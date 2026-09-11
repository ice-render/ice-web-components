import { ICECircle, ICERect } from 'ice-render';
import { UIComponent } from '../core/UIComponent';
import { uiManager } from '../core/UIManager';
import { UIBoundedRangeModel } from '../model/UIBoundedRangeModel';

export class UISlider extends UIComponent {
  private model: UIBoundedRangeModel;
  private track: any;
  private fill: any;
  private thumb: any;
  private dragging = false;
  private __bound = false;

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
    const trackHeight = props.trackHeight || theme.control.sliderTrackHeight;
    const thumbSize = props.thumbSize || theme.control.sliderHandle;
    const height = Math.max(props.height || theme.control.sliderHandle, thumbSize);
    const trackTop = (height - trackHeight) / 2;
    this.track = new ICERect({
      left: 0,
      top: trackTop,
      width,
      height: trackHeight,
      radius: trackHeight / 2,
      style: {
        fillStyle: theme.colors.borderSecondary,
        strokeStyle: theme.colors.borderSecondary,
        lineWidth: theme.control.lineWidth,
      },
    });
    this.fill = new ICERect({
      left: 0,
      top: trackTop,
      width: this.__fillWidth(width, thumbSize),
      height: trackHeight,
      radius: trackHeight / 2,
      style: {
        fillStyle: theme.colors.primary,
        strokeStyle: theme.colors.primary,
        lineWidth: theme.control.lineWidth,
      },
    });
    this.thumb = new ICECircle({
      left: this.__thumbLeft(width, thumbSize),
      top: (height - thumbSize) / 2,
      radius: thumbSize / 2,
      style: {
        fillStyle: theme.colors.primary,
        strokeStyle: theme.colors.surface,
        lineWidth: theme.control.lineWidth + 1,
        shadow: theme.shadows.sm,
      },
    });
    this.addChild(this.track, false);
    this.addChild(this.fill, false);
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

  protected afterAddHandler(): void {
    super.afterAddHandler();
    this.__bindGlobalEvents();
  }

  private __bindGlobalEvents(): void {
    if (this.__bound || !this.ice || !this.ice.evtBus) {
      return;
    }
    this.__bound = true;
    this.ice.evtBus.on('mousedown', this.__onGlobalMouseDown, this);
    this.ice.evtBus.on('mousemove', this.__onGlobalMouseMove, this);
    this.ice.evtBus.on('mouseup', this.__onGlobalMouseUp, this);
  }

  private __onGlobalMouseDown(evt: any): void {
    if (!this.enabled || !this.__isPointInside(evt)) {
      return;
    }
    this.dragging = true;
    this.__updateFromEvent(evt);
  }

  private __onGlobalMouseMove(evt: any): void {
    if (!this.dragging) {
      return;
    }
    this.__updateFromEvent(evt);
  }

  private __onGlobalMouseUp(): void {
    this.dragging = false;
  }

  private __isPointInside(evt: any): boolean {
    if (!evt || typeof evt.offsetX !== 'number' || typeof evt.offsetY !== 'number') {
      return false;
    }
    const [wx, wy] = this.ice.screenToWorld(evt.offsetX, evt.offsetY);
    const box = this.getMinBoundingBox(true);
    return wx >= box.tl[0] && wx <= box.br[0] && wy >= box.tl[1] && wy <= box.br[1];
  }

  private __updateFromEvent(evt: any): void {
    if (!evt || typeof evt.offsetX !== 'number') {
      return;
    }
    const [wx] = this.ice.screenToWorld(evt.offsetX, evt.offsetY);
    const box = this.getMinBoundingBox(true);
    const width = box.br[0] - box.tl[0] || 1;
    const ratio = Math.max(0, Math.min(1, (wx - box.tl[0]) / width));
    const min = this.model.getMinimum();
    const max = this.model.getMaximum();
    this.model.setValue(min + ratio * (max - min));
  }

  protected __applyHoverState(): void {
    this.__sync();
  }

  private __thumbLeft(width: number, thumbSize?: number): number {
    const min = this.model.getMinimum();
    const max = this.model.getMaximum();
    const ratio = (this.model.getValue() - min) / Math.max(1, max - min);
    const size = thumbSize ?? (Number(this.thumb.state.radius) * 2 || 0);
    return width * Math.max(0, Math.min(1, ratio)) - size / 2;
  }

  private __fillWidth(width: number, thumbSize: number): number {
    const min = this.model.getMinimum();
    const max = this.model.getMaximum();
    const ratio = (this.model.getValue() - min) / Math.max(1, max - min);
    return width * Math.max(0, Math.min(1, ratio));
  }

  private __sync(): void {
    const width = Number(this.track.state.width);
    const thumbSize = Number(this.thumb.state.radius) * 2 || 0;
    this.thumb.setState({
      left: this.__thumbLeft(this.track.state.width),
      style: {
        fillStyle: this.hovered ? uiManager.getTheme().colors.primaryHover : uiManager.getTheme().colors.primary,
        strokeStyle: uiManager.getTheme().colors.surface,
        lineWidth: uiManager.getTheme().control.lineWidth + (this.hovered ? 2 : 1),
        shadow: uiManager.getTheme().shadows.sm,
      },
    });
    this.fill.setState({
      width: this.__fillWidth(width, thumbSize),
      style: {
        fillStyle: this.hovered ? uiManager.getTheme().colors.primaryHover : uiManager.getTheme().colors.primary,
        strokeStyle: this.hovered ? uiManager.getTheme().colors.primaryHover : uiManager.getTheme().colors.primary,
        lineWidth: uiManager.getTheme().control.lineWidth,
      },
    });
    this.revalidate();
  }
}
