import { ICECircle } from 'ice-render';
import { ICEWidget } from '../core/ICEWidget';
import { iceUIManager } from '../core/ICEManager';
import { ICEToggleModel } from '../model/ICEToggleModel';

export class ICERadioButton extends ICEWidget {
  private model: ICEToggleModel;
  private outer: any;
  private inner: any;

  constructor(props: any = {}) {
    const theme = iceUIManager.getTheme();
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
    this.focusable = props.focusable !== false;
    this.model = new ICEToggleModel({ selected });
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
    this.model.addChangeListener(() => {
      this.__sync();
      this.trigger('change', null, { value: this.isSelected() });
    });
  }

  public isSelected(): boolean {
    return this.model.isSelected();
  }

  public setSelected(selected: boolean): this {
    this.model.setSelected(selected);
    return this;
  }

  public getFormValue(): any {
    return this.isSelected();
  }

  public setFormValue(value: any): void {
    this.setSelected(!!value);
  }

  /** 键盘激活（Enter / Space）与鼠标点击同义：选中本项。 */
  public activate(): void {
    if (!this.enabled) {
      return;
    }
    this.model.setSelected(true);
  }

  protected initEvents(): void {
    super.initEvents();
    this.on('mousedown', () => this.model.setSelected(true), this);
  }

  protected __applyHoverState(): void {
    this.__sync();
  }

  private __sync(): void {
    const theme = iceUIManager.getTheme();
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
