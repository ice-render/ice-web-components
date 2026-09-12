import { ICEWidget } from '../core/ICEWidget';
import { ICECheckBox } from './ICECheckBox';
import { ICEEmpty } from './ICEEmpty';
import { ICEPagination } from './ICEPagination';
import { iceUIManager } from '../core/ICEManager';
import { createTextNode, readHovered } from '../util/ICEStyle';
import { ICERect } from 'ice-render';
import { ICEScrollPane } from './ICEScrollPane';
import { t } from '../i18n/ICEI18n';
import { computeVirtualRange } from './ICEVirtualList';
import { ICEDropTarget, computeDropTarget, moveItem } from '../util/ICEDragReorder';

export type ICETableColumn = {
  key: string;
  title: string;
  width?: number;
  /** 固定列：横向滚动时钉在左边不跟着滚（宽表的常用约定） */
  fixed?: boolean;
  /** 拖拽缩列时的最小宽度（不传用表格的 `minColumnWidth`，默认 60） */
  minWidth?: number;
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

/**
 * 列宽求解（纯函数，方便单测）。
 *
 * 规则：
 * - 显式 `width` 优先，且不低于 `minWidth`；
 * - 剩下的宽度在所有「自动列」（没给 width 的）之间均分；
 * - 均分后仍小于最小宽度的，抬到最小宽度 —— 此时**总和可能超过 totalWidth**，
 *   这是有意的（宽表就该横向溢出，由调用方决定要不要横向滚动），不在函数里悄悄压扁。
 */
export function resolveColumnWidths(
  columns: Array<{ width?: number; minWidth?: number }>,
  totalWidth: number,
  defaultMinWidth: number = 60,
): number[] {
  const count = (columns || []).length;
  if (!count) return [];
  const mins = columns.map((column) => Math.max(1, Math.floor(Number(column.minWidth) || defaultMinWidth)));
  const widths = columns.map((column, index) => {
    const explicit = Math.floor(Number(column.width) || 0);
    return explicit > 0 ? Math.max(mins[index], explicit) : 0;
  });
  const autoIndexes = widths.map((width, index) => (width === 0 ? index : -1)).filter((index) => index >= 0);
  if (autoIndexes.length) {
    const fixedSum = widths.reduce((sum, width) => sum + width, 0);
    const remaining = Math.max(0, Math.floor(Number(totalWidth) || 0) - fixedSum);
    const each = Math.max(1, Math.floor(remaining / autoIndexes.length));
    autoIndexes.forEach((index) => {
      widths[index] = Math.max(mins[index], each);
    });
  }
  return widths;
}

export interface ICETableSortState {
  key: string;
  order: 'asc' | 'desc';
}

export interface ICETablePaginationOptions {
  pageSize?: number;
  /** 初始页码（从 1 开始） */
  page?: number;
  showTotal?: boolean;
  /** 换页回调（与 `pagechange` 事件同义） */
  onChange?: (page: number, pageSize: number) => void;
}

export type ICETableSelectionMode = 'none' | 'single' | 'multiple';

/**
 * 表格：列定义（宽度 / 对齐 / 排序 / 自定义单元格）+ 行选择 + 分页 + 空态 + 悬停/斑马纹。
 *
 * - 点表头排序：升 → 降 → 恢复，`sorter` 可为布尔或自定义比较函数；
 * - 行选择 `rowSelection: 'none' | 'single'（默认）| 'multiple'`：多选时最左侧多出
 *   40px 选择列（表头全选 + 每行复选框），`getSelectedRows()` / `selectAll()` /
 *   `clearSelection()` 配合批量操作；选择变化触发 `selectionchange` 与 `onSelectionChange`；
 * - `pagination: { pageSize, page, showTotal, onChange }`：只渲染当前页并挂出 `ICEPagination`；
 * - 没有数据时渲染 `ICEEmpty` 空态（不会留一片空白）。
 */
export class ICETable extends ICEWidget {
  private columns: ICETableColumn[];
  /** 原始数据（排序前的顺序，用于第三次点击恢复） */
  private sourceData: ICETableRow[];
  /** 排序后的全量数据（分页从这里切片） */
  private sortedData: ICETableRow[];
  /** 当前页要渲染的行（不分页时等于 sortedData） */
  private data: ICETableRow[];
  private pageSize = 0;
  private page = 1;
  private paginationOptions: ICETablePaginationOptions | null = null;
  private paginationNode: ICEPagination | null = null;
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
  /** 多选模式下的选中行（当前页内的下标，按行序） */
  private selectedIndexes: number[] = [];
  private selectionMode: ICETableSelectionMode = 'single';
  private selectionNodes: ICECheckBox[] = [];
  private headerCheckbox: ICECheckBox | null = null;
  private onSelectionChange: ((rows: ICETableRow[], indexes: number[]) => void) | null = null;
  /** 选择列宽度（多选时内容列整体右移这么多） */
  private static readonly SELECTION_WIDTH = 40;
  /** 上一次渲染用的宽度：宽度变了要多渲染一次（否则列宽不更新） */
  private renderedWidth = 0;
  /** 鼠标悬停行（-1 = 无）；只影响底色，不影响选中 */
  private hoveredIndex = -1;
  private rowHeight: number;
  private headerHeight: number;
  private onSelect: ((row: ICETableRow | null, index: number) => void) | null;
  /** 拖拽缩列后的宽度覆盖（列 key → 宽度）；不动原始 columns 定义 */
  private columnWidthOverrides: Record<string, number> = {};
  /** 是否允许拖表头边界缩列 */
  private resizable = false;
  private minColumnWidth: number;
  private onColumnResize: ((key: string, width: number, widths: Record<string, number>) => void) | null = null;
  /** 拖拽状态：{ key, index, startX, startWidth } */
  private resizeState: { key: string; index: number; startX: number; startWidth: number } | null = null;
  /** 可滚动模式：虚拟行（`virtual`）或存在固定列时启用；旧路径保持原样 */
  private scrollable = false;
  private virtual = false;
  private bodyPane: ICEScrollPane | null = null;
  private headerPane: ICEScrollPane | null = null;
  private bodyContent: any = null;
  private frozenLayer: any = null;
  private frozenContent: any = null;
  private rowWindow: { start: number; end: number; count: number } = { start: 0, end: 0, count: 0 };
  private virtualScrollTop = 0;
  private virtualScrollLeft = 0;
  private rowNodes = new Map<number, any>();
  private frozenRowNodes = new Map<number, any>();
  private virtualBuffer = 2;
  /** 可滚动模式下的内容宽度（列多到装不下时 > 视口宽度） */
  private renderedContentWidth = 0;
  /** 行拖拽排序：开启后按住行上下拖就能改顺序 */
  private rowDraggable = false;
  private onRowReorder: ((from: number, to: number, rows: ICETableRow[]) => void) | null = null;
  /** 拖拽状态：源行下标 + 当前落点 + 指示线节点 */
  private dragRow: { from: number; target: ICEDropTarget | null; indicator: any } | null = null;
  private __bound = false;

  constructor(props: any = {}) {
    const theme = iceUIManager.getTheme();
    const width = props.width || 720;
    const rowHeight = props.rowHeight || 40;
    const headerHeight = props.headerHeight || 36;
    const fixedColumns = (props.columns || []).some((column: ICETableColumn) => column.fixed === true);
    // 可滚动模式（虚拟行 / 固定列）高度必须由调用方给：按行数算高度会和「只渲染可视区」自相矛盾
    const scrollable = props.virtual === true || fixedColumns;
    const height = scrollable ? props.height || 400 : headerHeight + rowHeight * (props.data ? props.data.length : 0);

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
    this.sortedData = (props.data || []).slice();
    this.data = this.sortedData;
    this.rowHeight = rowHeight;
    this.headerHeight = headerHeight;
    this.onSelect = typeof props.onSelect === 'function' ? props.onSelect : null;
    this.resizable = props.resizable === true;
    this.minColumnWidth = Math.max(20, Math.floor(Number(props.minColumnWidth) || 60));
    this.onColumnResize = typeof props.onColumnResize === 'function' ? props.onColumnResize : null;
    this.virtual = props.virtual === true;
    this.virtualBuffer = Math.max(0, Math.floor(Number(props.virtualBuffer === undefined ? 2 : props.virtualBuffer) || 0));
    this.scrollable = this.virtual || (this.columns || []).some((column: ICETableColumn) => column.fixed === true);
    this.rowDraggable = props.rowDraggable === true;
    this.onRowReorder = typeof props.onRowReorder === 'function' ? props.onRowReorder : null;
    this.selectionMode =
      props.rowSelection === 'multiple' ? 'multiple' : props.rowSelection === 'none' ? 'none' : 'single';
    this.onSelectionChange = typeof props.onSelectionChange === 'function' ? props.onSelectionChange : null;
    if (props.pagination && typeof props.pagination === 'object') {
      this.paginationOptions = props.pagination;
      this.pageSize = Math.max(1, Number(props.pagination.pageSize) || 10);
      this.page = Math.max(1, Number(props.pagination.page) || 1);
      this.__applyPage();
      return;
    }
    this.__render();
  }

  public setData(data: ICETableRow[]): this {
    this.sourceData = data || [];
    this.sortedData = this.sourceData.slice();
    this.sortKey = null;
    this.sortOrder = null;
    this.selectedIndex = -1;
    this.selectedIndexes = [];
    this.page = 1;
    this.__applyPage();
    return this;
  }

  /** 全量行数（排序后、分页前的总数）。 */
  public getTotalRows(): number {
    return this.sortedData.length;
  }

  /** 总页数；不分页时为 1。 */
  public getPageCount(): number {
    if (!this.pageSize) {
      return 1;
    }
    return Math.max(1, Math.ceil(this.sortedData.length / this.pageSize));
  }

  public getPage(): number {
    return this.page;
  }

  public getPageSize(): number {
    return this.pageSize;
  }

  /** 换页：夹取到 [1, pageCount]，重新渲染并回调。 */
  public setPage(page: number): this {
    if (!this.pageSize) {
      return this;
    }
    const next = Math.min(this.getPageCount(), Math.max(1, Math.floor(Number(page) || 1)));
    if (next === this.page) {
      return this;
    }
    this.page = next;
    this.selectedIndex = -1;
    this.__applyPage();
    this.trigger('pagechange', null, { page: next, pageSize: this.pageSize });
    if (this.paginationOptions && this.paginationOptions.onChange) {
      this.paginationOptions.onChange(next, this.pageSize);
    }
    return this;
  }

  public setPageSize(pageSize: number): this {
    const next = Math.max(1, Math.floor(Number(pageSize) || 10));
    if (!this.pageSize || next === this.pageSize) {
      return this;
    }
    this.pageSize = next;
    this.page = 1;
    this.__applyPage();
    return this;
  }

  /** 分页器节点（不分页 / 空数据时为 null）。 */
  public getPaginationNode(): ICEPagination | null {
    return this.paginationNode;
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
      this.sortedData = this.sourceData.slice();
      this.__applyPage();
      return this;
    }
    this.sortKey = key;
    this.sortOrder = order;
    const direction = order === 'asc' ? 1 : -1;
    this.sortedData = this.sourceData
      .slice()
      .sort((a, b) => direction * this.__compareRows(a, b, column));
    this.__applyPage();
    return this;
  }

  /** 按当前页/每页条数切出要渲染的行，并把高度（含分页器 / 空态）算好。 */
  private __applyPage(): void {
    const total = this.sortedData.length;
    this.page = Math.min(this.getPageCount(), Math.max(1, this.page));
    if (!this.pageSize) {
      this.data = this.sortedData.slice();
    } else {
      const start = (this.page - 1) * this.pageSize;
      this.data = this.sortedData.slice(start, start + this.pageSize);
    }
    const showPagination = this.pageSize > 0 && total > 0;
    const bodyHeight = this.data.length > 0 ? this.rowHeight * this.data.length : 120;
    this.setState({
      height: this.headerHeight + bodyHeight + (showPagination ? this.__footerHeight() : 0),
    });
    this.__render();
  }

  /** 分页器区域高度（分页器本体 32 + 上下留白）。 */
  private __footerHeight(): number {
    return 48;
  }

  public setSelectedRow(index: number): this {
    if (this.selectionMode === 'multiple') {
      return this.setSelectedIndexes(index >= 0 ? [index] : []);
    }
    this.selectedIndex = index;
    this.selectedIndexes = index >= 0 ? [index] : [];
    this.__syncSelection();
    return this;
  }

  public getSelectedIndex(): number {
    return this.selectedIndex;
  }

  public getSelectionMode(): ICETableSelectionMode {
    return this.selectionMode;
  }

  public getSelectedIndexes(): number[] {
    if (this.selectionMode === 'multiple') {
      return this.selectedIndexes.slice();
    }
    return this.selectedIndex >= 0 ? [this.selectedIndex] : [];
  }

  /** 选中的行（多选按行序返回）。 */
  public getSelectedRows(): ICETableRow[] {
    return this.getSelectedIndexes()
      .map((index) => this.data[index])
      .filter(Boolean);
  }

  /** 批量设置选中行（多选模式用；单选模式只认第一个）。 */
  public setSelectedIndexes(indexes: number[]): this {
    const valid = (indexes || [])
      .map((index) => Math.floor(Number(index)))
      .filter((index) => index >= 0 && index < this.data.length)
      .filter((index, position, list) => list.indexOf(index) === position)
      .sort((a, b) => a - b);
    if (this.selectionMode !== 'multiple') {
      return this.setSelectedRow(valid.length ? valid[0] : -1);
    }
    this.selectedIndexes = valid;
    this.selectedIndex = valid.length ? valid[valid.length - 1] : -1;
    this.__syncSelection();
    this.__emitSelection();
    return this;
  }

  public selectAll(): this {
    return this.setSelectedIndexes(this.data.map((_row, index) => index));
  }

  public clearSelection(): this {
    return this.setSelectedIndexes([]);
  }

  public getSelectionNode(index: number): ICECheckBox | null {
    return this.selectionNodes[index] || null;
  }

  public getHeaderCheckbox(): ICECheckBox | null {
    return this.headerCheckbox;
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
    this.ice.evtBus.on('mousemove', this.__onGlobalMouseMove, this);
    this.ice.evtBus.on('mouseup', this.__onGlobalMouseUp, this);
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
      const offset = this.selectionMode === 'multiple' ? ICETable.SELECTION_WIDTH : 0;
      const widths = this.__columnWidths((Number(this.state.width) || 720) - offset);
      let acc = offset;
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
      // 行拖拽排序：按住行往下拖。多选列那 40px 不参与（那是勾选框的地盘）
      if (this.rowDraggable && !(this.selectionMode === 'multiple' && localX < ICETable.SELECTION_WIDTH)) {
        this.__startRowDrag(index);
        this.__updateRowDrag(localY);
      }
      // 点在行内的交互控件上（例如「详情 / 删除」按钮）：交给控件自己处理，不做整行选中。
      // 否则点按钮会同时触发选中回调（弹窗/抽屉会莫名其妙弹两层）。
      const hit = evt.target;
      const panel = this.rowPanels[index];
      if (hit && hit !== panel) {
        let node = hit.parentNode;
        while (node && node !== panel) {
          node = node.parentNode;
        }
        if (node === panel) {
          return;
        }
      }
      this.selectedIndex = index;
      if (this.selectionMode === 'multiple') {
        // 多选：点行本身 = 切换这一行（批量操作用），不再触发 onSelect
        const next = this.selectedIndexes.indexOf(index) === -1
          ? this.selectedIndexes.concat(index).sort((a, b) => a - b)
          : this.selectedIndexes.filter((item) => item !== index);
        this.selectedIndexes = next;
        this.selectedIndex = index;
        this.__syncSelection();
        this.__emitSelection();
        return;
      }
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
    this.renderedWidth = totalWidth;
    const offset = this.selectionMode === 'multiple' ? ICETable.SELECTION_WIDTH : 0;
    const widths = this.__columnWidths(totalWidth - offset);
    this.cellNodes = [];
    this.selectionNodes = [];
    this.headerCheckbox = null;

    // 可滚动模式（虚拟行 / 固定列）：表头与表体各自成滚动视口，走另一条渲染路径
    if (this.scrollable) {
      this.__renderScrollable(widths, offset);
      return;
    }

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
    if (this.selectionMode === 'multiple') {
      // 表头全选：勾上就是全选当前页
      const selectAllBox = new ICECheckBox({
        left: (offset - 24) / 2,
        top: (this.headerHeight - 24) / 2,
        width: 24,
        height: 24,
        selected: this.data.length > 0 && this.selectedIndexes.length === this.data.length,
      });
      selectAllBox.on('change', () => {
        if (selectAllBox.isSelected()) {
          this.selectAll();
        } else {
          this.clearSelection();
        }
      });
      header.addChild(selectAllBox, false);
      this.headerCheckbox = selectAllBox;
    }
    this.__placeCells(
      header,
      widths,
      this.columns.map((column) => this.getHeaderLabel(column.key)),
      true,
      this.columns,
      undefined,
      offset,
    );
    // 拖拽缩列：表头每列右边界放一条透明拖拽条
    if (this.resizable) {
      this.__createResizeHandles(header, widths, offset);
    }
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
    this.__createRowPanel(row, rowIndex, this, this.headerHeight + rowIndex * this.rowHeight, widths, offset);
    });

    // 空态：没有数据时给一块 ICEEmpty，而不是留一片空白
    if (!this.data.length) {
      this.addChild(
        new ICEEmpty({
          left: 0,
          top: this.headerHeight,
          width: totalWidth,
          height: 120,
          description: t('table.empty'),
        }),
        false,
      );
    }

    // 分页器：只有真的分了页（且不是空态）才出现
    this.paginationNode = null;
    if (this.pageSize > 0 && this.data.length > 0) {
      const pagination = new ICEPagination({
        left: 0,
        top: this.headerHeight + this.data.length * this.rowHeight + 8,
        width: totalWidth,
        total: this.sortedData.length,
        pageSize: this.pageSize,
        current: this.page,
        showTotal: this.paginationOptions ? this.paginationOptions.showTotal !== false : true,
        onChange: (page: number) => this.setPage(page),
      });
      this.addChild(pagination, false);
      this.paginationNode = pagination;
    }
    this.__syncSelection();
    if (this.ice && this.ice.ctx) {
      this.__layoutCells();
    }
    this.revalidate();
  }

  /**
   * @overwrite 宽度变化时重算列宽。
   *
   * `__render()` 只在 setData / 排序 / 分页时跑，而窗口缩放、分栏拖动只会改 `state.width`；
   * 引擎在 setState 后只回调 `__afterStateMerge`（不会调 `revalidate`），所以钩子挂在这里。
   * 不补这次渲染，列宽会停留在旧值 —— 表现为单元格文字互相重叠。
   */
  protected __afterStateMerge(sizeChanged: boolean): void {
    super.__afterStateMerge(sizeChanged);
    const width = Number(this.state.width) || 0;
    if (sizeChanged && width > 0 && this.renderedWidth > 0 && width !== this.renderedWidth) {
      this.__render();
    }
  }

  /** 建一行（普通模式与虚拟模式共用；top 由调用方给，虚拟模式里相对滚动内容）。 */
  /**
   * 可滚动模式的渲染：表头与表体各自一个 `ICEScrollPane`（横向同步），
   * 表体只渲染可视行窗口（虚拟行），有固定列时再叠一层不横向滚动的冻结层。
   */
  private __renderScrollable(baseWidths: number[], offset: number): void {
    const theme = iceUIManager.getTheme();
    const viewportWidth = Number(this.state.width) || 720;
    const viewportHeight = Number(this.state.height) || 400;
    const frozenIndexes: number[] = [];
    this.columns.forEach((column, index) => {
      if (column.fixed === true) frozenIndexes.push(index);
    });
    const frozenWidth = frozenIndexes.reduce((sum, index) => sum + baseWidths[index], 0);
    // 内容宽度：至少铺满视口；列多到最小宽度都装不下时自然溢出（横向滚动）
    const naturalWidth = baseWidths.reduce((sum, width) => sum + width, 0);
    const contentWidth = Math.max(viewportWidth, naturalWidth);
    this.renderedContentWidth = contentWidth;
    const widths = this.__columnWidths(contentWidth - offset);
    const bodyHeight = Math.max(0, viewportHeight - this.headerHeight);

    const headerContent = new ICEWidget({ left: 0, top: 0, width: contentWidth, height: this.headerHeight, fill: true, stroke: false, interactive: false, style: { fillStyle: theme.colors.background } });
    this.__placeCells(headerContent, widths, this.columns.map((column) => this.getHeaderLabel(column.key)), true, this.columns, undefined, offset);
    this.headerPane = new ICEScrollPane({ left: 0, top: 0, width: viewportWidth, height: this.headerHeight, scrollbar: false });
    this.headerPane.setContent(headerContent);
    this.headerPane.setContentSize(contentWidth, this.headerHeight);
    this.addChild(this.headerPane, false);

    const rows = this.pageSize > 0 ? this.data : this.sortedData;
    this.data = rows;
    const contentHeight = rows.length * this.rowHeight;
    this.bodyContent = new ICEWidget({ left: 0, top: 0, width: contentWidth, height: contentHeight, fill: false, stroke: false, interactive: false });
    this.bodyPane = new ICEScrollPane({ left: 0, top: this.headerHeight, width: viewportWidth, height: bodyHeight });
    this.bodyPane.setContent(this.bodyContent);
    this.bodyPane.setContentSize(contentWidth, contentHeight);
    this.bodyPane.on('scroll', (evt: any) => {
      const x = evt && evt.param ? Number(evt.param.x) || 0 : 0;
      const y = evt && evt.param ? Number(evt.param.y) || 0 : 0;
      this.virtualScrollLeft = x;
      this.virtualScrollTop = y;
      // 表头只跟横向，表体两个方向都能滚
      if (this.headerPane) this.headerPane.setScroll(x, 0);
      this.__syncRowWindow();
    });
    this.addChild(this.bodyPane, false);

    if (frozenIndexes.length) {
      this.frozenLayer = new ICEWidget({
        left: 0,
        top: 0,
        width: frozenWidth,
        height: viewportHeight,
        fill: false,
        stroke: false,
        interactive: false,
        clipChildren: true,
      });
      const frozenHeader = new ICEWidget({
        left: 0,
        top: 0,
        width: frozenWidth,
        height: this.headerHeight,
        fill: true,
        stroke: false,
        interactive: false,
        style: { fillStyle: theme.colors.background },
      });
      this.frozenLayer.addChild(frozenHeader, false);
      this.__placeCells(
        frozenHeader,
        widths,
        this.columns.map((column) => this.getHeaderLabel(column.key)),
        true,
        this.columns,
        undefined,
        offset,
      );
      this.frozenContent = new ICEWidget({ left: 0, top: this.headerHeight, width: frozenWidth, height: bodyHeight, fill: false, stroke: false, interactive: false });
      this.frozenLayer.addChild(this.frozenContent, false);
      // 固定列的分隔线 + 阴影，让「钉住」这件事看得见
      const edge = new ICERect({
        left: frozenWidth - 1,
        top: 0,
        width: 1,
        height: viewportHeight,
        fill: true,
        stroke: false,
        style: { fillStyle: theme.colors.border },
      });
      this.frozenLayer.addChild(edge, false);
      this.addChild(this.frozenLayer, false);
    }

    this.rowNodes.clear();
    this.frozenRowNodes.clear();
    this.__syncRowWindow();
    this.__syncSelection();
    if (this.ice && this.ice.ctx) this.__layoutCells();
    this.revalidate();
  }

  /** 按当前滚动位置重算可视行窗口：窗口外的行面板拆掉，窗口内的补上。 */
  private __syncRowWindow(): void {
    if (!this.scrollable || !this.bodyContent) return;
    const bodyHeight = Math.max(0, (Number(this.state.height) || 400) - this.headerHeight);
    const rows = this.data;
    const range = computeVirtualRange({
      scrollTop: this.virtualScrollTop,
      viewportHeight: bodyHeight,
      itemHeight: this.rowHeight,
      itemCount: rows.length,
      buffer: this.virtualBuffer,
    });
    this.rowWindow = range;
    const offset = this.selectionMode === 'multiple' ? ICETable.SELECTION_WIDTH : 0;
    const widths = this.__columnWidths((this.bodyContent.state.width || 0) - offset);
    Array.from(this.rowNodes.keys()).forEach((index) => {
      if (index >= range.start && index < range.end) return;
      const node = this.rowNodes.get(index);
      this.rowNodes.delete(index);
      if (node) this.bodyContent.removeChild(node);
      this.__forgetRowCells(node);
      const frozen = this.frozenRowNodes.get(index);
      if (frozen && this.frozenContent) {
        this.frozenRowNodes.delete(index);
        this.frozenContent.removeChild(frozen);
        this.__forgetRowCells(frozen);
      }
    });
    for (let index = range.start; index < range.end; index += 1) {
      if (this.rowNodes.has(index)) continue;
      const panel = this.__createRowPanel(rows[index], index, this.bodyContent, index * this.rowHeight, widths, offset);
      this.rowNodes.set(index, panel);
      if (this.frozenContent) {
        const frozen = this.__createRowPanel(rows[index], index, this.frozenContent, index * this.rowHeight - this.headerHeight, widths, offset, this.frozenContent.state.width);
        this.frozenRowNodes.set(index, frozen);
      }
    }
    // 新行里的单元格要重新量一次宽度：`__placeCells` 建出来的文字节点宽度是 1，
    // 不量的话滚动出来的新行会「有格子没字」（这个坑就是 QA 截图盯出来的）。
    if (this.ice && this.ice.ctx) this.__layoutCells();
  }

  /** 行被拆掉时，把它名下的单元格记录也清掉（否则 `cellNodes` 会随滚动无限增长）。 */
  private __forgetRowCells(panel: any): void {
    if (!panel || !panel.childNodes) return;
    const owned = new Set(panel.childNodes);
    this.cellNodes = this.cellNodes.filter((cell) => !owned.has(cell.node));
  }

  private __createRowPanel(row: ICETableRow, rowIndex: number, parent: any, top: number, widths: number[], offset: number, panelWidth?: number): any {
    const theme = iceUIManager.getTheme();
    const panel = new ICEWidget({
      fill: true,
      stroke: false,
      left: 0,
      top: top,
      width: panelWidth === undefined ? Number(this.state.width) || 0 : panelWidth,
      height: this.rowHeight,
      style: {
        fillStyle: rowIndex % 2 === 0 ? theme.colors.surface : theme.colors.background,
      },
    });
    parent.addChild(panel, false);
    this.rowPanels.push(panel);
    if (this.selectionMode === 'multiple') {
      const checkbox = new ICECheckBox({
        left: (offset - 24) / 2,
        top: (this.rowHeight - 24) / 2,
        width: 24,
        height: 24,
        selected: this.selectedIndexes.indexOf(rowIndex) !== -1,
      });
      checkbox.on('change', () => {
        const selected = checkbox.isSelected();
        const has = this.selectedIndexes.indexOf(rowIndex) !== -1;
        if (selected === has) {
          return;
        }
        this.selectedIndexes = selected
          ? this.selectedIndexes.concat(rowIndex).sort((a, b) => a - b)
          : this.selectedIndexes.filter((item) => item !== rowIndex);
        this.__syncSelection();
        this.__emitSelection();
      });
      panel.addChild(checkbox, false);
      this.selectionNodes.push(checkbox);
    }
    // 行悬停反馈：hover 由 ICEHoverManager 打在行面板上，这里只负责换底色
    panel.on(
      'hoverchange',
      (evt: any) => {
        const hovered = readHovered(evt);
        if (hovered) {
          this.hoveredIndex = rowIndex;
        } else if (this.hoveredIndex === rowIndex) {
          this.hoveredIndex = -1;
        }
        this.__syncSelection();
      },
      this,
    );
    const values = this.columns.map((column) => this.__format(row[column.key]));
    this.__placeCells(panel, widths, values, false, this.columns, row, offset);
    return panel;
  }

  private __placeCells(
    parent: any,
    widths: number[],
    values: string[],
    header: boolean,
    columns?: ICETableColumn[],
    row?: ICETableRow,
    offset: number = 0,
  ): void {
    const theme = iceUIManager.getTheme();
    const padX = theme.spacing.sm;
    let left = offset;
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
    return resolveColumnWidths(
      this.columns.map((column) => ({
        width: this.columnWidthOverrides[column.key] || column.width,
        minWidth: column.minWidth,
      })),
      totalWidth,
      this.minColumnWidth,
    );
  }

  // ---------------------------------------------------------------- 列宽 API

  /** 当前各列实际宽度（按列 key 给，方便断言与持久化）。 */
  public getColumnWidths(): Record<string, number> {
    const totalWidth =
      this.scrollable && this.renderedContentWidth
        ? this.renderedContentWidth
        : this.renderedWidth || Number(this.state.width) || 720;
    const offset = this.selectionMode === 'multiple' ? ICETable.SELECTION_WIDTH : 0;
    const widths = this.__columnWidths(totalWidth - offset);
    const result: Record<string, number> = {};
    this.columns.forEach((column, index) => {
      result[column.key] = widths[index];
    });
    return result;
  }

  /**
   * 手动设置某列宽度（拖拽缩列走的就是它）：宽度按 `minWidth` 夹取，改完重排整张表。
   * 返回是否真的变了（相同宽度不会白重排）。
   */
  public setColumnWidth(key: string, width: number): boolean {
    const column = this.columns.find((item) => item.key === key);
    if (!column) return false;
    const min = Math.max(20, Math.floor(Number(column.minWidth) || this.minColumnWidth));
    const next = Math.max(min, Math.floor(Number(width) || 0));
    const current = this.getColumnWidths()[key];
    if (current === next) return false;
    this.columnWidthOverrides[key] = next;
    // 列宽变了，其它自动列要重新分配 —— 只有「显式给了 width」的列才不会受影响
    this.columns.forEach((item) => {
      if (item.key !== key && !(Number(item.width) > 0) && this.columnWidthOverrides[item.key]) {
        delete this.columnWidthOverrides[item.key];
      }
    });
    this.__render();
    const widths = this.getColumnWidths();
    this.trigger('columnresize', null, { key, width: next, widths });
    if (this.onColumnResize) this.onColumnResize(key, next, widths);
    return true;
  }

  public isResizable(): boolean {
    return this.resizable;
  }

  public isResizing(): boolean {
    return !!this.resizeState;
  }

  // ---------------------------------------------------------------- 滚动 / 虚拟行 API

  public isVirtual(): boolean {
    return this.virtual;
  }

  public isScrollable(): boolean {
    return this.scrollable;
  }

  /** 当前可视行窗口（`[start, end)`，虚拟模式专用；普通模式返回整段）。 */
  public getRowRange(): { start: number; end: number; count: number } {
    if (!this.scrollable) return { start: 0, end: this.data.length, count: this.data.length };
    this.__syncRowWindow();
    return { ...this.rowWindow };
  }

  /** 真正建出来的行数（虚拟模式下的节点数上界，QA 拿它守「不会全量渲染」）。 */
  public getRenderedRowCount(): number {
    if (!this.scrollable) return this.data.length;
    return this.__syncRowWindow(), this.rowNodes.size;
  }

  public getScroll(): { x: number; y: number } {
    return { x: this.virtualScrollLeft, y: this.virtualScrollTop };
  }

  /** 内容总高度（虚拟模式下 = 行数 × 行高）。 */
  public getContentHeight(): number {
    return this.scrollable ? this.data.length * this.rowHeight : this.headerHeight + this.data.length * this.rowHeight;
  }

  /** 固定列的总宽度（没有固定列就是 0）。 */
  public getFrozenWidth(): number {
    const widths = this.getColumnWidths();
    return this.columns.reduce((sum, column) => sum + (column.fixed === true ? widths[column.key] : 0), 0);
  }

  public setScrollTop(y: number): this {
    if (!this.scrollable || !this.bodyPane) return this;
    const maxY = Math.max(0, this.getContentHeight() - Math.max(0, (Number(this.state.height) || 400) - this.headerHeight));
    const next = Math.min(Math.max(Number(y) || 0, 0), maxY);
    this.virtualScrollTop = next;
    this.bodyPane.setScroll(this.virtualScrollLeft, next);
    this.__syncRowWindow();
    return this;
  }

  public setScrollLeft(x: number): this {
    if (!this.scrollable || !this.bodyPane) return this;
    const next = Math.max(0, Number(x) || 0);
    this.virtualScrollLeft = next;
    this.bodyPane.setScroll(next, this.virtualScrollTop);
    if (this.headerPane) this.headerPane.setScroll(next, 0);
    return this;
  }

  /** 把某一行滚进视口（贴顶）。 */
  public scrollToRow(index: number): this {
    if (!this.scrollable) return this;
    const clamped = Math.min(Math.max(Math.floor(Number(index) || 0), 0), Math.max(0, this.data.length - 1));
    return this.setScrollTop(clamped * this.rowHeight);
  }

  // ---------------------------------------------------------------- 行拖拽排序

  public isRowDraggable(): boolean {
    return this.rowDraggable;
  }

  public isRowDragging(): boolean {
    return !!this.dragRow;
  }

  /** 当前落点（拖拽中才有值；QA 用它断言指示线跟手）。 */
  public getDropTarget(): ICEDropTarget | null {
    return this.dragRow ? this.dragRow.target : null;
  }

  /**
   * 把第 `from` 行移到落点处（拖拽松手时调用；也可以直接调它做「上移/下移」按钮）。
   *
   * 移动的是**当前渲染顺序**（`sortedData`）；没有激活排序时同步 `sourceData`，
   * 这样第 n 次点表头恢复原序时拿到的是新顺序。返回是否真的动了。
   */
  public moveRow(from: number, target: ICEDropTarget): boolean {
    // 拖拽给的是「当前页内的下标」，而数据在 sortedData 里是绝对下标 —— 分页时必须换算，
    // 否则会去动别的页的数据（QA 里就抓到过：事件抛了 [0,2]，但当前页顺序没变）。
    const pageOffset = this.pageSize > 0 ? (this.page - 1) * this.pageSize : 0;
    const result = moveItem(this.sortedData, pageOffset + from, { index: pageOffset + target.index, position: target.position });
    if (!result.moved) return false;
    this.sortedData = result.items;
    if (!this.sortKey) this.sourceData = result.items.slice();
    this.data = this.pageSize > 0 ? this.sortedData.slice((this.page - 1) * this.pageSize, this.page * this.pageSize) : this.sortedData;
    this.__render();
    const to = result.to - pageOffset;
    this.trigger('rowreorder', null, { from, to, rows: this.sortedData.slice() });
    if (this.onRowReorder) this.onRowReorder(from, to, this.sortedData.slice());
    return true;
  }

  /** 指针在行区域里的纵向坐标 → 行下标（可滚动模式要把滚动偏移加回来）。 */
  private __rowIndexAt(localY: number): number {
    const y = localY - this.headerHeight + (this.scrollable ? this.virtualScrollTop : 0);
    return Math.min(Math.max(Math.floor(y / this.rowHeight), 0), Math.max(0, this.data.length - 1));
  }

  private __startRowDrag(from: number): void {
    const theme = iceUIManager.getTheme();
    const indicator = new ICEWidget({
      left: 0,
      top: 0,
      width: Number(this.state.width) || 0,
      height: 2,
      fill: true,
      stroke: false,
      display: false,
      interactive: false,
      style: { fillStyle: theme.colors.primary },
    });
    this.__dropHost().addChild(indicator, false);
    this.dragRow = { from, target: null, indicator };
    this.trigger('rowdragstart', null, { from });
  }

  /** 指示线挂在哪：可滚动模式挂内容盒（跟着滚动走），否则挂表格自己。 */
  private __dropHost(): any {
    return this.scrollable && this.bodyContent ? this.bodyContent : this;
  }

  private __updateRowDrag(localY: number): void {
    if (!this.dragRow) return;
    const pointerY = localY - this.headerHeight + (this.scrollable ? this.virtualScrollTop : 0);
    const target = computeDropTarget({ pointerY, itemHeight: this.rowHeight, itemCount: this.data.length });
    this.dragRow.target = target;
    const indicator = this.dragRow.indicator;
    if (!target) {
      indicator.setState({ display: false });
      return;
    }
    const top = target.index * this.rowHeight + (target.position === 'after' ? this.rowHeight : 0);
    indicator.setState({
      display: true,
      top: this.scrollable ? top : this.headerHeight + top,
      left: 0,
      width: this.scrollable ? Number(this.bodyContent.state.width) || 0 : Number(this.state.width) || 0,
    });
  }

  private __endRowDrag(commit: boolean): void {
    const drag = this.dragRow;
    if (!drag) return;
    this.dragRow = null;
    if (drag.indicator) drag.indicator.setState({ display: false });
    if (commit && drag.target) {
      const moved = this.moveRow(drag.from, drag.target);
      this.trigger('rowdragend', null, { from: drag.from, to: drag.target, moved });
    } else {
      this.trigger('rowdragend', null, { from: drag.from, to: null, moved: false });
    }
  }

  /** 表头边界拖拽句柄：透明条，命中区 ±4px。 */
  private __createResizeHandles(parent: any, widths: number[], offset: number): void {
    let left = offset;
    widths.forEach((width, index) => {
      left += width;
      if (index >= widths.length - 1) return;
      const handle = new ICEWidget({
        left: left - 4,
        top: 0,
        width: 8,
        height: this.headerHeight,
        fill: false,
        stroke: false,
        style: { fillStyle: 'rgba(0,0,0,0)' },
      });
      handle.on('mousedown', (evt: any) => this.__startResize(index, evt));
      handle.on('hoverchange', (evt: any) => {
        const hovered = readHovered(evt);
        handle.setState({
          fill: hovered,
          style: { ...handle.state.style, fillStyle: hovered ? 'rgba(13,110,253,0.12)' : 'rgba(0,0,0,0)' },
        });
      });
      parent.addChild(handle, false);
    });
  }

  private __startResize(index: number, evt: any): void {
    const column = this.columns[index];
    if (!column || !this.ice || typeof this.ice.screenToWorld !== 'function') return;
    const [wx] = this.ice.screenToWorld(evt.offsetX, evt.offsetY);
    this.resizeState = { key: column.key, index, startX: wx, startWidth: this.getColumnWidths()[column.key] };
    this.trigger('columnresizestart', null, { key: column.key });
  }

  private __onGlobalMouseMove(evt: any): void {
    if (!this.ice || typeof this.ice.screenToWorld !== 'function') return;
    const [wx, wy] = this.ice.screenToWorld(evt.offsetX, evt.offsetY);
    if (this.resizeState) {
      const next = this.resizeState.startWidth + (wx - this.resizeState.startX);
      this.setColumnWidth(this.resizeState.key, next);
      return;
    }
    if (this.dragRow) {
      const box = this.getMinBoundingBox(true);
      this.__updateRowDrag(wy - box.tl[1]);
    }
  }

  private __onGlobalMouseUp(): void {
    if (this.resizeState) {
      const key = this.resizeState.key;
      this.resizeState = null;
      this.trigger('columnresizeend', null, { key, widths: this.getColumnWidths() });
    }
    if (this.dragRow) {
      this.__endRowDrag(true);
    }
  }

  private __format(value: any): string {
    if (value === null || value === undefined) return '';
    return String(value);
  }

  private __syncSelection(): void {
    const theme = iceUIManager.getTheme();
    this.rowPanels.forEach((panel, index) => {
      const selected =
        this.selectionMode === 'multiple' ? this.selectedIndexes.indexOf(index) !== -1 : index === this.selectedIndex;
      const hovered = index === this.hoveredIndex;
      panel.setState({
        style: {
          fillStyle: selected
            ? theme.colors.primaryBg
            : hovered
              ? theme.colors.disabled
              : index % 2 === 0
                ? theme.colors.surface
                : theme.colors.background,
        },
      });
      const checkbox = this.selectionNodes[index];
      if (checkbox && checkbox.isSelected() !== selected) {
        checkbox.setSelected(selected);
      }
    });
    this.revalidate();
  }

  /** 广播选择变化（多选批量操作用）。 */
  private __emitSelection(): void {
    const rows = this.getSelectedRows();
    const indexes = this.getSelectedIndexes();
    this.trigger('selectionchange', null, { rows, indexes });
    if (this.onSelectionChange) {
      this.onSelectionChange(rows, indexes);
    }
  }
}
