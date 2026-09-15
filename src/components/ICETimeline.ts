import { ICELabel } from './ICELabel';
import { ICEWidget } from '../core/ICEWidget';
import { iceUIManager } from '../core/ICEManager';
import { ICEBoxLayout } from 'ice-render';

/**
 * 时间线：竖线 + 节点圆点 + 标题/描述/时间。
 */
export interface ICETimelineItem {
  title: string;
  description?: string;
  time?: string;
  color?: string;
}

export interface ICETimelineOptions {
  /** 组件 id（引擎会用它做唯一标识，e2e/调试时可按 id 定位） */
  id?: string;
  items: ICETimelineItem[];
  left?: number;
  top?: number;
  width?: number;
  itemHeight?: number;
}

export class ICETimeline extends ICEWidget {
  private items: ICETimelineItem[];
  private itemHeight: number;
  private itemNodes: ICEWidget[] = [];
  private dots: ICEWidget[] = [];

  constructor(props: ICETimelineOptions) {
    const width = props.width ?? 320;
    const itemHeight = props.itemHeight ?? 44;
    const height = (props.items || []).length * itemHeight;
    super({
      id: props.id,
      fill: false,
      stroke: false,
      left: props.left,
      top: props.top,
      width,
      height,
    });
    this.items = (props.items || []).slice();
    this.itemHeight = itemHeight;
    // 条目槽是一列等距（行距 = itemHeight，无缝）→ 纵向 BoxLayout
    this.setLayout(new ICEBoxLayout({ axis: 'y', gap: 0 }));
    this.__render();
  }

  public getItemNodes(): ICEWidget[] {
    return this.itemNodes.slice();
  }

  public getDotColor(index: number): string {
    const dot = this.dots[index];
    return dot ? String(dot.state.style.fillStyle) : '';
  }

  /** 替换数据并重排（内容随选中项变化时用）。 */
  public setItems(items: ICETimelineItem[]): this {
    this.items = (items || []).slice();
    this.setState({ height: this.items.length * this.itemHeight });
    this.__render();
    return this;
  }

  /** 宽度变化时重排（理由同 ICEDescriptions：引擎只回调 __afterStateMerge）。 */
  protected __afterStateMerge(sizeChanged: boolean): void {
    super.__afterStateMerge(sizeChanged);
    if (sizeChanged) {
      this.__render();
    }
  }

  private __render(): void {
    const theme = iceUIManager.getTheme();
    // 重排前先清空（否则 setItems / 宽度变化会把新行叠在旧行上）
    this.removeChildren([...this.childNodes]);
    // 数组同样要清：`getItemNodes()` / `getDotColor()` 读的是它们，
    // 不清就会一直返回**上一次渲染**的节点（旧节点的坐标已经过期）。
    this.itemNodes = [];
    this.dots = [];
    const width = Number(this.state.width) || 320;
    const lineX = 6;
    this.items.forEach((item, index) => {
      /**
       * 条目自己就是「槽」：竖线 / 圆点是**行内装饰**（相对本行算：`top 16` / `top 6`），
       * 行与行的间距交给 BoxLayout —— 装饰与排布各归各的。
       *
       * 注意装饰要建在行**之前**、行内的文字之后：z 序与历史一致（竖线压在行底、圆点压竖线、
       * 文字在最上），否则相邻行之间会互相盖住。
       */
      const row = new ICEWidget({
        width,
        height: this.itemHeight,
        fill: false,
        stroke: false,
      });
      // 竖线（相邻节点之间）
      if (index < this.items.length - 1) {
        row.addChild(
          new ICEWidget({
            left: lineX,
            top: 16,
            width: 1,
            height: this.itemHeight - 8,
            fill: true,
            stroke: false,
            interactive: false,
            style: { fillStyle: theme.colors.borderSecondary },
          }),
          false,
        );
      }
      const dot = new ICEWidget({
        left: lineX - 3,
        top: 6,
        width: 7,
        height: 7,
        radius: 4,
        fill: true,
        stroke: false,
        interactive: false,
        style: { fillStyle: item.color || theme.colors.primary },
      });
      row.addChild(dot, false);
      this.dots.push(dot);

      row.addChild(
        new ICELabel({
          interactive: false,
          left: 20,
          top: 0,
          width: width - 20,
          height: 20,
          verticalAlign: 'middle',
          text: item.title,
          style: { fontSize: 13, fontWeight: '600', fillStyle: theme.colors.text },
        }),
        false,
      );
      if (item.description) {
        row.addChild(
          new ICELabel({
            interactive: false,
            left: 20,
            top: 20,
            width: width - 20,
            height: 18,
            verticalAlign: 'middle',
            text: item.description,
            style: { fontSize: 12, fillStyle: theme.colors.textSecondary },
          }),
          false,
        );
      }
      if (item.time) {
        row.addChild(
          new ICELabel({
            interactive: false,
            left: Math.max(20, width - 56),
            top: 0,
            width: 56,
            height: 20,
            align: 'right',
            verticalAlign: 'middle',
            text: item.time,
            style: { fontSize: 12, fillStyle: theme.colors.textTertiary },
          }),
          false,
        );
      }
      this.addChild(row, false);
      this.itemNodes.push(row);
    });
  }
}
