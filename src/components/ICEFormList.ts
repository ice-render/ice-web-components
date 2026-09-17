import { ICEWidget } from '../core/ICEWidget';
import { ICEPanel } from './ICEPanel';
import { ICELabel } from './ICELabel';
import { ICEButton } from './ICEButton';
import { iceUIManager } from '../core/ICEManager';
import { ICEBoxLayout, token } from 'ice-render';

/**
 * 可增删的重复表单项（多联系人 / 多地址 / 明细行）。
 *
 * 这类结构的难点不在「画一行」，而在**行身份**：用下标当 key，删掉第一行之后，
 * 第二行的控件就会显示第一行的数据（重复行最经典的 bug）。所以每一行都有稳定的 `rowKey`，
 * 增删只动那一行，`onChange(rows)` 给的是最新全量。
 *
 * 用法：
 * ```ts
 * const list = new ICEFormList({
 *   renderRow: (row, ctx) => textFieldFor(row),   // 返回这一行的内容组件
 *   initialRows: [{}],
 *   minRows: 1, maxRows: 5,
 *   onChange: (rows) => console.log(rows),
 * });
 * ```
 * 行内的控件由调用方创建；改完值调 `list.updateRow(index, patch)` 把数据写回去。
 */

export interface ICEFormListRowContext {
  index: number;
  rowKey: string;
}

export interface ICEFormListOptions {
  id?: string;
  left?: number;
  top?: number;
  width?: number;
  /** 每行内容的高度（默认 36） */
  rowHeight?: number;
  /** 行间距（默认 8） */
  gap?: number;
  /** 初始行（默认一行空数据） */
  initialRows?: any[];
  /** 最少几行（到了就禁用「删除」，默认 0） */
  minRows?: number;
  /** 最多几行（到了就禁用「添加」，默认不限） */
  maxRows?: number;
  addText?: string;
  removeText?: string;
  /** 生成一行内容；返回的组件会被放到该行里（宽 = width - 删除按钮那一列） */
  renderRow: (row: any, ctx: ICEFormListRowContext) => any;
  onChange?: (rows: any[]) => void;
  onAdd?: (row: any) => void;
  onRemove?: (row: any, index: number) => void;
}

interface ICEFormListRow {
  key: string;
  data: any;
}

export class ICEFormList extends ICEWidget {
  private rows: ICEFormListRow[] = [];
  private rowNodes: ICEWidget[] = [];
  private removeButtons: ICEButton[] = [];
  private addButton: ICEButton | null = null;
  private rowHeight: number;
  private gap: number;
  private minRows: number;
  private maxRows: number | null;
  private addText: string;
  private removeText: string;
  private renderRow: (row: any, ctx: ICEFormListRowContext) => any;
  private onChange: ((rows: any[]) => void) | null;
  private onAdd: ((row: any) => void) | null;
  private onRemove: ((row: any, index: number) => void) | null;
  private width: number;
  private seq = 0;

  constructor(props: ICEFormListOptions) {
    const theme = iceUIManager.getTheme();
    const width = props.width ?? 320;
    super({
      id: props.id,
      left: props.left,
      top: props.top,
      width,
      height: props.rowHeight ?? 36,
      fill: false,
      stroke: false,
      interactive: false,
    });
    this.width = width;
    this.rowHeight = Math.max(20, Math.floor(Number(props.rowHeight) || 36));
    this.gap = Math.max(0, Math.floor(Number(props.gap) || 8));
    // 行 + 底部「添加」按钮都是纵向等距子项（缝 = gap）→ 纵向 BoxLayout
    this.setLayout(new ICEBoxLayout({ axis: 'y', gap: this.gap }));
    this.minRows = Math.max(0, Math.floor(Number(props.minRows) || 0));
    this.maxRows = Number.isFinite(Number(props.maxRows)) ? Math.max(0, Math.floor(Number(props.maxRows))) : null;
    this.addText = props.addText || '+ 添加一行';
    this.removeText = props.removeText || '删除';
    this.renderRow = props.renderRow;
    this.onChange = typeof props.onChange === 'function' ? props.onChange : null;
    this.onAdd = typeof props.onAdd === 'function' ? props.onAdd : null;
    this.onRemove = typeof props.onRemove === 'function' ? props.onRemove : null;
    const initial = props.initialRows && props.initialRows.length ? props.initialRows : [{}];
    initial.forEach((data) => {
      this.rows.push({ key: this.__nextKey(), data });
    });
    this.__render();
  }

  // ---- 数据 ----

  public getRows(): any[] {
    return this.rows.map((row) => row.data);
  }

  public getRowKeys(): string[] {
    return this.rows.map((row) => row.key);
  }

  public getRowCount(): number {
    return this.rows.length;
  }

  public addRow(data: any = {}): this {
    if (this.isAddDisabled()) {
      return this;
    }
    const row = { key: this.__nextKey(), data };
    this.rows.push(row);
    this.__render();
    if (this.onAdd) {
      this.onAdd(data);
    }
    this.__emitChange();
    return this;
  }

  public removeRow(index: number): this {
    if (index < 0 || index >= this.rows.length || this.isRemoveDisabled(index)) {
      return this;
    }
    const [removed] = this.rows.splice(index, 1);
    this.__render();
    if (this.onRemove) {
      this.onRemove(removed.data, index);
    }
    this.__emitChange();
    return this;
  }

  public updateRow(index: number, patch: any): this {
    if (index < 0 || index >= this.rows.length) {
      return this;
    }
    const current = this.rows[index].data;
    this.rows[index].data = current && typeof current === 'object' ? { ...current, ...patch } : patch;
    this.__render();
    this.__emitChange();
    return this;
  }

  public setRows(rows: any[]): this {
    this.rows = (rows || []).map((data) => ({ key: this.__nextKey(), data }));
    this.__render();
    return this;
  }

  public isAddDisabled(): boolean {
    return this.maxRows !== null && this.rows.length >= this.maxRows;
  }

  public isRemoveDisabled(index: number): boolean {
    return this.rows.length <= this.minRows || index < 0 || index >= this.rows.length;
  }

  // ---- 节点（测试 / e2e） ----

  public getRowNode(index: number): ICEWidget | null {
    return this.rowNodes[index] || null;
  }

  public getRemoveButton(index: number): ICEButton | null {
    return this.removeButtons[index] || null;
  }

  public getAddButton(): ICEButton | null {
    return this.addButton;
  }

  /** 内容总高（行 + 间隙 + 添加按钮那一行）。 */
  public getContentHeight(): number {
    return this.rows.length * this.rowHeight + Math.max(0, this.rows.length - 1) * this.gap + this.gap + 32;
  }

  // ---- 内部 ----

  private __nextKey(): string {
    this.seq += 1;
    return `row-${this.seq}`;
  }

  private __emitChange(): void {
    if (this.onChange) {
      this.onChange(this.getRows());
    }
  }

  private __render(): void {
    const theme = iceUIManager.getTheme();
    const width = this.width;
    this.removeChildren([...this.childNodes]);
    this.rowNodes = [];
    this.removeButtons = [];
    const actionWidth = 64;
    const contentWidth = Math.max(40, width - actionWidth - 8);
    this.rows.forEach((row, index) => {
      const panel = new ICEPanel({
        width,
        height: this.rowHeight,
        radius: theme.radius.sm,
        style: { fillStyle: token('ui.colors.surface'), strokeStyle: token('ui.colors.border') },
      });
      const content = this.renderRow(row.data, { index, rowKey: row.key });
      if (content) {
        content.setState({ left: 8, top: 2, width: contentWidth, height: this.rowHeight - 4 });
        panel.addChild(content, false);
      }
      const remove = new ICEButton({
        left: width - actionWidth,
        top: Math.round((this.rowHeight - 26) / 2),
        width: actionWidth - 8,
        height: 26,
        text: this.removeText,
        size: 'small',
        variant: 'text',
        danger: true,
        disabled: this.isRemoveDisabled(index),
      });
      remove.on('click', () => this.removeRow(index), this);
      panel.addChild(remove, false);
      this.addChild(panel, false);
      this.rowNodes.push(panel);
      this.removeButtons.push(remove);
    });
    const addTop = this.rows.length * this.rowHeight + Math.max(0, this.rows.length - 1) * this.gap + this.gap;
    const add = new ICEButton({
      width: 120,
      height: 32,
      text: this.addText,
      variant: 'default',
      disabled: this.isAddDisabled(),
    });
    add.on('click', () => this.addRow({}), this);
    this.addChild(add, false);
    this.addButton = add;
    this.setState({ height: addTop + 32 });
    if (this.ice && this.ice.dirty !== undefined) {
      this.ice.dirty = true;
    }
  }
}

export default ICEFormList;
