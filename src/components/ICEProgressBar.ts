import { ICEPath, ICERect } from 'ice-render';
import { ICELabel } from './ICELabel';
import { ICEComponent } from '../core/ICEComponent';
import { iceUIManager } from '../core/ICEManager';
import { ICEBoundedRangeModel } from '../model/ICEBoundedRangeModel';

/**
 * 进度环/进度条。
 *
 * - 线形（默认）：`ICEBoundedRangeModel` 驱动填充条宽度；
 * - 环形（`type: 'circle'`）：底环 + 进度弧（Path2D 弧线，12 点方向顺时针）+ 居中百分比；
 *   `size` / `strokeWidth` / `showText` / `format` 可配，`status: 'success'` 走成功色。
 */

export type ICEProgressType = 'line' | 'circle';

/** 进度弧：`sweep` 是 0..1 的扫过比例，走 state 以便 setState 自动置脏重算路径。 */
class ICEProgressRing extends ICEPath {
  constructor(props: any = {}) {
    super({ fill: false, stroke: true, closePath: false, sweep: 1, full: false, ...props });
  }

  protected createPathObject(): any {
    const size = Number(this.state.width) || 120;
    const lineWidth = Number(this.state.style.lineWidth) || 8;
    // 描边居中在路径上，半径要往里收半个线宽，否则会被画布/组件盒截掉
    const radius = Math.max(1, size / 2 - lineWidth / 2);
    const path =
      typeof (globalThis as any).Path2D === 'function'
        ? new (globalThis as any).Path2D()
        : { _isPolyfill: true, _commands: [] };
    const sweep = Math.max(0, Math.min(1, Number(this.state.sweep)));
    if (typeof path.arc === 'function') {
      if (this.state.full === true) {
        path.arc(0, 0, radius, 0, Math.PI * 2);
      } else {
        const start = -Math.PI / 2;
        path.arc(0, 0, radius, start, start + Math.PI * 2 * sweep);
      }
    }
    this.path2D = path;
    return path;
  }
}

export class ICEProgressBar extends ICEComponent {
  private model: ICEBoundedRangeModel;
  private type: ICEProgressType;
  private track: any = null;
  private fill: any = null;
  private trackRing: any = null;
  private ring: any = null;
  private textNode: ICELabel | null = null;
  private strokeWidth: number;
  private showText: boolean;
  private formatFn: ((percent: number) => string) | null;

  constructor(props: any = {}) {
    const theme = iceUIManager.getTheme();
    const type: ICEProgressType = props.type === 'circle' ? 'circle' : 'line';
    const circle = type === 'circle';
    const size = Number(props.size) || 120;
    const strokeWidth = Math.max(1, Number(props.strokeWidth) || 8);
    const lineHeight = props.height || theme.control.progressHeight;
    super({
      fill: false,
      stroke: false,
      draggable: false,
      ...props,
      width: circle ? props.width || size : props.width || 160,
      height: circle ? props.height || size : lineHeight,
    });
    this.type = type;
    this.strokeWidth = strokeWidth;
    this.showText = props.showText !== false;
    this.formatFn = typeof props.format === 'function' ? props.format : null;
    this.model = new ICEBoundedRangeModel({
      value: props.value,
      min: props.min,
      max: props.max,
    });
    const color =
      props.status === 'success'
        ? theme.colors.success
        : props.status === 'error'
          ? theme.colors.error
          : props.color || theme.colors.primary;

    if (circle) {
      const diameter = Math.min(Number(this.state.width) || size, Number(this.state.height) || size);
      this.trackRing = new ICEProgressRing({
        left: 0,
        top: 0,
        width: diameter,
        height: diameter,
        full: true,
        style: {
          strokeStyle: theme.colors.borderSecondary,
          lineWidth: strokeWidth,
          lineCap: 'round',
        },
      });
      this.ring = new ICEProgressRing({
        left: 0,
        top: 0,
        width: diameter,
        height: diameter,
        sweep: this.__ratio(),
        style: { strokeStyle: color, lineWidth: strokeWidth, lineCap: 'round' },
      });
      this.addChild(this.trackRing, false);
      this.addChild(this.ring, false);
      if (this.showText) {
        this.textNode = new ICELabel({
          interactive: false,
          left: 0,
          top: 0,
          width: diameter,
          height: diameter,
          align: 'center',
          verticalAlign: 'middle',
          text: this.__format(this.__ratio()),
          style: { fontSize: Math.max(12, Math.round(diameter * 0.18)), fillStyle: theme.colors.text },
        });
        this.addChild(this.textNode, false);
      }
    } else {
      const width = Number(this.state.width) || 160;
      const height = Number(this.state.height) || theme.control.progressHeight;
      this.track = new ICERect({
        left: 0,
        top: 0,
        width,
        height,
        radius: height / 2,
        style: {
          fillStyle: theme.colors.disabled,
          strokeStyle: theme.colors.borderSecondary,
          lineWidth: theme.control.lineWidth,
        },
      });
      this.fill = new ICERect({
        left: 0,
        top: 0,
        width: this.__fillWidth(width),
        height,
        radius: height / 2,
        style: { fillStyle: color, strokeStyle: color, lineWidth: theme.control.lineWidth },
      });
      this.addChild(this.track, false);
      this.addChild(this.fill, false);
    }
    this.model.addChangeListener(() => this.__sync());
  }

  public setValue(value: number): this {
    this.model.setValue(value);
    return this;
  }

  public getValue(): number {
    return this.model.getValue();
  }

  public isCircle(): boolean {
    return this.type === 'circle';
  }

  /** 归一化进度（0..1）。 */
  public getPercent(): number {
    return this.__ratio();
  }

  /** 进度弧扫过的比例（0..1）；线形模式同样返回归一化进度。 */
  public getSweepRatio(): number {
    return this.__ratio();
  }

  public getRingNode(): any {
    return this.ring;
  }

  public getTrackRingNode(): any {
    return this.trackRing;
  }

  public getTextNode(): ICELabel | null {
    return this.textNode;
  }

  private __ratio(): number {
    const min = this.model.getMinimum();
    const max = this.model.getMaximum();
    const ratio = (this.model.getValue() - min) / Math.max(1, max - min);
    return Math.max(0, Math.min(1, ratio));
  }

  private __format(ratio: number): string {
    if (this.formatFn) {
      return this.formatFn(ratio);
    }
    return `${Math.round(ratio * 100)}%`;
  }

  private __fillWidth(width: number): number {
    return Math.max(0, Math.min(width, width * this.__ratio()));
  }

  private __sync(): void {
    if (this.isCircle()) {
      const ratio = this.__ratio();
      if (this.ring) {
        // 写进 state：ICEPath.doRender 会在 dirty 时重跑 createPathObject
        this.ring.setState({ sweep: ratio });
      }
      if (this.textNode) {
        this.textNode.setText(this.__format(ratio));
      }
    } else if (this.fill) {
      this.fill.setState({ width: this.__fillWidth(this.track.state.width) });
    }
    this.revalidate();
  }
}
