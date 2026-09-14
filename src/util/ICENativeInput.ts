/**
 * 原生输入替身（canvas 里支持中文 IME 的关键一步）。
 *
 * 问题：canvas 组件自己处理 `keydown` 只能吃单字符键 —— **中文输入法在组字阶段根本没有
 * keydown**，所以「打中文」一直打不进去（只能 `setValue`）。
 *
 * 做法（和引擎 `ICEText.startEditing()` 同一套路）：聚焦时在组件上方挂一个**完全透明**的
 * 原生 `<input>` / `<textarea>`，让浏览器和输入法去做它们擅长的事，再把结果回写：
 * - `input`：普通输入（打字、粘贴、删除）
 * - `compositionend`：输入法组字结束（中文/日文/韩文走这条）
 * - `Enter` / `Escape` / `blur`：交给组件决定（提交、取消、收尾）
 *
 * 元素是透明的（文字透明、背景透明、无边框），**画面仍然由 canvas 画**，元素只提供光标与输入法。
 *
 * 没有 `document` 的运行时（Node / 小程序）里 `mount()` 是空操作，组件据此降级回 keydown 输入。
 */

export interface ICENativeInputBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface ICENativeInputOptions {
  /** 注入 document（测试用假对象）；不传则取全局 document */
  doc?: any;
  /** 组件的世界坐标盒（CSS 像素，相对画布左上角） */
  box: ICENativeInputBox;
  value?: string;
  /** 与 canvas 完全一致的字体串（`400 14px Tahoma`），否则光标与文本对不齐 */
  font?: string;
  caretColor?: string;
  /** 0 / 不传 = 不限制 */
  maxLength?: number;
  /** 多行模式：创建 textarea（Enter 换行，不触发 onEnter） */
  multiline?: boolean;
  onInput?: (value: string) => void;
  onEnter?: () => void;
  onEscape?: () => void;
  onBlur?: () => void;
}

export class ICENativeInput {
  private options: ICENativeInputOptions;
  private element: any = null;
  private doc: any = null;
  private value: string;
  private maxLength: number;
  private multiline: boolean;

  constructor(options: ICENativeInputOptions) {
    this.options = options;
    this.doc = options.doc === undefined ? (globalThis as any).document : options.doc;
    this.value = options.value === undefined ? '' : String(options.value);
    this.maxLength = Math.max(0, Number(options.maxLength) || 0);
    this.multiline = options.multiline === true;
  }

  public isMounted(): boolean {
    return !!this.element;
  }

  public getElement(): any {
    return this.element;
  }

  public getValue(): string {
    return this.value;
  }

  /** 挂载：创建元素、定位、聚焦、把光标放到末尾。重复调用是幂等的。 */
  public mount(): this {
    if (this.element || !this.doc || !this.doc.body || typeof this.doc.createElement !== 'function') {
      return this;
    }
    const box = this.options.box;
    const element = this.doc.createElement(this.multiline ? 'textarea' : 'input');
    element.style.position = 'absolute';
    element.style.left = `${box.left}px`;
    element.style.top = `${box.top}px`;
    element.style.width = `${box.width}px`;
    element.style.height = `${box.height}px`;
    if (this.options.font) element.style.font = this.options.font;
    element.style.color = 'transparent'; // 文字透明：画面由 canvas 画，元素只留光标
    element.style.caretColor = this.options.caretColor || '#212529';
    element.style.background = 'transparent';
    element.style.border = 'none';
    element.style.outline = 'none';
    element.style.margin = '0';
    element.style.padding = '0';
    element.style.boxSizing = 'border-box';
    element.style.zIndex = '9999';
    element.value = this.value;
    if (element.setAttribute) {
      element.setAttribute('autocomplete', 'off');
      element.setAttribute('autocorrect', 'off');
      element.setAttribute('autocapitalize', 'off');
      element.setAttribute('spellcheck', 'false');
    }
    element.addEventListener('input', this.__handleInput);
    element.addEventListener('compositionend', this.__handleInput);
    element.addEventListener('keydown', this.__handleKeyDown);
    element.addEventListener('blur', this.__handleBlur);
    this.doc.body.appendChild(element);
    this.element = element;
    if (typeof element.focus === 'function') element.focus();
    this.__moveCaretToEnd();
    return this;
  }

  /** 卸载并解绑；重复调用安全。 */
  public unmount(): void {
    const element = this.element;
    if (!element) return;
    element.removeEventListener('input', this.__handleInput);
    element.removeEventListener('compositionend', this.__handleInput);
    element.removeEventListener('keydown', this.__handleKeyDown);
    element.removeEventListener('blur', this.__handleBlur);
    if (element.parentNode && typeof element.parentNode.removeChild === 'function') {
      element.parentNode.removeChild(element);
    }
    this.element = null;
  }

  /** 外部改值（例如 setValue）：同步到元素并把光标移到末尾。 */
  public setValue(value: string): this {
    this.value = this.__normalize(value);
    if (this.element) {
      this.element.value = this.value;
      this.__moveCaretToEnd();
    }
    return this;
  }

  public focus(): this {
    if (this.element && typeof this.element.focus === 'function') this.element.focus();
    return this;
  }

  /**
   * 改光标颜色（密码框在明文 / 掩码之间切换时用）。
   *
   * 掩码显示下 canvas 画的是 `•`、与输入框里的真实字符宽度不同，原生光标会漂移，
   * 这时宿主会把它设成 `transparent`，改由 canvas 画光标（见 `ICETextField`）。
   */
  public setCaretColor(color: string): this {
    this.options.caretColor = color;
    if (this.element && this.element.style) this.element.style.caretColor = color;
    return this;
  }

  // ---------------------------------------------------------------- 内部

  private __normalize(value: string): string {
    const text = value === undefined || value === null ? '' : String(value);
    return this.maxLength > 0 ? text.slice(0, this.maxLength) : text;
  }

  private __moveCaretToEnd(): void {
    if (!this.element || typeof this.element.setSelectionRange !== 'function') return;
    const length = String(this.element.value || '').length;
    this.element.setSelectionRange(length, length);
  }

  /** `input` 与 `compositionend` 共用：截断 → 回写元素 → 通知组件。 */
  private __handleInput = (): void => {
    if (!this.element) return;
    const next = this.__normalize(this.element.value);
    if (this.element.value !== next) {
      this.element.value = next; // 截断后同步回元素，光标才不会错位
      this.__moveCaretToEnd();
    }
    this.value = next;
    if (this.options.onInput) this.options.onInput(next);
  };

  private __handleKeyDown = (evt: any): void => {
    const key = evt && evt.key;
    // 组字中（中文输入法按回车选词）不能当成提交
    const composing = !!(evt && (evt.isComposing || evt.keyCode === 229));
    if (key === 'Enter' && !this.multiline) {
      if (!composing && this.options.onEnter) this.options.onEnter();
      return;
    }
    if (key === 'Escape' && this.options.onEscape) this.options.onEscape();
  };

  private __handleBlur = (): void => {
    if (this.options.onBlur) this.options.onBlur();
  };
}
