import { ICEWidget } from '../core/ICEWidget';
import { ICELabel } from './ICELabel';
import { iceUIManager } from '../core/ICEManager';
import { tween, ICETweenHandle, ICEFrameDriver } from '../util/ICEAnimation';
import { token } from 'ice-render';

/**
 * 轮播。
 *
 * - 结构：裁剪视口（`clipChildren`）里一条横向轨道，幻灯片并排；轨道 left = -index * width；
 * - `goTo` / `next` / `prev` 切换，`loop` 控制是否循环；箭头与圆点可点，方向键 ←/→ 也可切；
 * - 切换用可注入 frame driver 的补间（`duration: 0` 时同步落位，便于测试）；
 * - 自动播放走可注入的调度器（`play` / `pause` / `isPlaying`）。
 */

export type ICECarouselFrameDriver = ICEFrameDriver;

export interface ICECarouselScheduler {
  setInterval(handler: () => void, ms: number): any;
  clearInterval(handle: any): void;
}

export interface ICECarouselOptions {
  /** 组件 id（引擎会用它做唯一标识，e2e/调试时可按 id 定位） */
  id?: string;
  slides?: ICEWidget[];
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  initialIndex?: number;
  loop?: boolean;
  /** 切换过渡时长（毫秒）；0 = 立即落位 */
  duration?: number;
  /** 自动播放间隔（毫秒）；> 0 时构造后即开始播放 */
  autoplay?: number;
  arrows?: boolean;
  dots?: boolean;
  onChange?: (index: number) => void;
  driver?: ICECarouselFrameDriver;
  scheduler?: ICECarouselScheduler;
}

const ARROW_WIDTH = 26;
const ARROW_HEIGHT = 34;
const DOT_SIZE = 8;
const DOT_GAP = 10;

const defaultScheduler: ICECarouselScheduler = {
  setInterval(handler, ms) {
    return (globalThis as any).setInterval(handler, ms);
  },
  clearInterval(handle) {
    (globalThis as any).clearInterval(handle);
  },
};

export class ICECarousel extends ICEWidget {
  private slides: ICEWidget[];
  private index = 0;
  private loop: boolean;
  private duration: number;
  private autoplayMs: number;
  private showArrows: boolean;
  private showDots: boolean;
  private driver?: ICECarouselFrameDriver;
  private scheduler: ICECarouselScheduler;
  private onChangeCallback: ((index: number) => void) | null;
  private viewport: ICEWidget | null = null;
  private track: ICEWidget | null = null;
  private prevButton: ICEWidget | null = null;
  private nextButton: ICEWidget | null = null;
  private dots: ICEWidget[] = [];
  private tweenHandle: ICETweenHandle | null = null;
  private timer: any = null;
  private running = false;

  constructor(props: ICECarouselOptions = {}) {
    const theme = iceUIManager.getTheme();
    super({
      id: props.id,
      fill: true,
      stroke: true,
      left: props.left,
      top: props.top,
      width: props.width ?? 320,
      height: props.height ?? 180,
      radius: theme.radius.md,
      style: { fillStyle: token('ui.colors.surface'), strokeStyle: token('ui.colors.border') },
    });
    this.slides = (props.slides || []).slice();
    this.loop = props.loop !== false;
    this.duration = props.duration ?? 260;
    this.autoplayMs = Math.max(0, Number(props.autoplay) || 0);
    this.showArrows = props.arrows !== false;
    this.showDots = props.dots !== false;
    this.driver = props.driver;
    this.scheduler = props.scheduler || defaultScheduler;
    this.onChangeCallback = typeof props.onChange === 'function' ? props.onChange : null;
    this.index = this.__clampIndex(Number(props.initialIndex) || 0);
    this.focusable = true;
    this.__render();
  }

  protected afterAddHandler(): void {
    super.afterAddHandler();
    if (this.autoplayMs > 0) {
      this.play();
    }
    if (!this.running && this.ice && this.ice.evtBus && typeof this.ice.evtBus.on === 'function') {
      this.ice.evtBus.on('keydown', this.__onKeyDown, this);
      this.running = true;
    }
  }

  public getCount(): number {
    return this.slides.length;
  }

  public getIndex(): number {
    return this.index;
  }

  public setSlides(slides: ICEWidget[]): this {
    this.slides = (slides || []).slice();
    this.index = this.__clampIndex(this.index);
    this.__render();
    return this;
  }

  public getSlideNode(index: number): ICEWidget | null {
    return this.slides[index] || null;
  }

  public getTrackNode(): ICEWidget | null {
    return this.track;
  }

  public getPrevButton(): ICEWidget | null {
    return this.prevButton;
  }

  public getNextButton(): ICEWidget | null {
    return this.nextButton;
  }

  public getDotNode(index: number): ICEWidget | null {
    return this.dots[index] || null;
  }

  public isPlaying(): boolean {
    return this.timer !== null;
  }

  public play(): this {
    if (this.autoplayMs <= 0 || this.timer !== null || this.slides.length <= 1) {
      return this;
    }
    this.timer = this.scheduler.setInterval(() => this.next(), this.autoplayMs);
    return this;
  }

  public pause(): this {
    if (this.timer !== null) {
      this.scheduler.clearInterval(this.timer);
      this.timer = null;
    }
    return this;
  }

  public setAutoplay(ms: number): this {
    const wasPlaying = this.isPlaying();
    this.pause();
    this.autoplayMs = Math.max(0, Number(ms) || 0);
    if (wasPlaying) {
      this.play();
    }
    return this;
  }

  public goTo(index: number, animate: boolean = true): this {
    const count = this.slides.length;
    if (!count) {
      this.index = 0;
      return this;
    }
    const next = this.__clampIndex(index);
    if (next === this.index) {
      this.__updateControls();
      return this;
    }
    this.index = next;
    this.__moveTrack(animate);
    this.__updateControls();
    if (this.onChangeCallback) {
      this.onChangeCallback(next);
    }
    return this;
  }

  public next(): this {
    return this.goTo(this.index + 1);
  }

  public prev(): this {
    return this.goTo(this.index - 1);
  }

  public activate(): void {
    // 轮播没有单一激活语义：切换交给箭头 / 圆点 / 左右方向键
  }

  private __clampIndex(index: number): number {
    const count = this.slides.length;
    if (!count) {
      return 0;
    }
    const value = Math.floor(Number(index) || 0);
    if (this.loop) {
      return ((value % count) + count) % count;
    }
    return Math.min(count - 1, Math.max(0, value));
  }

  private __onKeyDown(evt: any): void {
    if (!this.isFocused()) {
      return;
    }
    const raw = evt && (evt.originalEvent || evt);
    const key = raw && (raw.key || raw.code);
    if (key === 'ArrowRight') {
      this.next();
    } else if (key === 'ArrowLeft') {
      this.prev();
    }
  }

  private __moveTrack(animate: boolean): void {
    const track = this.track;
    if (!track) {
      return;
    }
    const width = Number(this.state.width) || 320;
    const target = this.index === 0 ? 0 : -this.index * width;
    if (this.tweenHandle) {
      this.tweenHandle.cancel();
      this.tweenHandle = null;
    }
    if (!animate || this.duration <= 0) {
      track.setState({ left: target });
      return;
    }
    this.tweenHandle = tween({
      from: Number(track.state.left) || 0,
      to: target,
      duration: this.duration,
      driver: this.driver,
      onUpdate: (value: number) => track.setState({ left: value }),
      onFinish: () => {
        this.tweenHandle = null;
        track.setState({ left: target });
      },
    });
  }

  private __updateControls(): void {
    const theme = iceUIManager.getTheme();
    this.dots.forEach((dot, index) => {
      const active = index === this.index;
      dot.setState({
        style: {
          ...dot.state.style,
          fillStyle: active ? theme.colors.primary : theme.colors.borderSecondary,
        },
      });
    });
    const multiple = this.slides.length > 1;
    if (this.prevButton) {
      this.prevButton.setState({ display: this.showArrows && multiple });
    }
    if (this.nextButton) {
      this.nextButton.setState({ display: this.showArrows && multiple });
    }
  }

  /**
   * 尺寸变化时整段重排内部零件（`ICEWidget.__syncInternalLayout()`）。
   *
   * 本组件的内部构图（子项尺寸、居中偏移、断行/分栏）**本身就是宽高的函数**，
   * 所以按本库既有惯例直接重跑构造期那段 `__render()`；它内部用 `removeChildren` 重建，
   * 不会留下停在旧尺寸的零件（重建出来的子项由各自构造函数重新挂事件）。
   */
  protected __syncInternalLayout(): void {
    this.__render();
  }

  private __render(): void {
    const theme = iceUIManager.getTheme();
    const width = Number(this.state.width) || 320;
    const height = Number(this.state.height) || 180;
    this.removeChildren([...this.childNodes]);
    this.dots = [];
    this.tweenHandle = null;
    // 引擎按全局 zIndex 排序渲染，而**幻灯片往往是调用方在本组件之前创建的**（例如构造参数里
    // 现造现传），创建顺序靠前 → 不抬高就会被根节点的底色盖住。整棵子树统一抬到根之上。
    const base = (Number(this.state.zIndex) || 0) + 1;

    const viewport = new ICEWidget({
      left: 0,
      top: 0,
      width,
      height,
      fill: false,
      stroke: false,
      interactive: false,
      clipChildren: true,
    });
    const track = new ICEWidget({
      left: this.index === 0 ? 0 : -this.index * width,
      top: 0,
      width: Math.max(width, this.slides.length * width),
      height,
      fill: false,
      stroke: false,
      interactive: false,
    });
    this.slides.forEach((slide, index) => {
      slide.setState({ left: index * width, top: 0, width, height });
      track.addChild(slide, false);
    });
    viewport.addChild(track, false);
    this.addChild(viewport, false);
    this.viewport = viewport;
    this.track = track;
    this.__raiseSubtree(viewport, base);

    if (this.showArrows && this.slides.length > 1) {
      const prev = this.__makeArrow('‹', 8);
      prev.on('click', () => this.prev());
      const next = this.__makeArrow('›', width - 8 - ARROW_WIDTH);
      next.on('click', () => this.next());
      this.prevButton = prev;
      this.nextButton = next;
      this.addChild(prev, false);
      this.addChild(next, false);
      this.__raiseSubtree(prev, base + 1);
      this.__raiseSubtree(next, base + 1);
    } else {
      this.prevButton = null;
      this.nextButton = null;
    }

    if (this.showDots && this.slides.length > 1) {
      const total = this.slides.length * DOT_SIZE + (this.slides.length - 1) * DOT_GAP;
      const startX = (width - total) / 2;
      this.slides.forEach((_, index) => {
        const dot = new ICEWidget({
          left: startX + index * (DOT_SIZE + DOT_GAP),
          top: height - DOT_SIZE - 10,
          width: DOT_SIZE,
          height: DOT_SIZE,
          radius: DOT_SIZE / 2,
          fill: true,
          stroke: false,
          style: { fillStyle: index === this.index ? theme.colors.primary : theme.colors.borderSecondary },
        });
        dot.on('click', () => this.goTo(index));
        this.addChild(dot, false);
        this.__raiseSubtree(dot, base + 2);
        this.dots.push(dot);
      });
    }

    // 边框最后画：幻灯片会把根节点的描边盖住，这里补一圈浮在内容之上的圆角框
    const frame = new ICEWidget({
      left: 0,
      top: 0,
      width,
      height,
      radius: theme.radius.md,
      fill: false,
      stroke: true,
      interactive: false,
      style: { strokeStyle: token('ui.colors.border') },
    });
    this.addChild(frame, false);
    this.__raiseSubtree(frame, base + 3);

    this.__updateControls();
    if (this.ice && this.ice.dirty !== undefined) {
      this.ice.dirty = true;
    }
  }

  private __makeArrow(text: string, left: number): ICEWidget {
    const theme = iceUIManager.getTheme();
    const button = new ICEWidget({
      left,
      top: (Number(this.state.height) || 180) / 2 - ARROW_HEIGHT / 2,
      width: ARROW_WIDTH,
      height: ARROW_HEIGHT,
      radius: theme.radius.sm,
      fill: true,
      stroke: false,
      style: { fillStyle: 'rgba(255, 255, 255, 0.82)' },
    });
    button.addChild(
      new ICELabel({
        interactive: false,
        left: 0,
        top: 0,
        width: ARROW_WIDTH,
        height: ARROW_HEIGHT,
        align: 'center',
        verticalAlign: 'middle',
        text,
        style: { fontSize: 16, fillStyle: token('ui.colors.text') },
      }),
      false,
    );
    return button;
  }

  /**
   * 把一棵子树（含后代）统一抬到指定 zIndex。
   *
   * 整体用同一个值是有意的：同 zIndex 内按树的先父后子顺序绘制，这样既越过了根节点，
   * 又不会打乱子树内部「先底色、后文字」的相对次序（逐个分配不同值反而会把子节点压到父节点下面）。
   */
  private __raiseSubtree(node: any, zIndex: number): void {
    if (!node || !node.state) {
      return;
    }
    node.state.zIndex = zIndex;
    (node.childNodes || []).forEach((child: any) => this.__raiseSubtree(child, zIndex));
  }
}
