import { ICELabel } from './ICELabel';
import { ICEWidget } from '../core/ICEWidget';
import { iceUIManager } from '../core/ICEManager';

/**
 * 描述列表（业界组件库 Descriptions）：成对的「标签 / 值」，支持单列与多列。
 * 常用于详情页（订单信息、用户资料）。
 */
export interface ICEDescriptionsItem {
  label: string;
  value: string;
}

export interface ICEDescriptionsOptions {
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

  private __render(): void {
    const theme = iceUIManager.getTheme();
    const width = Number(this.state.width) || 320;
    const columnWidth = width / this.column;
    this.rowNodes = [];
    this.items.forEach((item, index) => {
      const row = index % this.column;
      const line = Math.floor(index / this.column);
      const left = row * columnWidth + 12;
      const top = 4 + line * this.itemHeight;
      const cell = new ICEWidget({
        left,
        top,
        width: columnWidth - 24,
        height: this.itemHeight,
        fill: false,
        stroke: false,
      });
      cell.addChild(
        new ICELabel({
          interactive: false,
          left: 0,
          top: 0,
          width: this.labelWidth,
          height: this.itemHeight,
          verticalAlign: 'middle',
          text: item.label,
          style: { fontSize: 12, fillStyle: theme.colors.textSecondary },
        }),
        false,
      );
      cell.addChild(
        new ICELabel({
          interactive: false,
          left: this.labelWidth,
          top: 0,
          width: Math.max(0, columnWidth - 24 - this.labelWidth),
          height: this.itemHeight,
          verticalAlign: 'middle',
          text: item.value,
          style: { fontSize: 13, fillStyle: theme.colors.text },
        }),
        false,
      );
      this.addChild(cell, false);
      this.rowNodes.push(cell);
    });
  }
}
