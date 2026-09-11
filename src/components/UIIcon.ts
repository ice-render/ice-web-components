import { UIComponent } from '../core/UIComponent';
import { uiManager } from '../core/UIManager';
import { centerTextNode } from '../util/UIStyle';

export class UIIcon extends UIComponent {
  private textNode: any;

  constructor(props: any = {}) {
    const theme = uiManager.getTheme();
    const size = props.size || props.fontSize || theme.font.sizeLarge;
    super({
      fill: false,
      stroke: false,
      width: size,
      height: size,
      ...props,
    });
    this.textNode = centerTextNode(props.icon || props.text || '★', theme, size, size, {
      fontSize: size,
      fontWeight: theme.font.weightNormal,
      fillStyle: props.color || theme.colors.text,
    });
    this.addChild(this.textNode, false);
  }

  public setIcon(icon: string): this {
    this.textNode.setText(icon || '★');
    this.revalidate();
    return this;
  }
}
