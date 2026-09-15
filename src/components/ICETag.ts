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

  /**
   * 尺寸变化时把内层文字盒铺到新的胶囊盒上（`ICEWidget.__syncInternalLayout()`）。
   *
   * 构造期按 `props.width/height` 算好文字盒（左右各让出 `spacing.sm` 内边距）就再没对过账：
   * 父层布局把胶囊拉宽/拉窄之后，文字盒还停在旧尺寸，`align: center` 于是在旧盒子里居中 ——
   * 文字偏出胶囊（表格状态列这类定宽胶囊一定会看到）。
   */
  protected __syncInternalLayout(): void {
    if (!this.textNode) {
      return; // dot 模式/无文字
    }
    const padX = iceUIManager.getTheme().spacing.sm;
    const width = Number(this.state.width) || 0;
    const height = Number(this.state.height) || 0;
    this.textNode.setState({ left: padX, top: 0, width: Math.max(0, width - padX * 2), height });
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
