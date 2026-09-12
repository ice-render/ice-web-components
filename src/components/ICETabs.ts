import { ICEButton } from './ICEButton';
import { ICEContainer } from '../core/ICEContainer';
import { ICEFlowLayout } from 'ice-render';
import { iceUIManager } from '../core/ICEManager';

export class ICETabs extends ICEContainer {
  private buttons: ICEButton[] = [];
  private activeIndex = 0;

  constructor(props: any = {}) {
    const theme = iceUIManager.getTheme();
    const height = props.height || theme.control.height;
    super({
      fill: false,
      stroke: false,
      ...props,
    });
    this.setLayout(new ICEFlowLayout({ gap: 8, align: 'left' }));
    const tabs: string[] = props.tabs || [];
    const gap = 8;
    const totalGap = Math.max(0, tabs.length - 1) * gap;
    const autoWidth = props.width ? (props.width - totalGap) / Math.max(1, tabs.length) : 90;
    tabs.forEach((text, index) => {
      const button = new ICEButton({
        text,
        width: Math.max(64, autoWidth),
        height,
        variant: index === 0 ? 'primary' : 'default',
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
      const active = i === index;
      button.setState({
        style: {
          ...button.state.style,
          fillStyle: active ? theme.colors.primary : theme.colors.surface,
          strokeStyle: active ? theme.colors.primary : theme.colors.border,
          ...(active ? theme.shadows.sm : {}),
        },
      });
      const label = button.childNodes && button.childNodes[0];
      if (label && label.setState) {
        label.setState({
          style: {
            fillStyle: active ? theme.colors.primaryText : theme.colors.text,
            fontFamily: theme.font.family,
            fontSize: theme.font.size,
            fontWeight: theme.font.weightMedium,
            textAlign: 'center',
            textBaseline: 'middle',
          },
        });
      }
    });
    this.revalidate();
    return this;
  }
}
