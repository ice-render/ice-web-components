import { ICEText } from 'ice-render';
import { UIComponent } from '../core/UIComponent';
import { uiManager } from '../core/UIManager';

export class UILabel extends UIComponent {
  private textNode: any;

  constructor(props: any = {}) {
    const theme = uiManager.getTheme();
    const font = {
      fillStyle: theme.colors.text,
      fontFamily: theme.font.family,
      fontSize: theme.font.size,
      fontWeight: theme.font.weightNormal,
    };
    super({
      fill: false,
      stroke: false,
      ...props,
    });
    const vAlign = props.verticalAlign;
    // 默认居中：无显式 height 时 ICEText 自动按文字尺寸包裹，文字从 top 起绘；
    // 有显式 height（如与控件同行）时文字在 box 内垂直居中，与相邻控件对齐。
    const baseline =
      vAlign === 'top' ? 'top' : vAlign === 'bottom' ? 'bottom' : 'middle';
    this.textNode = new ICEText({
      left: 0,
      top: 0,
      text: props.text ?? '',
      stroke: false,
      style: {
        ...font,
        ...(baseline ? { textBaseline: baseline } : {}),
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
