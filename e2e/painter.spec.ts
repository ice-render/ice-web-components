import { expect, test } from '@playwright/test';

/**
 * painter（UI delegate）**真机**验证。
 *
 * 单测用假 ctx 只能证明"调了哪些画笔"，证明不了落点对不对（本地原点是组件中心、
 * CTM 在 `super.doRender()` 之后要取回 —— 这两件事都只有真渲染路径能证伪）。
 * 这里在真实画布上画一个头像，采样像素确认：圆内 = 主题主色、圆外角落 = 透明。
 */
test('painter 真机：头像的圆底画在组件盒子里（圆内是主色、圆外透明）', async ({ page }) => {
  await page.goto('/examples/custom-component.html');

  const sample = await page.evaluate(async () => {
    // 引擎的 init() 收 canvas 的 **id**（示例页写的是 init('canvas')），不是 CSS 选择器
    const canvas = document.createElement('canvas');
    canvas.id = 'painter-probe';
    canvas.width = 200;
    canvas.height = 200;
    canvas.style.width = '200px';
    canvas.style.height = '200px';
    document.body.appendChild(canvas);
    const ice = new (window as any).ICE.ICE().init('painter-probe');
    const W = (window as any).ICEWEB;
    const avatar = new W.ICEAvatar({ left: 10, top: 10, size: 80, text: 'A' });
    ice.addChild(avatar);
    // 等引擎跑完一帧（FrameManager 是 rAF 驱动）
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const ctx = canvas.getContext('2d');
    const read = (x: number, y: number) => Array.from(ctx.getImageData(x, y, 1, 1).data);
    return {
      primary: String(W.iceUIManager.getTheme().colors.primary),
      inside: read(50, 26), // 圆内、避开字形
      center: read(50, 50), // 圆心（字形所在处）
      corner: read(85, 14), // 方框角落（圆外）
    };
  });

  const hexToRgb = (hex: string) => {
    const value = hex.replace('#', '');
    return [
      parseInt(value.slice(0, 2), 16),
      parseInt(value.slice(2, 4), 16),
      parseInt(value.slice(4, 6), 16),
    ];
  };
  const [r, g, b] = hexToRgb(sample.primary);

  expect(sample.inside.slice(0, 3)).toEqual([r, g, b]); // 圆内就是主题主色
  expect(sample.inside[3]).toBe(255);
  expect(sample.center[3]).toBe(255); // 圆心有字形，不透明即可
  expect(sample.corner).toEqual([0, 0, 0, 0]); // 圆外角落透明 → 画的是"圆"不是方块
});
