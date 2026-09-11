import { UIComponent } from '../core/UIComponent';
import { uiManager } from '../core/UIManager';
import { centerTextNode, getStatusColors } from '../util/UIStyle';

export class UIBadge extends UIComponent {
  private textNode: any;

  constructor(props: any = {}) {
    const theme = uiManager.getTheme();
    const status = props.status || props.color || 'primary';
    const colors = getStatusColors(theme, status);
    const height = props.height || 20;
    const width = props.width || Math.max(24, height);
    super({
      ...props,
      fill: true,
      stroke: true,
      width,
      height,
      radius: theme.radius.pill,
      style: {
        fillStyle: colors.background,
        strokeStyle: colors.border,
        lineWidth: theme.control.lineWidth,
        ...(props.style || {}),
      },
    });
    this.textNode = centerTextNode(props.text ?? '0', theme, width, height, {
      fontSize: theme.font.sizeSmall,
      fontWeight: theme.font.weightSemibold,
      fillStyle: colors.text,
    });
    this.addChild(this.textNode, false);
  }

  public setText(text: string): this {
    this.textNode.setText(text ?? '0');
    this.revalidate();
    return this;
  }
}
