/**
 * ICESlider 区间模式 / 步进 / 键盘。
 *
 * 规格：
 * - `step` 量化取值（相对 min 对齐），setValue 也走量化；
 * - `range: true` 双滑块：getRangeValue / setRangeValue（各自夹取，反序自动交换）；
 * - 填充条画在两个滑块之间；
 * - `setValueFromRatio` 按「离哪个滑块近」拖动，且两个滑块不会互相穿过；
 * - 方向键按 step 调值（区间模式调当前滑块，默认下界）。
 */
import { ICESlider } from '../src/components/ICESlider';

function setupIce() {
  const handlers: Record<string, Array<{ handler: any; ctx: any }>> = {};
  const ice: any = {
    dirty: false,
    evtBus: {
      on(name: string, handler: any, ctx: any) {
        (handlers[name] = handlers[name] || []).push({ handler, ctx });
      },
      off(name: string, handler: any) {
        handlers[name] = (handlers[name] || []).filter((entry) => entry.handler !== handler);
      },
      trigger(name: string, evt: any) {
        (handlers[name] || []).forEach((entry) => entry.handler.call(entry.ctx, evt));
      },
    },
    screenToWorld: (x: number, y: number) => [x, y],
  };
  return { ice, handlers };
}

describe('ICESlider step 量化', () => {
  it('setValue 按 step 相对 min 对齐', () => {
    const slider = new ICESlider({ min: 0, max: 10, step: 2, value: 5, width: 200, height: 18 });
    slider.setValue(5.4);
    expect(slider.getValue()).toBe(6);
    slider.setValue(5.1);
    expect(slider.getValue()).toBe(6);
    slider.setValue(1.1);
    expect(slider.getValue()).toBe(2);
    slider.setValue(100);
    expect(slider.getValue()).toBe(10);
  });

  it('min 非 0 时也按 min 对齐', () => {
    const slider = new ICESlider({ min: 10, max: 20, step: 5, value: 10, width: 200, height: 18 });
    slider.setValue(12);
    expect(slider.getValue()).toBe(10);
    slider.setValue(13);
    expect(slider.getValue()).toBe(15);
  });
});

describe('ICESlider 区间模式', () => {
  it('手柄在两端取值时也不越出组件盒子（几何审计抓到过的溢出）', () => {
    const slider = new ICESlider({ range: true, min: 0, max: 100, value: [0, 100], width: 200, height: 18 });
    slider.getThumbs().forEach((thumb: any) => {
      const size = thumb.state.radius * 2;
      expect(thumb.state.left).toBeGreaterThanOrEqual(0);
      expect(thumb.state.left + size).toBeLessThanOrEqual(200);
    });
    // 单值最小值：手柄左缘贴在盒子左边（以前是 -半径）
    const single = new ICESlider({ value: 0, min: 0, max: 100, width: 200, height: 18 });
    expect(single.getThumbs()[0].state.left).toBe(0);
  });

  it('构造与取值：getRangeValue / getThumbs / 填充条在两滑块之间', () => {
    const slider = new ICESlider({ range: true, min: 0, max: 100, value: [20, 80], width: 200, height: 18 });
    expect(slider.isRange()).toBe(true);
    expect(slider.getRangeValue()).toEqual([20, 80]);
    expect(slider.getThumbs().length).toBe(2);
    expect(slider.getValue()).toBe(20); // 单值语义取下界，向后兼容

    const fill = slider.childNodes[1] as any;
    const [lo, hi] = slider.getRangeValue()!;
    // 填充条走的是「手柄圆心之间」那段行程：两端各让出半个手柄（18/2 = 9）
    const travel = 200 - 18;
    expect(fill.state.left).toBeCloseTo(9 + (lo / 100) * travel, 5);
    expect(fill.state.width).toBeCloseTo(((hi - lo) / 100) * travel, 5);
  });

  it('setRangeValue：各自夹取到 [min,max]，反序自动交换', () => {
    const slider = new ICESlider({ range: true, min: 0, max: 100, value: [20, 80], width: 200, height: 18 });
    slider.setRangeValue([120, 40]);
    expect(slider.getRangeValue()).toEqual([40, 100]);
    slider.setRangeValue([-10, 30]);
    expect(slider.getRangeValue()).toEqual([0, 30]);
  });

  it('setValueFromRatio：拖最近的滑块，且不会互相穿过', () => {
    const slider = new ICESlider({ range: true, min: 0, max: 100, value: [20, 80], width: 200, height: 18 });
    slider.setValueFromRatio(0.9);
    expect(slider.getRangeValue()).toEqual([20, 90]);
    slider.setValueFromRatio(0.1);
    expect(slider.getRangeValue()).toEqual([10, 90]);

    // 两个滑块不会互相穿过：下界往上推越过上界 → 夹在上界处
    slider.setValueFromRatio(0.95, 'lower');
    expect(slider.getRangeValue()).toEqual([90, 90]);
    slider.setRangeValue([20, 80]);
    slider.setValueFromRatio(0.05, 'upper');
    expect(slider.getRangeValue()).toEqual([20, 20]);
  });

  it('区间模式下 fill 随拖动更新；单值模式不受影响', () => {
    const slider = new ICESlider({ range: true, min: 0, max: 100, value: [0, 50], width: 200, height: 18 });
    const fill = slider.childNodes[1] as any;
    expect(fill.state.width).toBeCloseTo((50 / 100) * (200 - 18), 5);
    slider.setValueFromRatio(1, 'upper');
    expect(fill.state.width).toBeCloseTo(200 - 18, 5);

    const single = new ICESlider({ value: 30, min: 0, max: 100, width: 200, height: 18 });
    expect(single.isRange()).toBe(false);
    expect(single.getRangeValue()).toBeNull();
  });

  it('表单取值：区间模式返回数组，按 [下界, 上界] 回填', () => {
    const slider = new ICESlider({ range: true, min: 0, max: 100, value: [25, 75], width: 200, height: 18 });
    expect(slider.getFormValue()).toEqual([25, 75]);
    slider.setFormValue([10, 90]);
    expect(slider.getRangeValue()).toEqual([10, 90]);
    slider.setFormValue(60);
    expect(slider.getRangeValue()).toEqual([60, 60]);

    const single = new ICESlider({ value: 30, min: 0, max: 100, width: 200, height: 18 });
    expect(single.getFormValue()).toBe(30);
    single.setFormValue(40);
    expect(single.getValue()).toBe(40);
  });
});

describe('ICESlider 键盘', () => {
  it('方向键按 step 调值；区间模式默认调下界，可指定上界', () => {
    const { ice } = setupIce();
    const slider = new ICESlider({ min: 0, max: 100, step: 5, value: 50, width: 200, height: 18 });
    (slider as any).ice = ice;
    (slider as any).afterAddHandler();
    slider.setFocused(true);

    ice.evtBus.trigger('keydown', { key: 'ArrowRight' });
    expect(slider.getValue()).toBe(55);
    ice.evtBus.trigger('keydown', { key: 'ArrowLeft' });
    expect(slider.getValue()).toBe(50);

    const range = new ICESlider({ range: true, min: 0, max: 100, step: 10, value: [20, 80], width: 200, height: 18 });
    (range as any).ice = ice;
    (range as any).afterAddHandler();
    range.setFocused(true);
    ice.evtBus.trigger('keydown', { key: 'ArrowRight' });
    expect(range.getRangeValue()).toEqual([30, 80]);
    range.setActiveThumb('upper');
    ice.evtBus.trigger('keydown', { key: 'ArrowLeft' });
    expect(range.getRangeValue()).toEqual([30, 70]);
  });
});
