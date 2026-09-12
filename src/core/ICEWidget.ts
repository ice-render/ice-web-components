import { ICEGroup } from 'ice-render';
import type { ICEPainter } from './ICEPainter';
import { iceUIManager } from './ICEManager';

/**
 * 所有 UI 组件的基类（继承引擎 ICEGroup）。
 *
 * 在引擎的绘制能力之上只加四件事：交互态（enabled / hovered / focused）、键盘焦点
 * （`focusable` / `activate()`）、表单校验态（`validateStatus`）、表单取值约定
 * （`getFormValue` / `setFormValue`）。
 */
export class ICEWidget extends ICEGroup {
  protected painter: ICEPainter | null = null;
  protected preferredWidth: number = 0;
  protected preferredHeight: number = 0;
  protected enabled: boolean = true;
  protected hovered: boolean = false;
  /**
   * 是否参与键盘焦点轮转（Tab）。默认 false：容器与展示类组件不该拿到焦点，
   * 控件在自己的构造函数里置 true；调用方也可用 `props.focusable` 覆盖。
   */
  protected focusable: boolean = false;
  protected focused: boolean = false;
  /** 表单校验状态（由 ICEFormItem 设置；控件可覆盖 __applyValidateState 做视觉反馈） */
  protected validateStatus: 'default' | 'error' | 'warning' | 'success' = 'default';
  /**
   * 焦点环策略（`:focus-visible` 的语义）：
   * - `keyboard`（默认）：只有键盘（Tab / Shift+Tab）聚焦才画环 —— 鼠标点一下按钮、
   *   拖一下滑块都冒蓝框会很怪；
   * - `always`：鼠标聚焦也画环（文本类控件需要「正在输入」的反馈）；
   * - `never`：从不画。
   */
  protected focusRingMode: 'keyboard' | 'always' | 'never' = 'keyboard';

  constructor(props: any = {}) {
    super({
      fill: false,
      stroke: false,
      draggable: false,
      transformable: false,
      interactive: true,
      ...props,
    });
    if (props.focusable !== undefined) {
      this.focusable = !!props.focusable;
    }
    if (props.focusRing === 'always' || props.focusRing === 'never' || props.focusRing === 'keyboard') {
      this.focusRingMode = props.focusRing;
    }
  }

  public getFocusRingMode(): 'keyboard' | 'always' | 'never' {
    return this.focusRingMode;
  }

  public setFocusRingMode(mode: 'keyboard' | 'always' | 'never'): this {
    this.focusRingMode = mode === 'always' || mode === 'never' ? mode : 'keyboard';
    return this;
  }

  /** 按聚焦来源判断要不要画焦点环（ICEFocusManager 调用）。 */
  public shouldShowFocusRing(origin: 'mouse' | 'keyboard' | 'api'): boolean {
    if (this.focusRingMode === 'never') {
      return false;
    }
    if (this.focusRingMode === 'always') {
      return true;
    }
    return origin === 'keyboard';
  }

  public setEnabled(enabled: boolean): this {
    this.enabled = !!enabled;
    this.setState({ interactive: this.enabled });
    this.revalidate();
    return this;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public isHovered(): boolean {
    return this.hovered;
  }

  /**
   * 是否可聚焦：显式声明 + 启用 + 可交互 + 最终可见（祖先 display:false 时不可聚焦）。
   */
  public isFocusable(): boolean {
    return this.focusable && this.enabled && this.state.interactive !== false && this.isEffectivelyVisible();
  }

  public setFocusable(focusable: boolean): this {
    this.focusable = !!focusable;
    return this;
  }

  public isFocused(): boolean {
    return this.focused;
  }

  /** 由 ICEFocusManager 调用；默认只记录状态（视觉表现由焦点环负责，子类可覆盖）。 */
  public setFocused(focused: boolean): this {
    const next = !!focused && this.enabled;
    if (next === this.focused) {
      return this;
    }
    this.focused = next;
    this.__applyFocusState();
    this.revalidate();
    return this;
  }

  /**
   * 键盘激活（Enter / Space）。默认等价于一次 click；
   * 有自己语义的控件（勾选、开关、单选）覆盖成对应的切换动作。
   */
  public activate(): void {
    if (!this.enabled) {
      return;
    }
    this.trigger('click', null, { source: 'keyboard' });
  }

  protected __applyFocusState(): void {
    // 默认不改变外观：焦点环由 ICEFocusManager 统一绘制。
  }

  public getValidateStatus(): 'default' | 'error' | 'warning' | 'success' {
    return this.validateStatus;
  }

  public setValidateStatus(status: 'default' | 'error' | 'warning' | 'success'): this {
    const next = status || 'default';
    if (next === this.validateStatus) {
      return this;
    }
    this.validateStatus = next;
    this.__applyValidateState();
    this.revalidate();
    return this;
  }

  /** 校验状态变化后的视觉反馈钩子（默认不变，控件按需覆盖）。 */
  protected __applyValidateState(): void {}

  /**
   * 表单取值约定：控件覆盖这两个方法即可被 ICEForm 直接读写。
   * 默认读写 `state.value`（对没有值语义的组件无害）。
   */
  public getFormValue(): any {
    return this.state.value;
  }

  public setFormValue(value: any): void {
    this.setState({ value });
  }

  public setHovered(hovered: boolean): this {
    const next = !!hovered && this.enabled;
    if (next === this.hovered) {
      return this;
    }
    this.hovered = next;
    this.__applyHoverState();
    this.revalidate();
    // 通知外部（Tooltip / Popover 这类「跟着 hover 走」的组件）
    this.trigger('hoverchange', null, { hovered: next });
    return this;
  }

  public setPreferredSize(width: number, height: number): this {
    this.preferredWidth = Math.max(0, width || 0);
    this.preferredHeight = Math.max(0, height || 0);
    this.revalidate();
    return this;
  }

  public getPreferredSize(): [number, number] {
    if (this.painter && typeof this.painter.getPreferredSize === 'function') {
      return this.painter.getPreferredSize(this);
    }
    return [this.preferredWidth, this.preferredHeight];
  }

  public setPainter(painter: ICEPainter | null): this {
    if (this.painter && typeof this.painter.uninstall === 'function') {
      this.painter.uninstall(this);
    }
    this.painter = painter;
    if (painter && typeof painter.install === 'function') {
      painter.install(this);
    }
    this.revalidate();
    return this;
  }

  public getPainter(): ICEPainter | null {
    return this.painter;
  }

  protected __applyHoverState(): void {
    // 默认不改变外观，交互组件按需覆盖。
  }

  /**
   * UI 组件内部的图元只负责外观，不参与画布级拖拽、变换、连线。
   * 只有真正的 UI 组件（ICEWidget）保留自己的交互配置。
   */
  public addChild(child: any, markDirty: boolean = true): void {
    if (!(child instanceof ICEWidget) && child && child.state) {
      child.state.interactive = false;
      child.state.draggable = false;
      child.state.transformable = false;
      child.state.linkable = false;
    }
    super.addChild(child, markDirty);
  }

  public revalidate(): this {
    this.requestLayout();
    if (this.ice) {
      this.ice.dirty = true;
    }
    return this;
  }

  protected theme() {
    return iceUIManager.getTheme();
  }
}
