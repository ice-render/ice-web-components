import { ICEWidget } from '../core/ICEWidget';
import { ICEScrollPane } from './ICEScrollPane';

/**
 * 虚拟列表：**只渲染可视区**的列表，一万条数据也只用十几个节点。
 *
 * 为什么要有它：`ICETable` / `ICEList` 都是「有多少行建多少节点」——几千行就开始卡，
 * 上万行直接不能上。虚拟滚动的做法是：内容盒按「总高度」撑开（滚动条对得上），
 * 但只把「可视区 + 缓冲」那几条真的建出来，滚动时换窗口、复用节点。
 *
 * ```
 * ICEVirtualList (固定高度)
 *   └── ICEScrollPane            滚轮 / 滚动条 / 子树裁剪都交给它
 *         └── content (总高 = itemCount × itemHeight，**唯一子节点**)
 *               └── painter 每帧只画窗口内的那几条（不再为每条建节点）
 * ```
 *
 * 窗口计算抽成了纯函数 `computeVirtualRange`（缓冲、贴底、空列表、越界都在那里守）；
 * 绘制走 `painter`（Swing 的 `ListCellRenderer` + UI delegate 位）——
 * **一万条数据同样是 1 个节点**，行只是画出来的。`renderItem` 因此拿到的是
 * "行矩形 + ctx"（自己画），不再是一个可 addChild 的行节点。
 */

/** 当前该渲染的区间：`[start, end)`。 */
export interface ICEVirtualRange {
  start: number;
  end: number;
  count: number;
}

export interface ICEVirtualWindowOptions {
  /** 当前滚动位置，默认 0 */
  scrollTop?: number;
  viewportHeight: number;
  itemHeight: number;
  itemCount: number;
  /** 上下各多渲染几条（默认 0），滚动时不容易看到白边 */
  buffer?: number;
}

/**
 * 纯窗口计算：给定滚动位置、视口高度、行高与总数，算出该渲染哪一段。
 *
 * - `end` 是**开区间**（`slice(start, end)` 语义）；
 * - 半露出的那一条也要渲染（`scrollTop + viewportHeight - 1` 取整）；
 * - 越界、空列表、非法入参一律返回空窗口或夹取后的结果，不抛异常、不给负数。
 */
export function computeVirtualRange(options: ICEVirtualWindowOptions): ICEVirtualRange {
  const itemHeight = Math.floor(Number(options.itemHeight) || 0);
  const viewportHeight = Math.floor(Number(options.viewportHeight) || 0);
  const itemCount = Math.max(0, Math.floor(Number(options.itemCount) || 0));
  const buffer = Math.max(0, Math.floor(Number(options.buffer) || 0));
  if (itemHeight <= 0 || viewportHeight <= 0 || itemCount <= 0) {
    return { start: 0, end: 0, count: 0 };
  }
  const maxScrollTop = itemCount * itemHeight;
  const rawScrollTop = Number(options.scrollTop);
  const scrollTop = Math.min(Math.max(Number.isFinite(rawScrollTop) ? rawScrollTop : 0, 0), maxScrollTop);
  const first = Math.floor(scrollTop / itemHeight);
  const lastVisible = Math.floor((scrollTop + viewportHeight - 1) / itemHeight);
  const start = Math.max(0, first - buffer);
  const end = Math.min(itemCount, Math.max(lastVisible, first) + buffer + 1);
  return { start, end, count: Math.max(0, end - start) };
}

/** 画一条时拿到的上下文（行矩形 + 数据）。 */
export interface ICEVirtualItemPaintContext {
  ctx: any;
  /** 数据下标（不是"第几个节点"） */
  index: number;
  item: any;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ICEVirtualListOptions {
  id?: string;
  left?: number;
  top?: number;
  width?: number;
  /** 视口高度（列表本身的尺寸，内容由它决定滚动范围） */
  height?: number;
  /** 每行高度（固定行高才谈得上虚拟滚动） */
  itemHeight: number;
  /** 上下缓冲条数，默认 2 */
  buffer?: number;
  items?: any[];
  /**
   * 画一条：**直接往 ctx 上画**（不再给节点）。
   *
   * `x/y/width/height` 是这一行在内容盒坐标系里的矩形（已含滚动偏移），
   * 拿它画底色/文字即可；窗口外的行不会被调用。
   */
  renderItem?: (context: ICEVirtualItemPaintContext) => void;
  /** 是否显示滚动条，默认 true */
  scrollbar?: boolean;
  [key: string]: any;
}

export class ICEVirtualList extends ICEWidget {
  private itemHeight: number;
  private buffer: number;
  private items: any[] = [];
  private pane: ICEScrollPane;
  private content: ICEWidget;
  private scrollTop = 0;
  private renderItem: (context: ICEVirtualItemPaintContext) => void;

  constructor(props: ICEVirtualListOptions) {
    super({
      fill: false,
      stroke: false,
      width: props.width || 320,
      height: props.height || 300,
      ...props,
    });
    this.itemHeight = Math.max(1, Math.floor(Number(props.itemHeight) || 1));
    this.buffer = Math.max(0, Math.floor(Number(props.buffer === undefined ? 2 : props.buffer) || 0));
    this.renderItem = typeof props.renderItem === 'function' ? props.renderItem : () => undefined;
    this.content = new ICEWidget({ left: 0, top: 0, width: this.__width(), height: 0, fill: false, stroke: false, interactive: false });
    this.pane = new ICEScrollPane({
      left: 0,
      top: 0,
      width: this.__width(),
      height: this.__height(),
      scrollbar: props.scrollbar !== false,
    });
    // 行由 painter 画：content 是唯一子节点，窗口变化只是"重画一次"
    this.content.setPainter({ paint: ({ ctx, origin }: any) => this.paintItems(ctx, origin) });
    this.pane.setContent(this.content);
    this.pane.on('scroll', (evt: any) => {
      const y = evt && evt.param ? Number(evt.param.y) || 0 : 0;
      this.scrollTop = y;
      this.__syncWindow();
    });
    this.addChild(this.pane, false);
    this.setItems(props.items || []);
  }

  // ---------------------------------------------------------------- 查询

  public getItemCount(): number {
    return this.items.length;
  }

  public getItemHeight(): number {
    return this.itemHeight;
  }

  public getBuffer(): number {
    return this.buffer;
  }

  public getItems(): any[] {
    return this.items.slice();
  }

  /** 内容总高度（撑开滚动条用）。 */
  public getContentHeight(): number {
    return this.items.length * this.itemHeight;
  }

  public getScrollTop(): number {
    this.__syncWindow();
    return this.scrollTop;
  }

  /** 当前窗口（查询前会先同步一次，保证拿到的是最新状态）。 */
  public getRange(): ICEVirtualRange {
    this.__syncWindow();
    return {
      start: this.__range().start,
      end: this.__range().end,
      count: this.__range().count,
    };
  }

  /**
   * 当前窗口会画几条（= `getRange().count`）。
   *
   * 名字保留自"渲染节点"时代：现在一条=一次 `renderItem` 调用，**不再有行节点**，
   * 所以这个数就是"这一帧要画几行"。
   */
  public getRenderedCount(): number {
    return this.__range().count;
  }

  /** 对外暴露滚动视口（需要挂滚动监听时用）。 */
  public getScrollPane(): ICEScrollPane {
    return this.pane;
  }

  // ---------------------------------------------------------------- 操作

  public setItems(items: any[]): this {
    this.items = Array.isArray(items) ? items.slice() : [];
    const contentHeight = this.getContentHeight();
    this.content.setState({ width: this.__width(), height: contentHeight });
    this.pane.setState({ width: this.__width(), height: this.__height() });
    this.pane.setContentSize(this.__width(), contentHeight);
    // 数据变少时把滚动位置夹回范围内
    const maxScrollTop = Math.max(0, contentHeight - this.__height());
    this.scrollTop = Math.min(this.scrollTop, maxScrollTop);
    this.pane.setScroll(0, this.scrollTop);
    this.__syncWindow();
    return this;
  }

  public setScrollTop(scrollTop: number): this {
    const maxScrollTop = Math.max(0, this.getContentHeight() - this.__height());
    const next = Math.min(Math.max(Number(scrollTop) || 0, 0), maxScrollTop);
    this.scrollTop = next;
    this.pane.setScroll(0, next);
    this.__syncWindow();
    return this;
  }

  /** 把某一条滚进视口（贴顶对齐），下标会被夹进合法范围。 */
  public scrollToIndex(index: number): this {
    if (!this.items.length) return this;
    const clamped = Math.min(Math.max(Math.floor(Number(index) || 0), 0), this.items.length - 1);
    return this.setScrollTop(clamped * this.itemHeight);
  }

  // ---------------------------------------------------------------- 内部

  private __width(): number {
    return Number(this.state.width) || 0;
  }

  private __height(): number {
    return Number(this.state.height) || 0;
  }

  private __range(): ICEVirtualRange {
    return computeVirtualRange({
      scrollTop: this.scrollTop,
      viewportHeight: this.__height(),
      itemHeight: this.itemHeight,
      itemCount: this.items.length,
      buffer: this.buffer,
    });
  }

  /**
   * 画当前窗口的每一行（浏览器里由 content 的 painter 每帧自动调用；
   * 单测可以直接调它，传一个假 ctx 就能断言"画了哪几行、画在哪个矩形"）。
   */
  public paintItems(ctx: any, origin: [number, number] = [0, 0]): void {
    if (!ctx) {
      return;
    }
    const range = this.__range();
    const width = this.__width();
    const [ox, oy] = origin;
    for (let index = range.start; index < range.end; index += 1) {
      this.renderItem({
        ctx,
        index,
        item: this.items[index],
        x: 0 - ox,
        y: index * this.itemHeight - oy,
        width,
        height: this.itemHeight,
      });
    }
  }

  /**
   * 窗口同步：只做两件事 —— 视口尺寸跟着 setState 走、标脏让 painter 重画。
   * （旧实现在这里建/拆行节点；现在行是画出来的，所以**没有任何结构变更**。）
   */
  private __syncWindow(): void {
    if (this.pane.state.width !== this.__width() || this.pane.state.height !== this.__height()) {
      this.pane.setState({ width: this.__width(), height: this.__height() });
    }
    // 只标"列表自己"脏（视口大小的一块），不标 content（总高可能几十万像素，
    // 标它等于让脏矩形退化成全量重绘）
    this.dirty = true;
  }
}
