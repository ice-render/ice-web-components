import { ICERect } from 'ice-render';
import { UIComponent } from '../core/UIComponent';
import { uiManager } from '../core/UIManager';
import { UIBoundedRangeModel } from '../model/UIBoundedRangeModel';

export class UIProgressBar extends UIComponent {
  private model: UIBoundedRangeModel;
  private track: any;
  private fill: any;

  constructor(props: any = {}) {
    const theme = uiManager.getTheme();
    super({
      fill: false,
      stroke: false,
      draggable: false,
      ...props,
    });
    this.model = new UIBoundedRangeModel({
      value: props.value,
      min: props.min,
      max: props.max,
    });
    const width = props.width || 160;
    const height = props.height || 10;
    this.track = new ICERect({
      left: 0,
      top: 0,
      width,
      height,
      radius: height / 2,
      style: {
        fillStyle: theme.colors.disabled,
        strokeStyle: theme.colors.disabled,
      },
    });
    this.fill = new ICERect({
      left: 0,
      top: 0,
      width: this.__fillWidth(width),
      height,
      radius: height / 2,
      style: {
        fillStyle: theme.colors.primary,
        strokeStyle: theme.colors.primary,
      },
    });
    this.addChild(this.track, false);
    this.addChild(this.fill, false);
    this.model.addChangeListener(() => this.__sync());
  }

  public setValue(value: number): this {
    this.model.setValue(value);
    return this;
  }

  public getValue(): number {
    return this.model.getValue();
  }

  private __fillWidth(width: number): number {
    const min = this.model.getMinimum();
    const max = this.model.getMaximum();
    const ratio = (this.model.getValue() - min) / Math.max(1, max - min);
    return Math.max(0, Math.min(width, width * ratio));
  }

  private __sync(): void {
    this.fill.setState({
      width: this.__fillWidth(this.track.state.width),
    });
    this.revalidate();
  }
}
