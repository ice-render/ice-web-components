import { ICEWidget } from '../core/ICEWidget';
import { iceUIManager } from '../core/ICEManager';
import { tween, ICETweenHandle } from '../util/ICEAnimation';

/**
 * 骨架屏：内容加载前的灰色占位。
 *
 * `active` 打开时整体做呼吸（opacity 0.55 ⇄ 1 循环），加载完成后 setActive(false) 并移除。
 */
export interface ICESkeletonOptions {
  /** 组件 id（引擎会用它做唯一标识，e2e/调试时可按 id 定位） */
  id?: string;
  rows?: number;
  /** 形态：`text`（默认，几行文字占位）/ `card` / `table` / `list` */
  variant?: 'text' | 'card' | 'table' | 'list';
  avatar?: boolean;
  title?: boolean;
  active?: boolean;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
}

export class ICESkeleton extends ICEWidget {
  private placeholders: ICEWidget[] = [];
  private active: boolean;
  private pulse: ICETweenHandle | null = null;
  private variant: 'text' | 'card' | 'table' | 'list';
  private rowCount = 0;
  private columnCount = 0;

  constructor(props: ICESkeletonOptions) {
    const theme = iceUIManager.getTheme();
    const width = props.width ?? 240;
    const variant = props.variant || 'text';
    const rows = Math.max(0, props.rows ?? 3);
    const avatar = props.avatar === true;
    const title = props.title === true;
    const avatarSize = 40;
    const titleHeight = title ? 20 : 0;
    const rowHeight = 14;
    const gap = 10;
    const contentLeft = avatar ? avatarSize + 12 : 0;
    const contentHeight = titleHeight + (title && rows ? gap : 0) + rows * rowHeight + Math.max(0, rows - 1) * gap;
    const defaultHeight =
      variant === 'card'
        ? 160
        : variant === 'table'
        ? 200
        : variant === 'list'
        ? 180
        : Math.max(avatar ? avatarSize : 0, contentHeight);
    const height = props.height ?? defaultHeight;
    super({
      id: props.id,
      fill: false, stroke: false, left: props.left, top: props.top, width, height ,
    });
    this.active = props.active === true;
    this.variant = variant;

    const bar = (left: number, top: number, w: number, h: number) => {
      const node = new ICEWidget({
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

    if (variant === 'card') {
      // 封面（上面 40%）+ 标题 + 两行文字
      bar(0, 0, width, Math.round(height * 0.4));
      const bodyTop = Math.round(height * 0.4) + 12;
      bar(0, bodyTop, Math.round(width * 0.55), 16);
      bar(0, bodyTop + 26, width, 12);
      bar(0, bodyTop + 46, Math.round(width * 0.7), 12);
      this.rowCount = 1;
      this.columnCount = 1;
      if (this.active) {
        this.__startPulse();
      }
      return;
    }
    if (variant === 'table') {
      const headerHeight = 24;
      const rowHeightValue = 18;
      const rowGap = 12;
      const columns = Math.min(4, Math.max(2, Math.floor(width / 120)));
      const columnWidth = (width - (columns - 1) * 8) / columns;
      for (let c = 0; c < columns; c += 1) {
        bar(c * (columnWidth + 8), 0, columnWidth, headerHeight);
      }
      const available = Math.max(0, height - headerHeight - rowGap);
      const rowCount = Math.max(1, Math.floor(available / (rowHeightValue + rowGap)));
      for (let r = 0; r < rowCount; r += 1) {
        const top = headerHeight + rowGap + r * (rowHeightValue + rowGap);
        if (top + rowHeightValue > height) break;
        for (let c = 0; c < columns; c += 1) {
          bar(c * (columnWidth + 8), top, columnWidth, rowHeightValue);
        }
      }
      this.rowCount = rowCount;
      this.columnCount = columns;
      if (this.active) {
        this.__startPulse();
      }
      return;
    }
    if (variant === 'list') {
      const itemHeight = 56;
      const avatarSizeValue = 36;
      const items = Math.max(1, Math.floor(height / itemHeight));
      for (let i = 0; i < items; i += 1) {
        const top = i * itemHeight;
        if (top + avatarSizeValue > height) break;
        const avatarNode = new ICEWidget({
          left: 0,
          top,
          width: avatarSizeValue,
          height: avatarSizeValue,
          radius: avatarSizeValue / 2,
          fill: true,
          stroke: false,
          interactive: false,
          style: { fillStyle: theme.colors.disabled },
        });
        this.addChild(avatarNode, false);
        this.placeholders.push(avatarNode);
        bar(avatarSizeValue + 12, top + 2, Math.round(width * 0.5), 14);
        bar(avatarSizeValue + 12, top + 24, Math.round(width * 0.7), 12);
      }
      this.rowCount = items;
      this.columnCount = 1;
      if (this.active) {
        this.__startPulse();
      }
      return;
    }

    if (avatar) {
      const avatarNode = new ICEWidget({
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

  public getVariant(): 'text' | 'card' | 'table' | 'list' {
    return this.variant;
  }

  /** 占位块总数（几何审计 / 测试用）。 */
  public getPlaceholderCount(): number {
    return this.placeholders.length;
  }

  public getRowCount(): number {
    return this.rowCount;
  }

  public getColumnCount(): number {
    return this.columnCount;
  }

  public isActive(): boolean {
    return this.active;
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
