/**
 * ICEDrawer 单测。
 *
 * 规格：
 * - 遮罩铺满可见区域（可交互、挡住下方），面板贴指定边缘、沿该方向占满；
 * - 关闭途径：遮罩点击（maskClosable）/ Esc（closeOnEsc）/ ✕ 按钮 / 显式 close()，onClose 回传原因；
 * - 焦点被限制在抽屉内（复用 ICEFocusManager.setFocusScope），关闭后恢复原焦点。
 */
import { ICEButton } from '../src/components/ICEButton';
import { ICEDrawer } from '../src/components/ICEDrawer';
import { ICEFocusManager } from '../src/core/ICEFocusManager';
import { ICEOverlayManager } from '../src/core/ICEOverlayManager';

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

function texts(node: any): string[] {
  const out: string[] = [];
  const walk = (current: any) => {
    const text = current.state && current.state.text;
    if (typeof text === 'string' && text && out.indexOf(text) === -1) out.push(text);
    (current.childNodes || []).forEach(walk);
  };
  walk(node);
  return out;
}

function setup(options: any = {}) {
  const ice = makeICE();
  const overlays = new ICEOverlayManager(ice);
  const focus = new ICEFocusManager(ice).start();
  const drawer = new ICEDrawer(ice, {
    title: '标题',
    content: '正文',
    manager: overlays,
    focusManager: focus,
    animation: { duration: 0 },
    ...options,
  });
  return { ice, overlays, focus, drawer };
}

describe('ICEDrawer', () => {
  it('默认右侧：遮罩全屏、面板贴右边缘并占满高度', () => {
    const { drawer } = setup();
    drawer.open();
    expect(drawer.isOpen()).toBe(true);

    const mask = drawer.getMask()!;
    const panel = drawer.getPanel()!;
    expect([mask.state.width, mask.state.height]).toEqual([800, 600]);
    expect(mask.state.interactive).toBe(true);
    expect(panel.state.width).toBe(360);
    expect(panel.state.left).toBe(440); // 800 - 360
    expect(panel.state.top).toBe(0);
    expect(panel.state.height).toBe(600);
    // 元素顺序按加入顺序（标题 → ✕ → 正文），这里只关心集合
    expect(texts(panel).slice().sort()).toEqual(['标题', '正文', '✕'].sort());
    drawer.close();
  });

  it('四个方向贴边位置正确', () => {
    const left = setup({ placement: 'left', width: 300 });
    left.drawer.open();
    expect(left.drawer.getPanel()!.state.left).toBe(0);
    expect(left.drawer.getPanel()!.state.width).toBe(300);

    const bottom = setup({ placement: 'bottom', height: 220 });
    bottom.drawer.open();
    expect(bottom.drawer.getPanel()!.state.top).toBe(380); // 600 - 220
    expect(bottom.drawer.getPanel()!.state.width).toBe(800);

    const top = setup({ placement: 'top', height: 180 });
    top.drawer.open();
    expect(top.drawer.getPanel()!.state.top).toBe(0);
    expect(top.drawer.getPanel()!.state.height).toBe(180);
  });

  it('关闭途径与原因：遮罩 / Esc / ✕ / 显式', () => {
    const reasons: string[] = [];
    const first = setup({ onClose: (reason: string) => reasons.push(reason) });
    first.drawer.open();
    first.drawer.getMask()!.trigger('click', null, {});
    expect(first.drawer.isOpen()).toBe(false);
    expect(reasons).toEqual(['mask']);

    const second = setup({ onClose: (reason: string) => reasons.push(reason) });
    second.drawer.open();
    second.ice.evtBus.trigger('keydown', { key: 'Escape' });
    expect(second.drawer.isOpen()).toBe(false);
    expect(reasons[1]).toBe('esc');

    const third = setup({ onClose: (reason: string) => reasons.push(reason) });
    third.drawer.open();
    third.drawer.getCloseButton()!.trigger('click', null, {});
    expect(third.drawer.isOpen()).toBe(false);
    expect(reasons[2]).toBe('close');

    const fourth = setup({ maskClosable: false, onClose: (reason: string) => reasons.push(reason) });
    fourth.drawer.open();
    fourth.drawer.getMask()!.trigger('click', null, {});
    expect(fourth.drawer.isOpen()).toBe(true);
    fourth.drawer.close();
    expect(reasons[3]).toBe('api');
  });

  it('焦点陷阱：打开后焦点在抽屉内，关闭后恢复原焦点', () => {
    const { ice, focus, drawer } = setup();
    const outside = new ICEButton({ left: 0, top: 0, width: 80, height: 32, text: '外部' });
    ice.childNodes = [outside];
    focus.focus(outside);

    drawer.open();
    expect(focus.getFocusScope() === drawer.getPanel()).toBe(true);
    expect(focus.getFocused() === outside).toBe(false);

    drawer.close();
    expect(focus.getFocusScope()).toBeNull();
    expect(focus.getFocused() === outside).toBe(true);
  });

  it('closable=false 时不渲染 ✕；重复 open 幂等', () => {
    const { drawer } = setup({ closable: false });
    drawer.open();
    drawer.open();
    expect(drawer.getCloseButton()).toBeNull();
    expect(texts(drawer.getPanel()!)).toEqual(['标题', '正文']);
    drawer.close();
    expect(drawer.isOpen()).toBe(false);
  });
});
