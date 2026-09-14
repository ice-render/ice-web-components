import { ICELabel } from './ICELabel';
import { ICEWidget } from '../core/ICEWidget';
import { iceUIManager } from '../core/ICEManager';
import { truncateTextLines } from './ICETypography';

/**
 * 描述列表：成对的「标签 / 值」，支持单列与多列。
 * 常用于详情页（订单信息、用户资料）。
 */
export interface ICEDescriptionsItem {
  label: string;
  value: string;
}

export interface ICEDescriptionsOptions {
  /** 组件 id（引擎会用它做唯一标识，e2e/调试时可按 id 定位） */
  id?: string;
  items: ICEDescriptionsItem[];
  column?: number;
  left?: number;
  top?: number;
  width?: number;
  itemHeight?: number;
  labelWidth?: number;
}

export class ICEDescriptions extends ICEWidget {
  private items: ICEDescriptionsItem[];
  private column: number;
  private itemHeight: number;
  private labelWidth: number;
  private rowNodes: ICEWidget[] = [];

  constructor(props: ICEDescriptionsOptions) {
    const width = props.width ?? 320;
    const column = Math.max(1, props.column ?? 1);
    const itemHeight = props.itemHeight ?? 32;
    const rows = Math.ceil((props.items || []).length / column);
    super({
      id: props.id,
      fill: true,
      stroke: true,
      left: props.left,
      top: props.top,
      width,
      height: rows * itemHeight + 8,
      radius: iceUIManager.getTheme().radius.md,
      style: { fillStyle: iceUIManager.getTheme().colors.surface, strokeStyle: iceUIManager.getTheme().colors.border },
    });
    this.items = (props.items || []).slice();
    this.column = column;
    this.itemHeight = itemHeight;
    this.labelWidth = props.labelWidth ?? 72;
    this.__render();
  }

  public getRowNodes(): ICEWidget[] {
    return this.rowNodes.slice();
  }

  /** 替换数据并重排（列表内容随选中项变化时用）。 */
  public setItems(items: ICEDescriptionsItem[]): this {
    this.items = (items || []).slice();
    const rows = Math.ceil(this.items.length / this.column);
    this.setState({ height: rows * this.itemHeight + 8 });
    this.__render();
    return this;
  }

  /**
   * 宽度变化时重排内部布局。
   *
   * `__render()` 只在构造与 setItems 时跑，而「窗口缩放 / 分栏拖动」只改 `state.width` ——
   * 引擎在 setState 后只回调 `__afterStateMerge`，不补这次重排的话列宽会停留在旧值
   * （值列宽度算成 0，文字直接消失）。
   */
  protected __afterStateMerge(sizeChanged: boolean): void {
    super.__afterStateMerge(sizeChanged);
    if (sizeChanged) {
      this.__render();
    }
  }

  private __render(): void {
    const theme = iceUIManager.getTheme();
    // 重排前先清空：不然每次重排都会把新格子叠在旧格子上（表现为文字重影/重复）
    this.removeChildren([...this.childNodes]);
    const width = Number(this.state.width) || 320;
    const columnWidth = width / this.column;
    this.rowNodes = [];
    this.items.forEach((item, index) => {
      const row = index % this.column;
      const line = Math.floor(index / this.column);
      const left = row * columnWidth + 12;
      const top = 4 + line * this.itemHeight;
      const cellWidth = columnWidth - 24;
      const labelWidth = Math.max(0, this.labelWidth - 6);
      // 值列再留 4px，避免文字紧贴下一列的标签
      const valueWidth = Math.max(0, cellWidth - this.labelWidth - 4);
      const cell = new ICEWidget({
        left,
        top,
        width: cellWidth,
        height: this.itemHeight,
        fill: false,
        stroke: false,
      });
      // 超宽就截断加省略号：画布文本不会自动裁剪，长值会直接压到相邻列上
      // （CPU 型号、操作系统版本这类值在窄列里很常见）
      const labelText = truncateTextLines(item.label, {
        maxWidth: labelWidth,
        fontSize: 12,
        maxLines: 1,
      })[0];
      const valueText = truncateTextLines(String(item.value ?? ''), {
        maxWidth: valueWidth,
        fontSize: 13,
        maxLines: 1,
      })[0];
      cell.addChild(
        new ICELabel({
          interactive: false,
          left: 0,
          top: 0,
          width: this.labelWidth,
          height: this.itemHeight,
          verticalAlign: 'middle',
          text: labelText,
          style: { fontSize: 12, fillStyle: theme.colors.textSecondary },
        }),
        false,
      );
      cell.addChild(
        new ICELabel({
          interactive: false,
          left: this.labelWidth,
          top: 0,
          width: valueWidth,
          height: this.itemHeight,
          verticalAlign: 'middle',
          text: valueText,
          style: { fontSize: 13, fillStyle: theme.colors.text },
        }),
        false,
      );
      this.addChild(cell, false);
      this.rowNodes.push(cell);
    });
  }
}
