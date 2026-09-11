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
    super({
      fill: false,
      stroke: false,
      draggable: false,
      ...props,
    });
    this.model = new UIToggleModel({ selected });
    this.outer = new ICECircle({
      left: 0,
      top: 0,
      radius: props.size ? props.size / 2 : 9,
      style: {
        fillStyle: theme.colors.surface,
        strokeStyle: selected ? theme.colors.primary : theme.colors.border,
        lineWidth: 1,
      },
    });
    this.inner = new ICECircle({
      left: 4,
      top: 4,
      radius: props.size ? props.size / 4 : 5,
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

  private __sync(): void {
    const theme = uiManager.getTheme();
    const selected = this.model.isSelected();
    this.outer.setState({
      style: {
        fillStyle: theme.colors.surface,
        strokeStyle: selected ? theme.colors.primary : theme.colors.border,
        lineWidth: 1,
      },
    });
    this.inner.setState({
      style: {
        fillStyle: selected ? theme.colors.primary : 'transparent',
        strokeStyle: selected ? theme.colors.primary : 'transparent',
      },
    });
    this.revalidate();
  }
}
