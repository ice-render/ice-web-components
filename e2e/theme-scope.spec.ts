/**
 * **局部主题作用域**：一棵子树单独一套主题（分屏大屏、暗底面板里嵌亮底卡片）。
 *
 * 为什么要有这个用例：作用域是**引擎**的能力（`props.theme` + `themeOf()` 沿祖先链合并），
 * 但库这层曾经只做了一半 —— 样式槽里的**主题引用**由引擎按 `themeOf()` 解析（跟随作用域），
 * 而**派生色与 painter 取色**走 `ICEWidget.theme()`，那里读的是**全局单例**（不跟随）。
 * 症状是"面板底色是深的、里面的骨架屏和列表还是浅的"，而且不会让任何单测变红。
 *
 * 判据全部落在**画布像素**上（painter 画的东西没有节点样式可读）：
 * - 同一组组件分别放进"有作用域"和"无作用域"的两个面板，颜色必须分属两套主题；
 * - 切页面主题时，**无作用域**那块跟着换、**有作用域**那块不换（这正是作用域的语义）。
 */
import { expect, test, type Page } from '@playwright/test';

/** 取节点在画布上的绝对左上角（祖先链的 left/top 累加）。 */
async function boxOf(page: Page, pick: string): Promise<{ l: number; t: number; w: number; h: number }> {
  return page.evaluate((expr) => {
    const node = eval(`window.__scope.${expr}`);
    let l = 0;
    let t = 0;
    let cur = node;
    while (cur && cur.state) {
      l += Number(cur.state.left) || 0;
      t += Number(cur.state.top) || 0;
      cur = cur.parentNode;
    }
    return { l, t, w: Number(node.state.width) || 0, h: Number(node.state.height) || 0 };
  }, pick);
}

/** 读画布上某点（相对节点盒左上角的偏移）的像素。 */
async function pixelAt(page: Page, pick: string, dx: number, dy: number): Promise<string> {
  const box = await boxOf(page, pick);
  return page.evaluate(
    ({ x, y }) => {
      const c = document.querySelector('#canvas') as HTMLCanvasElement;
      const rect = c.getBoundingClientRect();
      const scaleX = c.width / rect.width;
      const scaleY = c.height / rect.height;
      const ctx = c.getContext('2d')!;
      const d = ctx.getImageData(Math.round(x * scaleX), Math.round(y * scaleY), 1, 1).data;
      return `#${[d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
    },
    { x: box.l + dx, y: box.t + dy }
  );
}

/** 读节点样式的**解析后**颜色（引用会查表）。 */
async function styleColor(page: Page, pick: string, key: 'fillStyle' | 'strokeStyle' = 'fillStyle'): Promise<string> {
  return page.evaluate(
    ({ expr, k }) => {
      const W = (window as any).ICEWEB;
      return W.resolvedStyleColor(eval(`window.__scope.${expr}`), k);
    },
    { expr: pick, k: key }
  );
}

test.describe('局部主题作用域', () => {
  test('有/无作用域两块面板分属两套主题；切页面主题时只有无作用域那块跟着换', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

    await page.goto('/examples/theme-scope.html');
    await page.waitForFunction(() => !!(window as any).__scope);
    await page.waitForTimeout(600);

    const tokens = await page.evaluate(() => {
      const W = (window as any).ICEWEB;
      return {
        light: { surface: W.ICE_LIGHT_THEME.colors.surface },
        dark: { surface: W.ICE_DARK_THEME.colors.surface },
      };
    });

    /** 一次采样：两块面板的底色 + 两个 **painter 型** 组件的实际像素。 */
    const sample = async () => ({
      pagePanel: await styleColor(page, 'pagePanel'),
      darkPanel: await styleColor(page, 'darkPanel'),
      // ICEList 的行是 painter 画的（选中行底色 = primaryBg）→ 只能读像素
      pageListRow: await pixelAt(page, 'pageParts.list.childNodes[0]', 8, 12),
      darkListRow: await pixelAt(page, 'darkParts.list.childNodes[0]', 8, 12),
    });

    const light = await sample();
    expect(light.pagePanel, '左面板跟随页面主题（浅）').toBe(tokens.light.surface);
    expect(light.darkPanel, '右面板声明了深色作用域').toBe(tokens.dark.surface);
    expect(light.pageListRow, '左右两块面板的 painter 底色本就该不同').not.toBe(light.darkListRow);

    // 切页面主题 —— 作用域那块**不该**动
    await page.evaluate(() => (window as any).ICEWEB.iceUIManager.setTheme('dark'));
    await page.waitForTimeout(400);
    const dark = await sample();
    expect(dark.pagePanel, '无作用域：跟着页面换').toBe(tokens.dark.surface);
    expect(dark.darkPanel, '有作用域：保持自己那套').toBe(tokens.dark.surface);
    expect(dark.pageListRow, '无作用域：painter 也换（这是修好的回归点）').not.toBe(light.pageListRow);
    expect(dark.darkListRow, '有作用域：painter 不换').toBe(light.darkListRow);

    // 页面切回浅色：左面板回到浅色，右面板依旧深色且与之前逐像素一致
    await page.evaluate(() => (window as any).ICEWEB.iceUIManager.setTheme('light'));
    await page.waitForTimeout(400);
    const restored = await sample();
    expect(restored.pagePanel).toBe(light.pagePanel);
    expect(restored.darkPanel).toBe(tokens.dark.surface);
    expect(restored.darkListRow).toBe(light.darkListRow);

    expect(errors).toEqual([]);
  });
});
