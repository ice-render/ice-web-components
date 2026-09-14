import { ICEWidget } from '../core/ICEWidget';
import { ICECheckBox } from './ICECheckBox';
import { ICEEmpty } from './ICEEmpty';
import { ICEPagination } from './ICEPagination';
import { ICEPanel } from './ICEPanel';
import { iceUIManager } from '../core/ICEManager';
import { getICEOverlayManager } from '../core/ICEOverlayManager';
import { createTextNode, readHovered } from '../util/ICEStyle';
import { ICERect } from 'ice-render';
import { ICEScrollPane } from './ICEScrollPane';
import { ICETextField } from './ICETextField';
import { ICELabel } from './ICELabel';
import { t } from '../i18n/ICEI18n';
import { computeVirtualRange } from './ICEVirtualList';
import { ICEDropTarget, computeDropTarget, moveItem, moveTreeNode } from '../util/ICEDragReorder';

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
  /**
   * 列筛选候选：声明后表头出现漏斗标记（未激活 ▾ / 已激活 ●），点开是一列候选。
   * 同一列多个取值是**或**，跨列是**与**（和用户对「筛选」的直觉一致）。
   */
  filters?: ICETableFilterOption[];
  /** 该列可编辑（点格子进去改；提交时回调表格的 `onCellEdit`） */
  editable?: boolean;
  /** 编辑提交前的校验：返回字符串 = 不通过（就是错误文案），返回空 = 通过 */
  validate?: (value: string, row: ICETableRow) => string | null | undefined;
  /**
   * 自定义编辑器：返回一个组件替代默认文本输入框（下拉、日历、数字框…）。
   * 返回 null 表示「这一格用默认输入框」。
   */
  editor?: (value: string, row: ICETableRow, meta: { cellWidth: number; cellHeight: number }) => any;
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

export interface ICETableFilterOption {
  text: string;
  value: string;
}

  /** 列 key → 当前选中的取值（空数组 = 该列不筛）。 */
export type ICETableFilterState = Record<string, string[]>;

/** 列版式（可存 localStorage / 后端，下次进来还原）：每列宽度 + 列顺序。 */
export interface ICETableColumnState {
  widths: Record<string, number>;
  order: string[];
}

/** 汇总行：拿**筛选后的全量行**算出「每个列 key 显示什么」。 */
export type ICETableSummary = (rows: ICETableRow[], columns: ICETableColumn[]) => ICETableRow;

  /** 行展开：`render` 返回一个画在该行下面的组件（不是弹层）。 */
export interface ICETableExpandable {
  render: (
    row: ICETableRow,
    ctx: { width: number; columns: ICETableColumn[]; widths: Record<string, number>; rowIndex: number },
  ) => any;
  /** 该行能不能展开（默认都能）；返回 false 的行不画三角 */
  rowExpandable?: (row: ICETableRow) => boolean;
  /** 展开区高度，默认 2 行高 */
  expandedRowHeight?: number;
  /** 初始就展开的行 key */
  defaultExpandedKeys?: string[];
  onExpand?: (expanded: boolean, row: ICETableRow) => void;
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
  /** 按筛选条件过滤后的数据（排序与分页都从这份开始） */
  private filteredData: ICETableRow[];
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
    /** 首列给展开三角留出的缩进（右/居中列不用） */
    indent?: number;
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
  /** 列筛选：列 key → 选中的取值 */
  private filters: ICETableFilterState = {};
  private filterNodes = new Map<string, any>();
  private filterPanel: { key: string; panel: any; handle: any; options: Map<string, any> } | null = null;
  private onFilterChange: ((key: string, values: string[]) => void) | null = null;
  /** 汇总行：算出来的一行文案 + 渲染出来的节点 */
  private summaryFn: ICETableSummary | null = null;
  /** 汇总口径：`all` = 当前可见行（默认）；`leaves` = 只要叶子行（树形数据算总额不重复） */
  private summaryRowsMode: 'all' | 'leaves' = 'all';
  /** 汇总口径：`all` = 全量（默认）；`page` = 只算当前页 */
  private summaryScope: 'all' | 'page' = 'all';
  /** 表头「已选 N 行」提示 */
  private selectionSummary = false;
  private selectionHintNode: any = null;
  /** 树形筛选口径：`flat` = 逐条筛（默认）；`ancestors` = 保留命中行的祖先链 */
  private treeFilterMode: 'flat' | 'ancestors' = 'flat';
  /** 表头全选范围：`visible` = 眼前这些行（默认）；`all` = 整棵树（含折叠的后代） */
  private selectAllScope: 'visible' | 'all' = 'visible';
  /** 列头可拖拽换序（需要重排时**在 mouseup** 判定：没挪动就仍然算点表头排序） */
  private columnDraggable = false;
  private columnDrag: { from: number; to: number } | null = null;
  private onColumnReorder: ((order: string[], from: number, to: number) => void) | null = null;
  /** 列头拖拽的落点指示线（拖动期间才画） */
  private columnDropIndicator: any = null;
  /** 编辑校验失败时的可见提示节点 */
  private editErrorNode: any = null;
  /** 编辑态按回车的行为：`commit` = 提交退出（默认，老行为）；`next` = 提交并往下走同一列 */
  private editEnterBehavior: 'commit' | 'next' = 'commit';
  /** 空值策略：`clear` = 清空即写空（默认）；`keep` = 空值不算编辑（保留原值） */
  private emptyEditBehavior: 'clear' | 'keep' = 'clear';
  private summaryNode: any = null;
  private summaryTexts: Record<string, string> = {};
  /** 单元格编辑态：改哪一行哪一列 + 盖在格子上的输入框 */
  private editing: { rowIndex: number; key: string; node: any; original: string } | null = null;
  private editError: string | null = null;
  private onCellEdit: ((row: ICETableRow, key: string, value: string, previous: string) => void) | null = null;
  /** 树形数据：哪个字段装子行（默认 `children`）；有它的行是父行 */
  private treeChildrenKey = 'children';
  private treeExpanded = new Set<string>();
  private rowDepths = new Map<string, number>();
  private rowParents = new Map<string, string | null>();
  private treeToggleNodes = new Map<string, any>();
  /** 树形选择：记 key（与「当前展开到第几层」「当前在第几页」都无关） */
  private treeSelection = new Set<string>();
  /** 内部同步复选框时置上：`setSelected` 会再抛 change，不挡住就会递归成「勾上又取消」 */
  private syncingSelection = false;
  /** 全树索引：key → 直接子行 key（**与展开状态无关**，选择级联靠它） */
  private treeChildKeys = new Map<string, string[]>();
  /** 这张表是不是真的有层级（有任意一行带子行）—— 普通表格不能走树形那套选择语义 */
  private hasTreeData = false;
  private manager: any = null;
  /** 行展开：渲染区 + 状态（按 rowKey 记，默认行下标） */
  private expandable: ICETableExpandable | null = null;
  private expandableHeight = 0;
  private rowKeyProp: string | ((row: ICETableRow, index: number) => string) | null = null;
  private expandedKeys = new Set<string>();
  private expandToggleNodes = new Map<string, any>();
  private expandedRowNodes = new Map<string, any>();
  private __bound = false;

  constructor(props: any = {}) {
    const theme = iceUIManager.getTheme();
    const width = props.width || 720;
    const rowHeight = props.rowHeight || 40;
    const headerHeight = props.headerHeight || 36;
    const fixedColumns = (props.columns || []).some((column: ICETableColumn) => column.fixed === true);
    // 可滚动模式（虚拟行 / 固定列）高度必须由调用方给：按行数算高度会和「只渲染可视区」自相矛盾
    const scrollable = props.virtual === true || fixedColumns;
    // 高度从构造期就要算对：行数按初始筛选条件算，汇总行也算一行
    const initialFilterKeys =
      props.filters && typeof props.filters === 'object'
        ? Object.keys(props.filters).filter((key) => Array.isArray(props.filters[key]) && props.filters[key].length)
        : [];
    const initialRows = props.data ? props.data.length : 0;
    const initialVisibleRows = initialFilterKeys.length
      ? (props.data || []).filter((row: ICETableRow) =>
          initialFilterKeys.every((key) => props.filters[key].map((value: any) => String(value)).indexOf(String(row[key])) !== -1),
        ).length
      : initialRows;
    const summaryHeight = typeof props.summary === 'function' && initialVisibleRows > 0 ? rowHeight : 0;
    const expandHeight =
      props.expandable && typeof props.expandable.render === 'function'
        ? Math.max(20, Math.floor(Number(props.expandable.expandedRowHeight) || rowHeight * 2)) *
          (props.expandable.defaultExpandedKeys || []).length
        : 0;
    const height = scrollable
      ? props.height || 400
      : headerHeight + rowHeight * initialVisibleRows + summaryHeight + expandHeight;

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
    this.setLocale(props.locale); // 实例级语言（组件层文案可配、不持全局状态）

    this.columns = props.columns || [];
    this.sourceData = props.data || [];
    this.filteredData = (props.data || []).slice();
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
    this.onFilterChange = typeof props.onFilterChange === 'function' ? props.onFilterChange : null;
    this.onCellEdit = typeof props.onCellEdit === 'function' ? props.onCellEdit : null;
    this.treeChildrenKey = typeof props.treeChildrenKey === 'string' ? props.treeChildrenKey : 'children';
    (props.defaultExpandedKeys || []).forEach((key: string) => this.treeExpanded.add(String(key)));
    this.summaryFn = typeof props.summary === 'function' ? props.summary : null;
    this.summaryRowsMode = props.summaryRowsMode === 'leaves' ? 'leaves' : 'all';
    this.summaryScope = props.summaryScope === 'page' ? 'page' : 'all';
    this.selectionSummary = props.selectionSummary === true;
    this.treeFilterMode = props.treeFilterMode === 'ancestors' ? 'ancestors' : 'flat';
    this.selectAllScope = props.selectAllScope === 'all' ? 'all' : 'visible';
    this.columnDraggable = props.columnDraggable === true;
    this.editEnterBehavior = props.editEnterBehavior === 'next' ? 'next' : 'commit';
    this.emptyEditBehavior = props.emptyEditBehavior === 'keep' ? 'keep' : 'clear';
    this.onColumnReorder = typeof props.onColumnReorder === 'function' ? props.onColumnReorder : null;
    this.rowKeyProp = typeof props.rowKey === 'function' || typeof props.rowKey === 'string' ? props.rowKey : null;
    if (props.expandable && typeof props.expandable.render === 'function') {
      this.expandable = props.expandable;
      this.expandableHeight = Math.max(20, Math.floor(Number(props.expandable.expandedRowHeight) || rowHeight * 2));
      (props.expandable.defaultExpandedKeys || []).forEach((key: string) => this.expandedKeys.add(String(key)));
    }
    if (props.filters && typeof props.filters === 'object') {
      Object.keys(props.filters).forEach((key) => {
        const values = Array.isArray(props.filters[key]) ? props.filters[key].map((value: any) => String(value)) : [];
        if (values.length) this.filters[key] = values;
      });
    }
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
    this.filteredData = this.__computeFiltered();
    this.sortedData = this.__applySortTo(this.filteredData);
    this.data = this.sortedData;
    this.__render();
  }

  public setData(data: ICETableRow[]): this {
    this.sourceData = data || [];
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

  // ---------------------------------------------------------------- 列筛选 API

  /** 当前筛选条件（只包含真的在筛的列）。 */
  public getFilterState(): ICETableFilterState {
    const state: ICETableFilterState = {};
    Object.keys(this.filters).forEach((key) => {
      const values = this.filters[key];
      if (values && values.length) state[key] = values.slice();
    });
    return state;
  }

  /**
   * 设置某列的筛选取值（空数组 = 该列不筛）。
   *
   * 会重算「筛选后的行」、回到第 1 页并重绘；`onFilterChange` 与 `filterchange` 事件同步发出。
   */
  public setFilter(key: string, values: string[], options: { silent?: boolean } = {}): this {
    const column = this.columns.find((item) => item.key === key);
    if (!column) {
      return this;
    }
    const next = Array.from(new Set((values || []).map((value) => String(value))));
    const current = this.filters[key] || [];
    if (next.length === current.length && next.every((value, index) => value === current[index])) {
      return this;
    }
    if (next.length) {
      this.filters[key] = next;
    } else {
      delete this.filters[key];
    }
    this.page = 1;
    this.selectedIndex = -1;
    this.__applyPage();
    if (!options.silent) {
      this.trigger('filterchange', null, { key, values: next, filters: this.getFilterState() });
      if (this.onFilterChange) {
        this.onFilterChange(key, next);
      }
    }
    return this;
  }

  /** 清空全部列筛选。 */
  public clearFilters(): this {
    if (!Object.keys(this.filters).length) {
      return this;
    }
    this.filters = {};
    this.page = 1;
    this.selectedIndex = -1;
    this.__applyPage();
    this.trigger('filterchange', null, { key: null, values: [], filters: {} });
    return this;
  }

  /** 筛选后的行（原始顺序，不含排序），用于断言与导出。 */
  public getFilteredRows(): ICETableRow[] {
    return this.filteredData.slice();
  }

  /** 表头漏斗节点（该列没声明 filters 时为 null）。 */
  public getFilterNode(key: string): any {
    return this.filterNodes.get(key) || null;
  }

  public isFilterOpen(): boolean {
    return !!this.filterPanel && this.filterPanel.handle.isOpen();
  }

  public toggleFilter(key: string): this {
    if (this.isFilterOpen() && this.filterPanel && this.filterPanel.key === key) {
      return this.closeFilter();
    }
    return this.openFilter(key);
  }

  public openFilter(key: string): this {
    const column = this.columns.find((item) => item.key === key);
    if (!column || !column.filters || !column.filters.length) {
      return this;
    }
    this.closeFilter();
    if (!this.manager) {
      if (!this.ice) {
        throw new Error('ICETable 的列筛选面板需要先加入 ICE 场景');
      }
      this.manager = getICEOverlayManager(this.ice);
    }
    const theme = iceUIManager.getTheme();
    const optionHeight = 26;
    const width = Math.max(
      140,
      column.filters.reduce((max, option) => Math.max(max, option.text.length * 13 + 56), 0),
    );
    const height = column.filters.length * optionHeight + 16;
    const panel = new ICEPanel({
      width,
      height,
      radius: theme.radius.md,
      style: { fillStyle: theme.colors.surface, strokeStyle: theme.colors.border, shadow: 'md' },
    });
    const options = new Map<string, any>();
    const active = this.filters[key] || [];
    column.filters.forEach((option, index) => {
      const row = new ICEWidget({
        left: 8,
        top: 8 + index * optionHeight,
        width: width - 16,
        height: optionHeight,
        radius: theme.radius.sm,
        fill: true,
        stroke: false,
        interactive: true,
        style: { fillStyle: 'rgba(0,0,0,0)' },
      });
      const box = new ICECheckBox({
        left: 4,
        top: (optionHeight - 18) / 2,
        width: 18,
        height: 18,
        selected: active.indexOf(option.value) !== -1,
      });
      row.addChild(box, false);
      row.addChild(
        createTextNode({
          left: 34,
          top: 0,
          width: width - 50,
          height: optionHeight,
          text: option.text,
          fillStyle: theme.colors.text,
          fontFamily: theme.font.family,
          fontSize: theme.font.size,
          align: 'left',
          verticalAlign: 'middle',
        }),
        false,
      );
      const toggle = () => {
        const current = this.filters[key] || [];
        const next = current.indexOf(option.value) === -1
          ? current.concat(option.value)
          : current.filter((value) => value !== option.value);
        box.setSelected(next.indexOf(option.value) !== -1);
        this.setFilter(key, next);
      };
      row.on('click', toggle, this);
      row.on(
        'hoverchange',
        (evt: any) => {
          row.setState({
            style: { ...row.state.style, fillStyle: readHovered(evt) ? theme.colors.background : 'rgba(0,0,0,0)' },
          });
        },
        this,
      );
      panel.addChild(row, false);
      options.set(option.value, row);
    });
    const anchor = this.filterNodes.get(key) || this;
    const handle = this.manager.open({
      anchor,
      content: panel,
      placement: 'bottomLeft',
      offset: 4,
      enterAnimation: 'scale',
      exitAnimation: 'fade',
      keyboardCaptured: true,
      closeOnOutsideClick: false,
      onClose: () => {
        if (this.filterPanel && this.filterPanel.panel === panel) {
          this.filterPanel = null;
        }
      },
    });
    this.filterPanel = { key, panel, handle, options };
    return this;
  }

  public closeFilter(): this {
    if (this.filterPanel) {
      this.filterPanel.handle.close();
      this.filterPanel = null;
    }
    return this;
  }

  /** 候选节点（测试与 e2e 用）。 */
  public getFilterOptionNode(key: string, value: string): any {
    if (!this.filterPanel || this.filterPanel.key !== key) {
      return null;
    }
    return this.filterPanel.options.get(value) || null;
  }

  public getFilterPanel(): any {
    return this.filterPanel ? this.filterPanel.panel : null;
  }

  /** 面板与锚点列的位置关系（几何审计 / 测试用）。 */
  public getFilterPanelLayout(): { anchorLeft: number; anchorTop: number; panel: { width: number; height: number } } | null {
    if (!this.filterPanel) {
      return null;
    }
    let anchorLeft = 0;
    let anchorTop = 0;
    let current = this.filterNodes.get(this.filterPanel.key);
    while (current && current.state) {
      anchorLeft += Number(current.state.left) || 0;
      anchorTop += Number(current.state.top) || 0;
      current = current.parentNode;
    }
    return {
      anchorLeft,
      anchorTop,
      panel: {
        width: Number(this.filterPanel.panel.state.width) || 0,
        height: Number(this.filterPanel.panel.state.height) || 0,
      },
    };
  }

  // ---------------------------------------------------------------- 汇总行 API

  // ---------------------------------------------------------------- 单元格编辑 API

  public isEditing(): boolean {
    return !!this.editing;
  }

  public getEditingCell(): { rowIndex: number; key: string } | null {
    return this.editing ? { rowIndex: this.editing.rowIndex, key: this.editing.key } : null;
  }

  /** 盖在该格子上的输入框（测试 / e2e 用）。 */
  public getEditNode(): any {
    return this.editing ? this.editing.node : null;
  }

  /** 上一次提交校验失败的原因（通过 / 未编辑时为 null）。 */
  public getEditError(): string | null {
    return this.editError;
  }

  /**
   * 进入编辑态：在这一格上盖一个输入框（表格本身仍是那套渲染，不整体切换）。
   *
   * 只有声明了 `editable: true` 的列、且行列都在范围内才进得去。
   */
  public startEdit(rowIndex: number, key: string): this {
    const column = this.columns.find((item) => item.key === key);
    if (!column || column.editable !== true || rowIndex < 0 || rowIndex >= this.data.length) {
      return this;
    }
    this.cancelEdit();
    this.editError = null;
    const widths = this.__columnWidths((Number(this.state.width) || 720) - (this.selectionMode === 'multiple' ? ICETable.SELECTION_WIDTH : 0));
    let left = this.selectionMode === 'multiple' ? ICETable.SELECTION_WIDTH : 0;
    for (let index = 0; index < this.columns.length; index += 1) {
      if (this.columns[index].key === key) {
        break;
      }
      left += widths[index] || 0;
    }
    const columnWidth = widths[this.columns.findIndex((item) => item.key === key)] || 120;
    const original = this.__format(this.data[rowIndex][key]);
    // 列上给了 editor 就用它（下拉 / 日历 / 数字框…）；返回 null 退回默认文本输入框
    const custom = typeof column.editor === 'function'
      ? column.editor(original, this.data[rowIndex], { cellWidth: columnWidth, cellHeight: this.rowHeight })
      : null;
    const node =
      custom ||
      new ICETextField({
        left,
        // 可滚动模式里行挂在 bodyContent 上（top 是内容坐标，不含表头也不含滚动量）；
        // 普通模式行挂在表格自身（top 要加上表头高度）
        top: (this.scrollable ? 0 : this.headerHeight) + rowIndex * this.rowHeight + 4,
        width: Math.max(60, columnWidth - 8),
        height: this.rowHeight - 8,
        value: original,
      });
    if (custom) {
      // 位置与尺寸仍由表格按格子算（编辑器自己只关心内容）
      custom.setState({
        left,
        top: (this.scrollable ? 0 : this.headerHeight) + rowIndex * this.rowHeight + 4,
        width: Math.max(60, columnWidth - 8),
        height: this.rowHeight - 8,
      });
    }
    node.on('keydown', (evt: any) => {
      const raw = evt && (evt.originalEvent || evt);
      const pressed = raw && (raw.key || raw.code);
      if (pressed === 'Enter') {
        if (this.editEnterBehavior === 'next') {
          // 像表格软件那样：提交并往下走同一列（最后一行就提交退出）
          const rowIndex = this.editing ? this.editing.rowIndex : -1;
          const key = this.editing ? this.editing.key : null;
          if (key && this.commitEdit() && rowIndex + 1 < this.data.length) {
            this.startEdit(rowIndex + 1, key);
            this.__ensureCellVisible(rowIndex + 1, key);
          }
        } else {
          this.commitEdit();
        }
      } else if (pressed === 'Escape' || pressed === 'Esc') {
        this.cancelEdit();
      } else if (pressed === 'Tab') {
        // 键盘用户填表的节奏：改完一格 Tab 去下一格（跳过不可编辑的列，行末落到下一行）
        // 挡掉浏览器的默认 Tab（合成事件没有原生事件可挡，所以只在真有 preventDefault 时调）
        if (raw && typeof raw.preventDefault === 'function') {
          raw.preventDefault();
          evt.preventDefault && evt.preventDefault();
        }
        this.__moveEditByTab(raw && raw.shiftKey === true ? -1 : 1);
      }
    });
    // 可滚动模式：编辑框要和行一起滚，所以挂进 bodyContent
    if (this.scrollable && this.bodyContent) {
      this.bodyContent.addChild(node, false);
    } else {
      this.addChild(node, false);
    }
    this.editing = { rowIndex, key, node, original };
    if (this.ice && this.ice.dirty !== undefined) {
      this.ice.dirty = true;
    }
    return this;
  }

  /** 提交：写回行数据 + 回调（值没变就只是退出编辑态）。 */
  public commitEdit(): boolean {
    const state = this.editing;
    if (!state) {
      return false;
    }
    // 自定义编辑器优先读 getFormValue（下拉的值就在那儿），没有就退回 getValue
    const raw = typeof state.node.getFormValue === 'function' ? state.node.getFormValue() : state.node.getValue();
    const value = String(raw ?? '');
    // 'keep' 策略：清空（含全空白）不算编辑 —— 既不写回也不回调，直接退出编辑态
    if (this.emptyEditBehavior === 'keep' && !value.trim()) {
      this.editing = null;
      this.editError = null;
      this.__clearEditError();
      this.__detachEditNode(state.node);
      this.__render();
      return true;
    }
    // 提交前校验：不通过就留在编辑态、标红、给文案，**不写回也不回调**
    const column = this.columns.find((item) => item.key === state.key);
    if (column && typeof column.validate === 'function') {
      const message = column.validate(value, this.data[state.rowIndex]);
      if (message) {
        this.editError = String(message);
        if (typeof state.node.setValidateStatus === 'function') {
          state.node.setValidateStatus('error');
        }
        this.__showEditError(String(message), state.rowIndex, state.key);
        return false;
      }
    }
    this.editError = null;
    this.__clearEditError();
    this.editing = null;
    this.__detachEditNode(state.node);
    const row = this.data[state.rowIndex];
    if (!row || value === state.original) {
      this.__render();
      return true;
    }
    row[state.key] = value;
    this.__render();
    if (this.onCellEdit) {
      this.onCellEdit(row, state.key, value, state.original);
    }
    return true;
  }

  public cancelEdit(): boolean {
    const state = this.editing;
    if (!state) {
      return false;
    }
    this.editing = null;
    this.editError = null;
    this.__clearEditError();
    this.__detachEditNode(state.node);
    if (this.ice && this.ice.dirty !== undefined) {
      this.ice.dirty = true;
    }
    return true;
  }

  /** 摘掉编辑框：可滚动模式下它挂在 bodyContent 上，得按实际父亲摘。 */
  /** 把校验错误画在那一格下面（标红只说「有问题」，这里说「有什么问题」）。 */
  private __showEditError(message: string, rowIndex: number, key: string): void {
    this.__clearEditError();
    const theme = iceUIManager.getTheme();
    const offset = this.selectionMode === 'multiple' ? ICETable.SELECTION_WIDTH : 0;
    const widths = this.__columnWidths((Number(this.state.width) || 720) - offset);
    let left = offset;
    let columnWidth = 120;
    for (let i = 0; i < this.columns.length; i += 1) {
      if (this.columns[i].key === key) {
        columnWidth = widths[i];
        break;
      }
      left += widths[i];
    }
    const node = new ICELabel({
      interactive: false,
      left,
      top: this.headerHeight + rowIndex * this.rowHeight + this.rowHeight - 4,
      width: Math.max(80, columnWidth),
      height: 18,
      verticalAlign: 'middle',
      text: message,
      style: { fontSize: 11, fillStyle: theme.colors.error },
    });
    this.addChild(node, false);
    this.editErrorNode = node;
    if (this.ice) {
      this.ice.dirty = true;
    }
  }

  private __clearEditError(): void {
    if (!this.editErrorNode) {
      return;
    }
    if (this.editErrorNode.parentNode && this.editErrorNode.parentNode !== this) {
      this.editErrorNode.parentNode.removeChild(this.editErrorNode);
    } else {
      this.removeChild(this.editErrorNode);
    }
    this.editErrorNode = null;
  }

  public getEditErrorNode(): any {
    return this.editErrorNode;
  }

  private __detachEditNode(node: any): void {
    if (!node) {
      return;
    }
    if (node.parentNode && node.parentNode !== this) {
      node.parentNode.removeChild(node);
    } else {
      this.removeChild(node);
    }
  }

  /**
   * Tab / Shift+Tab 在可编辑格之间流转：先提交当前格，再进下一格；到头就退出编辑态。
   *
   * 只认 `editable: true` 的列（不可编辑的列直接跳过）；行末落到下一行的第一列。
   */
  private __moveEditByTab(step: number): void {
    const state = this.editing;
    if (!state) {
      return;
    }
    const editableIndexes = this.columns
      .map((column, index) => (column.editable === true ? index : -1))
      .filter((index) => index >= 0);
    const currentColumn = this.columns.findIndex((column) => column.key === state.key);
    const position = editableIndexes.indexOf(currentColumn);
    const rowIndex = state.rowIndex;
    const value = String(state.node.getValue() ?? '');
    // 先提交（校验不通过就停在原地，不要把用户送走）
    if (!this.commitEdit()) {
      return;
    }
    let nextPosition = position + step;
    let nextRow = rowIndex;
    if (nextPosition < 0 || nextPosition >= editableIndexes.length) {
      nextRow += step > 0 ? 1 : -1;
      if (nextRow < 0 || nextRow >= this.data.length) {
        return; // 到头：停在「已提交、不在编辑态」
      }
      nextPosition = step > 0 ? 0 : editableIndexes.length - 1;
    }
    const nextKey = this.columns[editableIndexes[nextPosition]].key;
    this.startEdit(nextRow, nextKey);
    // 目标格可能还在视口外：纵向滚行、横向滚列，否则用户看不见自己在改什么
    this.__ensureCellVisible(nextRow, nextKey);
    void value;
  }

  /** 把某一格滚进可视区（纵向用 scrollToRow；横向按列在内容里的位置调 setScrollLeft）。 */
  private __ensureCellVisible(rowIndex: number, key: string): void {
    this.scrollToRow(rowIndex);
    if (!this.scrollable) {
      return;
    }
    const offset = this.selectionMode === 'multiple' ? ICETable.SELECTION_WIDTH : 0;
    const contentWidth = this.renderedContentWidth || Number(this.state.width) || 720;
    const widths = this.__columnWidths(contentWidth - offset);
    let left = offset;
    let columnWidth = 0;
    for (let i = 0; i < this.columns.length; i += 1) {
      if (this.columns[i].key === key) {
        columnWidth = widths[i];
        break;
      }
      left += widths[i];
    }
    const viewportWidth = Number(this.state.width) || 0;
    const current = this.getScroll().x;
    if (left < current) {
      this.setScrollLeft(left);
    } else if (left + columnWidth > current + viewportWidth) {
      this.setScrollLeft(left + columnWidth - viewportWidth);
    }
  }

  public getSummaryNode(): any {
    return this.summaryNode;
  }

  public getSummaryText(key: string): string {
    return this.summaryTexts[key] === undefined ? '' : this.summaryTexts[key];
  }

  // ---------------------------------------------------------------- 行展开 API

  /** 展开中的行 key（按展开顺序）。 */
  public getExpandedRowKeys(): string[] {
    return Array.from(this.expandedKeys);
  }

  public isRowExpanded(key: string | ICETableRow): boolean {
    return this.expandedKeys.has(this.__normalizeKey(key));
  }

  public expandRow(key: string | ICETableRow, options: { silent?: boolean } = {}): this {
    const row = this.__rowOf(key);
    if (!this.__canExpand(row)) {
      return this;
    }
    const normalized = this.__normalizeKey(key);
    if (this.expandedKeys.has(normalized)) {
      return this;
    }
    this.expandedKeys.add(normalized);
    this.__afterExpandChange(row, true, options);
    return this;
  }

  public collapseRow(key: string | ICETableRow, options: { silent?: boolean } = {}): this {
    const normalized = this.__normalizeKey(key);
    if (!this.expandedKeys.has(normalized)) {
      return this;
    }
    this.expandedKeys.delete(normalized);
    this.__afterExpandChange(this.__rowOf(key), false, options);
    return this;
  }

  public toggleExpand(key: string | ICETableRow): this {
    return this.isRowExpanded(key) ? this.collapseRow(key) : this.expandRow(key);
  }

  /** 行首的展开三角（该行不可展开 / 没渲染时为 null）。 */
  public getExpandToggleNode(key: string | ICETableRow): any {
    return this.expandToggleNodes.get(this.__normalizeKey(key)) || null;
  }

  /** 展开区节点（该行没展开 / 不在当前页时为 null）。 */
  public getExpandedRowNode(key: string | ICETableRow): any {
    return this.expandedRowNodes.get(this.__normalizeKey(key)) || null;
  }

  /** 当前页第 index 行的行面板（测试与 e2e 断言版式用）。 */
  public getRowNode(index: number): any {
    return this.rowPanels[index] || null;
  }

  private __afterExpandChange(row: ICETableRow | null, expanded: boolean, options: { silent?: boolean }): void {
    this.__applyPage();
    if (!options.silent) {
      this.trigger('expand', null, { expanded, row });
      if (this.expandable && typeof this.expandable.onExpand === 'function' && row) {
        this.expandable.onExpand(expanded, row);
      }
    }
  }

  private __normalizeKey(key: string | ICETableRow): string {
    if (typeof key !== 'string') {
      const index = this.data.indexOf(key);
      return this.__keyOf(key, index < 0 ? 0 : index);
    }
    return key;
  }

  private __rowOf(key: string | ICETableRow): ICETableRow | null {
    if (typeof key !== 'string') {
      return key;
    }
    for (let index = 0; index < this.data.length; index += 1) {
      if (this.__keyOf(this.data[index], index) === key) {
        return this.data[index];
      }
    }
    return null;
  }

  private __keyOf(row: ICETableRow, index: number): string {
    if (typeof this.rowKeyProp === 'function') {
      return String(this.rowKeyProp(row, index));
    }
    if (this.rowKeyProp) {
      return String(row[this.rowKeyProp]);
    }
    return String(index);
  }

  /** 这一行现在能不能展开（虚拟化路径不支持展开，见类注释）。 */
  private __canExpand(row: ICETableRow | null): boolean {
    if (!this.expandable || this.scrollable || !row) {
      return false;
    }
    const test = this.expandable.rowExpandable;
    return typeof test === 'function' ? test(row) !== false : true;
  }

  /** 当前页里展开区总共占的高度。 */
  private __expandedHeightOf(rows: ICETableRow[]): number {
    if (!this.expandable || this.scrollable) {
      return 0;
    }
    let count = 0;
    rows.forEach((row, index) => {
      if (this.__canExpand(row) && this.expandedKeys.has(this.__keyOf(row, index))) {
        count += 1;
      }
    });
    return count * this.expandableHeight;
  }

  /** 表头文案（排序中的列带 ▲/▼ 指示）。 */
  public getHeaderLabel(key: string): string {
    const column = this.columns.find((item) => item.key === key);
    if (!column) {
      return '';
    }
    let label = column.title;
    if (this.sortKey === key && this.sortOrder) {
      label += ` ${this.sortOrder === 'asc' ? '▲' : '▼'}`;
    }
    if (column.filters && column.filters.length) {
      label += ` ${(this.filters[key] || []).length ? '●' : '▾'}`;
    }
    return label;
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
      this.sortedData = this.filteredData.slice();
      this.__applyPage();
      return this;
    }
    this.sortKey = key;
    this.sortOrder = order;
    this.sortedData = this.__applySortTo(this.filteredData);
    this.__applyPage();
    return this;
  }

  /** 按当前 sortKey / sortOrder 排一份数据（没在排序就原样返回）。 */
  private __applySortTo(rows: ICETableRow[]): ICETableRow[] {
    const column = this.columns.find((item) => item.key === this.sortKey);
    if (!column || !this.sortOrder || !column.sorter) {
      return rows.slice();
    }
    const direction = this.sortOrder === 'asc' ? 1 : -1;
    return rows.slice().sort((a, b) => direction * this.__compareRows(a, b, column));
  }

  /**
   * 按 `filters` 过滤原始数据。
   *
   * 同一列多个取值是**或**（用户勾了「已支付」和「待处理」想看的是两类），
   * 不同列之间是**与**（这是「缩小范围」的直觉）。
   */
  private __computeFiltered(): ICETableRow[] {
    // 树形数据：先按「展开到哪一层」拍平，再筛 —— 筛掉父行时它的子行也不该冒出来
    this.__indexTree();
    const flat = this.__flattenTree(this.sourceData, 0, null, [], this.treeFilterMode === 'ancestors' && this.__hasActiveFilters());
    const keys = Object.keys(this.filters).filter((key) => (this.filters[key] || []).length > 0);
    if (!keys.length) {
      return flat;
    }
    const matches = (row: ICETableRow) => keys.every((key) => this.filters[key].indexOf(String(row[key])) !== -1);
    if (this.treeFilterMode !== 'ancestors' || !this.hasTreeData) {
      return flat.filter(matches);
    }
    // ancestors 口径：命中行留下，**祖先链也留下**（否则用户不知道这行在哪一支下面）
    return flat.filter((row) => matches(row) || this.__hasMatchingDescendant(row, matches));
  }

  private __hasActiveFilters(): boolean {
    return Object.keys(this.filters).some((key) => (this.filters[key] || []).length > 0);
  }

  /** 这一行的后代里有没有命中的（ancestors 口径用它决定父行要不要露出来）。 */
  private __hasMatchingDescendant(row: ICETableRow, matches: (row: ICETableRow) => boolean): boolean {
    const children = row[this.treeChildrenKey];
    if (!Array.isArray(children) || !children.length) {
      return false;
    }
    return (children as ICETableRow[]).some((child) => matches(child) || this.__hasMatchingDescendant(child, matches));
  }

  /**
   * 把树拍平成「当前可见的行」（深度优先，父在前子在后），同时记下每行的深度与父行。
   *
   * 没有子行的普通表格走这一趟也不亏：返回值就是原数组的浅拷贝。
   */
  private __flattenTree(
    rows: ICETableRow[],
    depth = 0,
    parentKey: string | null = null,
    out: ICETableRow[] = [],
    forceExpand = false,
  ): ICETableRow[] {
    rows.forEach((row, index) => {
      const key = this.__keyOf(row, index);
      this.rowDepths.set(key, depth);
      this.rowParents.set(key, parentKey);
      out.push(row);
      const children = row[this.treeChildrenKey];
      // forceExpand：筛选的 ancestors 口径下，命中行藏在折叠的父行里时也要把路径摊出来
      if (Array.isArray(children) && children.length && (this.treeExpanded.has(key) || forceExpand)) {
        this.__flattenTree(children as ICETableRow[], depth + 1, key, out, forceExpand);
      }
    });
    return out;
  }

  /**
   * 索引**整棵树**（不只看展开的那部分）：key → 父 key、key → 直接子行 key。
   *
   * 选择级联必须在「没展开的子树」上也成立 —— 只靠拍平那条路会漏掉折叠起来的后代。
   */
  private __indexTree(rows: ICETableRow[] = this.sourceData, parentKey: string | null = null): void {
    this.treeChildKeys.clear();
    let anyParent = false;
    const visit = (list: ICETableRow[], parent: string | null) => {
      list.forEach((row, index) => {
        const key = this.__keyOf(row, index);
        this.rowParents.set(key, parent);
        const children = row[this.treeChildrenKey];
        if (Array.isArray(children) && children.length) {
          anyParent = true;
          const childKeys = (children as ICETableRow[]).map((child, childIndex) => this.__keyOf(child, childIndex));
          this.treeChildKeys.set(key, childKeys);
          visit(children as ICETableRow[], key);
        } else {
          this.treeChildKeys.set(key, []);
        }
      });
    };
    visit(rows, parentKey);
    this.hasTreeData = anyParent;
  }

  // ---- 树形数据 API ----

  public getTreeExpandedKeys(): string[] {
    return Array.from(this.treeExpanded);
  }

  public isTreeRowExpanded(key: string): boolean {
    return this.treeExpanded.has(key);
  }

  public isTreeParent(key: string): boolean {
    const row = this.__findRowByKey(key);
    return !!(row && Array.isArray(row[this.treeChildrenKey]) && (row[this.treeChildrenKey] as any[]).length);
  }

  public toggleRowExpanded(key: string): this {
    if (!this.isTreeParent(key)) {
      return this;
    }
    if (this.treeExpanded.has(key)) {
      this.treeExpanded.delete(key);
    } else {
      this.treeExpanded.add(key);
    }
    this.__applyPage();
    return this;
  }

  public setTreeExpandedKeys(keys: string[]): this {
    this.treeExpanded = new Set((keys || []).map(String));
    this.__applyPage();
    return this;
  }

  public getRowDepth(key: string): number {
    return this.rowDepths.has(key) ? (this.rowDepths.get(key) as number) : 0;
  }

  /** 首列的缩进像素（树形层级 × 16）。 */
  public getRowIndent(key: string): number {
    return this.getRowDepth(key) * 16;
  }

  /** 父行首列的 ▸/▾ 三角（叶子行是 null）。 */
  public getRowTreeToggle(key: string): any {
    return this.treeToggleNodes.get(key) || null;
  }

  // ---- 树形选择（勾父行带子行） ----

  /** 已选行的 key（树形数据下含被级联选中的后代）。 */
  public getSelectedRowKeys(): string[] {
    const keys: string[] = [];
    this.data.forEach((row, index) => {
      if (this.selectedIndexes.indexOf(index) !== -1) {
        keys.push(this.__keyOf(row, index));
      }
    });
    this.treeSelection.forEach((key) => {
      if (keys.indexOf(key) === -1) {
        keys.push(key);
      }
    });
    return keys;
  }

  public isTreeRowSelected(key: string): boolean {
    return this.treeSelection.has(key);
  }

  /**
   * 设置某一行的选中态（树形级联）。
   *
   * 勾父行 → 整棵子树都选上（含折叠起来的后代）；勾子行 → 兄弟全选时父行自动选上、
   * 少一个就把父行取消。选择记在 key 上，所以和「当前展开到第几层」无关。
   */
  public setTreeRowSelected(key: string, selected: boolean): this {
    const apply = (rowKey: string, next: boolean) => {
      if (next) {
        this.treeSelection.add(rowKey);
      } else {
        this.treeSelection.delete(rowKey);
      }
    };
    const walk = (rowKey: string, next: boolean) => {
      apply(rowKey, next);
      const children = this.__childrenOf(rowKey);
      children.forEach((childKey) => walk(childKey, next));
    };
    walk(key, selected);
    // 自下而上回填：子行全选 → 父行选上；否则父行取消
    const refreshAncestors = (rowKey: string) => {
      let parentKey = this.rowParents.get(rowKey) || null;
      while (parentKey) {
        const siblings = this.__childrenOf(parentKey);
        const allSelected = siblings.length > 0 && siblings.every((childKey) => this.treeSelection.has(childKey));
        apply(parentKey, allSelected);
        parentKey = this.rowParents.get(parentKey) || null;
      }
    };
    refreshAncestors(key);
    this.__syncSelection();
    if (this.selectionSummary) {
      this.__applyPage();
    }
    return this;
  }

  /** 某一行的直接子行 key（没有就是空数组）。 */
  private __childrenOf(key: string): string[] {
    return (this.treeChildKeys.get(key) || []).slice();
  }

  // ---- 树形行拖拽 ----

  /**
   * 树形数据的行拖拽：把 `dragKey` 那一行**连同它的后代**挪到目标位置。
   *
   * - 放进自己的后代会被拒绝（否则整棵子树凭空消失）；
   * - 子行的相对顺序不变；展开状态按 key 记，所以挪完还展开着。
   */
  public moveTreeRow(dragKey: string, targetKey: string, position: 'before' | 'inside' | 'after'): boolean {
    if (!this.hasTreeData) {
      return false;
    }
    // 表格用 rowKey 指定字段（默认 'key' 之外的名字），而 util 默认按 'key' 找 —— 字段名要透传
    const keyField = typeof this.rowKeyProp === 'string' && this.rowKeyProp ? this.rowKeyProp : 'key';
    const result = moveTreeNode(this.sourceData as any, dragKey, targetKey, position, this.treeChildrenKey, keyField);
    if (!result.moved) {
      return false;
    }
    this.sourceData = result.nodes as ICETableRow[];
    if (position === 'inside' && !this.treeExpanded.has(targetKey)) {
      this.treeExpanded.add(targetKey); // 放进去就展开，能立刻看见
    }
    this.__applyPage();
    this.trigger('rowreorder', null, { key: dragKey, targetKey, position, rows: this.sourceData });
    return true;
  }

  // ---- 表头「已选 N 行」提示 ----

  public getSelectionHintText(): string {
    const count = this.getSelectedRowKeys().length;
    return this.selectionSummary && count > 0 ? `已选 ${count} 行` : '';
  }

  public getSelectionHintNode(): any {
    return this.selectionHintNode;
  }

  /** 把当前页的复选框刷成「树形选择的真实状态」（级联选中的子行也要是勾上的）。 */
  private __syncTreeCheckboxes(): void {
    this.syncingSelection = true;
    try {
      this.data.forEach((row, index) => {
        const box = this.selectionNodes[index];
        if (box) {
          box.setSelected(this.treeSelection.has(this.__keyOf(row, index)));
        }
      });
      if (this.headerCheckbox) {
        const keys = this.data.map((row, index) => this.__keyOf(row, index));
        this.headerCheckbox.setSelected(keys.length > 0 && keys.every((key) => this.treeSelection.has(key)));
      }
    } finally {
      this.syncingSelection = false;
    }
    if (this.ice && this.ice.dirty !== undefined) {
      this.ice.dirty = true;
    }
  }

  private __findRowByKey(key: string): ICETableRow | null {
    const visit = (rows: ICETableRow[]): ICETableRow | null => {
      for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index];
        if (rows === this.sourceData ? this.__keyOf(row, index) : this.__keyOf(row, index)) {
          if (this.__keyOf(row, index) === key) {
            return row;
          }
        }
        const children = row[this.treeChildrenKey];
        if (Array.isArray(children)) {
          const found = visit(children as ICETableRow[]);
          if (found) {
            return found;
          }
        }
      }
      return null;
    };
    return visit(this.sourceData);
  }

  /** 有没有汇总行要画（筛选后 0 行不画：没东西可汇总）。 */
  private __hasSummary(): boolean {
    return !!this.summaryFn && this.data.length > 0;
  }

  /**
   * 汇总用的「叶子行」：把整棵树摊平只取叶子，再套上当前的筛选条件。
   *
   * 注意是**摊平整棵树**（不受展开状态影响）：父行的数字本来就是子行的合计，
   * 展开与否不该改变「总额是多少」。
   */
  private __leafRows(): ICETableRow[] {
    const leaves: ICETableRow[] = [];
    const visit = (rows: ICETableRow[]) => {
      rows.forEach((row) => {
        const children = row[this.treeChildrenKey];
        if (Array.isArray(children) && children.length) {
          visit(children as ICETableRow[]);
        } else {
          leaves.push(row);
        }
      });
    };
    visit(this.sourceData);
    const keys = Object.keys(this.filters).filter((key) => (this.filters[key] || []).length > 0);
    if (!keys.length) {
      return leaves;
    }
    return leaves.filter((row) => keys.every((key) => this.filters[key].indexOf(String(row[key])) !== -1));
  }

  /** 汇总要用的行（按口径取：全量 / 当前页，再按 all / leaves 收口）。 */
  private __summaryRows(): ICETableRow[] {
    const leafPredicate = (row: ICETableRow) => {
      const children = row[this.treeChildrenKey];
      return !(Array.isArray(children) && children.length);
    };
    if (this.summaryRowsMode === 'leaves') {
      // leaves 口径：摊平整棵树（不受展开影响）→ 需要页口径时再按「当前页里出现过的行」收口
      const leaves = this.__leafRows();
      if (this.summaryScope === 'page') {
        const pageRows = new Set(this.data);
        return leaves.filter((row) => pageRows.has(row));
      }
      return leaves;
    }
    if (this.summaryScope === 'page') {
      // 页口径 + all：当前页里那些在全树中不是父行的行（父行的子行翻页时不重复计）
      return this.data.filter(leafPredicate);
    }
    return this.sortedData.slice();
  }

  /** 按当前页/每页条数切出要渲染的行，并把高度（含分页器 / 空态）算好。 */
  private __applyPage(): void {
    // 管线是「筛选 → 排序 → 分页」：入口处统一重算前两步，后面的切片逻辑不用改
    this.filteredData = this.__computeFiltered();
    this.sortedData = this.__applySortTo(this.filteredData);
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
    // 可滚动模式（虚拟行 / 固定列）的高度由调用方给：按行数算高度会和「只渲染可视区」自相矛盾
    if (!this.scrollable) {
      const expandedHeight = this.data.length > 0 ? this.__expandedHeightOf(this.data) : 0;
      this.setState({
        height:
          this.headerHeight +
          bodyHeight +
          expandedHeight +
          (showPagination ? this.__footerHeight() : 0) +
          (this.__hasSummary() ? this.rowHeight : 0),
      });
    }
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
    if (this.hasTreeData) {
      // 树形：按树的前序收集选中的行 —— 含级联选中的后代与「别的页选中的行」
      const out: ICETableRow[] = [];
      const visit = (rows: ICETableRow[]) => {
        rows.forEach((row, index) => {
          const key = this.__keyOf(row, index);
          if (this.treeSelection.has(key)) {
            out.push(row);
          }
          const children = row[this.treeChildrenKey];
          if (Array.isArray(children)) {
            visit(children as ICETableRow[]);
          }
        });
      };
      visit(this.sourceData);
      return out;
    }
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
    // 正在编辑且点在编辑框外面 → 先提交这一格（失焦提交），再走原来的点击逻辑
    if (this.editing) {
      const insideEdit = (() => {
        let node = evt.target;
        while (node) {
          if (node === this.editing.node) return true;
          node = node.parentNode;
        }
        return false;
      })();
      if (!insideEdit) {
        this.commitEdit();
      }
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
    // 筛选候选面板：面板内的点击归面板；点到别处就把面板收起来
    if (this.filterPanel) {
      const insideOf = (node: any, root: any) => {
        let current = node;
        while (current) {
          if (current === root) return true;
          current = current.parentNode;
        }
        return false;
      };
      if (insideOf(evt.target, this.filterPanel.panel)) {
        return;
      }
      if (!insideOf(evt.target, this.filterNodes.get(this.filterPanel.key))) {
        this.closeFilter();
      }
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
          const column = this.columns[i];
          // 漏斗所在的一小块区域交给漏斗自己的 click（否则点开候选会顺带切一次排序）
          if (column.filters && column.filters.length && localX >= acc + widths[i] - 26) {
            return;
          }
          // 列头可拖拽：按在表头上先记下起点，松手时再决定「换序」还是「排序」
          if (this.columnDraggable) {
            this.columnDrag = { from: i, to: i };
            this.__ensureColumnDropIndicator();
            this.__syncColumnDropIndicator();
            return;
          }
          this.toggleSort(column.key);
          return;
        }
        acc += widths[i];
      }
      return;
    }
    const index = Math.floor((localY - this.headerHeight) / this.rowHeight);
    if (index >= 0 && index < this.data.length) {
      // 点到可编辑的格子 → 进编辑态（不走整行选中，两者语义不同）
      const offset = this.selectionMode === 'multiple' ? ICETable.SELECTION_WIDTH : 0;
      const widths = this.__columnWidths((Number(this.state.width) || 720) - offset);
      let acc = offset;
      for (let i = 0; i < this.columns.length; i += 1) {
        if (localX >= acc && localX <= acc + widths[i] && this.columns[i].editable === true) {
          if (this.editing && (this.editing.rowIndex !== index || this.editing.key !== this.columns[i].key)) {
            this.commitEdit();
          }
          this.startEdit(index, this.columns[i].key);
          return;
        }
        acc += widths[i];
      }
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
    this.filterNodes.clear();
    this.summaryNode = null;
    this.summaryTexts = {};
    this.expandToggleNodes.clear();
    this.expandedRowNodes.clear();

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
          if (this.hasTreeData) {
            // 树形：默认只选眼前这些行；`selectAllScope: 'all'` 时把整棵树的 key 都选上（含折叠的后代）
            if (this.selectAllScope === 'all') {
              const visit = (rows: ICETableRow[]) => {
                rows.forEach((row, index) => {
                  this.treeSelection.add(this.__keyOf(row, index));
                  const children = row[this.treeChildrenKey];
                  if (Array.isArray(children)) {
                    visit(children as ICETableRow[]);
                  }
                });
              };
              visit(this.sourceData);
            } else {
              // 「全选眼前这些行」不走级联：级联是「用户主动勾某一行」时的行为，
              // 全选要的就是眼前这些（折叠起来的后代等展开或切到 'all' 口径再说）
              this.data.forEach((row, index) => this.treeSelection.add(this.__keyOf(row, index)));
            }
            this.__syncTreeCheckboxes();
          } else {
            this.selectAll();
          }
        } else {
          if (this.hasTreeData) {
            this.treeSelection.clear();
            this.__syncTreeCheckboxes();
          } else {
            this.clearSelection();
          }
        }
      });
      header.addChild(selectAllBox, false);
      this.headerCheckbox = selectAllBox;
    }
    // 表头右侧的「已选 N 行」提示（含级联）：勾一个父行会带上好几个子行，用户要看得见
    this.selectionHintNode = null;
    if (this.selectionSummary) {
      const text = this.getSelectionHintText();
      if (text) {
        this.selectionHintNode = new ICELabel({
          interactive: false,
          left: Math.max(0, totalWidth - 220),
          top: 0,
          width: 200,
          height: this.headerHeight,
          align: 'right',
          verticalAlign: 'middle',
          text,
          style: { fontSize: 12, fillStyle: theme.colors.textSecondary },
        });
        header.addChild(this.selectionHintNode, false);
      }
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
    this.treeToggleNodes.clear();
    // 行与展开区依次往下排：展开区不是浮层，后面的行要真的被推下去
    let bodyTop = this.headerHeight;
    this.data.forEach((row, rowIndex) => {
      const panel = this.__createRowPanel(row, rowIndex, this, bodyTop, widths, offset);
      const key = this.__keyOf(row, rowIndex);
      if (this.isTreeParent(key)) {
        this.__placeTreeToggle(panel, row, rowIndex, offset, this.getRowDepth(key));
      }
      bodyTop += this.rowHeight;
      if (this.__canExpand(row) && this.expandedKeys.has(key)) {
        this.__renderExpandedRow(row, rowIndex, key, bodyTop, widths, totalWidth, offset);
        bodyTop += this.expandableHeight;
      }
    });

    // 汇总行：压在数据行下面（分页时也在它上面，因为算的是筛选后的全量）
    const summaryHeight = this.__hasSummary() ? this.rowHeight : 0;
    if (summaryHeight) {
      this.__renderSummary(this, widths, bodyTop, offset, totalWidth);
    }

    // 空态：没有数据时给一块 ICEEmpty，而不是留一片空白
    if (!this.data.length) {
      this.addChild(
        new ICEEmpty({
          left: 0,
          top: this.headerHeight,
          width: totalWidth,
          height: 120,
          description: this.t('table.empty'),
        }),
        false,
      );
    }

    // 分页器：只有真的分了页（且不是空态）才出现
    this.paginationNode = null;
    if (this.pageSize > 0 && this.data.length > 0) {
      const pagination = new ICEPagination({
        left: 0,
        top: bodyTop + summaryHeight + 8,
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
        // 树形数据下以「按 key 记的级联选择」为准（勾父行带出来的子行也要是勾上的）
        selected: this.hasTreeData
          ? this.treeSelection.has(this.__keyOf(row, rowIndex))
          : this.selectedIndexes.indexOf(rowIndex) !== -1,
      });
      checkbox.on('change', () => {
        if (this.syncingSelection) {
          return;
        }
        const selected = checkbox.isSelected();
        // 树形数据：走级联（勾父行带子行），其它表格仍是「只勾这一行」
        if (this.hasTreeData) {
          const key = this.__keyOf(row, rowIndex);
          this.setTreeRowSelected(key, selected);
          this.__syncTreeCheckboxes();
          this.__emitSelection();
          return;
        }
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
    const expandableRow = this.__canExpand(row);
    const depth = this.getRowDepth(this.__keyOf(row, rowIndex));
    this.__placeCells(panel, widths, values, false, this.columns, row, offset, (expandableRow ? 20 : 0) + depth * 16);
    if (expandableRow) {
      this.__placeExpandToggle(panel, row, rowIndex, offset);
    }
    return panel;
  }

  /** 行首展开三角：▸ 收起 / ▾ 展开；它是行内的交互控件，点它不会走整行选中。 */
  /** 树形父行的 ▸/▾ 三角（比展开行的三角更靠里一层，按深度缩进）。 */
  private __placeTreeToggle(panel: any, row: ICETableRow, rowIndex: number, offset: number, depth: number): void {
    const theme = iceUIManager.getTheme();
    const key = this.__keyOf(row, rowIndex);
    const expanded = this.treeExpanded.has(key);
    const size = Math.min(18, Math.max(14, this.rowHeight - 20));
    const toggle = new ICEWidget({
      left: offset + 2 + depth * 16,
      top: Math.round((this.rowHeight - size) / 2),
      width: size,
      height: size,
      radius: theme.radius.sm,
      fill: true,
      stroke: false,
      interactive: true,
      style: { fillStyle: 'rgba(0,0,0,0)' },
    });
    toggle.addChild(
      createTextNode({
        left: 0,
        top: 0,
        width: size,
        height: size,
        text: expanded ? '▾' : '▸',
        fillStyle: theme.colors.textSecondary,
        fontFamily: theme.font.family,
        fontSize: 11,
        align: 'center',
        verticalAlign: 'middle',
      }),
      false,
    );
    toggle.on('click', () => this.toggleRowExpanded(key), this);
    toggle.on(
      'hoverchange',
      (evt: any) => {
        toggle.setState({
          style: { ...toggle.state.style, fillStyle: readHovered(evt) ? theme.colors.background : 'rgba(0,0,0,0)' },
        });
      },
      this,
    );
    panel.addChild(toggle, false);
    this.treeToggleNodes.set(key, toggle);
  }

  private __placeExpandToggle(panel: any, row: ICETableRow, rowIndex: number, offset: number): void {
    const theme = iceUIManager.getTheme();
    const key = this.__keyOf(row, rowIndex);
    const expanded = this.expandedKeys.has(key);
    const size = Math.min(20, Math.max(14, this.rowHeight - 18));
    const toggle = new ICEWidget({
      left: offset + 2,
      top: (this.rowHeight - size) / 2,
      width: size,
      height: size,
      radius: theme.radius.sm,
      fill: true,
      stroke: false,
      interactive: true,
      style: { fillStyle: 'rgba(0,0,0,0)' },
    });
    toggle.addChild(
      createTextNode({
        left: 0,
        top: 0,
        width: size,
        height: size,
        text: expanded ? '▾' : '▸',
        fillStyle: theme.colors.textSecondary,
        fontFamily: theme.font.family,
        fontSize: 11,
        align: 'center',
        verticalAlign: 'middle',
      }),
      false,
    );
    toggle.on('click', () => this.toggleExpand(key), this);
    toggle.on(
      'hoverchange',
      (evt: any) => {
        toggle.setState({
          style: { ...toggle.state.style, fillStyle: readHovered(evt) ? theme.colors.background : 'rgba(0,0,0,0)' },
        });
      },
      this,
    );
    panel.addChild(toggle, false);
    this.expandToggleNodes.set(key, toggle);
  }

  /** 展开区：一整块贴着行下面，内容由 `expandable.render` 提供。 */
  private __renderExpandedRow(
    row: ICETableRow,
    rowIndex: number,
    key: string,
    top: number,
    widths: number[],
    panelWidth: number,
    offset: number,
  ): void {
    const theme = iceUIManager.getTheme();
    const panel = new ICEWidget({
      left: 0,
      top,
      width: panelWidth,
      height: this.expandableHeight,
      fill: true,
      stroke: false,
      style: { fillStyle: theme.colors.background },
    });
    panel.addChild(
      new ICERect({
        left: 0,
        top: 0,
        width: panelWidth,
        height: 1,
        fill: true,
        stroke: false,
        style: { fillStyle: theme.colors.border },
      }),
      false,
    );
    const widthMap: Record<string, number> = {};
    this.columns.forEach((column, index) => {
      widthMap[column.key] = widths[index];
    });
    const content = this.expandable
      ? this.expandable.render(row, {
          width: panelWidth - offset,
          columns: this.columns,
          widths: widthMap,
          rowIndex,
        })
      : null;
    if (content) {
      panel.addChild(content, false);
    }
    this.addChild(panel, false);
    this.expandedRowNodes.set(key, panel);
  }

  private __placeCells(
    parent: any,
    widths: number[],
    values: string[],
    header: boolean,
    columns?: ICETableColumn[],
    row?: ICETableRow,
    offset: number = 0,
    firstCellIndent: number = 0,
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
        left: left + (index === 0 && !header ? firstCellIndent : 0),
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
        indent: index === 0 && !header ? firstCellIndent : 0,
      });
      if (header && column && column.filters && column.filters.length) {
        this.__placeFilterGlyph(parent, column, left, colW, cellHeight);
      }
      left += colW;
    });
  }

  /**
   * 表头漏斗：贴在该列右缘的小方块（▾）。它自己处理点击 —— 全局 mousedown 里
   * 会把这块区域从「点表头排序」中排除掉，否则点漏斗会顺带把排序也切了。
   */
  private __placeFilterGlyph(parent: any, column: ICETableColumn, left: number, width: number, height: number): void {
    const theme = iceUIManager.getTheme();
    const size = Math.min(20, Math.max(16, height - 12));
    const glyph = new ICEWidget({
      left: left + width - size - 6,
      top: (height - size) / 2,
      width: size,
      height: size,
      radius: theme.radius.sm,
      fill: true,
      stroke: false,
      interactive: true,
      style: { fillStyle: 'rgba(0,0,0,0)' },
    });
    const active = (this.filters[column.key] || []).length > 0;
    glyph.addChild(
      createTextNode({
        left: 0,
        top: 0,
        width: size,
        height: size,
        text: active ? '●' : '▾',
        fillStyle: active ? theme.colors.primary : theme.colors.textTertiary,
        fontFamily: theme.font.family,
        fontSize: 11,
        align: 'center',
        verticalAlign: 'middle',
      }),
      false,
    );
    glyph.on('click', () => this.toggleFilter(column.key), this);
    glyph.on(
      'hoverchange',
      (evt: any) => {
        glyph.setState({
          style: { ...glyph.state.style, fillStyle: readHovered(evt) ? theme.colors.background : 'rgba(0,0,0,0)' },
        });
      },
      this,
    );
    parent.addChild(glyph, false);
    this.filterNodes.set(column.key, glyph);
  }

  /**
   * 汇总行：拿筛选后的全量行算一行文案，画在表尾。
   *
   * 单元格的排版复用 `cellNodes`（对齐规则与数据行完全一致，右对齐的数字列不会错位）。
   */
  private __renderSummary(parent: any, widths: number[], top: number, offset: number, panelWidth: number): void {
    const theme = iceUIManager.getTheme();
    const rows = this.__summaryRows();
    const values = this.summaryFn ? this.summaryFn(rows, this.columns) || {} : {};
    const node = new ICEWidget({
      left: 0,
      top,
      width: panelWidth,
      height: this.rowHeight,
      fill: true,
      stroke: false,
      interactive: false,
      style: { fillStyle: theme.colors.background },
    });
    node.addChild(
      new ICERect({
        left: 0,
        top: 0,
        width: panelWidth,
        height: 1,
        fill: true,
        stroke: false,
        style: { fillStyle: theme.colors.border },
      }),
      false,
    );
    let left = offset;
    this.columns.forEach((column, index) => {
      const text = values[column.key] === undefined || values[column.key] === null ? '' : String(values[column.key]);
      this.summaryTexts[column.key] = text;
      const colW = widths[index];
      const textNode = createTextNode({
        left,
        top: 0,
        width: 1,
        height: this.rowHeight,
        text,
        fillStyle: theme.colors.text,
        fontFamily: theme.font.family,
        fontSize: theme.font.size,
        fontWeight: theme.font.weightSemibold,
        align: 'left',
        verticalAlign: 'middle',
      });
      node.addChild(textNode, false);
      this.cellNodes.push({
        node: textNode,
        cellLeft: left,
        cellWidth: colW,
        cellHeight: this.rowHeight,
        align: column.align || 'left',
      });
      left += colW;
    });
    parent.addChild(node, false);
    this.summaryNode = node;
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
      let left = cell.cellLeft + padX + (cell.indent || 0);
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
   * 导出列版式（列宽 + 列顺序）。
   *
   * 组件不负责存：业务把它塞进 localStorage 或后端即可，下次进来 `setColumnState()` 还原。
   */
  public getColumnState(): ICETableColumnState {
    return {
      widths: this.getColumnWidths(),
      order: this.columns.map((column) => column.key),
    };
  }

  // ---- 列顺序 ----

  public getColumnOrder(): string[] {
    return this.columns.map((column) => column.key);
  }

  /** 列头拖拽的落点指示线位置（没在拖 / 拖回原列时为 null）。 */
  public getColumnDropIndicatorBox(): any {
    // 没在拖、或拖回原列（等于没动）都算「没有指示线」
    if (!this.columnDropIndicator || this.columnDropIndicator.state.display === false) {
      return null;
    }
    return {
      left: Number(this.columnDropIndicator.state.left) || 0,
      top: Number(this.columnDropIndicator.state.top) || 0,
      width: Number(this.columnDropIndicator.state.width) || 0,
      height: Number(this.columnDropIndicator.state.height) || 0,
    };
  }

  /** 按 key 列表重排（列表里没提到的列接在后面，新增列不会丢）。 */
  public setColumnOrder(keys: string[]): this {
    if (!Array.isArray(keys) || !keys.length) {
      return this;
    }
    const ordered = keys
      .map((key) => this.columns.find((column) => column.key === key))
      .filter(Boolean) as ICETableColumn[];
    this.columns.forEach((column) => {
      if (ordered.indexOf(column) === -1) {
        ordered.push(column);
      }
    });
    this.columns = ordered;
    this.__render();
    return this;
  }

  /** 把第 `from` 列挪到第 `to` 列的位置（拖拽与测试共用这条路径）。 */
  /** 拖拽开始时建好指示线（一条竖线，跟着落点列走）。 */
  private __ensureColumnDropIndicator(): void {
    if (this.columnDropIndicator || !this.columnDraggable) {
      return;
    }
    const theme = iceUIManager.getTheme();
    this.columnDropIndicator = new ICEWidget({
      left: 0,
      top: 0,
      width: 2,
      height: this.headerHeight + Math.max(1, this.data.length) * this.rowHeight,
      fill: true,
      stroke: false,
      display: false,
      interactive: false,
      style: { fillStyle: theme.colors.primary },
    });
    this.addChild(this.columnDropIndicator, false);
  }

  /** 指示线跟着落点列走；拖回原列时隐藏（等于没动）。 */
  private __syncColumnDropIndicator(): void {
    const indicator = this.columnDropIndicator;
    const drag = this.columnDrag;
    if (!indicator || !drag) {
      return;
    }
    if (drag.from === drag.to) {
      indicator.setState({ display: false });
      return;
    }
    const offset = this.selectionMode === 'multiple' ? ICETable.SELECTION_WIDTH : 0;
    const widths = this.__columnWidths((Number(this.state.width) || 720) - offset);
    const to = Math.min(Math.max(drag.to, 0), widths.length - 1);
    // 落点在目标列的哪一侧：往后拖落在它的右边界，往前拖落在左边界
    let edge = offset;
    for (let i = 0; i < to; i += 1) {
      edge += widths[i];
    }
    if (drag.to > drag.from) {
      edge += widths[to];
    }
    indicator.setState({ left: Math.max(0, edge - 1), display: true });
    if (this.ice) {
      this.ice.dirty = true;
    }
  }

  public moveColumn(from: number, to: number): this {
    const order = this.getColumnOrder();
    if (from < 0 || from >= order.length || to < 0 || to >= order.length || from === to) {
      return this;
    }
    const next = order.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    this.setColumnOrder(next);
    if (this.onColumnReorder) {
      this.onColumnReorder(next, from, to);
    }
    return this;
  }

  /** 按版式还原：未知 key 忽略、缺的列保持原样；宽度会按 `minWidth` 夹取（脏数据也压不没列）。 */
  public setColumnState(state: Partial<ICETableColumnState> | null | undefined): this {
    if (!state || typeof state !== 'object') {
      return this;
    }
    const widths = state.widths || {};
    Object.keys(widths).forEach((key) => {
      if (this.columns.some((column) => column.key === key)) {
        this.columnWidthOverrides[key] = Number(widths[key]);
      }
    });
    if (Array.isArray(state.order) && state.order.length) {
      const ordered = state.order
        .map((key) => this.columns.find((column) => column.key === key))
        .filter(Boolean) as ICETableColumn[];
      // 版式里没提到的列保持原顺序接在后面（新增了列也不会丢）
      this.columns.forEach((column) => {
        if (ordered.indexOf(column) === -1) {
          ordered.push(column);
        }
      });
      this.columns = ordered;
    }
    this.__render();
    return this;
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
    // 列头拖拽：只更新落点，松手时才真的换序
    if (this.columnDrag && evt && typeof evt.offsetX === 'number' && this.ice && typeof this.ice.screenToWorld === 'function') {
      const [wx] = this.ice.screenToWorld(evt.offsetX, evt.offsetY);
      const box = this.getMinBoundingBox(true);
      const offset = this.selectionMode === 'multiple' ? ICETable.SELECTION_WIDTH : 0;
      const widths = this.__columnWidths((Number(this.state.width) || 720) - offset);
      let acc = offset;
      const localX = wx - box.tl[0];
      for (let i = 0; i < this.columns.length; i += 1) {
        if (localX >= acc && localX <= acc + widths[i]) {
          this.columnDrag.to = i;
          this.__syncColumnDropIndicator();
          break;
        }
        acc += widths[i];
      }
      return;
    }
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
    // 列头拖拽收口：挪到别的列 → 换序；原地 → 当成「点表头排序」
    if (this.columnDrag) {
      const { from, to } = this.columnDrag;
      this.columnDrag = null;
      if (this.columnDropIndicator) {
        this.columnDropIndicator.setState({ display: false });
      }
      if (from !== to) {
        this.moveColumn(from, to);
      } else {
        this.toggleSort(this.columns[from].key);
      }
    }
  }

  private __format(value: any): string {
    if (value === null || value === undefined) return '';
    return String(value);
  }

  private __syncSelection(): void {
    const theme = iceUIManager.getTheme();
    this.rowPanels.forEach((panel, index) => {
      // 树形数据：选中态以「按 key 记的级联选择」为准（勾父行带出来的子行也要一起高亮）
      const row = this.data[index];
      const selected = this.hasTreeData
        ? !!row && this.treeSelection.has(this.__keyOf(row, index))
        : this.selectionMode === 'multiple'
          ? this.selectedIndexes.indexOf(index) !== -1
          : index === this.selectedIndex;
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
        // 同步期间挡住 change 回调：setSelected 会再抛 change，不挡会递归
        this.syncingSelection = true;
        try {
          checkbox.setSelected(selected);
        } finally {
          this.syncingSelection = false;
        }
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
