import { ICECircle } from 'ice-render';
import { UIComponent } from '../core/UIComponent';
import { uiManager } from '../core/UIManager';
import { UIToggleModel } from '../model/UIToggleModel';

export class UIRadioButton extends UIComponent {
  private model: UIToggleModel;
  private outer: any;
  private inner: any;

  constructor(props: any = {}) {
    const theme = uiManager.getTheme();
    const selected = props.selected === true;
    const outerSize = props.size || theme.control.radioSize;
    const width = props.width || outerSize;
    const height = props.height || outerSize;
    const outerLeft = (width - outerSize) / 2;
    const outerTop = (height - outerSize) / 2;
    const outerRadius = outerSize / 2;
    const innerRadius = outerSize / 4;
    super({
      fill: false,
      stroke: false,
      draggable: false,
      width,
      height,
      ...props,
    });
    this.model = new UIToggleModel({ selected });
    this.outer = new ICECircle({
      left: outerLeft,
      top: outerTop,
      radius: outerRadius,
      style: {
        fillStyle: theme.colors.surface,
        strokeStyle: selected ? theme.colors.primary : theme.colors.borderSecondary,
        lineWidth: theme.control.lineWidth,
      },
    });
    this.inner = new ICECircle({
      left: outerLeft + outerSize / 2 - innerRadius,
      top: outerTop + outerSize / 2 - innerRadius,
      radius: innerRadius,
      style: {
        fillStyle: selected ? theme.colors.primary : 'transparent',
        strokeStyle: selected ? theme.colors.primary : 'transparent',
      },
    });
    this.addChild(this.outer, false);
    this.addChild(this.inner, false);
    this.model.addChangeListener(() => this.__sync());
  }

  public isSelected(): boolean {
    return this.model.isSelected();
  }

  public setSelected(selected: boolean): this {
    this.model.setSelected(selected);
    return this;
  }

  protected initEvents(): void {
    super.initEvents();
    this.on('mousedown', () => this.model.setSelected(true), this);
  }

  protected __applyHoverState(): void {
    this.__sync();
  }

  private __sync(): void {
    const theme = uiManager.getTheme();
    const selected = this.model.isSelected();
    this.outer.setState({
      style: {
        fillStyle: this.hovered && !selected ? theme.colors.primaryBg : theme.colors.surface,
        strokeStyle: selected || this.hovered ? theme.colors.primary : theme.colors.borderSecondary,
        lineWidth: theme.control.lineWidth,
      },
    });
    this.inner.setState({
      style: {
        fillStyle: selected ? (this.hovered ? theme.colors.primaryHover : theme.colors.primary) : 'transparent',
        strokeStyle: selected ? (this.hovered ? theme.colors.primaryHover : theme.colors.primary) : 'transparent',
      },
    });
    this.revalidate();
  }
}
