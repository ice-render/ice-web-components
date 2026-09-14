import { ICEWidget } from '../core/ICEWidget';

/**
 * 吸顶容器（CSS `position: sticky` 的画布版本）。
 *
 * 长页面里「筛选条 / 表头 / 批量操作栏」跟着滚走是后台最常见的抱怨；DOM 里一行
 * `position: sticky` 就解决，画布里没有这回事，于是这里把它补上：
 *
 * - 组件留在原来的位置，**占位高度不变** —— 吸顶不该让下面的内容跳一下；
 * - 当它随内容滚到「视口顶 + `offsetTop`」以上时，把它贴回去（改自己的 `top` 补偿滚动量），
 *   并抬到更高 zIndex（否则会被后面的内容盖住）；滚回原位时两样都复原；
 * - 贴着**最近的祖先滚动视口**（`ICEScrollPane`）算，不是整页；也可以 `scrollTarget` 显式指定。
 *
 * 语义提醒：吸顶期间它会盖住后面的内容（和 CSS sticky 一致），所以页面要留出足够的高度
 * —— 例如内容顶部加 `offsetTop` 那一条空白。
 */

export interface ICEAffixOptions {
  /** 吸顶时距视口顶部多少像素（默认 0；顶部有固定头就传头的高度） */
  offsetTop?: number;
  /** 贴哪个滚动视口吸顶；不传则自动沿父链找最近的 ICEScrollPane */
  scrollTarget?: any;
  /** 吸顶时抬到多高（默认「整棵兄弟子树的最大 zIndex + 10」） */
  pinnedZIndex?: number;
  /** 吸顶状态翻转时回调 */
  onPinChange?: (pinned: boolean) => void;
  id?: string;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  style?: Record<string, any>;
  fill?: boolean;
  stroke?: boolean;
}

export class ICEAffix extends ICEWidget {
  private offsetTop: number;
  private scrollTarget: any;
  private pinnedZIndex: number | null;
  private onPinChange: ((pinned: boolean) => void) | null;
  private pinned = false;
  /** 布局给的位置（未吸顶时的 top）；吸顶补偿都基于它算 */
  private baseTop: number | null = null;
  /** 上一次由本组件写进去的 top，用来识别「别人重排了」 */
  private appliedTop: number | null = null;
  private baseZIndex = 0;
  private running = false;
  private applying = false;

  constructor(props: ICEAffixOptions = {}) {
    super({
      ...props,
      fill: props.fill === true,
      stroke: props.stroke === true,
      width: props.width ?? 200,
      height: props.height ?? 40,
    });
    this.offsetTop = Math.max(0, Math.floor(Number(props.offsetTop) || 0));
    this.scrollTarget = props.scrollTarget || null;
    this.pinnedZIndex = Number.isFinite(Number(props.pinnedZIndex)) ? Number(props.pinnedZIndex) : null;
    this.onPinChange = typeof props.onPinChange === 'function' ? props.onPinChange : null;
    this.baseZIndex = Number(this.state.zIndex) || 0;
    this.baseTop = Number(this.state.top) || 0;
  }

  protected afterAddHandler(): void {
    super.afterAddHandler();
    if (this.running) {
      return;
    }
    this.running = true;
    if (!this.scrollTarget) {
      this.scrollTarget = this.__findScrollTarget();
    }
    if (this.scrollTarget && typeof this.scrollTarget.on === 'function') {
      this.scrollTarget.on('scroll', this.update, this);
    }
    this.update();
  }

  public getScrollTarget(): any {
    return this.scrollTarget;
  }

  public getOffsetTop(): number {
    return this.offsetTop;
  }

  public setOffsetTop(value: number): this {
    this.offsetTop = Math.max(0, Math.floor(Number(value) || 0));
    return this.update();
  }

  /** 布局给的位置（吸顶时它仍然是「本来该在的地方」）。 */
  public getBaseTop(): number {
    return this.baseTop === null ? Number(this.state.top) || 0 : this.baseTop;
  }

  public getBaseZIndex(): number {
    return this.baseZIndex;
  }

  public isPinned(): boolean {
    return this.pinned;
  }

  /**
   * 重算吸顶。
   *
   * 每一步都从「父链上的实际坐标」重新推，而不是累加增量 —— 增量式补偿在来回滚动、
   * 布局重排、容器尺寸变化这几种情况下都会漂。
   */
  public update(): this {
    if (this.applying) {
      return this;
    }
    const top = Number(this.state.top) || 0;
    if (this.appliedTop === null || top !== this.appliedTop) {
      // 有人（布局）动过位置 → 以它为新基准
      this.baseTop = top;
    }
    const baseTop = this.baseTop === null ? top : this.baseTop;
    if (!this.scrollTarget) {
      this.__apply(baseTop, false);
      return this;
    }
    // 视口的「屏幕顶」含它自己的 top（可能有偏移），所以从它本身开始累加
    const paneScreenTop = this.__screenTop(this.scrollTarget);
    const parentScreenTop = this.__screenTop(this.parentNode);
    const naturalScreenTop = parentScreenTop + baseTop;
    const threshold = paneScreenTop + this.offsetTop;
    const pinned = naturalScreenTop <= threshold;
    const nextTop = pinned ? baseTop + (threshold - naturalScreenTop) : baseTop;
    this.__apply(nextTop, pinned);
    return this;
  }

  private __apply(top: number, pinned: boolean): void {
    const zIndex = pinned ? this.__pinnedZIndex() : this.baseZIndex;
    const changed = top !== (Number(this.state.top) || 0) || zIndex !== (Number(this.state.zIndex) || 0);
    if (!changed) {
      return;
    }
    this.applying = true;
    this.appliedTop = top;
    this.setState({ top, zIndex });
    this.applying = false;
    if (this.ice) {
      this.ice.dirty = true;
    }
    if (pinned !== this.pinned) {
      this.pinned = pinned;
      if (this.onPinChange) {
        this.onPinChange(pinned);
      }
    }
  }

  private __pinnedZIndex(): number {
    if (this.pinnedZIndex !== null) {
      return this.pinnedZIndex;
    }
    // 吸顶要盖住后面所有内容：取兄弟子树里的最大 zIndex 再往上抬 10
    let max = this.baseZIndex;
    const visit = (node: any) => {
      if (!node || !node.state) {
        return;
      }
      max = Math.max(max, Number(node.state.zIndex) || 0);
      (node.childNodes || []).forEach(visit);
    };
    visit(this.parentNode);
    return max + 10;
  }

  /** 父链上的世界纵坐标（不含自己）。 */
  private __screenTop(node: any): number {
    let top = 0;
    let current = node;
    while (current && current.state) {
      top += Number(current.state.top) || 0;
      current = current.parentNode;
    }
    return top;
  }

  private __findScrollTarget(): any {
    let current = this.parentNode;
    while (current) {
      if (typeof current.getScroll === 'function' && typeof current.getViewportSize === 'function') {
        return current;
      }
      current = current.parentNode;
    }
    return null;
  }
}

export default ICEAffix;
