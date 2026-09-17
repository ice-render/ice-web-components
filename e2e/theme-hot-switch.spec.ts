/**
 * **热切换**：`iceUIManager.setTheme()` 之后，界面在**不重建组件树**的前提下换色。
 *
 * 这是 2026-09-17 那轮改造的验收判据。改造前组件是**构造期**把 token 抄成字面量的，
 * 所以"换主题"只能重建整棵树（`ice-agent-console` / `ice-smart-water` 两个应用都因此
 * 退到"存偏好 + 重新加载"）。现在：
 *
 * 1. `applyThemeToEngine()` 把**整份 UI token 树**塞进引擎主题（落在 `semantic.ui`）；
 * 2. 组件样式改成**主题引用**（`token('ui.colors.x')`）—— 引擎在 **paint 时**解析；
 * 3. `iceUIManager.setTheme()` 广播到所有登记过的引擎实例（登记由组件挂载时兜底完成）。
 *
 * 于是换主题 = `setTheme` + 标脏 + 下一帧重画。这个用例钉住三件事：
 * - **画面真的变了**（canvas 指纹变化，不只是某个字段变了）；
 * - **组件树没被重建**（切换前在节点上打一个标记，切换后还在）；
 * - **颜色确实换成了新主题那一档**（用公开的 `resolvedStyleColor()` 读"画出来的颜色"，
 *   而不是读样式里存的引用对象 —— 后者是 `{$token}`，人眼看不出对错）。
 */
import { expect, test, type Page } from '@playwright/test';

/** 画布内容指纹（采样，和家族其它仓同一口径）。 */
async function canvasSignature(page: Page, selector: string): Promise<string> {
  return page.evaluate((sel) => {
    const canvas = document.querySelector(sel) as HTMLCanvasElement | null;
    if (!canvas || !canvas.width || !canvas.height) return 'no-canvas';
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'no-ctx';
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let hash = 2166136261;
    for (let i = 0; i < data.length; i += 97) {
      hash ^= data[i];
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16);
  }, selector);
}

test.describe('热切换（setTheme 不重建组件树）', () => {
  test('gallery：同一棵组件树换色、画面真的变了、颜色换成新主题那一档', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

    await page.goto('/examples/gallery.html');
    await page.waitForFunction(() => !!(window as any).__result && !!(window as any).ICEWEB);
    await page.waitForTimeout(800);

    /** 读一份"用户看得见的事实"：主题名 / 画布指纹 / 两个组件的**解析后**颜色 + 实例标记。 */
    const snapshot = async () =>
      page.evaluate(() => {
        const W = (window as any).ICEWEB;
        const r = (window as any).__result;
        const colorOf = (node: any) =>
          node ? W.resolvedStyleColor(node.childNodes && node.childNodes.length ? node.childNodes[0] : node, 'fillStyle') : '';
        return {
          themeName: W.iceUIManager.getThemeName(),
          // 分隔条（`ICESplitter` 的分隔节点）与统计数（`ICEStatistic`）：颜色都直接来自 token。
          // ⚠️ 别拿 `backTop` 当探针 —— 它是主色**底**上的字（`primaryText`），两套主题下都是白色，
          // 断言"颜色要变"会假红（踩过）；也别拿示例页自己传了 style 的组件（那是应用侧写死的颜色，
          // 压根不该跟随 —— `typographyTitle` 就是这种情况）。
          splitterColor: colorOf(r.splitter.getDividerNode()),
          statisticColor: colorOf(r.statistic),
          /** 切换前打的标记：还在 = 组件树没被重建 */
          mark: (r.panel as any).__hotSwitchMark ?? null,
        };
      });

    const before = await snapshot();
    const beforeSignature = await canvasSignature(page, '#canvas');
    expect(before.themeName).toBe('light');

    // 打标记（下一步据此判断"有没有被重建"）
    await page.evaluate(() => {
      (window as any).__result.panel.__hotSwitchMark = 'keep-me';
    });

    // 真调用库的 API 切主题 —— 不重建、不刷新页面
    await page.evaluate(() => (window as any).ICEWEB.iceUIManager.setTheme('dark'));
    await page.waitForTimeout(400);

    const after = await snapshot();
    const afterSignature = await canvasSignature(page, '#canvas');

    expect(after.themeName).toBe('dark');
    expect(after.mark, '组件树不该被重建（标记要还在）').toBe('keep-me');
    expect(afterSignature, '画面指纹应当变化').not.toBe(beforeSignature);
    expect(after.splitterColor, '分隔条颜色要换成暗色主题那一档').not.toBe(before.splitterColor);
    expect(after.statisticColor, '统计数的颜色也要跟着换').not.toBe(before.statisticColor);

    // 切回来：颜色回到浅色那一档，组件树依然没重建
    await page.evaluate(() => (window as any).ICEWEB.iceUIManager.setTheme('light'));
    await page.waitForTimeout(400);
    const restored = await snapshot();
    expect(restored.themeName).toBe('light');
    expect(restored.splitterColor).toBe(before.splitterColor);
    expect(restored.statisticColor).toBe(before.statisticColor);
    expect(restored.mark).toBe('keep-me');

    expect(errors).toEqual([]);
  });

  test('库的读数接口读的是"画出来的颜色"，不是样式里的引用对象', async ({ page }) => {
    await page.goto('/examples/gallery.html');
    await page.waitForFunction(() => !!(window as any).__result && !!(window as any).ICEWEB);
    await page.waitForTimeout(600);

    const probe = await page.evaluate(() => {
      const W = (window as any).ICEWEB;
      const r = (window as any).__result;
      const node = r.splitter.getDividerNode();
      const raw = node.state.style.fillStyle;
      return {
        rawIsRef: !!raw && typeof raw === 'object' && typeof raw.$token === 'string',
        rawPath: raw && raw.$token ? raw.$token : null,
        resolved: W.resolvedStyleColor(node, 'fillStyle'),
      };
    });

    // 样式里存的是主题引用（这是热切换的实现方式），而读数接口给出的是可比较的色值
    expect(probe.rawPath).toMatch(/^ui\.colors\./);
    expect(probe.resolved).toMatch(/^#|^rgba?\(/);
  });
});
