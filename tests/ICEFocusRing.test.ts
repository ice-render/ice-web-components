/**
 * 焦点环的显示策略（`:focus-visible` 语义）。
 *
 * 背景：原来只要聚焦就画蓝框 —— 用鼠标拖 Slider 的手柄、点一下按钮，整个组件都被框住，
 * 观感很怪。现在的规则：
 * - `keyboard`（默认）：只有 Tab / Shift+Tab 这类键盘聚焦才画环；
 * - `always`：鼠标聚焦也画（文本类控件要有「正在输入」的视觉反馈）；
 * - `never`：从不画。
 */
import { ICEButton } from '../src/components/ICEButton';
import { ICECheckBox } from '../src/components/ICECheckBox';
import { ICEPanel } from '../src/components/ICEPanel';
import { ICESlider } from '../src/components/ICESlider';
import { ICEFocusManager } from '../src/core/ICEFocusManager';
import { ICETextField } from '../src/components/ICETextField';
import { ICEWidget } from '../src/core/ICEWidget';

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
    hitTest: null as any,
  };
  return ice;
}

function makeScene() {
  const ice = makeICE();
  const panel = new ICEPanel({ left: 0, top: 0, width: 400, height: 260 });
  const slider = new ICESlider({ left: 10, top: 10, width: 200, height: 18, value: 40 });
  const button = new ICEButton({ left: 10, top: 60, width: 100, height: 32, text: 'OK' });
  const checkbox = new ICECheckBox({ left: 10, top: 110, width: 24, height: 24 });
  const input = new ICETextField({ left: 10, top: 150, width: 200, height: 32 });
  panel.addChildren([slider, button, checkbox, input]);
  ice.childNodes = [panel];
  return { ice, panel, slider, button, checkbox, input };
}

describe('焦点环显示策略', () => {
  it('鼠标点 Slider 手柄：聚焦但不画焦点环（拖动手感）', () => {
    const { ice, slider } = makeScene();
    const fm = new ICEFocusManager(ice).start();
    ice.hitTest = () => slider;
    ice.evtBus.trigger('mousedown', { offsetX: 100, offsetY: 18 });
    expect(fm.getFocused() === slider).toBe(true);
    expect(fm.getFocusOrigin()).toBe('mouse');
    expect(fm.isRingVisible()).toBe(false);
  });

  it('Tab 聚焦到 Slider：画焦点环（键盘用户需要看见焦点在哪）', () => {
    const { ice, slider } = makeScene();
    const fm = new ICEFocusManager(ice).start();
    ice.evtBus.trigger('keydown', { key: 'Tab' });
    expect(fm.getFocused() === slider).toBe(true);
    expect(fm.getFocusOrigin()).toBe('keyboard');
    expect(fm.isRingVisible()).toBe(true);
  });

  it('键盘聚焦后再用鼠标点同一个控件：焦点环消失', () => {
    const { ice, slider } = makeScene();
    const fm = new ICEFocusManager(ice).start();
    ice.evtBus.trigger('keydown', { key: 'Tab' });
    expect(fm.isRingVisible()).toBe(true);
    ice.hitTest = () => slider;
    ice.evtBus.trigger('mousedown', { offsetX: 100, offsetY: 18 });
    expect(fm.getFocused() === slider).toBe(true);
    expect(fm.isRingVisible()).toBe(false);
  });

  it('按钮 / 复选框：鼠标点击不画环，Tab 画环', () => {
    const { ice, button } = makeScene();
    const fm = new ICEFocusManager(ice).start();
    ice.hitTest = () => button;
    ice.evtBus.trigger('mousedown', { offsetX: 50, offsetY: 70 });
    expect(fm.isRingVisible()).toBe(false);
    fm.focus(button, { origin: 'keyboard' });
    expect(fm.isRingVisible()).toBe(true);
  });

  it('文本框：鼠标点进去也画环（正在输入的视觉反馈）', () => {
    const { ice, input } = makeScene();
    const fm = new ICEFocusManager(ice).start();
    expect(input.getFocusRingMode()).toBe('always');
    ice.hitTest = () => input;
    ice.evtBus.trigger('mousedown', { offsetX: 100, offsetY: 165 });
    expect(fm.getFocused() === input).toBe(true);
    expect(fm.isRingVisible()).toBe(true);
  });

  it('focusRing: never 永不画环；always 鼠标点也画', () => {
    const { ice, button } = makeScene();
    const fm = new ICEFocusManager(ice).start();
    button.setFocusRingMode('never');
    fm.focus(button, { origin: 'keyboard' });
    expect(fm.getFocused() === button).toBe(true);
    expect(fm.isRingVisible()).toBe(false);

    button.setFocusRingMode('always');
    ice.hitTest = () => button;
    ice.evtBus.trigger('mousedown', { offsetX: 50, offsetY: 70 });
    expect(fm.isRingVisible()).toBe(true);
  });

  it('自定义组件可以用 props.focusRing 声明策略', () => {
    expect(new ICEWidget({ focusRing: 'always' }).getFocusRingMode()).toBe('always');
    expect(new ICEWidget({}).getFocusRingMode()).toBe('keyboard');
  });

  it('取消焦点后焦点环隐藏', () => {
    const { ice } = makeScene();
    const fm = new ICEFocusManager(ice).start();
    ice.evtBus.trigger('keydown', { key: 'Tab' });
    expect(fm.isRingVisible()).toBe(true);
    ice.evtBus.trigger('keydown', { key: 'Escape' });
    expect(fm.isRingVisible()).toBe(false);
  });
});
