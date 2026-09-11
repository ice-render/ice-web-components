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
    const width = props.width || 44;
    const height = props.height || 22;
    this.knobTravel = width - height;
    this.track = new ICERect({
      left: 0,
      top: 0,
      width,
      height,
      radius: height / 2,
      style: {
        fillStyle: selected ? theme.colors.primary : theme.colors.border,
        strokeStyle: selected ? theme.colors.primary : theme.colors.border,
      },
    });
    this.knob = new ICECircle({
      left: selected ? this.knobTravel : 1,
      top: 1,
      radius: height / 2 - 1,
      style: {
        fillStyle: theme.colors.surface,
        strokeStyle: theme.colors.surface,
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

  private __sync(): void {
    const theme = uiManager.getTheme();
    const selected = this.model.isSelected();
    this.track.setState({
      style: {
        fillStyle: selected ? theme.colors.primary : theme.colors.border,
        strokeStyle: selected ? theme.colors.primary : theme.colors.border,
      },
    });
    this.knob.setState({
      left: selected ? this.knobTravel : 1,
    });
    this.revalidate();
  }
}
