import { ICECircle, ICERect } from 'ice-render';
import { ICEWidget } from '../core/ICEWidget';
import { iceUIManager } from '../core/ICEManager';
import { ICEBoundedRangeModel } from '../model/ICEBoundedRangeModel';

/**
 * 滑块：单值 / 区间双滑块，支持 `step` 量化与方向键微调。
 */
export class ICESlider extends ICEWidget {
  private model: ICEBoundedRangeModel;
  private track: any;
  private fill: any;
  private thumb: any;
  private upperThumb: any = null;
  private range: boolean;
  private rangeValue: [number, number] | null = null;
  private step: number;
  private activeThumb: 'lower' | 'upper' = 'lower';
  private dragThumb: 'lower' | 'upper' | null = null;
  private minValue: number;
  private maxValue: number;
  private dragging = false;
  private __bound = false;

  constructor(props: any = {}) {
    const theme = iceUIManager.getTheme();
    super({
      fill: false,
      stroke: false,
      draggable: false,
      ...props,
    });
    this.focusable = props.focusable !== false;
    this.range = props.range === true;
    this.step = Math.max(0, Number(props.step) || 0);
    this.minValue = props.min === undefined ? 0 : Number(props.min);
    this.maxValue = props.max === undefined ? 100 : Number(props.max);
    const initialRange = this.__normalizeRange(props.value);
    this.model = new ICEBoundedRangeModel({
      value: initialRange[0],
      min: props.min,
      max: props.max,
    });
    if (this.range) {
      this.rangeValue = [this.model.getValue(), initialRange[1]];
    }
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
      width: this.__fillWidth(width),
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
        ...theme.shadows.sm,
      },
    });
    this.addChild(this.track, false);
    this.addChild(this.fill, false);
    this.addChild(this.thumb, false);
    if (this.range) {
      this.upperThumb = new ICECircle({
        left: this.__upperThumbLeft(width, thumbSize),
        top: (height - thumbSize) / 2,
        radius: thumbSize / 2,
        style: {
          fillStyle: theme.colors.primary,
          strokeStyle: theme.colors.surface,
          lineWidth: theme.control.lineWidth + 1,
          ...theme.shadows.sm,
        },
      });
      this.addChild(this.upperThumb, false);
    }
    this.model.addChangeListener(() => {
      if (this.range && this.rangeValue) {
        this.rangeValue = [this.model.getValue(), Math.max(this.model.getValue(), this.rangeValue[1])];
      }
      this.__sync();
      this.trigger('change', null, { value: this.getValue() });
    });
    this.__sync();
  }

  /** 是否区间模式（双滑块）。 */
  public isRange(): boolean {
    return this.range;
  }

  public setValue(value: number): this {
    this.model.setValue(this.__quantize(value));
    return this;
  }

  public getValue(): number {
    return this.model.getValue();
  }

  /** 区间取值 [下界, 上界]；单值模式返回 null。 */
  public getRangeValue(): [number, number] | null {
    return this.rangeValue ? [...this.rangeValue] : null;
  }

  /** 设置区间：各自夹取到 [min,max]，反序时自动交换。 */
  public setRangeValue(value: [number, number] | number[]): this {
    if (!this.range) {
      return this;
    }
    const [nextLo, nextHi] = this.__normalizeRange(value);
    this.rangeValue = [nextLo, nextHi];
    this.model.setValue(nextLo);
    // model 值没变时不会触发监听器，这里兜底同步一次
    this.__sync();
    return this;
  }

  public getThumbs(): any[] {
    return this.upperThumb ? [this.thumb, this.upperThumb] : [this.thumb];
  }

  /** 当前操作中的滑块（键盘调整 / 拖动高亮用）。 */
  public getActiveThumb(): 'lower' | 'upper' {
    return this.activeThumb;
  }

  public setActiveThumb(thumb: 'lower' | 'upper'): this {
    this.activeThumb = thumb === 'upper' ? 'upper' : 'lower';
    this.__sync();
    return this;
  }

  /**
   * 按比例（0..1）落值。
   *
   * - 单值模式：直接设置；
   * - 区间模式：`thumb` 省略时取「离哪个滑块近」，拖动过程中由调用方传入锁定的滑块，
   *   两个滑块互相夹取、不会穿过（与区间滑块的常规行为一致）。
   */
  public setValueFromRatio(ratio: number, thumb?: 'lower' | 'upper'): this {
    const clamped = Math.max(0, Math.min(1, Number(ratio) || 0));
    const min = this.model.getMinimum();
    const max = this.model.getMaximum();
    const raw = min + clamped * (max - min);
    if (!this.range) {
      this.model.setValue(raw);
      return this;
    }
    const [lo, hi] = this.rangeValue || [min, max];
    const span = Math.max(1, max - min);
    const pick =
      thumb === 'lower' || thumb === 'upper'
        ? thumb
        : Math.abs(clamped - (lo - min) / span) <= Math.abs(clamped - (hi - min) / span)
          ? 'lower'
          : 'upper';
    this.activeThumb = pick;
    if (pick === 'lower') {
      const next = Math.min(this.__quantize(raw), hi);
      this.rangeValue = [next, hi];
      this.model.setValue(next);
    } else {
      const next = Math.max(this.__quantize(raw), lo);
      this.rangeValue = [lo, next];
      this.model.setValue(lo);
    }
    this.__sync();
    return this;
  }

  public getFormValue(): any {
    return this.range ? this.getRangeValue() : this.getValue();
  }

  public setFormValue(value: any): void {
    if (this.range) {
      if (Array.isArray(value)) {
        this.setRangeValue(value.map((item) => Number(item)));
      } else {
        const single = Number(value);
        this.setRangeValue([single, single]);
      }
      return;
    }
    this.setValue(Number(value));
  }

  protected afterAddHandler(): void {
    super.afterAddHandler();
    this.__bindGlobalEvents();
    if (this.ice && this.ice.evtBus && typeof this.ice.evtBus.on === 'function') {
      this.ice.evtBus.on('keydown', this.__onKeyDown, this);
    }
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
    this.dragThumb = this.range ? this.activeThumb : null;
  }

  private __onGlobalMouseMove(evt: any): void {
    if (!this.dragging) {
      return;
    }
    this.__updateFromEvent(evt);
  }

  private __onGlobalMouseUp(): void {
    this.dragging = false;
    this.dragThumb = null;
  }

  /** 方向键按 step 调值（区间模式调当前滑块，默认下界）。 */
  private __onKeyDown(evt: any): void {
    if (!this.enabled || !this.isFocused()) {
      return;
    }
    const raw = evt && (evt.originalEvent || evt);
    const key = raw && (raw.key || raw.code);
    if (key !== 'ArrowRight' && key !== 'ArrowUp' && key !== 'ArrowLeft' && key !== 'ArrowDown') {
      return;
    }
    const delta =
      this.step > 0 ? this.step : Math.max((this.maxValue - this.minValue) / 100, Number.EPSILON);
    const sign = key === 'ArrowRight' || key === 'ArrowUp' ? 1 : -1;
    if (this.range && this.rangeValue) {
      const [lo, hi] = this.rangeValue;
      if (this.activeThumb === 'upper') {
        this.setRangeValue([lo, hi + sign * delta]);
      } else {
        this.setRangeValue([lo + sign * delta, hi]);
      }
    } else {
      this.setValue(this.getValue() + sign * delta);
    }
  }

  private __isPointInside(evt: any): boolean {
    if (!evt || typeof evt.offsetX !== 'number' || typeof evt.offsetY !== 'number') {
      return false;
    }
    if (!this.ice || typeof this.ice.screenToWorld !== 'function') {
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
    if (!this.ice || typeof this.ice.screenToWorld !== 'function') {
      return;
    }
    const [wx] = this.ice.screenToWorld(evt.offsetX, evt.offsetY);
    const box = this.getMinBoundingBox(true);
    const width = box.br[0] - box.tl[0] || 1;
    const ratio = Math.max(0, Math.min(1, (wx - box.tl[0]) / width));
    // 区间模式：按下时锁定就近的滑块，移动过程中始终拖同一个（不会中途换手）
    this.setValueFromRatio(ratio, this.dragThumb || undefined);
  }

  protected __applyHoverState(): void {
    this.__sync();
  }

  /** 按 step 相对 min 量化；step ≤ 0 时保持连续取值。 */
  private __quantize(value: number): number {
    const low = Math.min(this.minValue, this.maxValue);
    const high = Math.max(this.minValue, this.maxValue);
    const numeric = Number(value);
    const bounded = Math.min(high, Math.max(low, Number.isFinite(numeric) ? numeric : low));
    if (this.step <= 0) {
      return bounded;
    }
    const snapped = low + Math.round((bounded - low) / this.step) * this.step;
    return Number(Math.min(high, Math.max(low, snapped)).toFixed(6));
  }

  /** 把任意入参整理成 [下界, 上界]（量化 + 夹取 + 反序交换）。 */
  private __normalizeRange(value: any): [number, number] {
    const low = Math.min(this.minValue, this.maxValue);
    let first: number;
    let second: number;
    if (Array.isArray(value)) {
      first = Number(value[0]);
      second = Number(value[1]);
    } else if (value === undefined || value === null) {
      first = low;
      second = low;
    } else {
      first = Number(value);
      second = Number(value);
    }
    const a = this.__quantize(first);
    const b = this.__quantize(second);
    return a <= b ? [a, b] : [b, a];
  }

  private __ratio(value: number): number {
    const min = this.model.getMinimum();
    const max = this.model.getMaximum();
    return Math.max(0, Math.min(1, (value - min) / Math.max(1, max - min)));
  }

  private __thumbStyle(which: 'lower' | 'upper'): any {
    const theme = iceUIManager.getTheme();
    const active = this.hovered || (this.dragging && this.activeThumb === which);
    return {
      fillStyle: active ? theme.colors.primaryHover : theme.colors.primary,
      strokeStyle: theme.colors.surface,
      lineWidth: theme.control.lineWidth + (active ? 2 : 1),
      ...theme.shadows.sm,
    };
  }

  private __thumbLeft(width: number, thumbSize?: number): number {
    const size = thumbSize ?? (Number(this.thumb.state.radius) * 2 || 0);
    return width * this.__ratio(this.model.getValue()) - size / 2;
  }

  private __upperThumbLeft(width: number, thumbSize: number): number {
    const hi = this.rangeValue ? this.rangeValue[1] : this.model.getValue();
    return width * this.__ratio(hi) - thumbSize / 2;
  }

  private __fillWidth(width: number): number {
    if (this.range && this.rangeValue) {
      return width * Math.max(0, this.__ratio(this.rangeValue[1]) - this.__ratio(this.rangeValue[0]));
    }
    return width * this.__ratio(this.model.getValue());
  }

  private __sync(): void {
    const theme = iceUIManager.getTheme();
    const width = Number(this.track.state.width);
    const thumbSize = Number(this.thumb.state.radius) * 2 || 0;
    this.thumb.setState({
      left: this.__thumbLeft(width),
      style: this.__thumbStyle('lower'),
    });
    if (this.upperThumb) {
      this.upperThumb.setState({ left: this.__upperThumbLeft(width, thumbSize), style: this.__thumbStyle('upper') });
    }
    const fillLeft = this.range && this.rangeValue ? width * this.__ratio(this.rangeValue[0]) : 0;
    const fillColor = this.hovered ? theme.colors.primaryHover : theme.colors.primary;
    this.fill.setState({
      left: fillLeft,
      width: this.__fillWidth(width),
      style: {
        fillStyle: fillColor,
        strokeStyle: fillColor,
        lineWidth: theme.control.lineWidth,
      },
    });
    this.revalidate();
  }
}
