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
