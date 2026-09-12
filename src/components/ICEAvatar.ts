import { ICECircle } from 'ice-render';
import { ICEWidget } from '../core/ICEWidget';
import { iceUIManager } from '../core/ICEManager';
import { centerTextNode } from '../util/ICEStyle';

export class ICEAvatar extends ICEWidget {
  private circle: any;
  private textNode: any;

  constructor(props: any = {}) {
    const theme = iceUIManager.getTheme();
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

  public getText(): string {
    return this.textNode.getText();
  }
}
