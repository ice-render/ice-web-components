import { ICEText } from 'ice-render';
import { UIComponent } from '../core/UIComponent';
import { uiManager } from '../core/UIManager';

export class UIBadge extends UIComponent {
  private textNode: any;

  constructor(props: any = {}) {
    const theme = uiManager.getTheme();
    super({
      fill: true,
      stroke: false,
      style: {
        fillStyle: theme.colors.primary,
        ...(props.style || {}),
      },
      ...props,
    });
    this.textNode = new ICEText({
      left: props.paddingLeft ?? 8,
      top: 0,
      text: props.text ?? '0',
      style: {
        fillStyle: theme.colors.primaryText,
        fontFamily: theme.font.family,
        fontSize: theme.font.sizeSmall,
        fontWeight: theme.font.weightBold,
      },
    });
    this.addChild(this.textNode, false);
  }

  public setText(text: string): this {
    this.textNode.setText(text ?? '0');
    this.revalidate();
    return this;
  }
}
