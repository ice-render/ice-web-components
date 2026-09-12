/**
 * UI 过渡单测（tween / fade / slide / scale）。
 *
 * 用注入的 frame driver 手动推进时间，断言与真实 rAF 无关 —— 只有确定性的数值。
 */
import { UIComponent } from '../src/core/UIComponent';
import { easeInOutCubic, easeOutCubic, fadeIn, fadeOut, fadeTo, scaleIn, slideIn, tween } from '../src/util/UIAnimation';

function makeDriver() {
  let queue: Array<(time: number) => void> = [];
  const driver = {
    request(callback: (time: number) => void) {
      queue.push(callback);
      return queue.length;
    },
    cancel(handle: any) {
      queue.splice(Number(handle) - 1, 1);
    },
  };
  return {
    driver,
    /** 推进一帧：把所有挂起的回调按给定时间戳执行 */
    step(time: number) {
      const pending = queue;
      queue = [];
      pending.forEach((callback) => callback(time));
    },
    pending: () => queue.length,
  };
}

describe('UIAnimation', () => {
  it('tween：线性补间按时间推进，结束时回调一次且不再产生帧', () => {
    const { driver, step } = makeDriver();
    const values: number[] = [];
    let finished = 0;
    tween({
      from: 0,
      to: 100,
      duration: 100,
      easing: 'linear',
      driver,
      onUpdate: (v) => values.push(v),
      onFinish: () => finished++,
    });

    step(0); // 起始帧
    step(50);
    step(100);
    expect(values).toEqual([0, 50, 100]);
    expect(finished).toBe(1);
    step(150); // 结束后不再有挂起帧
    expect(values).toEqual([0, 50, 100]);
  });

  it('tween：缓动函数按进度映射', () => {
    const { driver, step } = makeDriver();
    const values: number[] = [];
    tween({ from: 0, to: 1, duration: 100, easing: easeOutCubic, driver, onUpdate: (v) => values.push(v) });
    step(0);
    step(50);
    expect(values[1]).toBeCloseTo(easeOutCubic(0.5), 6); // 0.875
    expect(values[1]).toBeCloseTo(0.875, 6);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 6);
  });

  it('tween：delay 期间停在起始值，之后开始推进', () => {
    const { driver, step } = makeDriver();
    const values: number[] = [];
    tween({ from: 10, to: 20, duration: 100, delay: 50, driver, onUpdate: (v) => values.push(v) });
    step(0);
    step(30); // 仍在延迟期
    step(50); // elapsed = 0 → 起点
    step(100); // elapsed = 50 → 中点
    expect(values).toEqual([10, 10, 10, 15]);
  });

  it('tween：duration ≤ 0 同步落到终点；cancel 不触发 onFinish', () => {
    const { driver } = makeDriver();
    const values: number[] = [];
    let finished = 0;
    tween({ from: 0, to: 5, duration: 0, driver, onUpdate: (v) => values.push(v), onFinish: () => finished++ });
    expect(values).toEqual([5]);
    expect(finished).toBe(1);

    const { driver: driver2, step } = makeDriver();
    let finished2 = 0;
    const handle = tween({
      from: 0,
      to: 5,
      duration: 100,
      driver: driver2,
      onUpdate: () => {},
      onFinish: () => finished2++,
    });
    step(0);
    handle.cancel();
    step(200);
    expect(finished2).toBe(0);
  });

  it('fadeIn / fadeOut：写组件 state.opacity 并在结束时回调', () => {
    const { driver, step } = makeDriver();
    const node = new UIComponent({ width: 10, height: 10 });
    let done = 0;

    fadeIn(node, { duration: 100, driver, onFinish: () => done++ });
    expect(node.state.opacity).toBe(0); // 起始立刻置 0
    step(0);
    step(50);
    expect(node.state.opacity).toBeCloseTo(easeOutCubic(0.5), 6);
    step(100);
    expect(node.state.opacity).toBe(1);
    expect(done).toBe(1);

    fadeOut(node, { duration: 100, driver });
    step(200);
    step(300);
    expect(node.state.opacity).toBe(0);
  });

  it('fadeTo：从当前值出发（不强制归零）', () => {
    const { driver, step } = makeDriver();
    const node = new UIComponent({ width: 10, height: 10, opacity: 0.4 });
    fadeTo(node, 1, { duration: 100, easing: 'linear', driver });
    step(0);
    step(50);
    expect(node.state.opacity).toBeCloseTo(0.7, 6);
  });

  it('slideIn：从指定方向的偏移位置移到目标位置', () => {
    const { driver, step } = makeDriver();
    const node = new UIComponent({ left: 100, top: 50, width: 40, height: 20 });
    slideIn(node, { from: 'top', distance: 20, duration: 100, easing: 'linear', driver });
    expect(node.state.top).toBe(30); // 起始位置在目标上方 20
    expect(node.state.left).toBe(100);
    step(0);
    step(50);
    expect(node.state.top).toBeCloseTo(40, 6);
    step(100);
    expect(node.state.top).toBe(50);
    expect(node.state.opacity).toBe(1);
  });

  it('scaleIn：transform.scale 从 from 回到 1，并复位不透明度', () => {
    const { driver, step } = makeDriver();
    const node = new UIComponent({ width: 40, height: 20 });
    scaleIn(node, { from: 0.8, duration: 100, easing: 'linear', driver });
    expect(node.state.transform.scale).toEqual([0.8, 0.8]);
    step(0);
    step(50);
    expect(node.state.transform.scale[0]).toBeCloseTo(0.9, 6);
    step(100);
    expect(node.state.transform.scale).toEqual([1, 1]);
    expect(node.state.opacity).toBe(1);
  });
});
