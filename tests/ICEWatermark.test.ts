/**
 * ICEWatermark 规格：
 * - 按 gapX / gapY 平铺旋转文字，铺满自身尺寸（瓦片数量 = (⌈w/gapX⌉+1) × (⌈h/gapY⌉+1)）；
 * - 默认旋转 -22°，颜色为半透明；
 * - 不参与交互（不能挡住底下的点击）；
 * - setText / setSize 重排。
 */
import { ICEWatermark } from '../src/components/ICEWatermark';

describe('ICEWatermark', () => {
  it('平铺数量由 gap 决定，tile 带旋转', () => {
    const mark = new ICEWatermark({
      text: 'ICE 内部文档',
      width: 400,
      height: 200,
      gapX: 200,
      gapY: 100,
    });
    // ⌈400/200⌉+1 = 3 列；⌈200/100⌉+1 = 3 行
    expect(mark.getTileCount()).toBe(9);
    expect(mark.getTileNodes()[0].state.transform.rotate).toBe(-22);
    expect(mark.getTileNodes()[0].state.style.fillStyle).toContain('rgba');
  });

  it('不参与交互：interactive 为 false', () => {
    const mark = new ICEWatermark({ text: 'W', width: 200, height: 100 });
    expect(mark.state.interactive).toBe(false);
    expect(mark.state.clipChildren).toBe(true);
    expect(mark.getTileNodes().every((tile: any) => tile.state.interactive === false)).toBe(true);
  });

  it('setText 更新所有瓦片，setSize 重排数量', () => {
    const mark = new ICEWatermark({ text: '草稿', width: 400, height: 200, gapX: 200, gapY: 100 });
    mark.setText('已归档');
    expect(mark.getText()).toBe('已归档');
    expect(mark.getTileNodes().every((tile: any) => tile.getText() === '已归档')).toBe(true);
    mark.setSize(200, 100);
    expect(mark.state.width).toBe(200);
    expect(mark.state.height).toBe(100);
    expect(mark.getTileCount()).toBe(4); // ⌈200/200⌉+1 = 2 列 × 2 行
  });

  it('默认旋转与不透明度可覆盖', () => {
    const mark = new ICEWatermark({ text: 'X', width: 200, height: 100, rotate: 30, opacity: 0.2 });
    expect(mark.getTileNodes()[0].state.transform.rotate).toBe(30);
    expect(mark.getTileNodes()[0].state.style.globalAlpha ?? mark.getTileNodes()[0].state.opacity).toBe(0.2);
  });
});
