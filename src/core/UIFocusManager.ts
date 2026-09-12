import { UIComponent } from './UIComponent';
import { uiManager } from './UIManager';
import { getUIWorldBox } from '../util/UIWorldBox';

/**
 * 键盘焦点与焦点环。
 *
 * 引擎只负责「键盘事件派发给谁」（`ice.setFocusedComponent` + DOMEventDispatcher），
 * 上层的策略在这里：
 * - **可聚焦集合**：`UIComponent.isFocusable()`（控件显式声明 + 启用 + 可见），按文档序；
 * - **Tab / Shift+Tab** 循环轮转，**Escape** 取消焦点，**Enter / Space** 激活
 *   （调用控件的 `activate()`，勾选/开关/单选会覆盖成对应的切换动作）；
 * - **鼠标点击**同样会聚焦：命中后沿父链上溯到最近的可聚焦控件（点标签也能聚焦按钮），
 *   点在非控件区域则取消焦点；
 * - **焦点环**画在 ICE 工具层（非交互、绘制在所有组件之上），外扩 2px 跟随焦点组件。
 *
 * 焦点环跟随组件移动：组件触发 AFTER_MOVE 时重算（拖拽、布局变化都能跟上）。
 */
export class UIFocusManager {
  private ice: any;
  private toolNode: UIComponent | null = null;
  private ring: UIComponent | null = null;
  private focused: any = null;
  private bound = false;
  private ringPadding = 2;

  constructor(ice: any) {
    this.ice = ice;
  }

  /** 幂等：创建焦点环（挂 ICE 工具层）并绑定键盘/鼠标事件。 */
  public start(): this {
    if (this.bound || !this.ice) {
      return this;
    }
    const theme = uiManager.getTheme();
    this.toolNode = new UIComponent({
      id: 'ice-ui-focus-layer',
      fill: false,
      stroke: false,
      interactive: false,
      draggable: false,
      transformable: false,
      left: 0,
      top: 0,
      width: Number(this.ice.canvasWidth) || 0,
      height: Number(this.ice.canvasHeight) || 0,
    });
    this.ring = new UIComponent({
      left: 0,
      top: 0,
      width: 0,
      height: 0,
      radius: 6,
      fill: false,
      stroke: true,
      interactive: false,
      draggable: false,
      transformable: false,
      display: false,
      style: { strokeStyle: theme.colors.primary, lineWidth: 2 },
    });
    this.toolNode.addChild(this.ring, false);
    if (typeof this.ice.addTool === 'function') {
      this.ice.addTool(this.toolNode);
    }
    const bus = this.ice.evtBus;
    if (bus && typeof bus.on === 'function') {
      bus.on('keydown', this.__onKeyDown, this);
      bus.on('mousedown', this.__onMouseDown, this);
    }
    this.bound = true;
    return this;
  }

  /** 解绑事件、清空焦点并摘除焦点环。 */
  public stop(): this {
    if (!this.bound) {
      return this;
    }
    const bus = this.ice && this.ice.evtBus;
    if (bus && typeof bus.off === 'function') {
      bus.off('keydown', this.__onKeyDown, this);
      bus.off('mousedown', this.__onMouseDown, this);
    }
    this.focus(null);
    if (this.toolNode && this.ice && typeof this.ice.removeTool === 'function') {
      this.ice.removeTool(this.toolNode);
    }
    this.toolNode = null;
    this.ring = null;
    this.bound = false;
    return this;
  }

  /** 当前焦点控件（无焦点返回 null）。 */
  public getFocused(): any {
    return this.focused;
  }

  /** 焦点环组件（测试与自定义样式用）。 */
  public getRing(): any {
    return this.ring;
  }

  /** 按文档序返回当前可聚焦的控件。 */
  public getFocusables(): any[] {
    const out: any[] = [];
    const visit = (node: any) => {
      if (!node || !node.state) {
        return;
      }
      if (typeof node.isEffectivelyVisible === 'function' && !node.isEffectivelyVisible()) {
        return; // 隐藏子树整体跳过
      }
      if (typeof node.isFocusable === 'function' && node.isFocusable()) {
        out.push(node);
      }
      (node.childNodes || []).forEach(visit);
    };
    (this.ice.childNodes || []).forEach(visit);
    return out;
  }

  /** 设置焦点（传 null 取消焦点）。非可聚焦对象会被忽略成取消焦点。 */
  public focus(component: any): this {
    const next =
      component && typeof component.isFocusable === 'function' && component.isFocusable() ? component : null;
    if (next === this.focused) {
      this.__syncRing();
      return this;
    }
    if (this.focused && typeof this.focused.setFocused === 'function') {
      this.focused.setFocused(false);
      this.__watchMove(this.focused, false);
    }
    this.focused = next;
    if (next) {
      if (typeof next.setFocused === 'function') {
        next.setFocused(true);
      }
      this.__watchMove(next, true);
    }
    if (this.ice && typeof this.ice.setFocusedComponent === 'function') {
      this.ice.setFocusedComponent(next);
    }
    this.__syncRing();
    return this;
  }

  /** Tab：聚焦下一个（未聚焦时聚焦第一个；到末尾回绕）。 */
  public focusNext(): this {
    const list = this.getFocusables();
    if (!list.length) {
      return this.focus(null);
    }
    const index = this.focused ? list.indexOf(this.focused) : -1;
    return this.focus(list[(index + 1) % list.length]);
  }

  /** Shift+Tab：聚焦上一个。 */
  public focusPrev(): this {
    const list = this.getFocusables();
    if (!list.length) {
      return this.focus(null);
    }
    const index = this.focused ? list.indexOf(this.focused) : 0;
    return this.focus(list[(index - 1 + list.length) % list.length]);
  }

  private __onKeyDown(evt: any): void {
    const raw = evt && (evt.originalEvent || evt);
    const key = raw && (raw.key || raw.code);
    if (key === 'Tab') {
      if (raw.shiftKey) {
        this.focusPrev();
      } else {
        this.focusNext();
      }
      return;
    }
    if (key === 'Escape' || key === 'Esc') {
      this.focus(null);
      return;
    }
    if (key === 'Enter' || key === ' ' || key === 'Spacebar') {
      const current = this.focused;
      if (current && typeof current.activate === 'function') {
        current.activate();
      }
    }
  }

  private __onMouseDown(evt: any): void {
    if (!evt || typeof evt.offsetX !== 'number' || typeof evt.offsetY !== 'number') {
      return;
    }
    if (!this.ice || typeof this.ice.hitTest !== 'function') {
      return;
    }
    let node = this.ice.hitTest(evt.offsetX, evt.offsetY);
    // 命中子图元（如按钮里的文字）时上溯到最近的可聚焦控件
    while (node && typeof node.isFocusable === 'function' && !node.isFocusable()) {
      node = node.parentNode;
    }
    this.focus(node && typeof node.isFocusable === 'function' ? node : null);
  }

  /** 焦点组件移动（拖拽/布局变化）时让焦点环跟上。 */
  private __watchMove(component: any, on: boolean): void {
    if (!component || typeof component.on !== 'function' || typeof component.off !== 'function') {
      return;
    }
    if (on) {
      component.on('AFTER_MOVE', this.__onFocusedMoved, this);
    } else {
      component.off('AFTER_MOVE', this.__onFocusedMoved, this);
    }
  }

  private __onFocusedMoved(): void {
    this.__syncRing();
  }

  private __syncRing(): void {
    const ring = this.ring;
    if (!ring) {
      return;
    }
    const target = this.focused;
    if (!target) {
      ring.setState({ display: false });
      return;
    }
    const box = getUIWorldBox(target);
    const pad = this.ringPadding;
    ring.setState({
      display: true,
      left: box.left - pad,
      top: box.top - pad,
      width: box.width + pad * 2,
      height: box.height + pad * 2,
      radius: (Number(target.state && target.state.radius) || 0) + pad,
    });
    if (this.ice && this.ice.dirty !== undefined) {
      this.ice.dirty = true;
    }
  }
}

const managers = new WeakMap<object, UIFocusManager>();

/** 每个 ICE 实例一个焦点管理器（懒创建）。 */
export function getUIFocusManager(ice: any): UIFocusManager {
  if (!ice || typeof ice !== 'object') {
    throw new Error('getUIFocusManager(ice) 需要一个 ICE 实例');
  }
  let manager = managers.get(ice);
  if (!manager) {
    manager = new UIFocusManager(ice);
    managers.set(ice, manager);
  }
  return manager;
}
