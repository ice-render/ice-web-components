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
 *         └── content (总高 = itemCount × itemHeight)
 *               ├── item[97]  ← 只建窗口内的
 *               ├── item[98]
 *               └── …
 * ```
 *
 * 窗口计算抽成了纯函数 `computeVirtualRange`（缓冲、贴底、空列表、越界都在那里守），
 * 组件层只管把窗口映射成节点。
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
  /** 渲染一条：拿到的是**数据下标**（不是节点下标），可以复用传入的 node */
  renderItem?: (index: number, item: any, node: any) => void;
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
  /** 当前渲染出来的节点：数据下标 → 节点 */
  private nodes = new Map<number, any>();
  private scrollTop = 0;
  private renderItem: (index: number, item: any, node: any) => void;

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

  /** 当前真正渲染出来的节点（按下标升序）。 */
  public getRenderedNodes(): Array<{ index: number; node: any }> {
    this.__syncWindow();
    return Array.from(this.nodes.keys())
      .sort((a, b) => a - b)
      .map((index) => ({ index, node: this.nodes.get(index) }));
  }

  public getRenderedCount(): number {
    this.__syncWindow();
    return this.nodes.size;
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

  /** 把当前窗口映射成节点：窗口外的拆掉、窗口内的补上；重复调用是幂等的。 */
  private __syncWindow(): void {
    // 视口尺寸可能被 setState 改过，跟着走
    if (this.pane.state.width !== this.__width() || this.pane.state.height !== this.__height()) {
      this.pane.setState({ width: this.__width(), height: this.__height() });
    }
    const range = this.__range();
    Array.from(this.nodes.keys()).forEach((index) => {
      if (index >= range.start && index < range.end) return;
      const node = this.nodes.get(index);
      this.nodes.delete(index);
      if (node && typeof this.content.removeChild === 'function') this.content.removeChild(node);
    });
    for (let index = range.start; index < range.end; index += 1) {
      if (this.nodes.has(index)) continue;
      const node = new ICEWidget({
        left: 0,
        top: index * this.itemHeight,
        width: this.__width(),
        height: this.itemHeight,
        fill: false,
        stroke: false,
        interactive: false,
      });
      this.content.addChild(node, false);
      this.nodes.set(index, node);
      this.renderItem(index, this.items[index], node);
    }
  }
}
