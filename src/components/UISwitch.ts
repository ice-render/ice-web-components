import { ICECircle, ICERect } from 'ice-render';
import { UIComponent } from '../core/UIComponent';
import { uiManager } from '../core/UIManager';
import { UIToggleModel } from '../model/UIToggleModel';

export class UISwitch extends UIComponent {
  private model: UIToggleModel;
  private track: any;
  private knob: any;
  private knobTravel: number;

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
        shadow: theme.shadows.sm,
      },
    });
    this.addChild(this.track, false);
    this.addChild(this.knob, false);
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
    this.on('mousedown', () => this.model.toggle(), this);
  }

  protected __applyHoverState(): void {
    this.__sync();
  }

  private __sync(): void {
    const theme = uiManager.getTheme();
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
    const height = Number(this.state.height) || uiManager.getTheme().control.switchHeight;
    const knobSize = Number(this.knob.state.radius) * 2 || uiManager.getTheme().control.switchHandle;
    return (height - knobSize) / 2;
  }
}
