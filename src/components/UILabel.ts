import { ICEText } from 'ice-render';
import { UIComponent } from '../core/UIComponent';
import { uiManager } from '../core/UIManager';

export class UILabel extends UIComponent {
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
      text: props.text ?? '',
      style: {
        fillStyle: theme.colors.text,
        fontFamily: theme.font.family,
        fontSize: theme.font.size,
        fontWeight: theme.font.weightNormal,
        ...(props.style || {}),
      },
    });
    this.addChild(this.textNode, false);
  }

  public setText(text: string): this {
    this.textNode.setText(text ?? '');
    this.revalidate();
    return this;
  }

  public getText(): string {
    return this.textNode.getText();
  }
}
