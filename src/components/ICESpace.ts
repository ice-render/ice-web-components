import { ICEContainer } from '../core/ICEContainer';

/**
 * 间距容器：按固定间距排列一组子组件。
 *
 * - `direction: 'horizontal'`（默认）横向排列，`'vertical'` 纵向排列；
 * - `size` 是子项间距（默认 8）；
 * - 交叉轴对齐 `align: 'start' | 'center' | 'end'`；
 * - `wrap: true` 时横向超出容器宽度换行；
 * - 不传 width / height 时按内容自适应，加了子项就自动重排。
 *
 * 注：布局本身由本组件完成（不是引擎的 `ICEFlowLayout`）——因为 Space 需要同时处理
 * 交叉轴对齐与「按内容回写自身尺寸」，这两件事引擎布局器不管。
 */
export interface ICESpaceOptions {
  /** 组件 id（引擎会用它做唯一标识，e2e/调试时可按 id 定位） */
  id?: string;
  direction?: 'horizontal' | 'vertical';
  /** 子项间距，默认 8 */
  size?: number;
  align?: 'start' | 'center' | 'end';
  wrap?: boolean;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
}

export class ICESpace extends ICEContainer {
  private items: any[] = [];
  private direction: 'horizontal' | 'vertical';
  private gap: number;
  private align: 'start' | 'center' | 'end';
  private wrap: boolean;
  private autoWidth: boolean;
  private autoHeight: boolean;

  constructor(props: ICESpaceOptions = {}) {
    super({
      id: props.id,
      fill: false,
      stroke: false,
      // 纯布局容器：不参与命中（否则会挡住子项）
      interactive: false,
      left: props.left,
      top: props.top,
      width: props.width ?? 0,
      height: props.height ?? 0,
    });
    this.direction = props.direction === 'vertical' ? 'vertical' : 'horizontal';
    this.gap = props.size ?? 8;
    this.align = props.align || 'start';
    this.wrap = props.wrap === true;
    this.autoWidth = props.width === undefined;
    this.autoHeight = props.height === undefined;
  }

  /** 子项列表（按加入顺序）。 */
  public getItems(): any[] {
    return this.items.slice();
  }

  public setSize(size: number): this {
    this.gap = Number(size) || 0;
    this.__layout();
    return this;
  }

  public getSize(): number {
    return this.gap;
  }

  public setAlign(align: 'start' | 'center' | 'end'): this {
    this.align = align;
    this.__layout();
    return this;
  }

  /** 加入一个子项并立即重排。 */
  public addItem(child: any): this {
    super.addChild(child);
    this.items.push(child);
    this.__layout();
    return this;
  }

  /** 直接 `addChild` 也当作子项处理（保持容器语义）。 */
  public addChild(child: any, markDirty: boolean = true): void {
    super.addChild(child, markDirty);
    if (this.items.indexOf(child) === -1) {
      this.items.push(child);
      this.__layout();
    }
  }

  public removeItem(child: any): this {
    const index = this.items.indexOf(child);
    if (index !== -1) {
      this.items.splice(index, 1);
      this.removeChild(child);
      this.__layout();
    }
    return this;
  }

  public revalidate(): this {
    super.revalidate();
    this.__layout();
    return this;
  }

  /** 交叉轴偏移。 */
  private __crossOffset(childSize: number, containerSize: number): number {
    if (this.align === 'center') {
      return Math.max(0, (containerSize - childSize) / 2);
    }
    if (this.align === 'end') {
      return Math.max(0, containerSize - childSize);
    }
    return 0;
  }

  private __layout(): void {
    if (!this.items.length) {
      return;
    }
    const width = Number(this.state.width) || 0;
    const height = Number(this.state.height) || 0;

    if (this.direction === 'vertical') {
      const contentWidth = this.items.reduce((max, item) => Math.max(max, Number(item.state.width) || 0), 0);
      const containerWidth = this.autoWidth ? contentWidth : width;
      let top = 0;
      this.items.forEach((item) => {
        item.setState({
          left: this.__crossOffset(Number(item.state.width) || 0, containerWidth),
          top,
        });
        top += (Number(item.state.height) || 0) + this.gap;
      });
      const contentHeight = Math.max(0, top - this.gap);
      this.state.width = containerWidth;
      if (this.autoHeight) {
        this.state.height = contentHeight;
      }
      this.__markDirty();
      return;
    }

    // 横向：先按 wrap 分行（不 wrap 时永远单行）
    const containerWidth = width;
    const rows: any[][] = [[]];
    let rowWidth = 0;
    let rowHeight = 0;
    this.items.forEach((item) => {
      const itemWidth = Number(item.state.width) || 0;
      const needWrap =
        this.wrap && containerWidth > 0 && rows[rows.length - 1].length > 0 && rowWidth + this.gap + itemWidth > containerWidth;
      if (needWrap) {
        rows.push([]);
        rowWidth = 0;
        rowHeight = 0;
      }
      rows[rows.length - 1].push(item);
      rowWidth += (rows[rows.length - 1].length > 1 ? this.gap : 0) + itemWidth;
      rowHeight = Math.max(rowHeight, Number(item.state.height) || 0);
    });

    let top = 0;
    let contentWidth = 0;
    rows.forEach((row) => {
      const lineHeight = row.reduce((max, item) => Math.max(max, Number(item.state.height) || 0), 0);
      let left = 0;
      row.forEach((item) => {
        item.setState({
          left,
          top: top + this.__crossOffset(Number(item.state.height) || 0, lineHeight),
        });
        left += (Number(item.state.width) || 0) + this.gap;
        contentWidth = Math.max(contentWidth, left - this.gap);
      });
      top += lineHeight + this.gap;
    });
    const contentHeight = Math.max(0, top - this.gap);
    if (this.autoWidth) {
      this.state.width = contentWidth;
    }
    if (this.autoHeight) {
      this.state.height = contentHeight;
    }
    void rowHeight;
    void height;
    this.__markDirty();
  }

  private __markDirty(): void {
    if (this.ice) {
      this.ice.dirty = true;
    }
  }
}
