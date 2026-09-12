import { ICEGroup } from 'ice-render';
import type { UIPainter } from './UIPainter';
import { uiManager } from './UIManager';

export class UIComponent extends ICEGroup {
  protected painter: UIPainter | null = null;
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
  /** 表单校验状态（由 UIFormItem 设置；控件可覆盖 __applyValidateState 做视觉反馈） */
  protected validateStatus: 'default' | 'error' | 'warning' | 'success' = 'default';

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

  /** 由 UIFocusManager 调用；默认只记录状态（视觉表现由焦点环负责，子类可覆盖）。 */
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
    // 默认不改变外观：焦点环由 UIFocusManager 统一绘制。
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
   * 表单取值约定：控件覆盖这两个方法即可被 UIForm 直接读写。
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

  public setPainter(painter: UIPainter | null): this {
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

  public getPainter(): UIPainter | null {
    return this.painter;
  }

  protected __applyHoverState(): void {
    // 默认不改变外观，交互组件按需覆盖。
  }

  /**
   * UI 组件内部的图元只负责外观，不参与画布级拖拽、变换、连线。
   * 只有真正的 UI 组件（UIComponent）保留自己的交互配置。
   */
  public addChild(child: any, markDirty: boolean = true): void {
    if (!(child instanceof UIComponent) && child && child.state) {
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
    return uiManager.getTheme();
  }
}
