import { UIComponent } from '../core/UIComponent';
import { uiManager } from '../core/UIManager';
import { createTextNode } from '../util/UIStyle';

export type UITableColumn = {
  key: string;
  title: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
};

export type UITableRow = Record<string, any>;

export class UITable extends UIComponent {
  private columns: UITableColumn[];
  private data: UITableRow[];
  private rowPanels: any[] = [];
  private selectedIndex = -1;
  private rowHeight: number;
  private headerHeight: number;
  private onSelect: ((row: UITableRow | null, index: number) => void) | null;
  private __bound = false;

  constructor(props: any = {}) {
    const theme = uiManager.getTheme();
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
    this.data = props.data || [];
    this.rowHeight = rowHeight;
    this.headerHeight = headerHeight;
    this.onSelect = typeof props.onSelect === 'function' ? props.onSelect : null;
    this.__render();
  }

  public setData(data: UITableRow[]): this {
    this.data = data || [];
    this.selectedIndex = -1;
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
    const [wx, wy] = this.ice.screenToWorld(evt.offsetX, evt.offsetY);
    const box = this.getMinBoundingBox(true);
    if (wx < box.tl[0] || wx > box.br[0] || wy < box.tl[1] || wy > box.br[1]) {
      return;
    }
    const localY = wy - box.tl[1] - this.headerHeight;
    const index = Math.floor(localY / this.rowHeight);
    if (index >= 0 && index < this.data.length) {
      this.selectedIndex = index;
      this.__syncSelection();
      if (this.onSelect) {
        this.onSelect(this.data[index], index);
      }
    }
  }

  private __render(): void {
    this.removeChildren([...this.childNodes]);
    const theme = uiManager.getTheme();
    const totalWidth = Number(this.state.width) || 720;
    const widths = this.__columnWidths(totalWidth);

    const header = new UIComponent({
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
    this.__placeCells(header, widths, this.columns.map((column) => column.title), true);

    this.rowPanels = [];
    this.data.forEach((row, rowIndex) => {
      const panel = new UIComponent({
        fill: true,
        stroke: false,
        left: 0,
        top: this.headerHeight + rowIndex * this.rowHeight,
        width: totalWidth,
        height: this.rowHeight,
        style: {
          fillStyle: rowIndex % 2 === 0 ? theme.colors.surface : theme.colors.disabled,
        },
      });
      this.addChild(panel, false);
      this.rowPanels.push(panel);
      const values = this.columns.map((column) => this.__format(row[column.key]));
      this.__placeCells(panel, widths, values, false, this.columns);
    });
    this.__syncSelection();
    this.revalidate();
  }

  private __placeCells(
    parent: any,
    widths: number[],
    values: string[],
    header: boolean,
    columns?: UITableColumn[],
  ): void {
    const theme = uiManager.getTheme();
    let left = 0;
    values.forEach((value, index) => {
      const align = columns ? columns[index].align || 'left' : 'left';
      const node = createTextNode({
        left,
        top: 0,
        width: widths[index],
        height: header ? this.headerHeight : this.rowHeight,
        text: value,
        fillStyle: header ? theme.colors.textSecondary : theme.colors.text,
        fontFamily: theme.font.family,
        fontSize: header ? theme.font.sizeSmall : theme.font.size,
        fontWeight: header ? theme.font.weightSemibold : theme.font.weightNormal,
        align,
        verticalAlign: 'middle',
      });
      parent.addChild(node, false);
      left += widths[index];
    });
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
    const theme = uiManager.getTheme();
    this.rowPanels.forEach((panel, index) => {
      panel.setState({
        style: {
          fillStyle: index === this.selectedIndex ? theme.colors.primaryBg : index % 2 === 0 ? theme.colors.surface : theme.colors.disabled,
        },
      });
    });
    this.revalidate();
  }
}
