import { UIComponent } from '../core/UIComponent';
import { uiManager } from '../core/UIManager';
import { createTextNode } from '../util/UIStyle';

export class UITextField extends UIComponent {
  private textNode: any;
  private value: string;
  private placeholder: string;
  private maxLength: number;
  private __bound = false;
  /** 子类扩展点：是否允许多行（Enter 插入换行）。 */
  protected allowNewline = false;

  constructor(props: any = {}) {
    const theme = uiManager.getTheme();
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
        fillStyle: theme.colors.surface,
        strokeStyle: theme.colors.border,
        lineWidth: theme.control.lineWidth,
        ...(props.style || {}),
      },
    });

    this.value = value;
    this.placeholder = placeholder;
    this.maxLength = Math.max(0, maxLength);
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
    this.focusable = props.focusable !== false;
  }

  public getValue(): string {
    return this.value;
  }

  public getFormValue(): any {
    return this.value;
  }

  public setFormValue(value: any): void {
    this.setValue(value);
  }

  public setValue(value: string): this {
    this.value = this.__normalize(String(value ?? ''));
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
  }

  private __bindGlobalEvents(): void {
    if (this.__bound || !this.ice || !this.ice.evtBus) {
      return;
    }
    this.__bound = true;
    this.ice.evtBus.on('mousedown', this.__onGlobalMouseDown, this);
    this.ice.evtBus.on('keydown', this.__onGlobalKeyDown, this);
  }

  private __onGlobalMouseDown(evt: any): void {
    if (!this.enabled) return;
    this.setFocused(this.__isPointInside(evt));
  }

  private __onGlobalKeyDown(evt: any): void {
    if (!this.enabled || !this.focused) {
      return;
    }
    const key = evt && evt.key;
    if (key === 'Enter' && this.allowNewline) {
      this.value = this.__normalize(this.value + '\n');
      this.__sync();
      this.__emitChange();
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

  private __isPointInside(evt: any): boolean {
    if (!evt || typeof evt.offsetX !== 'number' || typeof evt.offsetY !== 'number') {
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

  private __normalize(value: string): string {
    return this.maxLength > 0 ? value.slice(0, this.maxLength) : value;
  }

  /** 基类在焦点变化后回调：同步边框与光标显示。 */
  protected __applyFocusState(): void {
    this.__sync();
  }

  /** 校验失败时边框标红（错误文案由 UIFormItem 渲染在下方）。 */
  protected __applyValidateState(): void {
    this.__sync();
  }

  private __sync(): void {
    const theme = uiManager.getTheme();
    const borderColor =
      this.validateStatus === 'error'
        ? theme.colors.error
        : this.focused
        ? theme.colors.primary
        : theme.colors.border;
    this.setState({
      style: {
        ...this.state.style,
        fillStyle: theme.colors.surface,
        // 校验失败优先于聚焦态：错误必须一眼可见
        strokeStyle: borderColor,
        lineWidth:
          this.focused || this.validateStatus === 'error'
            ? theme.control.lineWidthFocused
            : theme.control.lineWidth,
      },
    });
    const display = this.formatDisplayValue(this.value);
    const text = display || this.placeholder;
    this.textNode.setText(this.focused && display ? `${display}|` : text);
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
}
