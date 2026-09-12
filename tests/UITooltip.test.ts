/**
 * UITooltip 单测。
 *
 * 规格：
 * - 悬停进入延时后弹出（内容贴在目标旁边，走 UIOverlayManager 的定位）；
 * - 悬停离开延时后关闭；离开发生在进入延时之前则**不弹**（延时被打断）；
 * - 内容可以是字符串（自动包成小面板）或现成组件（每次弹出新建，因为浮层关闭会销毁内容）；
 * - destroy() 解绑，之后不再响应 hover。
 */
import { UIButton } from '../src/components/UIButton';
import { UITooltip } from '../src/components/UITooltip';
import { UIOverlayManager } from '../src/core/UIOverlayManager';

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

/** 每次调用重置 OverlayManager 的单例缓存（测试之间互不影响）。 */
function freshManager(ice: any): UIOverlayManager {
  return new UIOverlayManager(ice);
}

describe('UITooltip', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('悬停延时后弹出，位置贴住目标；离开延时后关闭', () => {
    const ice = makeICE();
    const manager = freshManager(ice);
    const target = new UIButton({ left: 100, top: 100, width: 96, height: 32, text: 'Hover me' });
    const tooltip = new UITooltip(ice, target, {
      title: '提示内容',
      manager,
      mouseEnterDelay: 100,
      mouseLeaveDelay: 80,
    }).start();

    target.setHovered(true);
    jest.advanceTimersByTime(60);
    expect(tooltip.isOpen()).toBe(false); // 延时未到
    jest.advanceTimersByTime(60);
    expect(tooltip.isOpen()).toBe(true);

    const content = manager.getLayer().childNodes[manager.getLayer().childNodes.length - 1];
    expect(content.state.left).toBe(100); // bottomLeft 对齐锚点左边
    expect(content.state.top).toBe(132 + 8); // 目标底边 + offset
    // 内容里应当有提示文案
    const texts: string[] = [];
    const walk = (node: any) => {
      if (node.state && typeof node.state.text === 'string') texts.push(node.state.text);
      (node.childNodes || []).forEach(walk);
    };
    walk(content);
    expect(texts).toContain('提示内容');

    target.setHovered(false);
    jest.advanceTimersByTime(100);
    expect(tooltip.isOpen()).toBe(false);
    tooltip.destroy();
  });

  it('进入延时未到就离开 → 不弹出', () => {
    const ice = makeICE();
    const manager = freshManager(ice);
    const target = new UIButton({ left: 0, top: 0, width: 80, height: 32, text: 't' });
    const tooltip = new UITooltip(ice, target, { title: 'x', manager, mouseEnterDelay: 200 }).start();

    target.setHovered(true);
    jest.advanceTimersByTime(100);
    target.setHovered(false);
    jest.advanceTimersByTime(500);
    expect(tooltip.isOpen()).toBe(false);
    tooltip.destroy();
  });

  it('custom content：每次弹出新建组件（浮层关闭会销毁内容）', () => {
    const ice = makeICE();
    const manager = freshManager(ice);
    const target = new UIButton({ left: 0, top: 0, width: 80, height: 32, text: 't' });
    let created = 0;
    const tooltip = new UITooltip(ice, target, {
      content: () => {
        created += 1;
        const { UIPanel } = require('../src/components/UIPanel');
        return new UIPanel({ width: 60, height: 24 });
      },
      manager,
      mouseEnterDelay: 0,
      mouseLeaveDelay: 0,
    }).start();

    target.setHovered(true);
    jest.advanceTimersByTime(0);
    expect(created).toBe(1);
    target.setHovered(false);
    jest.advanceTimersByTime(0);
    target.setHovered(true);
    jest.advanceTimersByTime(0);
    expect(created).toBe(2);
    tooltip.destroy();
  });

  it('destroy() 后不再响应 hover', () => {
    const ice = makeICE();
    const manager = freshManager(ice);
    const target = new UIButton({ left: 0, top: 0, width: 80, height: 32, text: 't' });
    const tooltip = new UITooltip(ice, target, { title: 'x', manager, mouseEnterDelay: 0 }).start();
    tooltip.destroy();
    target.setHovered(true);
    jest.advanceTimersByTime(50);
    expect(tooltip.isOpen()).toBe(false);
  });
});
