import { UIComponent } from '../core/UIComponent';
import { uiManager } from '../core/UIManager';
import { tween, UITweenHandle } from '../util/UIAnimation';

/**
 * 骨架屏：内容加载前的灰色占位。
 *
 * `active` 打开时整体做呼吸（opacity 0.55 ⇄ 1 循环），加载完成后 setActive(false) 并移除。
 */
export interface UISkeletonOptions {
  rows?: number;
  avatar?: boolean;
  title?: boolean;
  active?: boolean;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
}

export class UISkeleton extends UIComponent {
  private placeholders: UIComponent[] = [];
  private active: boolean;
  private pulse: UITweenHandle | null = null;

  constructor(props: UISkeletonOptions) {
    const theme = uiManager.getTheme();
    const width = props.width ?? 240;
    const rows = Math.max(0, props.rows ?? 3);
    const avatar = props.avatar === true;
    const title = props.title === true;
    const avatarSize = 40;
    const titleHeight = title ? 20 : 0;
    const rowHeight = 14;
    const gap = 10;
    const contentLeft = avatar ? avatarSize + 12 : 0;
    const contentHeight = titleHeight + (title && rows ? gap : 0) + rows * rowHeight + Math.max(0, rows - 1) * gap;
    const height = props.height ?? Math.max(avatar ? avatarSize : 0, contentHeight);
    super({ fill: false, stroke: false, left: props.left, top: props.top, width, height });
    this.active = props.active === true;

    const bar = (left: number, top: number, w: number, h: number) => {
      const node = new UIComponent({
        left,
        top,
        width: w,
        height: h,
        radius: 4,
        fill: true,
        stroke: false,
        interactive: false,
        style: { fillStyle: theme.colors.disabled },
      });
      this.addChild(node, false);
      this.placeholders.push(node);
    };

    if (avatar) {
      const avatarNode = new UIComponent({
        left: 0,
        top: 0,
        width: avatarSize,
        height: avatarSize,
        radius: avatarSize / 2,
        fill: true,
        stroke: false,
        interactive: false,
        style: { fillStyle: theme.colors.disabled },
      });
      this.addChild(avatarNode, false);
      this.placeholders.push(avatarNode);
    }
    if (title) {
      bar(contentLeft, 0, Math.min(width - contentLeft, Math.round(width * 0.4)), titleHeight);
    }
    for (let i = 0; i < rows; i++) {
      const top = titleHeight + (title ? gap : 0) + i * (rowHeight + gap);
      const w = i === rows - 1 ? Math.round((width - contentLeft) * 0.6) : width - contentLeft;
      bar(contentLeft, top, Math.max(24, w), rowHeight);
    }
    if (this.active) {
      this.__startPulse();
    }
  }

  public isActive(): boolean {
    return this.active;
  }

  public getPlaceholderCount(): number {
    return this.placeholders.length;
  }

  public setActive(active: boolean): this {
    const next = !!active;
    if (next === this.active) {
      return this;
    }
    this.active = next;
    if (next) {
      this.__startPulse();
    } else {
      this.__stopPulse();
      this.setState({ opacity: 1 });
    }
    return this;
  }

  private __startPulse(): void {
    if (this.pulse) {
      return;
    }
    const run = () => {
      this.pulse = tween({
        from: 0.55,
        to: 1,
        duration: 700,
        easing: 'easeInOut',
        onUpdate: (value) => this.setState({ opacity: value }),
        onFinish: () => {
          if (!this.active) {
            return;
          }
          this.pulse = tween({
            from: 1,
            to: 0.55,
            duration: 700,
            easing: 'easeInOut',
            onUpdate: (value) => this.setState({ opacity: value }),
            onFinish: () => {
              this.pulse = null;
              if (this.active) {
                run();
              }
            },
          });
        },
      });
    };
    run();
  }

  private __stopPulse(): void {
    if (this.pulse) {
      this.pulse.cancel();
      this.pulse = null;
    }
  }
}
