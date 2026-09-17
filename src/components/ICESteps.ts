import { ICELabel } from './ICELabel';
import { ICEWidget } from '../core/ICEWidget';
import { iceUIManager } from '../core/ICEManager';
import { ICEBoxLayout, token } from 'ice-render';

/**
 * 步骤条：横向序号 + 标题/描述 + 连接线，当前步骤高亮、已完成打勾。
 */
export interface ICEStepsItem {
  title: string;
  description?: string;
}

export interface ICEStepsOptions {
  /** 组件 id（引擎会用它做唯一标识，e2e/调试时可按 id 定位） */
  id?: string;
  items: ICEStepsItem[];
  current?: number;
  left?: number;
  top?: number;
  width?: number;
  /** 显式高度；不给则用「圆点 + 文字」的内容高度（`circleSize + 34`） */
  height?: number;
  circleSize?: number;
  onChange?: (current: number) => void;
}

export class ICESteps extends ICEWidget {
  private items: ICEStepsItem[];
  private current: number;
  private circleSize: number;
  private stepNodes: ICEWidget[] = [];
  private onChange: ((current: number) => void) | null;

  constructor(props: ICEStepsOptions) {
    const width = props.width ?? 420;
    const circleSize = props.circleSize ?? 28;
    super({
      id: props.id,
      fill: false,
      stroke: false,
      left: props.left,
      top: props.top,
      width,
      // 显式给的高度优先，与库内其余组件同口径；没给才用「圆点 + 文字」的内容高度。
      // 原来恒用内容高度，于是「构造时给 height」与「事后 setState 改 height」两条路
      // 会得到不同的步骤高（前者的 state.height 被覆盖、后者没有），同一个尺寸两种样子。
      height: props.height ?? circleSize + 34,
    });
    this.items = (props.items || []).slice();
    this.current = Math.min(Math.max(0, Number(props.current) || 0), Math.max(0, this.items.length - 1));
    this.circleSize = circleSize;
    this.onChange = typeof props.onChange === 'function' ? props.onChange : null;
    // 步骤槽是一行等距（槽宽 = width / 步数，槽与槽之间留 8px 缝）→ 横向 BoxLayout
    this.setLayout(new ICEBoxLayout({ axis: 'x', gap: 8 }));
    this.__render();
  }

  public getCurrent(): number {
    return this.current;
  }

  public setCurrent(current: number): this {
    const next = Math.min(Math.max(0, Math.floor(Number(current) || 0)), Math.max(0, this.items.length - 1));
    if (next === this.current) {
      return this;
    }
    this.current = next;
    this.__render();
    if (this.onChange) {
      this.onChange(next);
    }
    return this;
  }

  public getStepNode(index: number): ICEWidget | null {
    return this.stepNodes[index] || null;
  }

  /**
   * 尺寸变化时整段重排内部零件（`ICEWidget.__syncInternalLayout()`）。
   *
   * 本组件的内部构图（子项尺寸、居中偏移、断行/分栏）**本身就是宽高的函数**，
   * 所以按本库既有惯例直接重跑构造期那段 `__render()`；它内部用 `removeChildren` 重建，
   * 不会留下停在旧尺寸的零件（重建出来的子项由各自构造函数重新挂事件）。
   */
  protected __syncInternalLayout(): void {
    this.__render();
  }

  private __render(): void {
    const theme = iceUIManager.getTheme();
    this.removeChildren([...this.childNodes]);
    this.stepNodes = [];
    const width = Number(this.state.width) || 420;
    const count = Math.max(1, this.items.length);
    const slot = width / count;

    this.items.forEach((item, index) => {
      const finished = index < this.current;
      const active = index === this.current;
      const step = new ICEWidget({
        width: slot - 8,
        height: Number(this.state.height) || 62,
        fill: true,
        stroke: false,
        radius: theme.radius.sm,
        style: {
          fillStyle: active ? token('ui.colors.primaryBg') : 'rgba(0,0,0,0)',
        },
      });
      const circle = new ICEWidget({
        left: 0,
        top: 6,
        width: this.circleSize,
        height: this.circleSize,
        radius: this.circleSize / 2,
        fill: true,
        stroke: false,
        interactive: false,
        style: {
          fillStyle: finished ? token('ui.colors.primary') : active ? token('ui.colors.primary') : token('ui.colors.disabled'),
        },
      });
      circle.addChild(
        new ICELabel({
          interactive: false,
          left: 0,
          top: 0,
          width: this.circleSize,
          height: this.circleSize,
          align: 'center',
          verticalAlign: 'middle',
          text: finished ? '✓' : String(index + 1),
          style: {
            fontSize: 12,
            fontWeight: '600',
            fillStyle: token('ui.colors.primaryText'),
          },
        }),
        false,
      );
      step.addChild(circle, false);
      step.addChild(
        new ICELabel({
          interactive: false,
          left: this.circleSize + 8,
          top: 6,
          width: Math.max(0, slot - this.circleSize - 20),
          height: 20,
          verticalAlign: 'middle',
          text: item.title,
          style: {
            fontSize: 13,
            fontWeight: active ? '600' : '400',
            fillStyle: active ? token('ui.colors.primary') : token('ui.colors.text'),
          },
        }),
        false,
      );
      if (item.description) {
        step.addChild(
          new ICELabel({
            interactive: false,
            left: this.circleSize + 8,
            top: 26,
            width: Math.max(0, slot - this.circleSize - 20),
            height: 18,
            verticalAlign: 'middle',
            text: item.description,
            style: { fontSize: 12, fillStyle: token('ui.colors.textSecondary') },
          }),
          false,
        );
      }
      // 连接线（连到下一个步骤）
      if (index < count - 1) {
        step.addChild(
          new ICEWidget({
            left: this.circleSize + 4,
            top: 6 + this.circleSize / 2,
            width: Math.max(0, slot - this.circleSize - 12),
            height: 1,
            fill: true,
            stroke: false,
            interactive: false,
            style: { fillStyle: finished ? token('ui.colors.primary') : token('ui.colors.borderSecondary') },
          }),
          false,
        );
      }
      this.addChild(step, false);
      this.stepNodes.push(step);
    });
    if (this.ice && this.ice.dirty !== undefined) {
      this.ice.dirty = true;
    }
  }
}
