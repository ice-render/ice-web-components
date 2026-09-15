import { ICEGroup } from 'ice-render';
import type { ICEPainter } from './ICEPainter';
import { iceUIManager } from './ICEManager';
import { tFor } from '../i18n/ICEI18n';
import type { ICETranslate } from '../i18n/ICEI18n';

/**
 * 所有 UI 组件的基类（继承引擎 ICEGroup）。
 *
 * 在引擎的绘制能力之上只加四件事：交互态（enabled / hovered / focused）、键盘焦点
 * （`focusable` / `activate()`）、表单校验态（`validateStatus`）、表单取值约定
 * （`getFormValue` / `setFormValue`）。
 */
export class ICEWidget extends ICEGroup {
  /**
   * 取组件内置文案（i18n 边界见 `docs/architecture/17-i18n-boundary.md`）。
   *
   * **按实例**解析：`setLocale(props.locale)` 指定语言（未注册 / 未传则回退当前语言，`tFor` 内部兜底到默认语言）。
   * 这样同页两个面板可以各用各的语言，库本身也不必持全局状态。
   * **业务文案不要走这里** —— 它属于应用层，直接传 `text` / `title` 之类的 props。
   *
   * 注意：各组件构造函数对 props 是**白名单转发**（只把认识的字段交给基类），
   * 所以想支持实例级语言的组件必须在自己的构造函数里显式调用 `setLocale(props.locale)`。
   */
  protected t(key: string, vars?: Record<string, string | number>): string {
    return (this.__t || (this.__t = tFor(this.__locale)))(key, vars);
  }

  /** 设置本实例的语言（语言未注册时 `tFor` 会回退到当前语言）。 */
  protected setLocale(locale?: string): void {
    this.__locale = locale;
    this.__t = null;
  }

  private __locale?: string;
  private __t: ICETranslate | null = null;

  protected painter: ICEPainter | null = null;
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

  /**
   * 无障碍：可读名称。
   *
   * 引擎的 a11y 快照优先读 `state.ariaLabel`（见 ice-render 的 `a11y/accessibility.ts`），
   * 拿不到才回退到文本 / id。控件应当给出有意义的名称（按钮用文字、输入框用占位符……），
   * 否则屏幕阅读器会念出一串 id。
   */
  public setAriaLabel(label: string): this {
    this.setState({ ariaLabel: String(label ?? '') });
    return this;
  }

  public getAriaLabel(): string {
    const value = this.state && this.state.ariaLabel;
    return typeof value === 'string' ? value : '';
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

  /**
   * 组件**想要多大**（布局用）。
   *
   * 优先级与 Swing 的 `JComponent.getPreferredSize()` 一致：
   * ① 调用方 `setPreferredSize([w, h])` 声明过（引擎基类提供）→ 用声明值；
   * ② 组件挂了自己的 `painter` 且它能报尺寸 → 问 painter（对应 Swing 的 UI delegate）；
   * ③ 否则回到引擎基类（容器有布局时报内容尺寸，叶子报自己的盒子）。
   *
   * 注：本类原来自己实现过 `setPreferredSize(width, height)` + `preferredWidth/Height` 字段，
   * 与引擎 2026-09-15 新增的同名 Swing API 撞了签名，已合并到引擎那一份（调用方改传数组）。
   */
  public getPreferredSize(): [number, number] {
    if (this.isPreferredSizeSet()) {
      return super.getPreferredSize();
    }
    if (this.painter && typeof this.painter.getPreferredSize === 'function') {
      return this.painter.getPreferredSize(this);
    }
    return super.getPreferredSize();
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

  /**
   * 渲染钩子：先画自己的盒子（背景 / 描边 / 圆角），再把**组件内部装饰**交给 painter。
   *
   * painter 是 Swing `ComponentUI`（UI delegate）在本库的对应物：组件内部那些
   * "不是内容、也不该参与父容器布局"的装饰（头像的圆与文字、骨架屏的占位条…）
   * 由它直接画在组件自己的坐标系里，因而**不占 `childNodes`** —— 于是给组件挂布局
   * 也不会把内部装饰一起排掉（见 `docs/guides/layout.md`）。
   *
   * 契约：
   * - `paint({ ctx, theme, component })` 在组件**本地坐标系**里调用（引擎已经应用了
   *   该组件的 CTM），画的东西要落在 `0,0 - state.width/height` 之内；
   * - painter 自己负责 ctx 状态（引擎会在组件渲染结束后归位"泄漏属性"，但别依赖它）；
   * - 需要交互的内部装饰（例如下拉箭头的点击区）在 `install(component)` 里挂事件监听、
   *   自己算本地坐标 —— 与 Swing 的 UI delegate 装监听器同构；
   * - 要声明组件想要多大，实现 `getPreferredSize(component)`（布局会问它）。
   */
  protected doRender(): void {
    super.doRender();
    // `ICEComponent.doRender()` 内部会把 CTM 换成「世界 → 设备」去画调试包围盒，
    // super 之后必须把本渲染通道的变换取回来，painter 才能按组件本地坐标画
    // （与 ICETileMap 自绘时调它的原因相同）。
    this.applyActiveTransform();
    this.paintDecoration();
  }

  /**
   * 让 painter 画一次内部装饰。`doRender()` 每帧自动调用；单测可以直接调它来断言画笔行为
   * （与 `ICETileMap.paintBoard()` 的用法一致）。组件没挂到 ICE 实例 / 没挂 painter 时是空操作。
   */
  public paintDecoration(): void {
    if (!this.painter || typeof this.painter.paint !== 'function') {
      return;
    }
    const ctx = this.ctx;
    if (!ctx) {
      return; // headless（单测里没 init 过画布）没有 ctx 可画
    }
    const origin = Array.isArray(this.state.localOrigin) ? this.state.localOrigin : [0, 0];
    this.painter.paint({
      ctx,
      theme: this.theme(),
      component: this,
      origin: [Number(origin[0]) || 0, Number(origin[1]) || 0],
    });
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
