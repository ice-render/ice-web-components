import { ICELabel } from './ICELabel';
import { ICEComponent } from '../core/ICEComponent';
import { iceUIManager } from '../core/ICEManager';

/**
 * 时间线（业界组件库 Timeline）：竖线 + 节点圆点 + 标题/描述/时间。
 */
export interface ICETimelineItem {
  title: string;
  description?: string;
  time?: string;
  color?: string;
}

export interface ICETimelineOptions {
  items: ICETimelineItem[];
  left?: number;
  top?: number;
  width?: number;
  itemHeight?: number;
}

export class ICETimeline extends ICEComponent {
  private items: ICETimelineItem[];
  private itemHeight: number;
  private itemNodes: ICEComponent[] = [];
  private dots: ICEComponent[] = [];

  constructor(props: ICETimelineOptions) {
    const width = props.width ?? 320;
    const itemHeight = props.itemHeight ?? 44;
    const height = (props.items || []).length * itemHeight;
    super({
      fill: false,
      stroke: false,
      left: props.left,
      top: props.top,
      width,
      height,
    });
    this.items = (props.items || []).slice();
    this.itemHeight = itemHeight;
    this.__render();
  }

  public getItemNodes(): ICEComponent[] {
    return this.itemNodes.slice();
  }

  public getDotColor(index: number): string {
    const dot = this.dots[index];
    return dot ? String(dot.state.style.fillStyle) : '';
  }

  private __render(): void {
    const theme = iceUIManager.getTheme();
    const width = Number(this.state.width) || 320;
    const lineX = 6;
    this.items.forEach((item, index) => {
      const top = index * this.itemHeight;
      // 竖线（相邻节点之间）
      if (index < this.items.length - 1) {
        this.addChild(
          new ICEComponent({
            left: lineX,
            top: top + 16,
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
      const dot = new ICEComponent({
        left: lineX - 3,
        top: top + 6,
        width: 7,
        height: 7,
        radius: 4,
        fill: true,
        stroke: false,
        interactive: false,
        style: { fillStyle: item.color || theme.colors.primary },
      });
      this.addChild(dot, false);
      this.dots.push(dot);

      const row = new ICEComponent({
        left: 0,
        top,
        width,
        height: this.itemHeight,
        fill: false,
        stroke: false,
      });
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
