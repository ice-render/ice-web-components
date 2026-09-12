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

    const fontSize = fontSizeForSize(theme, size);
    this.label = centerTextNode(props.text ?? 'Button', theme, width, height, {
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
      super.setAriaLabel(String(props.text ?? 'Button'));
    }
  }

  /** 覆盖可读名称（之后 setText 不会再把名字改回去）。 */
  public override setAriaLabel(label: string): this {
    super.setAriaLabel(label);
    this.explicitAriaLabel = true;
    return this;
  }

  public setText(text: string): this {
    this.label.setText(text ?? '');
    // 无障碍：按钮的可读名称就是它的文字（否则屏幕阅读器会念 id）
    if (!this.explicitAriaLabel) super.setAriaLabel(text ?? '');
    this.revalidate();
    return this;
  }

  public getText(): string {
    return this.label.getText();
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
