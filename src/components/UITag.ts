import { ICEText } from 'ice-render';
import { UIComponent } from '../core/UIComponent';
import { uiManager } from '../core/UIManager';

export class UITag extends UIComponent {
  private textNode: any;

  constructor(props: any = {}) {
    const theme = uiManager.getTheme();
    super({
      fill: true,
      stroke: true,
      style: {
        fillStyle: theme.colors.surface,
        strokeStyle: theme.colors.border,
        lineWidth: 1,
        ...(props.style || {}),
      },
      ...props,
    });
    this.textNode = new ICEText({
      left: props.paddingLeft ?? 10,
      top: 0,
      text: props.text ?? 'Tag',
      style: {
        fillStyle: theme.colors.text,
        fontFamily: theme.font.family,
        fontSize: theme.font.size,
      },
    });
    this.addChild(this.textNode, false);
  }

  public setText(text: string): this {
    this.textNode.setText(text ?? '');
    this.revalidate();
    return this;
  }
}
