import { UIComponent } from '../core/UIComponent';
import { uiManager } from '../core/UIManager';
import { centerTextNode, getStatusColors } from '../util/UIStyle';

export class UITag extends UIComponent {
  private textNode: any;
  private statusColors: { background: string; border: string; text: string };

  constructor(props: any = {}) {
    const theme = uiManager.getTheme();
    const status = props.status || props.color || 'default';
    const colors = getStatusColors(theme, status);
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
        fillStyle: colors.background,
        strokeStyle: colors.border,
        lineWidth: theme.control.lineWidth,
        ...(props.style || {}),
      },
    });
    this.statusColors = colors;
    this.textNode = centerTextNode(props.text ?? 'Tag', theme, width, height, {
      fontSize: theme.font.sizeSmall,
      fontWeight: theme.font.weightMedium,
      fillStyle: colors.text,
    });
    this.addChild(this.textNode, false);
  }

  public setText(text: string): this {
    this.textNode.setText(text ?? '');
    this.revalidate();
    return this;
  }

  protected __applyHoverState(): void {
    const theme = uiManager.getTheme();
    this.setState({
      style: {
        ...this.state.style,
        fillStyle: this.hovered ? this.__mix(theme.colors.surface, this.statusColors.background, 0.55) : this.statusColors.background,
        strokeStyle: this.hovered ? this.statusColors.border : this.statusColors.border,
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
