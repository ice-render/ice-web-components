/**
 * **主题覆盖实测**：`setTheme('dark')` 之后，组件树里**到底有多少节点的颜色真的换了**。
 *
 * ## 为什么要有它
 *
 * `theme-refs.test.ts` 数的是源码里 `theme.colors.*` 的出现次数 —— 那只是个**代理指标**：
 * paint 回调里读 theme 本来就跟随，也照样被数进去；反过来 `iceUIManager.getTheme().colors.x`
 * 这种写法它又数不到（2026-09-17 就是靠这个用例把 `ICEDescriptions` / `ICETree` 的漏网抓出来的）。
 * 真正该看的是**画出来的颜色**：同一棵组件树，切主题前后逐节点比对 `resolvedStyleColor()`。
 *
 * ## 判据
 *
 * 逐节点取 `fillStyle` / `strokeStyle` 的**解析值**（引用会解析成实际色值），比较前后：
 * - 两侧都透明的节点（`rgba(0,0,0,0)` / `transparent` / 引擎默认 `fill:false`）不参与；
 * - 颜色没变的节点记为 **frozen**。frozen 里还要再分两类：
 *   - **引用形态**（`{$token}`）：天然跟随，颜色一样只是**两套主题同一个色**（如 primary `#0d6efd`）→ 不是缺陷；
 *   - **字面量**：只有"这个字面量恰好等于**浅色主题某一档、且那一档在暗色下不同**"才算可疑
 *     （`#212529` = 浅色 `text`，暗色里该变 `#dee2e6`）。`#ffffff` / `#000000` 是实底上的字
 *     （`getStatusColors().onSolid`）、`red` / `blue` 是引擎 `DEFAULT_PROPS.style` 的遗产默认值 —— 都不算。
 *
 * ## 读数（2026-09-17 迁移前后，同一页 gallery.html）
 *
 * | | 换色 | 未换 |
 * |---|---|---|
 * | 迁移前 | 306 / 1456 | **1150** |
 * | 迁移后 | 1195 / 1456 | 261（其中 135 是"两套主题同色"的引用） |
 *
 * 所以下面卡两件事：**可疑字面量必须为 0**，以及**换色节点数不许回退**。
 */
import { expect, test, type Page } from '@playwright/test';

/** 采样整棵组件树：类名 + 原始样式 + 解析后的填充/描边色。 */
async function sampleTree(page: Page): Promise<Record<string, { cls: string; fill: string; stroke: string; rawFill: any; rawStroke: any }>> {
  return page.evaluate(() => {
    const W = (window as any).ICEWEB;
    const r = (window as any).__result;
    const out: Record<string, any> = {};
    let seq = 0;
    const walk = (node: any, path: string) => {
      if (!node) return;
      // 明确标了 `__themeConstant` 的节点涂的是**内容色**（如 ICEColorPicker 的调色板色块），
      // 换主题时本就不该变 —— 不参与统计。
      if (node.__themeConstant === true) return;
      const id = `${path}#${seq++}`;
      const style = (node.state && node.state.style) || {};
      const cls =
        (node.constructor && node.constructor.name) ||
        (node.__className as string) ||
        'unknown';
      out[id] = {
        cls,
        fill: W.resolvedStyleColor(node, 'fillStyle'),
        stroke: W.resolvedStyleColor(node, 'strokeStyle'),
        rawFill: style.fillStyle,
        rawStroke: style.strokeStyle,
      };
      const kids = node.childNodes || [];
      for (let i = 0; i < kids.length; i++) walk(kids[i], `${id}.${i}`);
    };
    walk(r.ice || r.panel, 'root');
    return out;
  });
}

const transparent = (v: string) => !v || v === 'transparent' || /rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)/.test(v);

/**
 * 与主题无关的**常量色**（不算缺陷）：
 * - `#ffffff` / `#000000`：实底上的字（`getStatusColors().onSolid`，Bootstrap 的 `.text-bg-*` 就是黑/白字）；
 * - `red` / `blue`：引擎 `ICEComponent.DEFAULT_PROPS.style` 的遗产默认值（`fill:false` 的节点根本不画它）；
 * - `none`：图标路径的 `fillStyle`（只描边）。
 */
const ALWAYS_THEME_INDEPENDENT = new Set(['#ffffff', '#000000', 'red', 'blue', 'none']);

test.describe('主题覆盖（真机逐节点比对）', () => {
  test('切到暗色之后，几乎每个有颜色的节点都换了色', async ({ page }) => {
    await page.goto('/examples/gallery.html');
    await page.waitForFunction(() => !!(window as any).__result && !!(window as any).ICEWEB);
    await page.waitForTimeout(800);

    // 浅色主题里"有档位、且暗色下不同"的色值 —— 冻结的字面量只有命中这些才算可疑
    const lightOnly: string[] = await page.evaluate(() => {
      const W = (window as any).ICEWEB;
      const light = W.ICE_LIGHT_THEME.colors;
      const dark = W.ICE_DARK_THEME.colors;
      return Object.keys(light)
        .filter((k) => typeof light[k] === 'string' && dark[k] !== light[k])
        .map((k) => String(light[k]).toLowerCase());
    });
    const lightOnlySet = new Set(lightOnly);

    await page.evaluate(() => (window as any).ICEWEB.iceUIManager.setTheme('light'));
    await page.waitForTimeout(300);
    const before = await sampleTree(page);

    await page.evaluate(() => (window as any).ICEWEB.iceUIManager.setTheme('dark'));
    await page.waitForTimeout(400);
    const after = await sampleTree(page);

    const ids = Object.keys(before).filter((id) => after[id] !== undefined);
    let changed = 0;
    let skipped = 0;
    let frozenRefSameValue = 0;
    const suspect: string[] = [];
    const byClass: Record<string, number> = {};
    for (const id of ids) {
      const b = before[id];
      const a = after[id];
      if (transparent(b.fill) && transparent(b.stroke)) {
        skipped++;
        continue;
      }
      if (a.fill !== b.fill || a.stroke !== b.stroke) {
        changed++;
        continue;
      }
      // 冻结：引用形态天然跟随，颜色一样只说明两套主题同值
      if (b.rawFill && typeof b.rawFill === 'object') {
        frozenRefSameValue++;
        continue;
      }
      byClass[b.cls] = (byClass[b.cls] || 0) + 1;
      const literal = String(b.rawFill || '').toLowerCase();
      if (!ALWAYS_THEME_INDEPENDENT.has(literal) && lightOnlySet.has(literal)) {
        suspect.push(`${id} ${b.cls} fill=${b.fill} raw=${literal}`);
      }
    }

    const ranked = Object.entries(byClass).sort((a, b) => b[1] - a[1]);
    // eslint-disable-next-line no-console
    console.log(
      [
        `节点总数 ${ids.length}｜有色 ${ids.length - skipped}｜换色 ${changed}｜` +
          `未换 ${ids.length - skipped - changed}（引用同值 ${frozenRefSameValue}）｜透明跳过 ${skipped}`,
        '未换色的字面量节点（按类名）：',
        ...ranked.map(([c, n]) => `  ${String(n).padStart(3)}  ${c}`),
        `可疑（字面量 = 浅色档位，该跟没跟）：${suspect.length}`,
        ...suspect.slice(0, 20).map((s) => `  ${s}`),
      ].join('\n')
    );

    expect(suspect, '构造期抄成字面量的颜色：换了主题却没跟着变').toEqual([]);
    // 棘轮：换色节点数不许回退（2026-09-17 实测 1195；迁移前是 306）
    expect(changed).toBeGreaterThanOrEqual(Number(process.env.ICE_THEME_CHANGED_FLOOR ?? 1150));
  });

  /**
   * **样式值说变了 ≠ 屏幕上真的变了**。
   *
   * 上面那条用例读的是 `resolvedStyleColor()`（样式里解析出来的颜色），它**证明不了画布**：
   * 2026-09-17 的真实缺陷就是这么漏掉的 —— 换主题后文本仍贴着**烤进离屏位图的旧颜色**
   * （引擎的组件级缓存/静态层把旧图贴回来），而样式值早已是新主题的色。
   * 修复在引擎 2.14.1（`ICE.__recomposeTheme()` 调 `renderer.invalidateObjectCache()`）。
   *
   * 这条把两端钉在一起：**画布上找得到"样式里那个颜色"的像素**。
   */
  test('画出来的像素与样式里的颜色一致（位图缓存不许贴旧主题）', async ({ page }) => {
    await page.goto('/examples/gallery.html');
    await page.waitForFunction(() => !!(window as any).__result && !!(window as any).ICEWEB);
    await page.waitForTimeout(800);

    /**
     * 对每个文本节点：把它的**世界盒**投影到画布上撒点采样，看有没有像素等于
     * `resolvedStyleColor()` 报出来的颜色。找不到 = 画布上还留着旧颜色（位图过期）。
     *
     * ⚠️ 口径是**差分**的：只要求"**切换前找得到**的节点，切换后也必须找得到"。
     * 理由：滚动容器里的节点（大表头那一行就是）世界盒映射不到画布 —— 那是探针的局限，
     * 不是缺陷。差分口径把这类假阳性挡掉，同时又抓得住真问题：位图若是旧的，
     * 新颜色在画布上就一个像素都找不到。
     */
    /**
     * ⚠️ **切主题与读像素必须在两个 evaluate 之间**：在同一个 evaluate 里 `setTheme()` 之后立刻
     * `getImageData()`，读到的是**上一帧**的画布（新帧还没画）—— 实测会凭空多出 149 个"找不到"。
     */
    let prev: Record<string, string> = {};
    const sample = async (theme: 'light' | 'dark') => {
      await page.evaluate((t) => (window as any).ICEWEB.iceUIManager.setTheme(t), theme);
      await page.waitForTimeout(260); // 等两帧：一帧按新主题重画，一帧落定
      return page.evaluate(({ theme: t, prev }) => {
        const W = (window as any).ICEWEB;
        const canvas = document.querySelector('#canvas') as HTMLCanvasElement;
        const ctx = canvas.getContext('2d')!;
        const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        const parse = (v: string): [number, number, number] | null => {
          const m = /^#([0-9a-f]{6})$/i.exec(String(v).trim());
          if (!m) return null;
          const n = parseInt(m[1], 16);
          return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
        };
        const out: Array<{ key: string; color: string; found: boolean; oldColorInk: boolean; text: string }> = [];
        let seq = 0;
        const walk = (node: any, path: string) => {
          const st = node.state;
          const text = st && st.text;
          const id = `${path}#${seq++}`;
          if (typeof text === 'string' && text && st.style) {
            const color = W.resolvedStyleColor(node, 'fillStyle');
            const prevColor = prev[id] || color;
            const target = parse(color);
            const w = Number(st.width) || 0;
            const h = Number(st.height) || 0;
            if (target && w > 8 && h > 8) {
              let l = 0;
              let top = 0;
              let cur = node;
              while (cur && cur.state) {
                l += Number(cur.state.left) || 0;
                top += Number(cur.state.top) || 0;
                cur = cur.parentNode;
              }
              const origin = Array.isArray(st.localOrigin) ? st.localOrigin : [w / 2, h / 2];
              const x0 = l - origin[0];
              const y0 = top - origin[1];
              const dist = (t: [number, number, number], x: number, y: number): number => {
                const i = (y * canvas.width + x) * 4;
                return Math.abs(d[i] - t[0]) + Math.abs(d[i + 1] - t[1]) + Math.abs(d[i + 2] - t[2]);
              };
              // 新色：给抗锯齿留 24 的余量（字形核心是纯色）；
              // 旧色：**收紧到 6** —— 深色里有几档颜色彼此只差 ~10（`textDisabled #6c757d` vs 浅色
              // `textSecondary #6a7178`），容差 24 会把"别人画对了的颜色"误判成"这个节点的旧色还在"。
              const near = (t: [number, number, number], x: number, y: number): boolean => dist(t, x, y) <= 24;
              const nearExact = (t: [number, number, number], x: number, y: number): boolean => dist(t, x, y) <= 6;
              let hit = false;
              let oldHit = false;
              const prev = parse(prevColor);
              for (let gy = 0.15; gy <= 0.95; gy += 0.1) {
                for (let gx = 0.05; gx <= 0.95; gx += 0.05) {
                  const px = Math.round(x0 + w * gx);
                  const py = Math.round(y0 + h * gy);
                  if (px < 0 || py < 0 || px >= canvas.width || py >= canvas.height) continue;
                  if (near(target, px, py)) hit = true;
                  // 顺便看看**旧色**还在不在：这才是"位图没换"的铁证
                  if (prev && nearExact(prev, px, py)) oldHit = true;
                }
              }
              out.push({ key: id, color, found: hit, oldColorInk: oldHit, text: String(text).slice(0, 16) });
            }
          }
          (node.childNodes || []).forEach((c: any, i: number) => walk(c, `${id}.${i}`));
        };
        walk((window as any).__result.ice || (window as any).__result.panel, 'root');
        return out;
      }, { theme, prev });
    };

    const light = await sample('light');
    const prevByKey: Record<string, string> = {};
    for (const r of light) prevByKey[r.key] = r.color;
    prev = prevByKey;
    const dark = await sample('dark');

    const lightByKey = new Map(light.map((r) => [r.key, r]));
    const darkByKey = new Map(dark.map((r) => [r.key, r]));
    const stale: string[] = [];
    const inconclusive: string[] = [];
    let comparable = 0;
    for (const [key, before] of lightByKey) {
      const after = darkByKey.get(key);
      if (!after || !before.found) continue; // 切换前都找不到 → 探针局限，跳过
      if (before.color === after.color) continue; // 颜色没变的节点不该要求它变
      comparable++;
      if (after.found) continue;
      // 旧色还在框里 → **位图没换**（这才是缺陷）；新旧都没找到 → 采样没落在墨迹上（探针局限）
      if (after.oldColorInk) stale.push(`「${after.text}」${key}：画布上还是旧色 ${before.color}（样式已是 ${after.color}）`);
      else inconclusive.push(`${key}：样式 ${after.color} / 旧色 ${before.color} 都没采到`);
    }

    // eslint-disable-next-line no-console
    console.log(
      `像素对账：可比节点 ${comparable}｜位图没换（旧色还在）${stale.length}｜采样没落在墨迹上（探针局限）${inconclusive.length}`
    );
    expect({ 可比节点够多: comparable > 50 }).toEqual({ 可比节点够多: true });
    expect(stale).toEqual([]);
    // 探针局限必须有上限：超过说明采样口径坏了，而不是"图没问题"
    expect(inconclusive.length).toBeLessThanOrEqual(10);
  });
});
