import { ICEBoxLayout, ICEFlowLayout } from 'ice-render';
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
 * 排列本身交给**引擎的布局器**（2026-09-15 起）：
 * - 纵向、以及横向不换行 → `ICEBoxLayout`（交叉轴 `align` 就是它的 `align`）；
 * - 横向且 `wrap: true` → `ICEFlowLayout`（`crossAlign` 是引擎补的行内交叉轴对齐）。
 *
 * 本组件自己只保留一条策略：**没给宽/高的那一轴按内容自适应**（布局器不管这件事，
 * 它只按容器当前的盒子排版）。做法是先问布局器「内容想要多大」，写回自身后再让它排。
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
    this.__applyLayout();
  }

  /** 按当前 direction / wrap 挂上对应的引擎布局（方向或换行形态变了要重挂）。 */
  private __applyLayout(): void {
    if (this.direction === 'vertical') {
      this.setLayout(new ICEBoxLayout({ axis: 'y', gap: this.gap, align: this.align }));
    } else if (this.wrap) {
      this.setLayout(new ICEFlowLayout({ gap: this.gap, crossAlign: this.align }));
    } else {
      this.setLayout(new ICEBoxLayout({ axis: 'x', gap: this.gap, align: this.align }));
    }
  }

  /** 子项列表（按加入顺序）。 */
  public getItems(): any[] {
    return this.items.slice();
  }

  public setSize(size: number): this {
    this.gap = Number(size) || 0;
    this.__applyLayout();
    return this;
  }

  public getSize(): number {
    return this.gap;
  }

  public setAlign(align: 'start' | 'center' | 'end'): this {
    this.align = align;
    this.__applyLayout();
    return this;
  }

  /** 加入一个子项并立即重排。 */
  public addItem(child: any): this {
    super.addChild(child);
    this.items.push(child);
    this.doLayout();
    return this;
  }

  /** 直接 `addChild` 也当作子项处理（保持容器语义）。 */
  public addChild(child: any, markDirty: boolean = true): void {
    super.addChild(child, markDirty);
    if (this.items.indexOf(child) === -1) {
      this.items.push(child);
      this.doLayout();
    }
  }

  public removeItem(child: any): this {
    const index = this.items.indexOf(child);
    if (index !== -1) {
      this.items.splice(index, 1);
      this.removeChild(child);
      this.doLayout();
    }
    return this;
  }

  public revalidate(): this {
    super.revalidate();
    this.doLayout();
    return this;
  }

  /**
   * 排布 = 「按内容自适应自身尺寸」+ 引擎布局摆子项。
   *
   * 顺序很重要：布局器是按**容器当前的盒子**排的（换行宽度、交叉轴对齐都要用到它），
   * 所以先把没给宽/高的那一轴写成引擎算出的内容尺寸，再让布局器落位。
   */
  public doLayout(): void {
    if (this.autoWidth || this.autoHeight) {
      const [contentWidth, contentHeight] = this.getPreferredSize();
      if (this.autoWidth) {
        this.state.width = contentWidth;
      }
      if (this.autoHeight) {
        this.state.height = contentHeight;
      }
    }
    super.doLayout();
    this.dirty = true;
    if (this.ice) {
      this.ice.dirty = true;
    }
  }
}
