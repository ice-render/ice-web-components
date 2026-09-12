import { ICECircle, ICERect } from 'ice-render';
import { ICEWidget } from '../core/ICEWidget';
import { iceUIManager } from '../core/ICEManager';
import { ICEToggleModel } from '../model/ICEToggleModel';

export class ICESwitch extends ICEWidget {
  private model: ICEToggleModel;
  private track: any;
  private knob: any;
  private knobTravel: number;

  constructor(props: any = {}) {
    const theme = iceUIManager.getTheme();
    const selected = props.selected === true;
    super({
      fill: false,
      stroke: false,
      draggable: false,
      ...props,
    });
    this.focusable = props.focusable !== false;
    this.model = new ICEToggleModel({ selected });
    const width = props.width || theme.control.switchWidth;
    const height = props.height || theme.control.switchHeight;
    const knobSize = Math.max(12, Math.min(theme.control.switchHandle, height - 4));
    const knobGap = (height - knobSize) / 2;
    this.knobTravel = width - knobSize - knobGap * 2;
    this.track = new ICERect({
      left: 0,
      top: 0,
      width,
      height,
      radius: height / 2,
      style: {
        fillStyle: selected ? theme.colors.primary : theme.colors.borderSecondary,
        strokeStyle: selected ? theme.colors.primary : theme.colors.borderSecondary,
        lineWidth: theme.control.lineWidth,
      },
    });
    this.knob = new ICECircle({
      left: selected ? this.knobTravel : knobGap,
      top: knobGap,
      radius: knobSize / 2,
      style: {
        fillStyle: theme.colors.surface,
        strokeStyle: theme.colors.surface,
        ...theme.shadows.sm,
      },
    });
    this.addChild(this.track, false);
    this.addChild(this.knob, false);
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

  /** 键盘激活（Enter / Space）与鼠标点击同义：切换开关。 */
  public activate(): void {
    if (!this.enabled) {
      return;
    }
    this.model.toggle();
  }

  protected initEvents(): void {
    super.initEvents();
    this.on('mousedown', () => this.model.toggle(), this);
  }

  protected __applyHoverState(): void {
    this.__sync();
  }

  private __sync(): void {
    const theme = iceUIManager.getTheme();
    const selected = this.model.isSelected();
    this.track.setState({
      style: {
        fillStyle: selected
          ? this.hovered
            ? theme.colors.primaryHover
            : theme.colors.primary
          : this.hovered
          ? theme.colors.primaryBorder
          : theme.colors.borderSecondary,
        strokeStyle: selected
          ? this.hovered
            ? theme.colors.primaryHover
            : theme.colors.primary
          : this.hovered
          ? theme.colors.primaryBorder
          : theme.colors.borderSecondary,
        lineWidth: theme.control.lineWidth,
      },
    });
    this.knob.setState({
      left: selected ? this.knobTravel : this.__knobGap(),
    });
    this.revalidate();
  }

  private __knobGap(): number {
    const height = Number(this.state.height) || iceUIManager.getTheme().control.switchHeight;
    const knobSize = Number(this.knob.state.radius) * 2 || iceUIManager.getTheme().control.switchHandle;
    return (height - knobSize) / 2;
  }
}
