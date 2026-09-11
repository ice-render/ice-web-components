import { UIComponent } from '../core/UIComponent';
import { uiManager } from '../core/UIManager';
import { createTextNode, getStatusColors } from '../util/UIStyle';

export type UIAlertType = 'info' | 'success' | 'warning' | 'error';

export class UIAlert extends UIComponent {
  private titleNode: any;
  private messageNode: any;
  private type: UIAlertType;

  constructor(props: any = {}) {
    const theme = uiManager.getTheme();
    const type = props.type || 'info';
    const colors = getStatusColors(theme, type);
    const width = props.width || 420;
    const height = props.height || 60;

    super({
      ...props,
      fill: true,
      stroke: true,
      width,
      height,
      radius: theme.radius.md,
      style: {
        fillStyle: colors.background,
        strokeStyle: colors.border,
        lineWidth: theme.control.lineWidth,
        ...(props.style || {}),
      },
    });

    this.type = type;
    this.titleNode = createTextNode({
      left: theme.spacing.md,
      top: theme.spacing.xs,
      text: props.title || '',
      fillStyle: colors.text,
      fontFamily: theme.font.family,
      fontSize: theme.font.size,
      fontWeight: theme.font.weightSemibold,
      align: 'left',
      verticalAlign: 'top',
    });
    this.messageNode = createTextNode({
      left: theme.spacing.md,
      top: theme.spacing.lg,
      text: props.message || '',
      fillStyle: theme.colors.textSecondary,
      fontFamily: theme.font.family,
      fontSize: theme.font.sizeSmall,
      fontWeight: theme.font.weightNormal,
      align: 'left',
      verticalAlign: 'top',
    });
    this.addChild(this.titleNode, false);
    this.addChild(this.messageNode, false);
  }

  public setTitle(title: string): this {
    this.titleNode.setText(title ?? '');
    this.revalidate();
    return this;
  }

  public setMessage(message: string): this {
    this.messageNode.setText(message ?? '');
    this.revalidate();
    return this;
  }

  public getType(): UIAlertType {
    return this.type;
  }
}
