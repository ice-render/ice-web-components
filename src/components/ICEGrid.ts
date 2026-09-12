import { ICEContainer } from '../core/ICEContainer';
import { iceUIManager } from '../core/ICEManager';

/**
 * 24 栅格列（业界组件库 `Col`）：`span` 占多少格、`offset` 左边空多少格，`content` 是列内容。
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
 * 24 栅格行（业界组件库 `Row`）：把若干 `ICEGridCol` 排成一行，放不下自动换行。
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
  private gutter: number;
  private gutterY: number;
  private autoHeight: boolean;

  constructor(props: ICEGridOptions = {}) {
    const theme = iceUIManager.getTheme();
    super({
      id: props.id,
      fill: false,
      stroke: false,
      left: props.left,
      top: props.top,
      width: props.width ?? 480,
      height: props.height ?? 0,
    });
    this.gutter = props.gutter ?? theme.spacing.md;
    this.gutterY = props.gutterY ?? this.gutter;
    this.autoHeight = props.height === undefined;
  }

  public getCols(): ICEGridCol[] {
    return this.cols.slice();
  }

  public addCol(col: ICEGridCol): this {
    super.addChild(col, false);
    this.cols.push(col);
    this.__layout();
    return this;
  }

  public setGutter(gutter: number, gutterY?: number): this {
    this.gutter = Number(gutter) || 0;
    this.gutterY = gutterY === undefined ? this.gutter : Number(gutterY) || 0;
    this.__layout();
    return this;
  }

  private __rows(): ICEGridCol[][] {
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

  private __layout(): void {
    const width = Number(this.state.width) || 0;
    let top = 0;
    this.__rows().forEach((row) => {
      const unit = (width - this.gutter * Math.max(0, row.length - 1)) / 24;
      let slots = 0;
      let rowHeight = 0;
      row.forEach((col, index) => {
        const left = (slots + col.offset) * unit + this.gutter * index;
        const colWidth = col.span * unit;
        col.applyLayout(left, top, colWidth);
        slots += col.span;
        rowHeight = Math.max(rowHeight, Number(col.state.height) || this.__contentHeight(col));
      });
      top += rowHeight + this.gutterY;
    });
    if (this.autoHeight) {
      this.state.height = Math.max(0, top - this.gutterY);
    }
    if (this.ice) {
      this.ice.dirty = true;
    }
  }

  private __contentHeight(col: ICEGridCol): number {
    const content = col.getContent();
    return content ? Number(content.state.height) || 0 : 0;
  }

  public revalidate(): this {
    super.revalidate();
    this.__layout();
    return this;
  }
}
