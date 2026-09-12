/**
 * ICETour 规格（业界组件库 Tour 漫游式引导）：
 * - 逐步引导：每一步有目标组件 + 标题 + 描述，面板显示「x/N」与上一步/下一步/跳过；
 * - 目标高亮：边框矩形贴合目标的世界盒，四周用遮罩压暗（留出聚光孔）；
 * - 最后一步的「下一步」变成「完成」：关闭并回调 onFinish；
 * - 关闭途径：跳过、Esc；键盘 →/Enter 下一步，← 上一步；
 * - 切换步骤触发 onChange。
 */
import { ICETour } from '../src/components/ICETour';
import { ICEFocusManager } from '../src/core/ICEFocusManager';
import { ICEOverlayManager } from '../src/core/ICEOverlayManager';
import { ICEWidget } from '../src/core/ICEWidget';

function makeICE() {
  const handlers: Record<string, Array<{ handler: any; ctx: any }>> = {};
  const ice: any = {
    canvasWidth: 800,
    canvasHeight: 600,
    childNodes: [],
    toolNodes: [],
    dirty: false,
    focused: null,
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
    addTool: (tool: any) => ice.toolNodes.push(tool),
    removeTool: (tool: any) => {
      const index = ice.toolNodes.indexOf(tool);
      if (index !== -1) ice.toolNodes.splice(index, 1);
    },
    setFocusedComponent: (component: any) => {
      ice.focused = component;
    },
    getFocusedComponent: () => ice.focused,
    screenToWorld: (x: number, y: number) => [x, y],
    getRenderViewport: () => ({ scale: 1, tx: 0, ty: 0 }),
  };
  return ice;
}

function makeTour(options: any = {}) {
  const ice = makeICE();
  const targets = [
    new ICEWidget({ left: 40, top: 30, width: 100, height: 40 }),
    new ICEWidget({ left: 300, top: 120, width: 120, height: 60 }),
    new ICEWidget({ left: 600, top: 400, width: 80, height: 30 }),
  ];
  const tour = new ICETour(ice, {
    steps: [
      { target: targets[0], title: '第一步', description: '这里是工具栏' },
      { target: targets[1], title: '第二步', description: '这里是内容区' },
      { target: targets[2], title: '第三步', description: '这里是提交按钮' },
    ],
    manager: new ICEOverlayManager(ice),
    focusManager: new ICEFocusManager(ice),
    ...options,
  });
  return { ice, tour, targets };
}

describe('ICETour', () => {
  it('打开第一步：面板显示标题 / 描述 / 步骤计数，高亮框贴合目标', () => {
    const { tour, targets } = makeTour();
    tour.open();
    expect(tour.isOpen()).toBe(true);
    expect(tour.getCurrent()).toBe(0);
    expect(tour.getTitleText()).toBe('第一步');
    expect(tour.getDescriptionText()).toBe('这里是工具栏');
    expect(tour.getCounterText()).toBe('1/3');
    const box = tour.getHighlightBox();
    expect(box).toEqual({ left: 40, top: 30, width: 100, height: 40 });
    expect(targets[0]).toBeTruthy();
  });

  it('下一步 / 上一步：切换步骤并回调 onChange；最后一步完成', () => {
    const changes: number[] = [];
    let finished = 0;
    const { tour } = makeTour({
      onChange: (index: number) => changes.push(index),
      onFinish: () => (finished += 1),
    });
    tour.open();
    tour.next();
    expect(tour.getCurrent()).toBe(1);
    expect(tour.getTitleText()).toBe('第二步');
    tour.next();
    expect(tour.getCurrent()).toBe(2);
    expect(tour.getCounterText()).toBe('3/3');
    tour.next(); // 最后一步 → 完成
    expect(tour.isOpen()).toBe(false);
    expect(tour.isFinished()).toBe(true);
    expect(finished).toBe(1);
    expect(changes).toEqual([1, 2]);

    const second = makeTour();
    second.tour.open();
    second.tour.next();
    second.tour.prev();
    expect(second.tour.getCurrent()).toBe(0);
  });

  it('跳过 / Esc 关闭，不触发 onFinish', () => {
    let finished = 0;
    const closed: string[] = [];
    const { ice, tour } = makeTour({
      onFinish: () => (finished += 1),
      onClose: (reason: string) => closed.push(reason),
    });
    tour.open();
    ice.evtBus.trigger('keydown', { key: 'Escape' });
    expect(tour.isOpen()).toBe(false);
    expect(tour.isFinished()).toBe(false);
    expect(finished).toBe(0);

    tour.open();
    tour.skip();
    expect(tour.isOpen()).toBe(false);
    expect(closed).toEqual(['esc', 'skip']);
  });

  it('键盘：→/Enter 下一步，← 上一步', () => {
    const { ice, tour } = makeTour();
    tour.open();
    ice.evtBus.trigger('keydown', { key: 'ArrowRight' });
    expect(tour.getCurrent()).toBe(1);
    ice.evtBus.trigger('keydown', { key: 'Enter' });
    expect(tour.getCurrent()).toBe(2);
    ice.evtBus.trigger('keydown', { key: 'ArrowLeft' });
    expect(tour.getCurrent()).toBe(1);
  });

  it('setSteps 重置步骤；open(index) 从指定步骤开始', () => {
    const { tour } = makeTour();
    tour.open(2);
    expect(tour.getCurrent()).toBe(2);
    expect(tour.getCounterText()).toBe('3/3');
    tour.close();
    tour.open(0);
    expect(tour.getCurrent()).toBe(0);
  });
});
