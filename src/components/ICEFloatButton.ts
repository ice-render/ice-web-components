import { ICEWidget } from '../core/ICEWidget';
import { iceUIManager } from '../core/ICEManager';
import { centerTextNode, resolvedStyleColor } from '../util/ICEStyle';
import { token } from 'ice-render';

/**
 * 悬浮操作按钮：一个圆形主按钮，点击展开一组子按钮。
 *
 * - 默认收起，子按钮 `display:false`（既不显示也不参与命中）；
 * - 展开后子按钮沿 `direction`（默认向上）依次排开；
 * - 点子按钮回调 `onItemClick(key)` 与子项自己的 `onClick`，并自动收起；
 * - `type: 'primary' | 'default'` 决定主按钮底色。
 */
export interface ICEFloatButtonItem {
  key: string;
  /** 图标字形（★ ✓ ⚙ …） */
  icon: string;
  label?: string;
  onClick?: () => void;
}

export interface ICEFloatButtonOptions {
  /** 组件 id（引擎会用它做唯一标识，e2e/调试时可按 id 定位） */
  id?: string;
  /** 主按钮图标，默认 ＋（展开时变 ×） */
  icon?: string;
  /** 展开后的图标，默认 × */
  expandedIcon?: string;
  size?: number;
  /** 与子按钮的间距，默认 8 */
  gap?: number;
  direction?: 'up' | 'down';
  type?: 'primary' | 'default';
  items?: ICEFloatButtonItem[];
  left?: number;
  top?: number;
  onClick?: () => void;
  onItemClick?: (key: string) => void;
}

export class ICEFloatButton extends ICEWidget {
  private items: ICEFloatButtonItem[];
  private itemNodes = new Map<string, ICEWidget>();
  private size: number;
  private gap: number;
  private direction: 'up' | 'down';
  private type: 'primary' | 'default';
  private expanded = false;
  private iconClosed: string;
  private iconExpanded: string;
  private iconNode: any;
  private onClick: (() => void) | null;
  private onItemClick: ((key: string) => void) | null;

  constructor(props: ICEFloatButtonOptions = {}) {
    const theme = iceUIManager.getTheme();
    const size = props.size ?? 44;
    super({
      id: props.id,
      fill: true,
      stroke: false,
      radius: size / 2,
      left: props.left,
      top: props.top,
      width: size,
      height: size,
      style: {
        fillStyle: props.type === 'default' ? theme.colors.surface : theme.colors.primary,
        strokeStyle: token('ui.colors.border'),
        ...theme.shadows.md,
      },
    });
    this.focusable = true;
    this.size = size;
    this.gap = props.gap ?? theme.spacing.sm;
    this.direction = props.direction === 'down' ? 'down' : 'up';
    this.type = props.type === 'default' ? 'default' : 'primary';
    this.items = (props.items || []).slice();
    this.iconClosed = props.icon ?? '＋';
    this.iconExpanded = props.expandedIcon ?? '×';
    this.onClick = typeof props.onClick === 'function' ? props.onClick : null;
    this.onItemClick = typeof props.onItemClick === 'function' ? props.onItemClick : null;
    this.iconNode = centerTextNode(this.iconClosed, theme, size, size, {
      fontSize: Math.round(size * 0.42),
      fillStyle: this.__iconColor(),
    });
    this.addChild(this.iconNode, false);
    this.__renderItems();
    this.on('click', () => this.toggle());
  }

  public isExpanded(): boolean {
    return this.expanded;
  }

  public getItemNode(key: string): ICEWidget | null {
    return this.itemNodes.get(key) || null;
  }

  public getItems(): ICEFloatButtonItem[] {
    return this.items.slice();
  }

  public getButtonColor(): string {
    return resolvedStyleColor(this, 'fillStyle');
  }

  public expand(): this {
    if (this.expanded || !this.items.length) {
      return this;
    }
    this.expanded = true;
    this.__sync();
    return this;
  }

  public collapse(): this {
    if (!this.expanded) {
      return this;
    }
    this.expanded = false;
    this.__sync();
    return this;
  }

  public toggle(): this {
    if (this.expanded) {
      this.collapse();
    } else {
      this.expand();
    }
    if (this.onClick) {
      this.onClick();
    }
    return this;
  }

  /** @overwrite 键盘激活等价一次点击（展开 / 收起）。 */
  public activate(): void {
    if (!this.enabled) {
      return;
    }
    this.toggle();
  }

  protected __applyHoverState(): void {
    const theme = iceUIManager.getTheme();
    const base = this.type === 'default' ? theme.colors.surface : theme.colors.primary;
    const hover = this.type === 'default' ? theme.colors.background : theme.colors.primaryHover;
    this.setState({
      style: { ...this.state.style, fillStyle: this.hovered ? hover : base },
    });
    this.revalidate();
  }

  private __iconColor(): string {
    const theme = iceUIManager.getTheme();
    return this.type === 'default' ? theme.colors.text : theme.colors.primaryText;
  }

  /** 子按钮只建一次，显隐靠 display（引擎的不可见组件不参与命中）。 */
  private __renderItems(): void {
    const theme = iceUIManager.getTheme();
    this.itemNodes.clear();
    this.items.forEach((item, index) => {
      const distance = (index + 1) * (this.size + this.gap);
      const node = new ICEWidget({
        left: 0,
        top: this.direction === 'up' ? -distance : distance,
        width: this.size,
        height: this.size,
        fill: true,
        stroke: true,
        radius: this.size / 2,
        display: false,
        style: {
          fillStyle: token('ui.colors.elevated'),
          strokeStyle: token('ui.colors.border'),
          ...theme.shadows.sm,
        },
      });
      node.addChild(
        centerTextNode(item.icon, theme, this.size, this.size, {
          fontSize: Math.round(this.size * 0.4),
          fillStyle: token('ui.colors.text'),
        }),
        false,
      );
      node.on('click', () => {
        if (this.onItemClick) {
          this.onItemClick(item.key);
        }
        if (item.onClick) {
          item.onClick();
        }
        this.trigger('itemclick', null, { key: item.key });
        this.collapse();
      });
      this.addChild(node, false);
      this.itemNodes.set(item.key, node);
    });
  }

  private __sync(): void {
    this.itemNodes.forEach((node) => node.setState({ display: this.expanded }));
    this.iconNode.setText(this.expanded ? this.iconExpanded : this.iconClosed);
    this.revalidate();
    if (this.ice) {
      this.ice.dirty = true;
    }
  }
}
