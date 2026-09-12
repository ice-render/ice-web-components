/**
 * 焦点与键盘导航单测（UIFocusManager）。
 *
 * 契约：
 * - 只有「可聚焦控件」参与 Tab 轮转：容器/展示组件不参与，禁用的控件跳过；
 * - Tab / Shift+Tab 按文档序循环（含首尾回绕）；Esc 取消焦点；
 * - Enter / Space 激活当前焦点控件（调用它的 activate()）；
 * - 鼠标点击控件会聚焦它，点击非控件区域取消焦点；
 * - 焦点同步到引擎（setFocusedComponent），以便引擎把后续键盘事件派发给它；
 * - 焦点环画在工具层（非交互、跟随焦点组件的位置与尺寸）。
 */
import { UIButton } from '../src/components/UIButton';
import { UICheckBox } from '../src/components/UICheckBox';
import { UIPanel } from '../src/components/UIPanel';
import { UISwitch } from '../src/components/UISwitch';
import { UIFocusManager } from '../src/core/UIFocusManager';

function makeICE() {
  const handlers: Record<string, Array<{ handler: any; ctx: any }>> = {};
  const ice: any = {
    canvasWidth: 800,
    canvasHeight: 600,
    childNodes: [],
    toolNodes: [],
    dirty: false,
    focused: null as any,
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
    addTool(tool: any) {
      ice.toolNodes.push(tool);
    },
    removeTool(tool: any) {
      const index = ice.toolNodes.indexOf(tool);
      if (index !== -1) ice.toolNodes.splice(index, 1);
    },
    setFocusedComponent(component: any) {
      ice.focused = component;
      return ice;
    },
    getFocusedComponent() {
      return ice.focused;
    },
    screenToWorld: (x: number, y: number) => [x, y],
    getRenderViewport: () => ({ scale: 1, tx: 0, ty: 0 }),
    hitTest: null as any,
  };
  return ice;
}

/** 造一棵：panel > [button, checkbox, switch]，并挂到 ice 上。 */
function makeScene() {
  const ice = makeICE();
  const panel = new UIPanel({ left: 0, top: 0, width: 400, height: 200 });
  const button = new UIButton({ left: 10, top: 10, width: 100, height: 32, text: 'OK' });
  const checkbox = new UICheckBox({ left: 10, top: 60, width: 24, height: 24 });
  const switchCtl = new UISwitch({ left: 10, top: 100, width: 44, height: 22 });
  panel.addChildren([button, checkbox, switchCtl]);
  ice.childNodes = [panel];
  return { ice, panel, button, checkbox, switch: switchCtl };
}

describe('UIFocusManager', () => {
  it('可聚焦控件按文档序排列，容器不参与', () => {
    const { ice, button, checkbox, switch: switchCtl } = makeScene();
    const fm = new UIFocusManager(ice).start();
    expect(fm.getFocusables().map((c) => c.state.id)).toEqual([button, checkbox, switchCtl].map((c) => c.state.id));
  });

  it('Tab 顺序轮转并回绕；Shift+Tab 反向', () => {
    const { ice, button, checkbox, switch: switchCtl } = makeScene();
    const fm = new UIFocusManager(ice).start();

    fm.focusNext(); // 未聚焦时聚焦第一个
    expect(fm.getFocused() === button).toBe(true);
    fm.focusNext();
    expect(fm.getFocused() === checkbox).toBe(true);
    fm.focusNext();
    expect(fm.getFocused() === switchCtl).toBe(true);
    fm.focusNext();
    expect(fm.getFocused() === button).toBe(true); // 回绕

    fm.focusPrev();
    expect(fm.getFocused() === switchCtl).toBe(true);
  });

  it('键盘事件驱动：Tab / Shift+Tab / Escape / Enter', () => {
    const { ice, button, checkbox } = makeScene();
    const fm = new UIFocusManager(ice).start();
    const clicked: string[] = [];
    button.on('click', () => clicked.push('button'));
    checkbox.on('click', () => clicked.push('checkbox'));

    ice.evtBus.trigger('keydown', { key: 'Tab' });
    expect(fm.getFocused() === button).toBe(true);
    ice.evtBus.trigger('keydown', { key: 'Tab' });
    expect(fm.getFocused() === checkbox).toBe(true);
    ice.evtBus.trigger('keydown', { key: 'Tab', shiftKey: true });
    expect(fm.getFocused() === button).toBe(true);

    ice.evtBus.trigger('keydown', { key: 'Enter' });
    expect(clicked).toEqual(['button']);
    ice.evtBus.trigger('keydown', { key: ' ' });
    expect(clicked).toEqual(['button', 'button']); // 空格同样激活（当前焦点仍是 button）
    ice.evtBus.trigger('keydown', { key: 'Escape' });
    expect(fm.getFocused()).toBeNull();
  });

  it('禁用控件不参与轮转', () => {
    const { ice, button, checkbox, switch: switchCtl } = makeScene();
    const fm = new UIFocusManager(ice).start();
    switchCtl.setEnabled(false);
    expect(fm.getFocusables().map((c) => c.state.id)).toEqual([button.state.id, checkbox.state.id]);
  });

  it('焦点同步到引擎（后续键盘事件由引擎派发给它）', () => {
    const { ice, button } = makeScene();
    const fm = new UIFocusManager(ice).start();
    fm.focus(button);
    expect(ice.getFocusedComponent() === button).toBe(true);
    expect(button.isFocused()).toBe(true);
    fm.focus(null);
    expect(ice.getFocusedComponent()).toBeNull();
    expect(button.isFocused()).toBe(false);
  });

  it('鼠标点击控件会聚焦，点击非控件区域取消焦点', () => {
    const { ice, panel, button } = makeScene();
    const fm = new UIFocusManager(ice).start();
    button.getMinBoundingBox(true); // 合成矩阵（真实流程里渲染后才做命中检测）
    ice.hitTest = () => button;

    ice.evtBus.trigger('mousedown', { offsetX: 20, offsetY: 20 });
    expect(fm.getFocused() === button).toBe(true);

    ice.hitTest = () => panel; // 命中容器（不可聚焦）→ 取消焦点
    ice.evtBus.trigger('mousedown', { offsetX: 300, offsetY: 150 });
    expect(fm.getFocused()).toBeNull();
  });

  it('焦点环：聚焦时显示并跟随控件位置，取消后隐藏', () => {
    const { ice, button } = makeScene();
    const fm = new UIFocusManager(ice).start();
    const ring = fm.getRing();

    expect(ring.state.display).toBe(false);
    fm.focus(button);
    expect(ring.state.display).toBe(true);
    // 控件 (10,10,100,32)，焦点环外扩 2px
    expect([ring.state.left, ring.state.top, ring.state.width, ring.state.height]).toEqual([8, 8, 104, 36]);

    fm.focus(null);
    expect(ring.state.display).toBe(false);
  });

  it('stop() 解绑事件并摘除焦点环', () => {
    const { ice, button } = makeScene();
    const fm = new UIFocusManager(ice).start();
    expect(ice.toolNodes.length).toBe(1);
    fm.focus(button);
    fm.stop();
    expect(ice.toolNodes.length).toBe(0);
    expect(ice.getFocusedComponent()).toBeNull();
  });

  it('焦点范围（模态焦点陷阱）：Tab 只在范围内轮转，范围外的焦点被清掉', () => {
    const { ice, panel, button, checkbox } = makeScene();
    const dialog = new UIPanel({ left: 20, top: 40, width: 200, height: 120 });
    const dialogButton = new UIButton({ left: 10, top: 10, width: 80, height: 28, text: 'Confirm' });
    const dialogSwitch = new UISwitch({ left: 10, top: 60, width: 44, height: 22 });
    dialog.addChildren([dialogButton, dialogSwitch]);
    panel.addChild(dialog);
    const fm = new UIFocusManager(ice).start();

    fm.focus(button);
    fm.setFocusScope(dialog);
    expect(fm.getFocused()).toBeNull(); // 原焦点在范围外 → 清掉
    expect(fm.getFocusables().map((c) => c.state.id)).toEqual(
      [dialogButton, dialogSwitch].map((c) => c.state.id),
    );

    fm.focusNext();
    expect(fm.getFocused() === dialogButton).toBe(true);
    fm.focusNext();
    expect(fm.getFocused() === dialogSwitch).toBe(true);
    fm.focusNext();
    expect(fm.getFocused() === dialogButton).toBe(true); // 在范围内回绕，不会跑到外侧按钮

    fm.setFocusScope(null);
    expect(fm.getFocusables().length).toBeGreaterThan(2);
  });
});
