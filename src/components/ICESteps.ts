import { ICELabel } from './ICELabel';
import { ICEComponent } from '../core/ICEComponent';
import { iceUIManager } from '../core/ICEManager';

/**
 * 步骤条（业界组件库 Steps）：横向序号 + 标题/描述 + 连接线，当前步骤高亮、已完成打勾。
 */
export interface ICEStepsItem {
  title: string;
  description?: string;
}

export interface ICEStepsOptions {
  items: ICEStepsItem[];
  current?: number;
  left?: number;
  top?: number;
  width?: number;
  circleSize?: number;
  onChange?: (current: number) => void;
}

export class ICESteps extends ICEComponent {
  private items: ICEStepsItem[];
  private current: number;
  private circleSize: number;
  private stepNodes: ICEComponent[] = [];
  private onChange: ((current: number) => void) | null;

  constructor(props: ICEStepsOptions) {
    const width = props.width ?? 420;
    const circleSize = props.circleSize ?? 28;
    super({
      fill: false,
      stroke: false,
      left: props.left,
      top: props.top,
      width,
      height: circleSize + 34,
    });
    this.items = (props.items || []).slice();
    this.current = Math.min(Math.max(0, Number(props.current) || 0), Math.max(0, this.items.length - 1));
    this.circleSize = circleSize;
    this.onChange = typeof props.onChange === 'function' ? props.onChange : null;
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

  public getStepNode(index: number): ICEComponent | null {
    return this.stepNodes[index] || null;
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
      const left = index * slot;
      const step = new ICEComponent({
        left,
        top: 0,
        width: slot - 8,
        height: Number(this.state.height) || 62,
        fill: true,
        stroke: false,
        radius: theme.radius.sm,
        style: {
          fillStyle: active ? theme.colors.primaryBg : 'rgba(0,0,0,0)',
        },
      });
      const circle = new ICEComponent({
        left: 0,
        top: 6,
        width: this.circleSize,
        height: this.circleSize,
        radius: this.circleSize / 2,
        fill: true,
        stroke: false,
        interactive: false,
        style: {
          fillStyle: finished ? theme.colors.primary : active ? theme.colors.primary : theme.colors.disabled,
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
            fillStyle: theme.colors.primaryText,
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
            fillStyle: active ? theme.colors.primary : theme.colors.text,
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
            style: { fontSize: 12, fillStyle: theme.colors.textSecondary },
          }),
          false,
        );
      }
      // 连接线（连到下一个步骤）
      if (index < count - 1) {
        step.addChild(
          new ICEComponent({
            left: this.circleSize + 4,
            top: 6 + this.circleSize / 2,
            width: Math.max(0, slot - this.circleSize - 12),
            height: 1,
            fill: true,
            stroke: false,
            interactive: false,
            style: { fillStyle: finished ? theme.colors.primary : theme.colors.borderSecondary },
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
