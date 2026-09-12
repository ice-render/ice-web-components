import { EventBus } from 'ice-render';
import { UIHoverManager, UIButton, UIPanel } from '../src';

function hoverComponent(id: string, zIndex: number, contains: (x: number) => boolean) {
  return {
    state: { id, zIndex, interactive: true },
    childNodes: [],
    setHovered: jest.fn(),
    containsPoint: (x: number) => contains(x),
  };
}

describe('UIHoverManager', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('tracks the topmost hovered component on mousemove', () => {
    const bus = new EventBus();
    const left = hoverComponent('left', 1, (x) => x < 10);
    const right = hoverComponent('right', 2, (x) => x >= 10);
    const ice = {
      evtBus: bus,
      childNodes: [left, right],
      canvasEl: null,
      root: {},
      screenToWorld: (x: number, y: number) => [x, y],
    };

    const manager = new UIHoverManager(ice).start();
    bus.trigger('mousemove', { offsetX: 5, offsetY: 5 });
    jest.advanceTimersByTime(20);

    expect(left.setHovered).toHaveBeenCalledWith(true);
    expect(right.setHovered).not.toHaveBeenCalledWith(true);

    bus.trigger('mousemove', { offsetX: 15, offsetY: 5 });
    jest.advanceTimersByTime(20);

    expect(left.setHovered).toHaveBeenCalledWith(false);
    expect(right.setHovered).toHaveBeenCalledWith(true);
    manager.stop();
  });

  it('clears hover when stopped', () => {
    const bus = new EventBus();
    const target = hoverComponent('target', 1, () => true);
    const ice = {
      evtBus: bus,
      childNodes: [target],
      canvasEl: null,
      root: {},
      screenToWorld: (x: number, y: number) => [x, y],
    };

    const manager = new UIHoverManager(ice).start();
    bus.trigger('mousemove', { offsetX: 3, offsetY: 3 });
    jest.advanceTimersByTime(20);
    expect(target.setHovered).toHaveBeenCalledWith(true);

    manager.stop();
    expect(target.setHovered).toHaveBeenCalledWith(false);
  });
});

describe('UIHoverManager 工具层遮挡', () => {
  it('工具层里的可交互组件（遮罩/浮层）优先于组件层的组件', () => {
    const handlers: Record<string, any> = {};
    const ice: any = {
      childNodes: [],
      toolNodes: [],
      evtBus: {
        on(name: string, handler: any, ctx: any) {
          handlers[name] = { handler, ctx };
        },
        off() {},
      },
      screenToWorld: (x: number, y: number) => [x, y],
    };
    const button = new UIButton({ left: 0, top: 0, width: 100, height: 40, text: '下面' });
    ice.childNodes = [button];
    button.getMinBoundingBox(true); // 合成矩阵（真实流程里渲染后才做命中检测）
    const manager = new UIHoverManager(ice).start();

    handlers['mousemove'].handler.call(handlers['mousemove'].ctx, { offsetX: 20, offsetY: 20 });
    // 手动触发 __flush 的等价路径：直接调内部命中（rAF 在 node 环境里不会自动跑）
    (manager as any).__flush();
    expect(button.isHovered()).toBe(true);

    // 工具层放一个盖住它的遮罩 → hover 不应再落到按钮上
    const mask = new UIPanel({ left: 0, top: 0, width: 400, height: 400, radius: 0 });
    mask.getMinBoundingBox(true);
    ice.toolNodes = [mask];
    (manager as any).__flush();
    expect(button.isHovered()).toBe(false);
    expect(mask.isHovered()).toBe(true);
    manager.stop();
  });
});
