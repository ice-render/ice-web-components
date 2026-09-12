import { ICEContainer } from '../core/ICEContainer';
import { ICEWidget } from '../core/ICEWidget';
import { iceUIManager } from '../core/ICEManager';

/**
 * 滚动视口（Swing 的 JScrollPane / 业界组件库 的 overflow:auto 容器）。
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

export class ICEScrollPane extends ICEContainer {
  private contentBox: ICEWidget;
  private contentNode: any = null;
  private scrollbarTrack: ICEWidget;
  private scrollbarThumb: ICEWidget;

  private scrollX = 0;
  private scrollY = 0;
  private contentWidth = 0;
  private contentHeight = 0;
  private explicitContentSize = false;
  private scrollbarMode: 'auto' | 'always' | 'never';
  private wheelStep: number;
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
    // 注意：0 要写成 0 而不是 -0（-0 在 Object.is 语义下不等于 0，断言/序列化都容易踩）
    this.contentBox.setState({ left: nextX === 0 ? 0 : -nextX, top: nextY === 0 ? 0 : -nextY });
    this.__syncScrollbar();
    if (changed && this.ice) {
      this.ice.dirty = true;
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
    this.contentBox.setState({ width, height });
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

  private __syncScrollbar(): void {
    const [vw, vh] = this.getViewportSize();
    const trackHeight = Math.max(0, vh - SCROLLBAR_INSET * 2);
    const visible = this.isScrollbarVisible() && this.contentHeight > vh && trackHeight > 0;
    this.scrollbarTrack.setState({
      left: vw - SCROLLBAR_WIDTH - SCROLLBAR_INSET,
      top: SCROLLBAR_INSET,
      width: SCROLLBAR_WIDTH,
      height: trackHeight,
      display: visible,
    });
    if (!visible) {
      this.scrollbarThumb.setState({ display: false });
      return;
    }
    const ratio = vh / this.contentHeight;
    const thumbHeight = Math.max(SCROLLBAR_MIN_THUMB, Math.round(trackHeight * ratio));
    const [maxX, maxY] = this.getScrollRange();
    const progress = maxY > 0 ? this.scrollY / maxY : 0;
    this.scrollbarThumb.setState({
      display: true,
      left: 0,
      top: Math.round((trackHeight - thumbHeight) * progress),
      width: SCROLLBAR_WIDTH,
      height: thumbHeight,
    });
  }
}
