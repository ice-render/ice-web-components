import { UIPanel } from './UIPanel';
import { uiManager } from '../core/UIManager';
import { createTextNode } from '../util/UIStyle';

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
      this.titleNode = createTextNode({
        left: props.paddingLeft ?? theme.spacing.md,
        top: props.paddingTop ?? theme.spacing.sm,
        text: props.title,
        fillStyle: theme.colors.text,
        fontFamily: theme.font.family,
        fontSize: theme.font.sizeLarge,
        fontWeight: theme.font.weightSemibold,
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
