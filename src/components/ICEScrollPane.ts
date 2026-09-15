import { ICEContainer } from '../core/ICEContainer';
import { ICEWidget } from '../core/ICEWidget';
import { iceUIManager } from '../core/ICEManager';
import { tween, resolveICEAnimationDuration } from '../util/ICEAnimation';
import { ICELayoutManager } from 'ice-render';

/**
 * 滚动视口（Swing 的 JScrollPane / CSS 的 overflow:auto 容器）。
 *
 * 依赖引擎的**子树裁剪**（`clipChildren`）：内容超出视口的部分被裁掉，滚出去的子组件
 * 也命不中（命中检测同样尊重裁剪区）。
 *
 * 结构：
 * ```
 * ICEScrollPane (clipChildren: true)
 *   ├── contentBox   位置 = (-scrollX, -scrollY)，尺寸 = 内容尺寸
 *   │     └── 调用方的内容组件
 *   └── scrollbarTrack + scrollbarThumb   滚动条（内容超出时才显示）
 * ```
 * 内容盒与滚动条都在构造期创建，保证滚动条的 zIndex 恒高于内容（引擎按 zIndex 排序渲染）。
 */

export interface ICEScrollPaneOptions {
  width?: number;
  height?: number;
  /** 初始滚动位置 */
  scrollX?: number;
  scrollY?: number;
  /** 是否显示滚动条（默认 auto：内容超出时显示） */
  scrollbar?: boolean;
  /** 滚轮灵敏度（每个 deltaY 像素对应的滚动量，默认 1） */
  wheelStep?: number;
}

const SCROLLBAR_WIDTH = 6;
const SCROLLBAR_INSET = 4;
const SCROLLBAR_MIN_THUMB = 12;

/**
 * 视口 + 滚动条的自持策略（Swing 的 `JScrollPane` + `ScrollPaneLayout` 位）。
 *
 * 这里同时摆"内容"（内容盒 = 负的滚动偏移）与"装饰"（两条轨道 + 两个滑块）——
 * 正是 Swing 用 `ScrollPaneLayout` 解决的那类版式：容器里既有内容又有可交互装饰，
 * 用引擎的通用布局器表达不了，于是**组件自己实现一个 `ICELayoutManager`**。
 *
 * 组件侧只留策略：内容多大、能不能滚、滚动条显不显示（`isScrollbarVisible()` 等），
 * 坐标一律由本策略算（`setScroll` / `setContentSize` / 尺寸变化都只是触发一次 `doLayout()`）。
 */
class ICEScrollPaneLayout extends ICELayoutManager {
  layoutContainer(container: any): void {
    const pane = container as unknown as ICEScrollPane;
    const [vw, vh] = pane.getViewportSize();
    const [contentWidth, contentHeight] = pane.getContentSize();
    const [scrollX, scrollY] = pane.getScroll();
    const { content, vTrack, vThumb, hTrack, hThumb } = pane.__getScrollNodes();

    // ① 内容盒：位置 = 负的滚动偏移（-0 要写成 0，断言/序列化都敏感）
    content.setState({
      left: scrollX === 0 ? 0 : -scrollX,
      top: scrollY === 0 ? 0 : -scrollY,
      width: contentWidth,
      height: contentHeight,
    });

    // ② 竖向滚动条
    const trackHeight = Math.max(0, vh - SCROLLBAR_INSET * 2);
    const vVisible = pane.isScrollbarVisible() && contentHeight > vh && trackHeight > 0;
    vTrack.setState({
      left: vw - SCROLLBAR_WIDTH - SCROLLBAR_INSET,
      top: SCROLLBAR_INSET,
      width: SCROLLBAR_WIDTH,
      height: trackHeight,
      display: vVisible,
    });
    if (!vVisible) {
      vThumb.setState({ display: false });
    } else {
      const thumbHeight = Math.max(SCROLLBAR_MIN_THUMB, Math.round(trackHeight * (vh / contentHeight)));
      const maxY = Math.max(0, contentHeight - vh);
      const progress = maxY > 0 ? scrollY / maxY : 0;
      vThumb.setState({
        display: true,
        left: 0,
        top: Math.round((trackHeight - thumbHeight) * progress),
        width: SCROLLBAR_WIDTH,
        height: thumbHeight,
      });
    }

    // ③ 横向滚动条（比例与竖向一致）
    const trackWidth = Math.max(0, vw - SCROLLBAR_INSET * 2);
    const hVisible =
      pane.isHorizontalScrollbarVisible() && contentWidth > vw && trackWidth > 0 && vh > SCROLLBAR_WIDTH * 3;
    hTrack.setState({
      left: SCROLLBAR_INSET,
      top: vh - SCROLLBAR_WIDTH - SCROLLBAR_INSET,
      width: trackWidth,
      height: SCROLLBAR_WIDTH,
      display: hVisible,
    });
    if (!hVisible) {
      hThumb.setState({ display: false });
    } else {
      const thumbWidth = Math.max(SCROLLBAR_MIN_THUMB, Math.round(trackWidth * (vw / contentWidth)));
      const maxX = Math.max(0, contentWidth - vw);
      const progress = maxX > 0 ? scrollX / maxX : 0;
      hThumb.setState({
        display: true,
        left: Math.round((trackWidth - thumbWidth) * progress),
        top: 0,
        width: thumbWidth,
        height: SCROLLBAR_WIDTH,
      });
    }
  }

  /** 内部策略：不进文档（`null` = 由 `ICEScrollPane` 构造时重建，几何参数在 state 里）。 */
  public toJSON(): any {
    return null;
  }
}

export class ICEScrollPane extends ICEContainer {
  private contentBox: ICEWidget;
  private contentNode: any = null;
  private scrollbarTrack: ICEWidget;
  private scrollbarThumb: ICEWidget;
  /** 横向滚动条（内容比视口宽时才出现） */
  private hTrack: ICEWidget;
  private hThumb: ICEWidget;

  private scrollX = 0;
  private scrollY = 0;
  private contentWidth = 0;
  private contentHeight = 0;
  private explicitContentSize = false;
  private scrollbarMode: 'auto' | 'always' | 'never';
  private wheelStep: number;
  /** 滑块拖拽态：记住按的是哪条、按下时指针在滑块内的偏移 */
  private thumbDrag: { axis: 'vertical' | 'horizontal'; offset: number } | null = null;
  private __bound = false;

  constructor(props: ICEScrollPaneOptions & Record<string, any> = {}) {
    const theme = iceUIManager.getTheme();
    const width = props.width ?? 240;
    const height = props.height ?? 160;
    super({
      ...props,
      width,
      height,
      // 引擎按这个标志把后代裁到本视口内
      clipChildren: true,
      fill: props.fill !== undefined ? props.fill : true,
      stroke: props.stroke !== undefined ? props.stroke : true,
      style: {
        fillStyle: theme.colors.surface,
        strokeStyle: theme.colors.border,
        lineWidth: theme.control.lineWidth,
        ...(props.style || {}),
      },
    });

    this.wheelStep = props.wheelStep ?? 1;
    this.scrollbarMode = props.scrollbar === true ? 'always' : props.scrollbar === false ? 'never' : 'auto';
    this.scrollX = 0;
    this.scrollY = 0;

    this.contentBox = new ICEWidget({ left: 0, top: 0, width: 0, height: 0, fill: false, stroke: false });
    this.addChild(this.contentBox, false);

    this.scrollbarTrack = new ICEWidget({
      left: width - SCROLLBAR_WIDTH - SCROLLBAR_INSET,
      top: SCROLLBAR_INSET,
      width: SCROLLBAR_WIDTH,
      height: Math.max(0, height - SCROLLBAR_INSET * 2),
      radius: SCROLLBAR_WIDTH / 2,
      fill: true,
      stroke: false,
      interactive: false,
      style: { fillStyle: theme.colors.disabled },
    });
    this.scrollbarThumb = new ICEWidget({
      left: 0,
      top: 0,
      width: SCROLLBAR_WIDTH,
      height: 0,
      radius: SCROLLBAR_WIDTH / 2,
      fill: true,
      stroke: false,
      interactive: false,
      style: { fillStyle: theme.colors.borderSecondary },
    });
    this.scrollbarTrack.addChild(this.scrollbarThumb, false);
    this.addChild(this.scrollbarTrack, false);

    this.hTrack = new ICEWidget({
      left: SCROLLBAR_INSET,
      top: height - SCROLLBAR_WIDTH - SCROLLBAR_INSET,
      width: Math.max(0, width - SCROLLBAR_INSET * 2),
      height: SCROLLBAR_WIDTH,
      radius: SCROLLBAR_WIDTH / 2,
      fill: true,
      stroke: false,
      style: { fillStyle: theme.colors.borderSecondary },
    });
    this.hThumb = new ICEWidget({
      left: 0,
      top: 0,
      width: 0,
      height: SCROLLBAR_WIDTH,
      radius: SCROLLBAR_WIDTH / 2,
      fill: true,
      stroke: false,
      style: { fillStyle: theme.colors.textTertiary },
    });
    this.hTrack.addChild(this.hThumb, false);
    this.addChild(this.hTrack, false);
    this.hTrack.setState({ display: false });

    // 排布交给自持策略（Swing ScrollPaneLayout 位）：内容盒 + 两条滚动条都归它摆
    this.setLayout(new ICEScrollPaneLayout());
    this.setScroll(this.scrollX, this.scrollY);
  }

  /** 设置滚动内容（会替换上一个内容组件）。 */
  public setContent(node: any): this {
    if (this.contentNode && this.contentNode !== node) {
      this.contentBox.removeChild(this.contentNode);
    }
    this.contentNode = node;
    if (node) {
      this.contentBox.addChild(node, false);
      this.__raiseAboveSelf(node);
      if (!this.explicitContentSize) {
        this.__syncContentSizeFromNode();
      }
    }
    this.__raiseAboveSelf(this.contentBox);
    this.scrollbarTrack.state.zIndex = (Number(this.state.zIndex) || 0) + 2;
    this.setScroll(this.scrollX, this.scrollY);
    this.revalidate();
    return this;
  }

  public getContent(): any {
    return this.contentNode;
  }

  /** 显式设置内容尺寸（内容自己不做布局时用；设置后不再跟随内容组件尺寸）。 */
  public setContentSize(width: number, height: number): this {
    this.explicitContentSize = true;
    this.contentWidth = Math.max(0, Number(width) || 0);
    this.contentHeight = Math.max(0, Number(height) || 0);
    this.contentBox.setState({ width: this.contentWidth, height: this.contentHeight });
    this.setScroll(this.scrollX, this.scrollY);
    return this;
  }

  public getContentSize(): [number, number] {
    return [this.contentWidth, this.contentHeight];
  }

  public getViewportSize(): [number, number] {
    return [Number(this.state.width) || 0, Number(this.state.height) || 0];
  }

  /** 可滚动范围（上界）；内容不超出时为 0。 */
  public getScrollRange(): [number, number] {
    const [vw, vh] = this.getViewportSize();
    return [Math.max(0, this.contentWidth - vw), Math.max(0, this.contentHeight - vh)];
  }

  public getScroll(): [number, number] {
    return [this.scrollX, this.scrollY];
  }

  /** 设置滚动位置（按可滚动范围夹取）。 */
  public setScroll(x: number, y: number): this {
    const [maxX, maxY] = this.getScrollRange();
    const nextX = Math.min(Math.max(Number(x) || 0, 0), maxX);
    const nextY = Math.min(Math.max(Number(y) || 0, 0), maxY);
    const changed = nextX !== this.scrollX || nextY !== this.scrollY;
    this.scrollX = nextX;
    this.scrollY = nextY;
    // 位置不再自己算：策略会按新的滚动偏移重摆内容盒与两条滚动条
    this.doLayout();
    if (changed && this.ice) {
      this.ice.dirty = true;
    }
    // 滚动位置真的变了才通知外部（BackTop / Anchor 这类「跟着滚动走」的组件靠它驱动）
    if (changed) {
      this.trigger('scroll', null, { x: nextX, y: nextY });
    }
    return this;
  }

  public scrollBy(dx: number, dy: number): this {
    return this.setScroll(this.scrollX + (Number(dx) || 0), this.scrollY + (Number(dy) || 0));
  }

  public isScrollbarVisible(): boolean {
    if (this.scrollbarMode === 'never') {
      return false;
    }
    if (this.scrollbarMode === 'always') {
      return true;
    }
    return this.contentHeight > this.getViewportSize()[1];
  }

  /** 滚动条滑块（测试与自定义样式用）。 */
  public getScrollbarThumb(): any {
    return this.scrollbarThumb;
  }

  // ---- 横向滚动条 + 平滑滚动 ----

  public isHorizontalScrollbarVisible(): boolean {
    if (this.scrollbarMode === 'never') {
      return false;
    }
    if (this.scrollbarMode === 'always') {
      return true;
    }
    return this.contentWidth > this.getViewportSize()[0];
  }

  public getHorizontalTrackWidth(): number {
    return Number(this.hTrack.state.width) || 0;
  }

  public getHorizontalThumb(): any {
    return this.hThumb;
  }

  /**
   * 平滑滚动到 (x, y)。
   *
   * `duration: 0`（或开了「减少动效」）时立即到位 —— 与其余动画同一个开关。
   */
  public smoothScrollTo(x: number, y: number, options: { duration?: number } = {}): this {
    const duration = resolveICEAnimationDuration(options.duration === undefined ? 220 : options.duration);
    const [maxX, maxY] = this.getScrollRange();
    const targetX = Math.min(Math.max(Number(x) || 0, 0), maxX);
    const targetY = Math.min(Math.max(Number(y) || 0, 0), maxY);
    if (duration <= 0) {
      return this.setScroll(targetX, targetY);
    }
    const fromX = this.scrollX;
    const fromY = this.scrollY;
    let frame = 0;
    tween({
      from: 0,
      to: 1,
      duration,
      onUpdate: (progress: number) => {
        frame = progress;
        this.setScroll(fromX + (targetX - fromX) * progress, fromY + (targetY - fromY) * progress);
      },
      onFinish: () => {
        if (frame >= 0) {
          this.setScroll(targetX, targetY);
        }
      },
    });
    return this;
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
    this.ice.evtBus.on('wheel', this.__onWheel, this);
    this.ice.evtBus.on('mousedown', this.__onGlobalMouseDown, this);
    this.ice.evtBus.on('mousemove', this.__onGlobalMouseMove, this);
    this.ice.evtBus.on('mouseup', this.__onGlobalMouseUp, this);
  }

  /** 按住的是哪条滑块（点在轨道空白不算）。 */
  public isThumbDragging(): boolean {
    return !!this.thumbDrag;
  }

  private __onGlobalMouseDown(evt: any): void {
    if (!evt || !evt.target) {
      return;
    }
    if (evt.target === this.scrollbarThumb && this.isScrollbarVisible()) {
      const [, wy] = this.ice.screenToWorld(evt.offsetX, evt.offsetY);
      this.__onThumbMouseDown('vertical', {
        offsetX: evt.offsetX,
        offsetY: evt.offsetY,
        target: evt.target,
        pointerInThumb: wy - (Number(this.scrollbarThumb.state.top) || 0),
      });
      return;
    }
    if (evt.target === this.hThumb && this.isHorizontalScrollbarVisible()) {
      const [wx] = this.ice.screenToWorld(evt.offsetX, evt.offsetY);
      this.__onThumbMouseDown('horizontal', {
        offsetX: evt.offsetX,
        offsetY: evt.offsetY,
        target: evt.target,
        pointerInThumb: wx - (Number(this.hThumb.state.left) || 0),
      });
    }
  }

  private __onGlobalMouseMove(evt: any): void {
    if (!this.thumbDrag) {
      return;
    }
    this.__onThumbMouseMove(evt);
  }

  private __onGlobalMouseUp(): void {
    this.__onThumbMouseUp();
  }

  /**
   * 按下滑块（真实路径由 `__onGlobalMouseDown` 触发；测试可直接调）。
   *
   * `pointerInThumb` 是按下时指针在滑块内的偏移：拖拽时保持它，滑块才不会「跳一下」。
   */
  public __onThumbMouseDown(axis: 'vertical' | 'horizontal', evt: any): this {
    if (!evt || !evt.target || this.thumbDrag) {
      return this;
    }
    const [, maxY] = this.getScrollRange();
    const [maxX] = this.getScrollRange();
    if (axis === 'vertical' && maxY <= 0) {
      return this;
    }
    if (axis === 'horizontal' && maxX <= 0) {
      return this;
    }
    this.thumbDrag = { axis, offset: Number(evt.pointerInThumb) || 0 };
    return this;
  }

  /** 拖动中：把「指针位置 - 手指偏移」换算成滚动位置。 */
  public __onThumbMouseMove(evt: any): this {
    const drag = this.thumbDrag;
    if (!drag || !evt || typeof evt.offsetX !== 'number') {
      return this;
    }
    if (!this.ice || typeof this.ice.screenToWorld !== 'function') {
      return this;
    }
    const [wx, wy] = this.ice.screenToWorld(evt.offsetX, evt.offsetY);
    const [maxX, maxY] = this.getScrollRange();
    if (drag.axis === 'vertical') {
      const thumbHeight = Number(this.scrollbarThumb.state.height) || SCROLLBAR_MIN_THUMB;
      const travel = Math.max(1, this.getVerticalTrackHeight() - thumbHeight);
      const top = Math.min(Math.max(0, wy - drag.offset), travel);
      return this.setScroll(this.scrollX, (top / travel) * maxY);
    }
    const thumbWidth = Number(this.hThumb.state.width) || SCROLLBAR_MIN_THUMB;
    const travel = Math.max(1, this.getHorizontalTrackWidth() - thumbWidth);
    const left = Math.min(Math.max(0, wx - drag.offset), travel);
    return this.setScroll((left / travel) * maxX, this.scrollY);
  }

  public __onThumbMouseUp(): this {
    this.thumbDrag = null;
    return this;
  }

  /** 竖向轨道的可用高度（拖拽换算用）。 */
  public getVerticalTrackHeight(): number {
    return Number(this.scrollbarTrack.state.height) || 0;
  }

  private __onWheel(evt: any): void {
    if (!evt || typeof evt.offsetX !== 'number' || typeof evt.offsetY !== 'number') {
      return;
    }
    if (!this.ice || typeof this.ice.screenToWorld !== 'function') {
      return;
    }
    const raw: any = evt.originalEvent || evt;
    const deltaY = Number(raw && raw.deltaY) || 0;
    if (!deltaY) {
      return;
    }
    const [maxX, maxY] = this.getScrollRange();
    if (maxX <= 0 && maxY <= 0) {
      return; // 没得滚：把事件留给别人
    }
    const [wx, wy] = this.ice.screenToWorld(evt.offsetX, evt.offsetY);
    const box = this.__paneWorldBox();
    if (wx < box.left || wx > box.left + box.width || wy < box.top || wy > box.top + box.height) {
      return;
    }
    const deltaX = Number(raw && raw.deltaX) || 0;
    this.scrollBy(deltaX * this.wheelStep, deltaY * this.wheelStep);
  }

  private __paneWorldBox(): { left: number; top: number; width: number; height: number } {
    let left = 0;
    let top = 0;
    let node: any = this;
    while (node && node.state) {
      left += Number(node.state.left) || 0;
      top += Number(node.state.top) || 0;
      node = node.parentNode;
    }
    return { left, top, width: Number(this.state.width) || 0, height: Number(this.state.height) || 0 };
  }

  private __syncContentSizeFromNode(): void {
    const node = this.contentNode;
    const width = Number(node && node.state && node.state.width) || 0;
    const height = Number(node && node.state && node.state.height) || 0;
    this.contentWidth = width;
    this.contentHeight = height;
    this.doLayout();
  }

  /**
   * 把「内容子树」整体抬到本视口之上。
   *
   * 引擎按**全局 zIndex** 排序渲染（zIndex 在构造时自增），因此「先创建内容、后创建视口」
   * 这种常见的组装顺序会让视口自己的背景盖住内容。这里给整个子树统一赋一个高于视口的
   * zIndex：同值时引擎的稳定排序保持树的原顺序（父在前、子在后），层级不会乱。
   */
  private __raiseAboveSelf(node: any): void {
    if (!node) {
      return;
    }
    const base = (Number(this.state.zIndex) || 0) + 1;
    const visit = (current: any) => {
      if (!current || !current.state) {
        return;
      }
      current.state.zIndex = base;
      (current.childNodes || []).forEach(visit);
    };
    visit(node);
  }

  /** 拖横向滑块：入口给 0-1 的进度（真实拖拽与测试用同一条路径）。 */
  public __onHorizontalThumbDrag(progress: number): this {
    const [maxX] = this.getScrollRange();
    const clamped = Math.min(1, Math.max(0, Number(progress) || 0));
    return this.setScroll(maxX * clamped, this.scrollY);
  }

  protected __afterStateMerge(sizeChanged: boolean): void {
    super.__afterStateMerge(sizeChanged);
    if (sizeChanged) {
      // 视口尺寸变了：策略要按新尺寸重摆内容盒与两条滚动条
      this.doLayout();
    }
  }

  /** 策略要摆的五个节点（内容盒 + 两条轨道 + 两个滑块）：内部 API，供 ICEScrollPaneLayout 使用。 */
  public __getScrollNodes(): {
    content: ICEWidget;
    vTrack: ICEWidget;
    vThumb: ICEWidget;
    hTrack: ICEWidget;
    hThumb: ICEWidget;
  } {
    return {
      content: this.contentBox,
      vTrack: this.scrollbarTrack,
      vThumb: this.scrollbarThumb,
      hTrack: this.hTrack,
      hThumb: this.hThumb,
    };
  }
}
