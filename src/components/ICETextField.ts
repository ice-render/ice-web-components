import { ICEWidget } from '../core/ICEWidget';
import { iceUIManager } from '../core/ICEManager';
import { ICEButton } from './ICEButton';
import { createTextNode } from '../util/ICEStyle';
import { ICENativeInput } from '../util/ICENativeInput';
import { token } from 'ice-render';

/**
 * 单行文本输入：聚焦边框、错误态、表单取值约定与键盘输入；
 * 子类通过覆盖 `__allowNewline()` 等钩子扩展（见 ICETextArea）。
 */
export class ICETextField extends ICEWidget {
  private textNode: any;
  private value: string;
  private placeholder: string;
  private maxLength: number;
  private __bound = false;
  /**
   * 鼠标是否正按在组件上。
   *
   * 为什么需要它：`mousedown` 的默认动作会（在 canvas 这种不可聚焦元素上）把焦点挪到 body，
   * 于是「按下时就挂原生输入」会被紧接着的 blur 当成失焦、刚挂上就被拆掉。
   * 所以鼠标路径改成**松开鼠标之后再挂**（键盘 Tab 进来时没有这个手势，照常立即挂）。
   */
  private __pointerDown = false;
  /** 子类扩展点：是否允许多行（Enter 插入换行）。 */
  protected allowNewline = false;
  /** 聚焦期间挂载的原生输入替身（浏览器环境才有；见 ICENativeInput） */
  private nativeInput: ICENativeInput | null = null;
  /** 附属物：前后缀 / 清除按钮 / 字数统计（都跟随焦点与值自己显隐） */
  private prefixNode: any = null;
  private suffixNode: any = null;
  private countNode: any = null;
  private clearButton: any = null;
  private allowClear = false;
  private showCount = false;

  constructor(props: any = {}) {
    const theme = iceUIManager.getTheme();
    const width = props.width || 200;
    const height = props.height || theme.control.height;
    const value = props.value === undefined ? '' : String(props.value);
    const placeholder = props.placeholder || '';
    const maxLength = Number.isFinite(props.maxLength) ? props.maxLength : 0;

    super({
      ...props,
      fill: true,
      stroke: true,
      width,
      height,
      radius: theme.radius.md,
      style: {
        fillStyle: token('ui.colors.surface'),
        strokeStyle: token('ui.colors.border'),
        lineWidth: theme.control.lineWidth,
        ...(props.style || {}),
      },
    });

    this.value = value;
    this.placeholder = placeholder;
    this.maxLength = Math.max(0, maxLength);
    this.allowClear = props.allowClear === true;
    this.showCount = props.showCount === true;
    this.textNode = createTextNode({
      left: theme.spacing.sm,
      top: 0,
      width: Math.max(0, width - theme.spacing.sm * 2),
      height,
      text: value || placeholder,
      fillStyle: value ? theme.colors.text : theme.colors.textTertiary,
      fontFamily: theme.font.family,
      fontSize: theme.font.size,
      fontWeight: theme.font.weightNormal,
      align: 'left',
      verticalAlign: 'middle',
    });
    this.addChild(this.textNode, false);
    this.__buildAdornments(props);
    this.focusable = props.focusable !== false;
    // 无障碍：没显式给 ariaLabel 时用占位符当可读名称（比念 id 强得多）
    if (props.ariaLabel !== undefined) this.setAriaLabel(String(props.ariaLabel));
    else if (placeholder) this.setAriaLabel(placeholder);
    // 文本类控件：鼠标点进去也要有「正在输入」的焦点反馈（:focus 语义）
    this.focusRingMode = 'always';
  }

  public getValue(): string {
    return this.value;
  }

  /** 附属物句柄（QA / 调试用；也让调用方能读到当前显示的字数）。 */
  public getTextNodes(): { prefix: string; suffix: string; count: string; clear: any } {
    return {
      prefix: this.prefixNode ? String(this.prefixNode.getText() || '') : '',
      suffix: this.suffixNode ? String(this.suffixNode.getText() || '') : '',
      count: this.getCountText(),
      clear: this.clearButton,
    };
  }

  public getCountText(): string {
    return this.countNode ? String(this.countNode.getText() || '') : '';
  }

  public isClearVisible(): boolean {
    return !!(this.clearButton && this.clearButton.state.display !== false);
  }

  /** 清空（表单重置 / 点击清除按钮都走它）。 */
  public clear(): this {
    this.setValue('');
    return this;
  }

  public getFormValue(): any {
    return this.value;
  }

  public setFormValue(value: any): void {
    this.setValue(value);
  }

  public setValue(value: string): this {
    this.value = this.__normalize(String(value ?? ''));
    if (this.nativeInput) this.nativeInput.setValue(this.value);
    this.__sync();
    this.__emitChange();
    return this;
  }

  public getPlaceholder(): string {
    return this.placeholder;
  }

  public setPlaceholder(placeholder: string): this {
    this.placeholder = String(placeholder ?? '');
    this.__sync();
    return this;
  }

  public focus(): this {
    this.setFocused(true);
    return this;
  }

  public blur(): this {
    this.setFocused(false);
    return this;
  }

  /** 文本输入由控件自己的 keydown 处理（见 __onGlobalKeyDown）；Enter/Space 不额外触发 click。 */
  public activate(): void {}

  protected afterAddHandler(): void {
    super.afterAddHandler();
    this.__bindGlobalEvents();
    // 组件被移出场景时收起替身，别在 DOM 里留一个孤儿 input
    this.once('AFTER_REMOVE', () => this.__unmountNativeInput(), this);
  }

  private __bindGlobalEvents(): void {
    if (this.__bound || !this.ice || !this.ice.evtBus) {
      return;
    }
    this.__bound = true;
    this.ice.evtBus.on('mousedown', this.__onGlobalMouseDown, this);
    this.ice.evtBus.on('mouseup', this.__onGlobalMouseUp, this);
    this.ice.evtBus.on('keydown', this.__onGlobalKeyDown, this);
  }

  private __onGlobalMouseDown(evt: any): void {
    if (!this.enabled) return;
    this.__pointerDown = true;
    this.setFocused(this.__isPointInside(evt));
  }

  /** 松开鼠标：这时候再挂原生输入，就不会被 mousedown 的默认焦点转移打掉。 */
  private __onGlobalMouseUp(): void {
    this.__pointerDown = false;
    if (!this.focused || this.nativeInput) return;
    // 再等一拍：click 的默认动作（浏览器把焦点从 canvas 挪走那一下）跑完再挂，
    // 否则替身刚拿到焦点就被「假失焦」打掉（QA 里表现为“点了输入框却打不进字”）。
    if (typeof setTimeout === 'function') {
      setTimeout(() => {
        if (this.focused && !this.nativeInput) this.__mountNativeInput();
      }, 0);
    } else {
      this.__mountNativeInput();
    }
  }

  private __onGlobalKeyDown(evt: any): void {
    if (!this.enabled || !this.focused) {
      return;
    }
    // 原生替身在时它接管一切输入（含 IME），这里必须让路，否则同一个字符进两次
    if (this.nativeInput) return;
    const key = evt && evt.key;
    if (key === 'Enter' && this.allowNewline) {
      this.value = this.__normalize(this.value + '\n');
      this.__sync();
      this.__emitChange();
      return;
    }
    if (key === 'Enter') {
      this.trigger('submit', null, { value: this.value });
      return;
    }
    if (key === 'Backspace') {
      this.value = this.value.slice(0, -1);
      this.__sync();
      this.__emitChange();
    } else if (key === 'Delete') {
      this.value = this.value.slice(1);
      this.__sync();
      this.__emitChange();
    } else if (key === 'Escape') {
      this.blur();
    } else if (typeof key === 'string' && key.length === 1 && !evt.metaKey && !evt.ctrlKey) {
      this.value = this.__normalize(this.value + key);
      this.__sync();
      this.__emitChange();
    }
  }

  private __emitChange(): void {
    this.trigger('change', null, { value: this.value });
  }

  /**
   * 挂载原生输入替身（见 `ICENativeInput`）。
   *
   * 只在浏览器环境挂：没有 `document`（Node / 小程序）时直接返回，输入走原来的 keydown 路径。
   * 组件的包围盒在「还没渲染过」（单测）时拿不到，这里兜底成 (0,0) —— 定位不准也只影响
   * 光标的落点，不影响输入本身。
   */
  private __mountNativeInput(): void {
    if (this.nativeInput || !this.enabled) return;
    const doc = this.ice && this.ice.root ? this.ice.root.document : null;
    if (!doc || !doc.body) return;
    const theme = iceUIManager.getTheme();
    let left = 0;
    let top = 0;
    try {
      const box = this.getMinBoundingBox(true);
      if (box && box.tl) {
        left = Number(box.tl[0]) || 0;
        top = Number(box.tl[1]) || 0;
      }
    } catch (err) {
      /* 未渲染（单测）时用 0,0 */
    }
    const canvasRect =
      this.ice && this.ice.canvasEl && typeof this.ice.canvasEl.getBoundingClientRect === 'function'
        ? this.ice.canvasEl.getBoundingClientRect()
        : { left: 0, top: 0 };
    // 画布**显示尺寸**（CSS）相对内部坐标系（SCREEN_W×SCREEN_H）的缩放：
    // 引擎把世界坐标画进 canvas 缓冲，缓冲再按 CSS 缩放到页面。getBoundingClientRect()
    // 给的是*页面*坐标（含信箱边偏移），但 left/top 是从 getMinBoundingBox 拿的*世界*坐标
    // （未缩放）——必须乘 scale 才能落到画布上文字真正的位置。否则在 CSS 缩放的画布上
    // （XP 信箱边 / 任意非 1:1 的视口）透明 input 会整体偏右偏下、光标漂到画布外。
    // scale 取引擎当前视口缩放（setViewport 设的 displayW/SCREEN_W）；取不到时按 1 兜底
    // （单测环境没有 viewport，1:1 渲染也不影响）。
    const scale =
      this.ice && this.ice.viewport && Number.isFinite(Number(this.ice.viewport.scale))
        ? Number(this.ice.viewport.scale)
        : 1;
    // 替身要盖在**文本盒**上，而不是组件整盒：canvas 把文字内缩了 textNode.left（默认 spacing.sm = 12）、
    // 并按 textNode.width 排布。box 不跟着缩，原生光标就会整体偏左 12px、与画面文字错位。
    const textLeft = Number(this.textNode && this.textNode.state ? this.textNode.state.left : 0) || 0;
    const rawTextWidth = Number(this.textNode && this.textNode.state ? this.textNode.state.width : 0) || 0;
    const textWidth = rawTextWidth > 0 ? rawTextWidth : Number(this.state.width) || 0;
    // 掩码显示（密码框）：canvas 画的是 •，与输入框里的真实字符宽度不同，原生光标会随长度漂移
    const masked = this.__isMaskedDisplay();
    this.nativeInput = new ICENativeInput({
      doc,
      box: {
        left: (Number(canvasRect.left) || 0) + (left + textLeft) * scale,
        top: (Number(canvasRect.top) || 0) + top * scale,
        width: textWidth * scale,
        height: (Number(this.state.height) || 0) * scale,
      },
      value: this.value,
      font: `${theme.font.weightNormal} ${theme.font.size}px ${theme.font.family}`,
      // 掩码时把原生光标藏掉（它按真实字符定位、会和 • 的落点错开），改由 canvas 的 `|` 当光标
      caretColor: masked ? 'transparent' : theme.colors.text,
      maxLength: this.maxLength,
      multiline: this.allowNewline,
      onInput: (value) => this.__applyNativeValue(value),
      onEnter: () => this.trigger('submit', null, { value: this.value }),
      onEscape: () => this.blur(),
      onBlur: () => this.__handleNativeBlur(),
    });
    this.nativeInput.mount();
  }

  /**
   * 替身失焦时的处理。
   *
   * DOM 层失焦**不等于**组件失焦：`mousedown` / `click` 的默认动作、focus 管理器重新聚焦、
   * 浏览器的一些内部行为都可能让替身瞬间丢焦点（QA 里表现为「点了输入框，输入框却立刻丢焦点，
   * 字打不进去」）。所以这里只看**组件自己**的状态：
   * - 组件仍然聚焦 → 把 DOM 焦点抢回来（不是我们想失焦，是别人捣乱）；
   * - 组件已经失焦（例如点到了别的控件、焦点管理器清了焦点）→ 什么都不用做，
   *   因为那条路径已经由 `__applyFocusState` 收起替身了。
   */
  private __handleNativeBlur(): void {
    if (!this.focused || !this.nativeInput) return;
    this.nativeInput.focus();
  }

  private __unmountNativeInput(): void {
    if (!this.nativeInput) return;
    this.nativeInput.unmount();
    this.nativeInput = null;
  }

  /** 原生输入回写：**同值不重复触发 change**（IME 收尾时会再补一次同值事件）。 */
  private __applyNativeValue(value: string): void {
    const next = this.__normalize(String(value ?? ''));
    if (next === this.value) return;
    this.value = next;
    this.__sync();
    this.__emitChange();
  }

  private __isPointInside(evt: any): boolean {
    if (!evt || typeof evt.offsetX !== 'number' || typeof evt.offsetY !== 'number') {
      return false;
    }
    if (!this.ice || typeof this.ice.screenToWorld !== 'function') {
      return false;
    }
    const [wx, wy] = this.ice.screenToWorld(evt.offsetX, evt.offsetY);
    const box = this.getMinBoundingBox(true);
    return wx >= box.tl[0] && wx <= box.br[0] && wy >= box.tl[1] && wy <= box.br[1];
  }

  /** 当前显示的文本（含聚焦时的光标占位）。 */
  public getFieldText(): string {
    return this.textNode.getText();
  }

  /** 子类改动了显示相关状态后，重新渲染字段。 */
  protected refresh(): void {
    this.__sync();
  }

  /**
   * 子类扩展点：把真实值转成显示文本（密码掩码）。
   * 光标仍然按真实值长度渲染在末尾。
   */
  protected formatDisplayValue(value: string): string {
    return value;
  }

  /**
   * 显示文本是否与真实值不同（即被掩码，如密码框的 `•`）。
   *
   * 掩码下 canvas 画的字符与输入框里的真实字符**宽度不同**，原生光标会随长度漂移，
   * 所以这时藏掉原生光标、改用 canvas 画的 `|`（见 `__mountNativeInput` / `__sync`）。
   */
  private __isMaskedDisplay(): boolean {
    return this.formatDisplayValue(this.value) !== this.value;
  }

  private __normalize(value: string): string {
    return this.maxLength > 0 ? value.slice(0, this.maxLength) : value;
  }

  /** 基类在焦点变化后回调：同步边框与光标显示。 */
  protected __applyFocusState(): void {
    // 聚焦就挂原生输入替身：中文输入法、粘贴、光标拖动都由浏览器负责
    if (!this.focused) {
      this.__unmountNativeInput();
    } else if (!this.__pointerDown) {
      // 鼠标手势中先不挂，等 __onGlobalMouseUp
      this.__mountNativeInput();
    }
    this.__sync();
  }

  /** 校验失败时边框标红（错误文案由 ICEFormItem 渲染在下方）。 */
  protected __applyValidateState(): void {
    this.__sync();
  }

  /** 建附属物：前缀 / 后缀 / 清除按钮 / 字数（都贴在输入框内部，跟随内边距走）。 */
  private __buildAdornments(props: any): void {
    const theme = iceUIManager.getTheme();
    const height = Number(this.state.height) || theme.control.height;
    const width = Number(this.state.width) || 200;
    const makeHint = (text: string, alignRight: boolean) =>
      createTextNode({
        left: alignRight ? width - theme.spacing.sm - 24 : theme.spacing.sm,
        top: 0,
        width: 120,
        height,
        text,
        fillStyle: token('ui.colors.textTertiary'),
        fontFamily: theme.font.family,
        fontSize: theme.font.size,
        fontWeight: theme.font.weightNormal,
        align: 'left',
        verticalAlign: 'middle',
      });
    if (props.prefix !== undefined && props.prefix !== null && String(props.prefix) !== '') {
      this.prefixNode = makeHint(String(props.prefix), false);
      this.addChild(this.prefixNode, false);
    }
    if (props.suffix !== undefined && props.suffix !== null && String(props.suffix) !== '') {
      this.suffixNode = makeHint(String(props.suffix), true);
      this.addChild(this.suffixNode, false);
    }
    if (this.showCount && this.maxLength > 0) {
      this.countNode = makeHint(`0/${this.maxLength}`, true);
      this.addChild(this.countNode, false);
    }
    if (this.allowClear) {
      this.clearButton = new ICEButton({
        left: Math.max(0, width - theme.spacing.sm - 18),
        top: Math.max(0, (height - 20) / 2),
        width: 18,
        height: 20,
        text: '✕',
        variant: 'text',
        size: 'small',
        focusable: false,
        style: { fontSize: 11 },
      });
      this.clearButton.setState({ display: false });
      this.clearButton.on('click', () => this.clear());
      this.addChild(this.clearButton, false);
    }
  }

  /** 供测试/内部使用的悬停钩子：附属物要跟着 hover 显隐（子类不暴露 hovered 字段）。 */
  public __setHoverForTest(hovered: boolean): void {
    (this as any).hovered = hovered === true;
    this.__sync();
  }

  private __sync(): void {
    const theme = iceUIManager.getTheme();
    const borderColor =
      this.validateStatus === 'error'
        ? theme.colors.error
        : this.focused
        ? theme.colors.focusRing
        : theme.colors.border;
    this.setState({
      style: {
        ...this.state.style,
        fillStyle: token('ui.colors.surface'),
        // 校验失败优先于聚焦态：错误必须一眼可见
        strokeStyle: borderColor,
        lineWidth:
          this.focused || this.validateStatus === 'error'
            ? theme.control.lineWidthFocused
            : theme.control.lineWidth,
      },
    });
    // 附属物：内边距与显隐都在这里算 —— 前缀挤左、后缀/字数/清除挤右
    const width = Number(this.state.width) || 200;
    const height = Number(this.state.height) || theme.control.height;
    const widthOf = (node: any) => (node ? Math.round(Number(node.state.width) || 0) : 0);
    const leftInset = theme.spacing.sm + (this.prefixNode ? widthOf(this.prefixNode) + 6 : 0);
    let rightInset = theme.spacing.sm;
    if (this.suffixNode) rightInset += widthOf(this.suffixNode) + 6;
    if (this.countNode) rightInset += widthOf(this.countNode) + 6;
    if (this.clearButton && this.isClearVisible()) rightInset += 20;
    // 文字盒 = 当前盒子扣掉左右内距，**高度也要跟上**：内层文字是 `verticalAlign: middle`，
    // 拿旧高度当盒子会让文字垂直居中到错的位置（构造期建过一次，之后高度再没人对账）。
    this.textNode.setState({ left: leftInset, top: 0, width: Math.max(20, width - leftInset - rightInset), height });
    if (this.prefixNode) this.prefixNode.setState({ left: theme.spacing.sm, top: 0, height });
    if (this.suffixNode) this.suffixNode.setState({ left: width - theme.spacing.sm - widthOf(this.suffixNode), top: 0, height });
    if (this.countNode) {
      const offset = width - theme.spacing.sm - widthOf(this.countNode) - (this.clearButton ? 20 : 0);
      this.countNode.setText(`${this.value.length}/${this.maxLength}`);
      this.countNode.setState({ left: Math.max(theme.spacing.sm, width - theme.spacing.sm - widthOf(this.countNode) - (this.clearButton ? 20 : 0)), top: 0, height });
      void offset;
    }
    if (this.clearButton) {
      const visible = this.allowClear && this.value.length > 0 && (this.hovered || this.focused);
      this.clearButton.setState({ display: visible, left: Math.max(0, width - theme.spacing.sm - 18), top: Math.max(0, (height - 20) / 2) });
    }
    const display = this.formatDisplayValue(this.value);
    const text = display || this.placeholder;
    // 掩码状态可能在聚焦期间变化（密码框切明文 / 掩码）：同步替身的光标颜色 ——
    // 否则会出现「原生光标被藏掉、canvas 光标又被抑制」→ 一个光标都没有。
    const masked = this.__isMaskedDisplay();
    if (this.nativeInput) this.nativeInput.setCaretColor(masked ? 'transparent' : theme.colors.text);
    // 光标占位：只在「没有原生替身」（Node / 小程序 / 未聚焦）或「掩码显示」时画 canvas 的 `|`。
    // 非掩码且已挂替身时用原生光标（box 已对齐到文本盒，位置正确）—— 两个都画就会出现两个错位的光标。
    const showCanvasCaret = this.focused && !!display && (!this.nativeInput || masked);
    this.textNode.setText(showCanvasCaret ? `${display}|` : text);
    this.textNode.setState({
      style: {
        fillStyle: this.value ? theme.colors.text : theme.colors.textTertiary,
        fontFamily: theme.font.family,
        fontSize: theme.font.size,
        fontWeight: theme.font.weightNormal,
        textAlign: 'left',
        textBaseline: 'middle',
      },
    });
    this.revalidate();
  }

  /**
   * 尺寸变化时重排内部零件（`ICEWidget.__syncInternalLayout()`）。
   *
   * `__sync()` 本来就是**从 `this.state.width/height` 现算**的（内边距、前后缀、
   * 字数、清除按钮的位置全在里面），所以这里只需在尺寸变化时叫它跑一遍 ——
   * 以前它只挂在交互与取值路径上，父层布局把输入框拉窄之后，文字盒还停在旧宽度上，
   * 文字与后缀图标直接画到框外。
   */
  protected __syncInternalLayout(): void {
    this.__sync();
  }
}
