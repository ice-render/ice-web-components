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
});
