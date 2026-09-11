import { UILabel } from './UILabel';
import { UIComponent } from '../core/UIComponent';
import { uiManager } from '../core/UIManager';

export class UIButton extends UIComponent {
  private label: UILabel;

  constructor(props: any = {}) {
    const theme = uiManager.getTheme();
    super({
      fill: true,
      stroke: true,
      style: {
        fillStyle: theme.colors.primary,
        strokeStyle: theme.colors.primary,
        lineWidth: 1,
        ...(props.style || {}),
      },
      ...props,
    });

    const labelLeft = Number(props.paddingLeft ?? 16);
    this.label = new UILabel({
      left: labelLeft,
      top: 0,
      text: props.text ?? 'Button',
      style: {
        fillStyle: theme.colors.primaryText,
        fontFamily: theme.font.family,
        fontSize: theme.font.size,
        fontWeight: theme.font.weightBold,
      },
    });
    this.addChild(this.label, false);
  }

  public setText(text: string): this {
    this.label.setText(text ?? '');
    this.revalidate();
    return this;
  }

  public getText(): string {
    return this.label.getText();
  }
}
