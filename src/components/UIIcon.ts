import { ICEText } from 'ice-render';
import { UIComponent } from '../core/UIComponent';
import { uiManager } from '../core/UIManager';

export class UIIcon extends UIComponent {
  private textNode: any;

  constructor(props: any = {}) {
    const theme = uiManager.getTheme();
    super({
      fill: false,
      stroke: false,
      ...props,
    });
    this.textNode = new ICEText({
      left: 0,
      top: 0,
      text: props.icon || props.text || '★',
      style: {
        fillStyle: theme.colors.text,
        fontFamily: theme.font.family,
        fontSize: props.size || theme.font.sizeLarge,
      },
    });
    this.addChild(this.textNode, false);
  }

  public setIcon(icon: string): this {
    this.textNode.setText(icon || '★');
    this.revalidate();
    return this;
  }
}
