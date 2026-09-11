import { ICECircle } from 'ice-render';
import { UIComponent } from '../core/UIComponent';
import { uiManager } from '../core/UIManager';
import { centerTextNode } from '../util/UIStyle';

export class UIAvatar extends UIComponent {
  private circle: any;
  private textNode: any;

  constructor(props: any = {}) {
    const theme = uiManager.getTheme();
    const size = props.size || 40;
    super({
      fill: false,
      stroke: false,
      width: size,
      height: size,
      ...props,
    });
    this.circle = new ICECircle({
      left: 0,
      top: 0,
      radius: size / 2,
      style: {
        fillStyle: props.backgroundColor || theme.colors.primary,
        strokeStyle: theme.colors.surface,
        lineWidth: 2,
      },
    });
    this.textNode = centerTextNode(props.text || 'U', theme, size, size, {
      fontSize: Math.round(size * 0.4),
      fontWeight: theme.font.weightSemibold,
      fillStyle: theme.colors.primaryText,
    });
    this.addChild(this.circle, false);
    this.addChild(this.textNode, false);
  }

  public setText(text: string): this {
    this.textNode.setText(text || 'U');
    this.revalidate();
    return this;
  }
}
