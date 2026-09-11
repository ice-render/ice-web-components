import { ICECircle, ICERect } from 'ice-render';
import { UIComponent } from '../core/UIComponent';
import { uiManager } from '../core/UIManager';
import { UIBoundedRangeModel } from '../model/UIBoundedRangeModel';

export class UISlider extends UIComponent {
  private model: UIBoundedRangeModel;
  private track: any;
  private thumb: any;

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
    const height = props.height || 6;
    const thumbSize = props.thumbSize || 16;
    this.track = new ICERect({
      left: 0,
      top: (thumbSize - height) / 2,
      width,
      height,
      radius: height / 2,
      style: {
        fillStyle: theme.colors.border,
        strokeStyle: theme.colors.border,
      },
    });
    this.thumb = new ICECircle({
      left: this.__thumbLeft(width),
      top: 0,
      radius: thumbSize / 2,
      style: {
        fillStyle: theme.colors.primary,
        strokeStyle: theme.colors.surface,
        lineWidth: 2,
      },
    });
    this.addChild(this.track, false);
    this.addChild(this.thumb, false);
    this.model.addChangeListener(() => this.__sync());
  }

  public setValue(value: number): this {
    this.model.setValue(value);
    return this;
  }

  public getValue(): number {
    return this.model.getValue();
  }

  private __thumbLeft(width: number): number {
    const min = this.model.getMinimum();
    const max = this.model.getMaximum();
    const ratio = (this.model.getValue() - min) / Math.max(1, max - min);
    return width * Math.max(0, Math.min(1, ratio));
  }

  private __sync(): void {
    this.thumb.setState({
      left: this.__thumbLeft(this.track.state.width),
    });
    this.revalidate();
  }
}
