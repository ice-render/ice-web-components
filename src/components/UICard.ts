import { ICEText } from 'ice-render';
import { UIPanel } from './UIPanel';
import { uiManager } from '../core/UIManager';

export class UICard extends UIPanel {
  private titleNode: any;

  constructor(props: any = {}) {
    super({
      ...props,
      style: {
        shadow: 'md',
        ...(props.style || {}),
      },
    });
    const theme = uiManager.getTheme();
    if (props.title) {
      this.titleNode = new ICEText({
        left: props.paddingLeft ?? 16,
        top: props.paddingTop ?? 12,
        text: props.title,
        style: {
          fillStyle: theme.colors.text,
          fontFamily: theme.font.family,
          fontSize: theme.font.sizeLarge,
          fontWeight: theme.font.weightBold,
        },
      });
      this.addChild(this.titleNode, false);
    }
  }

  public setTitle(title: string): this {
    if (!this.titleNode) {
      return this;
    }
    this.titleNode.setText(title);
    this.revalidate();
    return this;
  }
}
