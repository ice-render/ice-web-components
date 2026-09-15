import { ICEContainer } from '../core/ICEContainer';
import { iceUIManager } from '../core/ICEManager';
import { ICELayoutManager } from 'ice-render';

/**
 * 24 栅格的自持策略（2026-09-15）。
 *
 * 为什么自持而不是用引擎的 `ICEGridLayout`：引擎的等分模式是"填满容器"（列宽行高都均分，
 * 首选尺寸不表态），而 24 栅格要的是"**等列宽 + 行高按内容 + 自动高度 + 列偏移(offset)**"，
 * 且每行的 unit 按该行实际列数算 —— 这是个有自己语义的网格，属于"组件自持策略"那一类
 * （与 `ICETabs` / `ICEScrollPane` 同一条路）。
 *
 * 规则（与迁移前逐字一致）：
 * 先按 `span + offset` 把列分行（每行不超过 24 格），行内
 * `unit = (width - gutter × (列数 - 1)) / 24`，列起点 = `(已用格 + offset) × unit + gutter × 列序`。
 */
class ICEGridLayout extends ICELayoutManager {
  layoutContainer(container: any): void {
    const grid = container as ICEGrid;
    const width = Number(container.state.width) || 0;
    const gutter = grid.getGutter();
    const gutterY = grid.getGutterY();
    let top = 0;
    grid.__rows().forEach((row: ICEGridCol[]) => {
      const unit = (width - gutter * Math.max(0, row.length - 1)) / 24;
      let slots = 0;
      let rowHeight = 0;
      row.forEach((col, index) => {
        const left = (slots + col.offset) * unit + gutter * index;
        col.applyLayout(left, top, col.span * unit);
        slots += col.span;
        // 行高取该列最高者；列自己没给高度时用它内容的高度（迁移前的口径，逐字保留）
        const content = typeof col.getContent === 'function' ? col.getContent() : null;
        rowHeight = Math.max(rowHeight, Number(col.state.height) || Number(content && content.state.height) || 0);
      });
      top += rowHeight + gutterY;
    });
    // 把"内容总高"回给组件：autoHeight 的高度策略要用（旧实现在这里直接写 state.height）
    grid.__setContentBottom(Math.max(0, top - gutterY));
  }

  /** 内部策略：不进文档（`null` = 由 `ICEGrid` 构造时重建，gutter / span / offset 都在 state 里）。 */
  public toJSON(): any {
    return null;
  }
}

/**
 * 24 栅格列：`span` 占多少格、`offset` 左边空多少格，`content` 是列内容。
 *
 * 一般配合 `ICEGrid`（行）使用，由行统一算宽度与位置，不需要手动设 width。
 */
export interface ICEGridColOptions {
  /** 组件 id（引擎会用它做唯一标识，e2e/调试时可按 id 定位） */
  id?: string;
  /** 占多少格（1..24），默认 24 */
  span?: number;
  /** 左侧空出多少格，默认 0 */
  offset?: number;
  /** 列内容 */
  content?: any;
  height?: number;
}

export class ICEGridCol extends ICEContainer {
  public readonly span: number;
  public readonly offset: number;
  private content: any = null;

  constructor(props: ICEGridColOptions = {}) {
    super({
      id: props.id,
      fill: false,
      stroke: false,
      // 纯布局容器：不参与命中（否则会挡住列内容）
      interactive: false,
      width: 0,
      height: props.height ?? 0,
    });
    this.span = Math.max(1, Math.min(24, Math.floor(Number(props.span) || 24)));
    this.offset = Math.max(0, Math.min(23, Math.floor(Number(props.offset) || 0)));
    this.content = props.content || null;
    if (this.content) {
      this.addChild(this.content, false);
    }
  }

  public getContent(): any {
    return this.content;
  }

  /** 由 `ICEGrid` 调用：设置列宽并把内容撑满列宽。 */
  public applyLayout(left: number, top: number, width: number): void {
    this.setState({ left, top, width });
    if (this.content) {
      this.content.setState({ left: 0, top: 0, width });
    }
  }
}

/**
 * 24 栅格行：把若干 `ICEGridCol` 排成一行，放不下自动换行。
 *
 * 规则：先按 `span + offset` 把列分行（每行不超过 24 格），再按
 * `unit = (width - gutter × (列数 - 1)) / 24` 算每格宽度；
 * 行高取该行最高列，行间距离是 `gutterY`。
 */
export interface ICEGridOptions {
  /** 组件 id（引擎会用它做唯一标识，e2e/调试时可按 id 定位） */
  id?: string;
  /** 列间距，默认 16 */
  gutter?: number;
  /** 行间距，默认 16 */
  gutterY?: number;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
}

export class ICEGrid extends ICEContainer {
  private cols: ICEGridCol[] = [];
  /** 自持策略算出的内容总高（`autoHeight` 用）。 */
  private __contentBottom = 0;
  private gutter: number;
  private gutterY: number;
  private autoHeight: boolean;

  constructor(props: ICEGridOptions = {}) {
    const theme = iceUIManager.getTheme();
    super({
      id: props.id,
      fill: false,
      stroke: false,
      // 纯布局容器：不参与命中
      interactive: false,
      left: props.left,
      top: props.top,
      width: props.width ?? 480,
      height: props.height ?? 0,
    });
    this.gutter = props.gutter ?? theme.spacing.md;
    this.gutterY = props.gutterY ?? this.gutter;
    this.autoHeight = props.height === undefined;
    // 排布交给自持策略（见文件头「为什么自持」）
    this.setLayout(new ICEGridLayout());
  }

  public getCols(): ICEGridCol[] {
    return this.cols.slice();
  }

  public addCol(col: ICEGridCol): this {
    super.addChild(col, false);
    this.cols.push(col);
    this.doLayout();
    return this;
  }

  public setGutter(gutter: number, gutterY?: number): this {
    this.gutter = Number(gutter) || 0;
    this.gutterY = gutterY === undefined ? this.gutter : Number(gutterY) || 0;
    this.doLayout();
    return this;
  }

  /** 策略回填的内容总高（`autoHeight` 的高度策略用它，见 `doLayout`）。 */
  public __setContentBottom(bottom: number): void {
    this.__contentBottom = Math.max(0, Number(bottom) || 0);
  }

  public getGutter(): number {
    return this.gutter;
  }

  public getGutterY(): number {
    return this.gutterY;
  }

  /** 按 `span + offset` 分行（每行不超过 24 格）。策略用它，测试也直接断言它。 */
  public __rows(): ICEGridCol[][] {
    const rows: ICEGridCol[][] = [[]];
    let used = 0;
    this.cols.forEach((col) => {
      const slots = col.span + col.offset;
      if (rows[rows.length - 1].length > 0 && used + slots > 24) {
        rows.push([]);
        used = 0;
      }
      rows[rows.length - 1].push(col);
      used += slots;
    });
    return rows;
  }

  /**
   * 排布 = 自持策略摆列 + 组件自己的高度策略（`autoHeight` 时高度 = 内容高度）。
   *
   * 宽度仍由调用方决定（栅格的 24 等分以它为基准）。
   */
  public doLayout(): void {
    super.doLayout();
    if (!this.autoHeight) {
      return;
    }
    const bottom = this.__contentBottom;
    if (Math.abs((Number(this.state.height) || 0) - bottom) > 0.5) {
      this.state.height = Math.max(0, bottom);
      this.dirty = true;
      if (this.ice) {
        this.ice.dirty = true;
      }
    }
  }

  public revalidate(): this {
    super.revalidate();
    this.doLayout();
    return this;
  }
}
