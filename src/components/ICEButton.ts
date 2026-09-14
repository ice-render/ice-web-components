import { ICEWidget } from '../core/ICEWidget';
import { iceUIManager } from '../core/ICEManager';
import { centerTextNode } from '../util/ICEStyle';

export type ICEButtonVariant = 'primary' | 'default' | 'text' | 'link';
export type ICEButtonSize = 'small' | 'middle' | 'large';

function heightForSize(theme: any, size: ICEButtonSize): number {
  if (size === 'small') return theme.control.heightSmall;
  if (size === 'large') return theme.control.heightLarge;
  return theme.control.height;
}

function fontSizeForSize(theme: any, size: ICEButtonSize): number {
  if (size === 'small') return theme.font.sizeSmall;
  if (size === 'large') return theme.font.sizeLarge;
  return theme.font.size;
}

function styleFor(
  theme: any,
  variant: ICEButtonVariant,
  danger: boolean,
  active: boolean,
  hovered: boolean,
  enabled: boolean,
  userStyle: any,
): any {
  if (variant === 'text' || variant === 'link') {
    return {
      fill: false,
      stroke: false,
      fillStyle: 'rgba(0,0,0,0)',
      strokeStyle: 'rgba(0,0,0,0)',
      shadow: undefined,
    };
  }

  if (variant === 'default') {
    const border = active || hovered ? (danger ? theme.colors.error : theme.colors.primary) : theme.colors.border;
    const fill = enabled ? theme.colors.surface : theme.colors.disabled;
    return {
      fill: true,
      stroke: true,
      fillStyle: fill,
      strokeStyle: border,
      shadow: undefined,
    };
  }

  const fill = danger
    ? theme.colors.error
    : active
    ? theme.colors.primaryActive
    : hovered
    ? theme.colors.primaryHover
    : enabled
    ? theme.colors.primary
    : theme.colors.disabled;
  return {
    fill: true,
    stroke: true,
    fillStyle: fill,
    strokeStyle: fill,
    ...(enabled ? theme.shadows.sm : {}),
  };
}

function textColor(theme: any, variant: ICEButtonVariant, danger: boolean, enabled: boolean, hovered = false): string {
  if (variant === 'primary') return theme.colors.primaryText;
  if (danger) return theme.colors.error;
  if (variant === 'text' || variant === 'link') return hovered ? theme.colors.primaryHover : theme.colors.primary;
  if (!enabled) return theme.colors.textDisabled;
  return hovered ? theme.colors.primary : theme.colors.text;
}

/**
 * 按钮：`primary` / `default` / `text` / `link` 变体，`danger` 与三种尺寸，
 * 自带 hover / 焦点 / 禁用态，点击时触发 `click`。
 */
export class ICEButton extends ICEWidget {
  /** 调用方显式设过 ariaLabel 之后，setText 不再覆盖它 */
  private explicitAriaLabel = false;
  private label: any;
  private variant: ICEButtonVariant;
  private size: ICEButtonSize;
  private danger: boolean;
  private pressed = false;
  /** 纯文字（不含图标字形）：getText 与无障碍名都用它 */
  private text = '';
  /** 图标字形，只参与绘制 */
  private icon = '';
  private loading = false;
  /** 构造期声明的可命中性：退出提交态时恢复到它（禁用不改这个） */
  private baseInteractive = true;

  constructor(props: any = {}) {
    const theme = iceUIManager.getTheme();
    const variant = props.variant || 'primary';
    const size = props.size || 'middle';
    const danger = props.danger === true;
    const height = props.height || heightForSize(theme, size);
    const width = props.width || 96;
    const style = styleFor(theme, variant, danger, false, false, true, props.style || {});

    super({
      fill: style.fill !== false,
      stroke: style.stroke !== false,
      draggable: props.draggable !== undefined ? props.draggable : false,
      transformable: props.transformable !== undefined ? props.transformable : false,
      interactive: true,
      ...props,
      width,
      height,
      radius: props.radius ?? theme.radius.md,
      style: {
        fillStyle: style.fillStyle,
        strokeStyle: style.strokeStyle,
        lineWidth: theme.control.lineWidth,
        shadow: style.shadow,
        ...(props.style || {}),
      },
    });
    this.focusable = props.focusable !== false;

    this.variant = variant;
    this.size = size;
    this.danger = danger;
    this.baseInteractive = props.interactive !== false;
    this.text = String(props.text ?? 'Button');
    this.icon = props.icon === undefined || props.icon === null ? '' : String(props.icon);

    const fontSize = fontSizeForSize(theme, size);
    this.label = centerTextNode(this.__labelText(), theme, width, height, {
      fontSize,
      fontWeight: theme.font.weightMedium,
      fillStyle: textColor(theme, variant, danger, true, false),
    });
    this.addChild(this.label, false);
    // 无障碍：默认用按钮文字当可读名称
    if (props.ariaLabel !== undefined) {
      this.explicitAriaLabel = true;
      super.setAriaLabel(String(props.ariaLabel));
    } else {
      super.setAriaLabel(this.text);
    }
    if (props.loading === true) this.setLoading(true);
  }

  /** 覆盖可读名称（之后 setText 不会再把名字改回去）。 */
  public override setAriaLabel(label: string): this {
    super.setAriaLabel(label);
    this.explicitAriaLabel = true;
    return this;
  }

  /** 图标只影响画面：`getText()` 与无障碍名始终是纯文字。 */
  private __labelText(): string {
    return this.icon ? `${this.icon} ${this.text}` : this.text;
  }

  public setText(text: string): this {
    this.text = String(text ?? '');
    this.label.setText(this.__labelText());
    // 无障碍：按钮的可读名称就是它的文字（否则屏幕阅读器会念 id）
    if (!this.explicitAriaLabel) super.setAriaLabel(this.text);
    this.revalidate();
    return this;
  }

  public getText(): string {
    return this.text;
  }

  /** 换图标（空字符串 = 去掉图标）。 */
  public setIcon(icon: string): this {
    const next = icon === undefined || icon === null ? '' : String(icon);
    if (next === this.icon) return this;
    this.icon = next;
    this.label.setText(this.__labelText());
    this.revalidate();
    return this;
  }

  public getIcon(): string {
    return this.icon;
  }

  public isLoading(): boolean {
    return this.loading;
  }

  /**
   * 提交态：**挡住重复提交**，不只是换个样子 ——
   * 期间把 `interactive` 关掉，引擎的命中检测与键盘激活都会跳过它；
   * 与 `disabled` 正交：先禁用再解除 loading，仍然保持禁用。
   */
  public setLoading(loading: boolean): this {
    const next = loading === true;
    if (next === this.loading) return this;
    this.loading = next;
    this.state.interactive = next ? false : this.baseInteractive;
    this.__sync();
    return this;
  }

  /** 键盘激活（Enter/Space）在提交态下同样无效。 */
  public override activate(): void {
    if (this.loading) return;
    super.activate();
  }

  protected initEvents(): void {
    super.initEvents();
    this.on('mousedown', () => {
      if (!this.enabled) return;
      this.pressed = true;
      this.__sync();
    });
    this.on('mouseup', () => {
      this.pressed = false;
      this.__sync();
    });
    this.on('mouseleave', () => {
      this.pressed = false;
      this.__sync();
    });
  }

  public setEnabled(enabled: boolean): this {
    super.setEnabled(enabled);
    this.__sync();
    return this;
  }

  protected __applyHoverState(): void {
    this.__sync();
  }

  private __sync(): void {
    const theme = iceUIManager.getTheme();
    const active = this.enabled ? this.pressed : false;
    const style = styleFor(
      theme,
      this.variant,
      this.danger,
      active,
      this.hovered,
      this.enabled,
      this.state.style || {},
    );
    this.setState({
      style: {
        ...this.state.style,
        fillStyle: style.fillStyle,
        strokeStyle: style.strokeStyle,
        lineWidth: theme.control.lineWidth,
        shadow: style.shadow,
      },
    });
    this.label.setState({
      style: {
        fillStyle: textColor(theme, this.variant, this.danger, this.enabled, this.hovered),
        fontFamily: theme.font.family,
        fontSize: fontSizeForSize(theme, this.size),
        fontWeight: theme.font.weightMedium,
        textAlign: 'center',
        textBaseline: 'middle',
      },
    });
    this.revalidate();
  }
}
