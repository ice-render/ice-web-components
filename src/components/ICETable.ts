import { ICEWidget } from '../core/ICEWidget';
import { iceUIManager } from '../core/ICEManager';
import { createTextNode } from '../util/ICEStyle';
import { ICERect } from 'ice-render';

export type ICETableColumn = {
  key: string;
  title: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
  /** 表头可排序：`true` 用默认比较（数值按数值、其余按字典序），或传自定义比较函数 */
  sorter?: boolean | ((a: ICETableRow, b: ICETableRow) => number);
  renderCell?: (
    value: string,
    row: ICETableRow,
    column: ICETableColumn,
    meta: { cellWidth: number; cellHeight: number; align: 'left' | 'center' | 'right' },
  ) => any | null;
};

export type ICETableRow = Record<string, any>;

export interface ICETableSortState {
  key: string;
  order: 'asc' | 'desc';
}

export class ICETable extends ICEWidget {
  private columns: ICETableColumn[];
  /** 原始数据（排序前的顺序，用于第三次点击恢复） */
  private sourceData: ICETableRow[];
  private data: ICETableRow[];
  private sortKey: string | null = null;
  private sortOrder: 'asc' | 'desc' | null = null;
  private rowPanels: any[] = [];
  private cellNodes: Array<{
    node: any;
    cellLeft: number;
    cellWidth: number;
    cellHeight: number;
    align: 'left' | 'center' | 'right';
  }> = [];
  private selectedIndex = -1;
  private rowHeight: number;
  private headerHeight: number;
  private onSelect: ((row: ICETableRow | null, index: number) => void) | null;
  private __bound = false;

  constructor(props: any = {}) {
    const theme = iceUIManager.getTheme();
    const width = props.width || 720;
    const rowHeight = props.rowHeight || 40;
    const headerHeight = props.headerHeight || 36;
    const height = headerHeight + rowHeight * (props.data ? props.data.length : 0);

    super({
      ...props,
      fill: true,
      stroke: true,
      width,
      height,
      radius: theme.radius.md,
      style: {
        fillStyle: theme.colors.surface,
        strokeStyle: theme.colors.border,
        lineWidth: theme.control.lineWidth,
        ...(props.style || {}),
      },
    });

    this.columns = props.columns || [];
    this.sourceData = props.data || [];
    this.data = props.data || [];
    this.rowHeight = rowHeight;
    this.headerHeight = headerHeight;
    this.onSelect = typeof props.onSelect === 'function' ? props.onSelect : null;
    this.__render();
  }

  public setData(data: ICETableRow[]): this {
    this.sourceData = data || [];
    this.data = this.sourceData;
    this.sortKey = null;
    this.sortOrder = null;
    this.selectedIndex = -1;
    this.setState({ height: this.headerHeight + this.rowHeight * this.data.length });
    this.__render();
    return this;
  }

  /** 当前渲染顺序的数据（排序后）。 */
  public getRows(): ICETableRow[] {
    return this.data.slice();
  }

  public getSortState(): ICETableSortState | null {
    if (!this.sortKey || !this.sortOrder) {
      return null;
    }
    return { key: this.sortKey, order: this.sortOrder };
  }

  /** 表头文案（排序中的列带 ▲/▼ 指示）。 */
  public getHeaderLabel(key: string): string {
    const column = this.columns.find((item) => item.key === key);
    if (!column) {
      return '';
    }
    if (this.sortKey === key && this.sortOrder) {
      return `${column.title} ${this.sortOrder === 'asc' ? '▲' : '▼'}`;
    }
    return column.title;
  }

  /** 点表头：升序 → 降序 → 恢复原始顺序。 */
  public toggleSort(key: string): this {
    const column = this.columns.find((item) => item.key === key);
    if (!column || !column.sorter) {
      return this;
    }
    let order: 'asc' | 'desc' | null;
    if (this.sortKey !== key) {
      order = 'asc';
    } else if (this.sortOrder === 'asc') {
      order = 'desc';
    } else {
      order = null;
    }
    return this.sortBy(key, order);
  }

  /** 显式设置排序（`order: null` 恢复原始顺序）。 */
  public sortBy(key: string, order: 'asc' | 'desc' | null): this {
    const column = this.columns.find((item) => item.key === key);
    if (!column || !column.sorter || !order) {
      this.sortKey = null;
      this.sortOrder = null;
      this.data = this.sourceData.slice();
      this.__render();
      return this;
    }
    this.sortKey = key;
    this.sortOrder = order;
    const direction = order === 'asc' ? 1 : -1;
    this.data = this.sourceData
      .slice()
      .sort((a, b) => direction * this.__compareRows(a, b, column));
    this.__render();
    return this;
  }

  public setSelectedRow(index: number): this {
    this.selectedIndex = index;
    this.__syncSelection();
    return this;
  }

  public getSelectedIndex(): number {
    return this.selectedIndex;
  }

  protected afterAddHandler(): void {
    super.afterAddHandler();
    this.__bindGlobalEvents();
    this.__layoutCells();
  }

  private __bindGlobalEvents(): void {
    if (this.__bound || !this.ice || !this.ice.evtBus) {
      return;
    }
    this.__bound = true;
    this.ice.evtBus.on('mousedown', this.__onGlobalMouseDown, this);
  }

  private __onGlobalMouseDown(evt: any): void {
    if (!evt || typeof evt.offsetX !== 'number' || typeof evt.offsetY !== 'number') {
      return;
    }
    // 组件可能已经从场景里摘掉（ice 被置空），此时全局事件不该再处理
    if (!this.ice || typeof this.ice.screenToWorld !== 'function') {
      return;
    }
    const [wx, wy] = this.ice.screenToWorld(evt.offsetX, evt.offsetY);
    const box = this.getMinBoundingBox(true);
    if (wx < box.tl[0] || wx > box.br[0] || wy < box.tl[1] || wy > box.br[1]) {
      return;
    }
    const localX = wx - box.tl[0];
    const localY = wy - box.tl[1];
    // 表头：命中列 → 排序
    if (localY < this.headerHeight) {
      const widths = this.__columnWidths(Number(this.state.width) || 720);
      let acc = 0;
      for (let i = 0; i < this.columns.length; i++) {
        if (localX >= acc && localX <= acc + widths[i]) {
          this.toggleSort(this.columns[i].key);
          return;
        }
        acc += widths[i];
      }
      return;
    }
    const index = Math.floor((localY - this.headerHeight) / this.rowHeight);
    if (index >= 0 && index < this.data.length) {
      this.selectedIndex = index;
      this.__syncSelection();
      if (this.onSelect) {
        this.onSelect(this.data[index], index);
      }
    }
  }

  /**
   * 宽松数值解析：容忍千分位与常见货币/百分号（`$1,240.00`、`12%`、`-3.5`）。
   * 解析不出来返回 null，交给字符串比较。
   */
  private __toNumber(value: any): number | null {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }
    if (typeof value !== 'string') {
      return null;
    }
    const cleaned = value.replace(/[,\s]/g, '').replace(/^[¥$€£]/, '').replace(/%$/, '');
    if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(cleaned)) {
      return null;
    }
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }

  /** 默认比较：两侧都能解析成数字（含货币/千分位/百分号）时按数值，否则按字符串。 */
  private __compareRows(a: ICETableRow, b: ICETableRow, column: ICETableColumn): number {
    if (typeof column.sorter === 'function') {
      return column.sorter(a, b);
    }
    const left = a[column.key];
    const right = b[column.key];
    const leftNumber = this.__toNumber(left);
    const rightNumber = this.__toNumber(right);
    if (leftNumber !== null && rightNumber !== null) {
      return leftNumber - rightNumber;
    }
    return String(left ?? '').localeCompare(String(right ?? ''));
  }

  private __render(): void {
    this.removeChildren([...this.childNodes]);
    const theme = iceUIManager.getTheme();
    const totalWidth = Number(this.state.width) || 720;
    const widths = this.__columnWidths(totalWidth);
    this.cellNodes = [];

    const header = new ICEWidget({
      fill: true,
      stroke: false,
      width: totalWidth,
      height: this.headerHeight,
      radius: theme.radius.sm,
      style: {
        fillStyle: theme.colors.background,
      },
    });
    this.addChild(header, false);
    this.__placeCells(header, widths, this.columns.map((column) => this.getHeaderLabel(column.key)), true, this.columns);
    const divider = new ICERect({
      left: 0,
      top: this.headerHeight - 1,
      width: totalWidth,
      height: 1,
      fill: true,
      stroke: false,
      style: { fillStyle: theme.colors.border },
    });
    header.addChild(divider, false);

    this.rowPanels = [];
    this.data.forEach((row, rowIndex) => {
      const panel = new ICEWidget({
        fill: true,
        stroke: false,
        left: 0,
        top: this.headerHeight + rowIndex * this.rowHeight,
        width: totalWidth,
        height: this.rowHeight,
        style: {
          fillStyle: rowIndex % 2 === 0 ? theme.colors.surface : theme.colors.background,
        },
      });
      this.addChild(panel, false);
      this.rowPanels.push(panel);
      const values = this.columns.map((column) => this.__format(row[column.key]));
      this.__placeCells(panel, widths, values, false, this.columns, row);
    });
    this.__syncSelection();
    if (this.ice && this.ice.ctx) {
      this.__layoutCells();
    }
    this.revalidate();
  }

  private __placeCells(
    parent: any,
    widths: number[],
    values: string[],
    header: boolean,
    columns?: ICETableColumn[],
    row?: ICETableRow,
  ): void {
    const theme = iceUIManager.getTheme();
    const padX = theme.spacing.sm;
    let left = 0;
    const cellHeight = header ? this.headerHeight : this.rowHeight;
    values.forEach((value, index) => {
      const column = columns ? columns[index] : undefined;
      const align = column ? column.align || 'left' : 'left';
      const colW = widths[index];

      if (column && typeof column.renderCell === 'function' && row) {
        const node = column.renderCell(value, row, column, {
          cellWidth: colW,
          cellHeight,
          align,
        });
        if (node) {
          // 渲染节点是 row panel 的子节点，其 left/top 是相对 panel 坐标；
          // 需把节点平移到当前单元格内（左侧累加值 left 即单元格在 panel 中的起点）。
          node.setState({ left: (node.state.left || 0) + left });
          parent.addChild(node, false);
          left += colW;
          return;
        }
      }

      const node = createTextNode({
        left: left,
        top: 0,
        width: 1,
        height: cellHeight,
        text: value,
        fillStyle: header ? theme.colors.textSecondary : theme.colors.text,
        fontFamily: theme.font.family,
        fontSize: header ? theme.font.sizeSmall : theme.font.size,
        fontWeight: header ? theme.font.weightSemibold : theme.font.weightNormal,
        align: 'left',
        verticalAlign: 'middle',
      });
      parent.addChild(node, false);
      this.cellNodes.push({
        node,
        cellLeft: left,
        cellWidth: colW,
        cellHeight,
        align,
      });
      left += colW;
    });
  }

  private __layoutCells(): void {
    if (!this.ice || !this.ice.ctx || typeof this.ice.ctx.measureText !== 'function') {
      return;
    }
    const theme = iceUIManager.getTheme();
    const padX = theme.spacing.sm;
    const ctx = this.ice.ctx;

    for (const cell of this.cellNodes) {
      const style = cell.node.state.style || {};
      const font = style.font || `${style.fontWeight || 'normal'} ${style.fontSize || 14}px ${style.fontFamily || 'Arial'}`;
      ctx.font = font;
      const textWidth = ctx.measureText(String(cell.node.state.text || '')).width || 0;
      let left = cell.cellLeft + padX;
      if (cell.align === 'right') {
        left = cell.cellLeft + cell.cellWidth - padX - textWidth;
      } else if (cell.align === 'center') {
        left = cell.cellLeft + (cell.cellWidth - textWidth) / 2;
      }
      cell.node.setState({
        left,
        top: 0,
        width: Math.max(1, textWidth),
        height: cell.cellHeight,
      });
    }
    this.revalidate();
  }

  private __columnWidths(totalWidth: number): number[] {
    const fixed = this.columns.reduce((sum, column) => sum + (Number(column.width) || 0), 0);
    const rest = totalWidth - fixed;
    const autoCount = this.columns.filter((column) => !(Number(column.width) > 0)).length;
    const auto = autoCount > 0 ? rest / autoCount : 0;
    return this.columns.map((column) => Number(column.width) || auto);
  }

  private __format(value: any): string {
    if (value === null || value === undefined) return '';
    return String(value);
  }

  private __syncSelection(): void {
    const theme = iceUIManager.getTheme();
    this.rowPanels.forEach((panel, index) => {
      panel.setState({
        style: {
          fillStyle: index === this.selectedIndex ? theme.colors.primaryBg : index % 2 === 0 ? theme.colors.surface : theme.colors.background,
        },
      });
    });
    this.revalidate();
  }
}
