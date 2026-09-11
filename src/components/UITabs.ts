import { UIButton } from './UIButton';
import { UIContainer } from '../core/UIContainer';
import { UIFlowLayout } from '../layouts/UIFlowLayout';

export class UITabs extends UIContainer {
  private buttons: UIButton[] = [];
  private activeIndex = 0;

  constructor(props: any = {}) {
    super({
      fill: false,
      stroke: false,
      ...props,
    });
    this.setUILayout(new UIFlowLayout({ gap: 8, align: 'left' }));
    const tabs: string[] = props.tabs || [];
    tabs.forEach((text, index) => {
      const button = new UIButton({
        text,
        width: 90,
        height: 36,
        style:
          index === 0
            ? {}
            : { fillStyle: '#ffffff', strokeStyle: '#cbd5e1' },
      });
      this.buttons.push(button);
      this.addChild(button, false);
    });
    this.buttons.forEach((button, index) => {
      button.on('mousedown', () => this.setActiveIndex(index), this);
    });
    this.doLayout();
  }

  public getActiveIndex(): number {
    return this.activeIndex;
  }

  public setActiveIndex(index: number): this {
    if (index < 0 || index >= this.buttons.length) {
      return this;
    }
    this.activeIndex = index;
    this.buttons.forEach((button, i) => {
      const theme = this.theme();
      button.setState({
        style:
          i === index
            ? { fillStyle: theme.colors.primary, strokeStyle: theme.colors.primary }
            : { fillStyle: theme.colors.surface, strokeStyle: theme.colors.border },
      });
    });
    this.revalidate();
    return this;
  }
}
