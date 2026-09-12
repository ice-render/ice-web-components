/**
 * ICEModal 单测。
 *
 * 规格：
 * - 打开后：全屏遮罩（交互层，能挡住下方组件）+ 居中对话框（标题/内容/页脚按钮）；
 * - 模态期间焦点被限制在对话框内（复用 ICEFocusManager.setFocusScope），关闭后恢复原焦点；
 * - 关闭途径：遮罩点击（maskClosable）、Esc（closeOnEsc）、确定/取消、显式 close()；
 * - 确认/取消回调与 onClose 原因。
 */
import { ICEButton } from '../src/components/ICEButton';
import { ICEModal } from '../src/components/ICEModal';
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

function textsOf(node: any): string[] {
  const out: string[] = [];
  const walk = (current: any) => {
    const text = current.state && current.state.text;
    if (typeof text === 'string' && text && out.indexOf(text) === -1) {
      out.push(text);
    }
    (current.childNodes || []).forEach(walk);
  };
  walk(node);
  return out;
}

function setup(options: any = {}) {
  const ice = makeICE();
  const overlays = new ICEOverlayManager(ice);
  const focus = new ICEFocusManager(ice).start();
  const modal = new ICEModal(ice, {
    title: '标题',
    content: '正文',
    manager: overlays,
    focusManager: focus,
    animation: { duration: 0 },
    ...options,
  });
  return { ice, overlays, focus, modal };
}

describe('ICEModal', () => {
  it('打开后：全屏遮罩 + 居中对话框（标题/正文/页脚按钮）', () => {
    const { ice, overlays, modal } = setup();
    modal.open();
    expect(modal.isOpen()).toBe(true);

    const mask = modal.getMask()!;
    const dialog = modal.getDialog()!;
    expect(mask.state.width).toBe(800);
    expect(mask.state.height).toBe(600);
    expect(mask.state.interactive).toBe(true); // 遮罩要挡住下方组件
    const width = dialog.state.width;
    const height = dialog.state.height;
    expect(dialog.state.left).toBe((800 - width) / 2);
    expect(dialog.state.top).toBe((600 - height) / 2);
    expect(textsOf(dialog)).toEqual(['标题', '正文', '取消', '确定']);
    modal.close();
    expect(ice.toolNodes.length).toBeGreaterThan(0);
  });

  it('遮罩覆盖全屏、可交互、且在场景组件之上（命中检测会优先命中它）', () => {
    const ice = makeICE();
    const sceneButton = new ICEButton({ left: 100, top: 100, width: 120, height: 32, text: '下面' });
    ice.childNodes = [sceneButton];
    const overlays = new ICEOverlayManager(ice);
    const focus = new ICEFocusManager(ice).start();
    const modal = new ICEModal(ice, {
      title: '标题',
      content: '正文',
      manager: overlays,
      focusManager: focus,
      animation: { duration: 0 },
    });

    modal.open();
    const mask = modal.getMask()!;
    expect([mask.state.width, mask.state.height]).toEqual([800, 600]);
    expect(mask.state.interactive).toBe(true);
    // 引擎按 zIndex 命中/渲染：遮罩创建得比场景组件晚，zIndex 更高 → 挡住它
    expect(Number(mask.state.zIndex) > Number(sceneButton.state.zIndex)).toBe(true);
    modal.close();
  });

  it('焦点陷阱：打开后焦点在对话框内，关闭后恢复原焦点', () => {
    const { ice, focus, modal } = setup();
    const outside = new ICEButton({ left: 0, top: 0, width: 80, height: 32, text: '外部' });
    ice.childNodes = [outside];
    focus.focus(outside);

    modal.open();
    expect(focus.getFocusScope() === modal.getDialog()).toBe(true);
    const focused = focus.getFocused();
    expect(!!focused && focused !== outside).toBe(true); // 焦点已移进对话框

    modal.close();
    expect(focus.getFocusScope()).toBeNull();
    expect(focus.getFocused() === outside).toBe(true); // 恢复原先的焦点
  });

  it('关闭途径：遮罩点击 / Esc / 确定 / 取消，并回调对应处理器', () => {
    const calls: string[] = [];
    const first = setup({
      maskClosable: true,
      onClose: (reason: string) => calls.push('close:' + reason),
    });
    first.modal.open();
    first.modal.getMask()!.trigger('click', null, {});
    expect(first.modal.isOpen()).toBe(false);
    expect(calls).toEqual(['close:mask']);

    const second = setup({ onClose: (reason: string) => calls.push('close2:' + reason) });
    second.modal.open();
    second.ice.evtBus.trigger('keydown', { key: 'Escape' });
    expect(second.modal.isOpen()).toBe(false);
    expect(calls[1]).toBe('close2:esc');

    const third = setup({ onConfirm: () => calls.push('confirm'), onCancel: () => calls.push('cancel') });
    third.modal.open();
    third.modal.getConfirmButton()!.trigger('click', null, {});
    expect(calls).toContain('confirm');
    expect(third.modal.isOpen()).toBe(false);

    const fourth = setup({ onCancel: () => calls.push('cancel2') });
    fourth.modal.open();
    fourth.modal.getCancelButton()!.trigger('click', null, {});
    expect(calls).toContain('cancel2');
    expect(fourth.modal.isOpen()).toBe(false);
  });

  it('maskClosable=false 时点遮罩不关；showFooter=false 时没有页脚按钮', () => {
    const { modal } = setup({ maskClosable: false, showFooter: false });
    modal.open();
    expect(textsOf(modal.getDialog()!)).toEqual(['标题', '正文']);
    modal.getMask()!.trigger('click', null, {});
    expect(modal.isOpen()).toBe(true);
    modal.close();
  });
});
