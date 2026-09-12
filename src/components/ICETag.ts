import { ICEWidget } from '../core/ICEWidget';
import { iceUIManager } from '../core/ICEManager';
import { ICEStatusColors, createTextNode, getStatusColors } from '../util/ICEStyle';

/**
 * 标签：默认 Bootstrap 实底（`.text-bg-*`），`variant: 'soft'` 切浅底 + 强调文字。
 */
export class ICETag extends ICEWidget {
  private textNode: any;
  private statusColors: ICEStatusColors;
  /** `solid` = Bootstrap `.text-bg-*` 实底（默认）；`soft` = subtle 浅底 + 强调文字 */
  private variant: 'solid' | 'soft';

  constructor(props: any = {}) {
    const theme = iceUIManager.getTheme();
    const status = props.status || props.color || 'default';
    const colors = getStatusColors(theme, status);
    const variant: 'solid' | 'soft' = props.variant === 'soft' ? 'soft' : 'solid';
    const height = props.height || 24;
    const width = props.width || 56;
    super({
      ...props,
      fill: true,
      stroke: true,
      width,
      height,
      radius: theme.radius.sm,
      style: {
        fillStyle: variant === 'solid' ? colors.solid : colors.background,
        strokeStyle: variant === 'solid' ? colors.solid : colors.border,
        lineWidth: theme.control.lineWidth,
        ...(props.style || {}),
      },
    });
    this.statusColors = colors;
    this.variant = variant;
    const padX = theme.spacing.sm;
    this.textNode = createTextNode({
      left: padX,
      top: 0,
      width: Math.max(0, width - padX * 2),
      height,
      text: props.text ?? 'Tag',
      fillStyle: variant === 'solid' ? colors.onSolid : colors.strong,
      fontFamily: theme.font.family,
      fontSize: theme.font.sizeSmall,
      fontWeight: theme.font.weightMedium,
      // 与 ICEBadge 一致：在去掉左右内边距后的内盒里居中
      align: 'center',
      verticalAlign: 'middle',
    });
    this.addChild(this.textNode, false);
  }

  public setText(text: string): this {
    this.textNode.setText(text ?? '');
    this.revalidate();
    return this;
  }

  protected __applyHoverState(): void {
    const theme = iceUIManager.getTheme();
    const base = this.variant === 'solid' ? this.statusColors.solid : this.statusColors.background;
    // solid：稍微提亮；soft：往面色上靠一点
    const hoverFill =
      this.variant === 'solid'
        ? this.__mix('#ffffff', this.statusColors.solid, 0.85)
        : this.__mix(theme.colors.surface, this.statusColors.background, 0.55);
    this.setState({
      style: {
        ...this.state.style,
        fillStyle: this.hovered ? hoverFill : base,
        strokeStyle:
          this.variant === 'solid' ? (this.hovered ? hoverFill : this.statusColors.solid) : this.statusColors.border,
        lineWidth: theme.control.lineWidth,
      },
    });
    this.revalidate();
  }

  private __mix(a: string, b: string, ratio: number): string {
    if (ratio <= 0) return b;
    if (ratio >= 1) return a;
    const pa = this.__hex(a);
    const pb = this.__hex(b);
    if (!pa || !pb) return b;
    return `rgba(${Math.round(pa[0] * ratio + pb[0] * (1 - ratio))}, ${Math.round(
      pa[1] * ratio + pb[1] * (1 - ratio),
    )}, ${Math.round(pa[2] * ratio + pb[2] * (1 - ratio))}, 1)`;
  }

  private __hex(color: string): [number, number, number] | null {
    const m = /^#([0-9a-f]{6})$/i.exec(color);
    if (!m) return null;
    return [
      parseInt(m[1].slice(0, 2), 16),
      parseInt(m[1].slice(2, 4), 16),
      parseInt(m[1].slice(4, 6), 16),
    ];
  }
}
