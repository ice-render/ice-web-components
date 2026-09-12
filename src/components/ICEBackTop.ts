import { ICEWidget } from '../core/ICEWidget';
import { iceUIManager } from '../core/ICEManager';
import { centerTextNode } from '../util/ICEStyle';

/**
 * 回到顶部（业界组件库 BackTop）：一个小圆按钮，滚动超过阈值才出现。
 *
 * 用法是把滚动容器交给它：`new ICEBackTop({ target: scrollPane })`。
 * 依赖 `ICEScrollPane` 的 `scroll` 事件（滚动位置变化时派发），
 * 点击后把目标滚回 `(0, 0)` 并回调 `onClick`。
 */
export interface ICEBackTopOptions {
  /** 组件 id（引擎会用它做唯一标识，e2e/调试时可按 id 定位） */
  id?: string;
  /** 跟随的滚动容器（实现 getScroll / setScroll / on('scroll') 即可） */
  target: any;
  /** 超过多少滚动量才出现，默认 200 */
  visibilityHeight?: number;
  /** 圆按钮直径，默认 36 */
  size?: number;
  /** 图标字形，默认 ↑ */
  icon?: string;
  left?: number;
  top?: number;
  onClick?: () => void;
}

export class ICEBackTop extends ICEWidget {
  private target: any;
  private visibilityHeight: number;
  private visible = false;
  private onClick: (() => void) | null;
  private iconNode: any;

  constructor(props: ICEBackTopOptions) {
    const theme = iceUIManager.getTheme();
    const size = props.size ?? 36;
    super({
      id: props.id,
      fill: true,
      stroke: false,
      radius: size / 2,
      interactive: true,
      left: props.left,
      top: props.top,
      width: size,
      height: size,
      opacity: 0,
      style: {
        fillStyle: theme.colors.primary,
        ...theme.shadows.md,
      },
    });
    this.focusable = true;
    this.target = props.target || null;
    this.visibilityHeight = Number(props.visibilityHeight) || 200;
    this.onClick = typeof props.onClick === 'function' ? props.onClick : null;
    this.iconNode = centerTextNode(props.icon ?? '↑', theme, size, size, {
      fontSize: Math.round(size * 0.5),
      fillStyle: theme.colors.primaryText,
    });
    this.addChild(this.iconNode, false);
    this.on('click', () => this.__click());
    if (this.target && typeof this.target.on === 'function') {
      this.target.on('scroll', () => this.__syncVisibility(), this);
    }
    this.__syncVisibility();
  }

  public isVisible(): boolean {
    return this.visible;
  }

  /** 当前按钮底色（悬停态取主色 hover）。 */
  public getButtonColor(): string {
    return String(this.state.style.fillStyle);
  }

  public setTarget(target: any): this {
    this.target = target || null;
    this.__syncVisibility();
    return this;
  }

  protected __applyHoverState(): void {
    const theme = iceUIManager.getTheme();
    this.setState({
      style: {
        ...this.state.style,
        fillStyle: this.hovered ? theme.colors.primaryHover : theme.colors.primary,
      },
    });
    this.revalidate();
  }

  /** 可见时才动手：隐藏状态下点击（或键盘激活）应当是空操作。 */
  private __click(): void {
    if (!this.visible || !this.enabled) {
      return;
    }
    if (this.target && typeof this.target.setScroll === 'function') {
      this.target.setScroll(0, 0);
    }
    if (this.onClick) {
      this.onClick();
    }
    this.__syncVisibility();
  }

  private __syncVisibility(): void {
    const scroll = this.target && typeof this.target.getScroll === 'function' ? this.target.getScroll() : [0, 0];
    const y = Number(scroll && scroll[1]) || 0;
    const next = y > this.visibilityHeight;
    if (next === this.visible) {
      return;
    }
    this.visible = next;
    this.setState({ opacity: next ? 1 : 0 });
    this.revalidate();
  }
}
