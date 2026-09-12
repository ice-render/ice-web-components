/**
 * UIPopover / UIPopconfirm 单测。
 *
 * 规格：
 * - popover 默认 click 触发：点目标 toggle；点浮层外由 UIOverlayManager 关闭；
 * - hover 触发走进入/离开延时；
 * - 内容工厂每次弹出新建（浮层关闭会销毁内容）；onOpenChange 报开关；
 * - popconfirm 在 popover 之上加「取消/确定」，点按钮后自动关闭并回调。
 */
import { UIButton } from '../src/components/UIButton';
import { UIPopconfirm } from '../src/components/UIPopconfirm';
import { UIPopover } from '../src/components/UIPopover';
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

function collectText(node: any): string[] {
  const out: string[] = [];
  const walk = (current: any) => {
    // UILabel 与它内部的 ICEText 都带同一段 text，这里去重
    if (current.state && typeof current.state.text === 'string' && current.state.text && out.indexOf(current.state.text) === -1) {
      out.push(current.state.text);
    }
    (current.childNodes || []).forEach(walk);
  };
  walk(node);
  return out;
}

function lastLayerContent(manager: UIOverlayManager): any {
  const layer = manager.getLayer();
  return layer ? layer.childNodes[layer.childNodes.length - 1] : null;
}

describe('UIPopover', () => {
  it('click 触发：点目标打开、再点关闭（toggle），内容含标题与正文', () => {
    const ice = makeICE();
    const manager = new UIOverlayManager(ice);
    const target = new UIButton({ left: 10, top: 10, width: 96, height: 32, text: '更多' });
    const popover = new UIPopover(ice, target, {
      title: '标题',
      content: '正文内容',
      manager,
      enterAnimation: 'none',
      exitAnimation: 'none',
    }).start();

    target.trigger('click', null, {});
    expect(popover.isOpen()).toBe(true);
    expect(collectText(lastLayerContent(manager))).toEqual(['标题', '正文内容']);

    target.trigger('click', null, {});
    expect(popover.isOpen()).toBe(false);
    popover.destroy();
  });

  it('点浮层与目标之外关闭（交给 UIOverlayManager）', () => {
    const ice = makeICE();
    const manager = new UIOverlayManager(ice);
    const target = new UIButton({ left: 10, top: 10, width: 96, height: 32, text: '更多' });
    const popover = new UIPopover(ice, target, { content: 'x', manager, exitAnimation: 'none' }).start();

    target.trigger('click', null, {});
    expect(popover.isOpen()).toBe(true);
    ice.evtBus.trigger('mousedown', { offsetX: 700, offsetY: 500 });
    expect(popover.isOpen()).toBe(false);
    popover.destroy();
  });

  it('hover 触发：进入延时后打开、离开延时后关闭', () => {
    jest.useFakeTimers();
    const ice = makeICE();
    const manager = new UIOverlayManager(ice);
    const target = new UIButton({ left: 0, top: 0, width: 80, height: 32, text: 't' });
    const popover = new UIPopover(ice, target, {
      content: '悬停内容',
      trigger: 'hover',
      manager,
      mouseEnterDelay: 120,
      mouseLeaveDelay: 60,
      exitAnimation: 'none',
    }).start();

    target.setHovered(true);
    jest.advanceTimersByTime(100);
    expect(popover.isOpen()).toBe(false);
    jest.advanceTimersByTime(40);
    expect(popover.isOpen()).toBe(true);
    target.setHovered(false);
    jest.advanceTimersByTime(80);
    expect(popover.isOpen()).toBe(false);
    popover.destroy();
    jest.useRealTimers();
  });

  it('内容工厂每次弹出新建；onOpenChange 报开关；destroy 后不再响应', () => {
    const ice = makeICE();
    const manager = new UIOverlayManager(ice);
    const target = new UIButton({ left: 0, top: 0, width: 80, height: 32, text: 't' });
    let created = 0;
    const changes: boolean[] = [];
    const popover = new UIPopover(ice, target, {
      content: () => {
        created += 1;
        const { UIPanel } = require('../src/components/UIPanel');
        return new UIPanel({ width: 40, height: 20 });
      },
      manager,
      enterAnimation: 'none',
      exitAnimation: 'none',
      onOpenChange: (open) => changes.push(open),
    }).start();

    target.trigger('click', null, {});
    target.trigger('click', null, {});
    target.trigger('click', null, {});
    expect(created).toBe(2);
    expect(changes).toEqual([true, false, true]);

    popover.destroy();
    target.trigger('click', null, {});
    expect(created).toBe(2);
  });
});

describe('UIPopconfirm', () => {
  function setup(options: any = {}) {
    const ice = makeICE();
    const manager = new UIOverlayManager(ice);
    const target = new UIButton({ left: 0, top: 0, width: 96, height: 32, text: '删除' });
    const confirm = new UIPopconfirm(ice, target, {
      title: '确认删除？',
      description: '删除后不可恢复',
      manager,
      enterAnimation: 'none',
      exitAnimation: 'none',
      ...options,
    }).start();
    target.trigger('click', null, {});
    const panel = lastLayerContent(manager);
    const buttons = (panel.childNodes || []).filter((node: any) => node.state && node.state.text);
    return { ice, manager, target, confirm, panel, buttons };
  }

  it('弹出内容包含标题、说明与两个按钮', () => {
    const { panel, confirm } = setup();
    expect(confirm.isOpen()).toBe(true);
    expect(collectText(panel)).toEqual(['确认删除？', '删除后不可恢复', '取消', '确定']);
  });

  it('点确定 → onConfirm 并关闭；点取消 → onCancel 并关闭', () => {
    const calls: string[] = [];
    const first = setup({ onConfirm: () => calls.push('confirm'), onCancel: () => calls.push('cancel') });
    const confirmButton = first.buttons.find((b: any) => b.state.text === '确定');
    confirmButton.trigger('click', null, {});
    expect(calls).toEqual(['confirm']);
    expect(first.confirm.isOpen()).toBe(false);

    const second = setup({ onConfirm: () => calls.push('confirm2'), onCancel: () => calls.push('cancel2') });
    const cancelButton = second.buttons.find((b: any) => b.state.text === '取消');
    cancelButton.trigger('click', null, {});
    expect(calls).toEqual(['confirm', 'cancel2']);
    expect(second.confirm.isOpen()).toBe(false);
  });
});
