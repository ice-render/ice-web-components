import { ICEWidget } from '../core/ICEWidget';
import { ICECheckBox } from './ICECheckBox';
import { ICEEmpty } from './ICEEmpty';
import { ICEPagination } from './ICEPagination';
import { iceUIManager } from '../core/ICEManager';
import { createTextNode, readHovered } from '../util/ICEStyle';
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
    this.sortedData = (props.data || []).slice();
    this.data = this.sortedData;
    this.rowHeight = rowHeight;
    this.headerHeight = headerHeight;
    this.onSelect = typeof props.onSelect === 'function' ? props.onSelect : null;
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
    });

    // 空态：没有数据时给一块 ICEEmpty，而不是留一片空白
    if (!this.data.length) {
      this.addChild(
        new ICEEmpty({
          left: 0,
          top: this.headerHeight,
          width: totalWidth,
          height: 120,
          description: this.columns.length ? '暂无数据' : '暂无数据',
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
