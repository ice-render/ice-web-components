import { UIComponent } from '../core/UIComponent';
import { uiManager } from '../core/UIManager';
import { createTextNode, getStatusColors } from '../util/UIStyle';

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
    const padX = theme.spacing.sm;
    this.textNode = createTextNode({
      left: padX,
      top: 0,
      width: Math.max(0, width - padX * 2),
      height,
      text: props.text ?? '0',
      fillStyle: colors.text,
      fontFamily: theme.font.family,
      fontSize: theme.font.sizeSmall,
      fontWeight: theme.font.weightSemibold,
      align: 'left',
      verticalAlign: 'middle',
    });
    this.addChild(this.textNode, false);
  }

  public setText(text: string): this {
    this.textNode.setText(text ?? '0');
    this.revalidate();
    return this;
  }
}
