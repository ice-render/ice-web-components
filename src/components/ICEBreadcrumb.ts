import { ICEWidget } from '../core/ICEWidget';
import { ICELabel } from './ICELabel';
import { iceUIManager } from '../core/ICEManager';
import { estimateTextWidth } from '../util/ICEStyle';
import { ICEFlowLayout } from 'ice-render';

/**
 * 面包屑：一行「路径 + 分隔符」，最后一项是当前页。
 *
 * - 宽度按内容自适应（中文按 1em 估算，不会把文字压出色块外）；
 * - 除最后一项外都可点击，点击触发 `navigate` 事件（载荷 `{ item, index }`）与 `onNavigate`；
 * - `maxItems` 超长时把中间项折叠成「…」，点击省略号展开（折叠语义：
 *   `maxItems` 只数真实项，省略号不占额度）。
 */
export interface ICEBreadcrumbItem {
  /** 业务键（可选，便于回调里定位） */
  key?: string;
  label: string;
  /** 业务路由（组件不自己跳转，交给 onNavigate 决定） */
  href?: string;
  disabled?: boolean;
}

export interface ICEBreadcrumbOptions {
  /** 组件 id（引擎会用它做唯一标识，e2e/调试时可按 id 定位） */
  id?: string;
  items: ICEBreadcrumbItem[];
  /** 分隔符，默认 `›` */
  separator?: string;
  /** 最多显示多少**真实项**（超过则中间折叠为省略号）；不传或 ≤ 0 表示不折叠 */
  maxItems?: number;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  fontSize?: number;
  /** 点击非当前项的回调（与 `navigate` 事件同义） */
  onNavigate?: (item: ICEBreadcrumbItem, index: number) => void;
}

type ICEDisplayedCrumb = { item: ICEBreadcrumbItem; index: number; ellipsis?: boolean };

/** 面包屑项：悬停时文字转主色（文字样式落在内层 ICEText 上）。 */
class ICEBreadcrumbItemNode extends ICEWidget {
  private label: ICELabel;
  private textNode: any;
  private restColor: string;
  private hoverColor: string;

  constructor(props: {
    /** 位置由父级（面包屑的流式布局）给；单独使用时可以显式传 */
    left?: number;
    top?: number;
    width: number;
    height: number;
    text: string;
    fontSize: number;
    fillStyle: string;
    fontWeight: string;
    clickable: boolean;
  }) {
    const theme = iceUIManager.getTheme();
    super({
      left: props.left,
      top: props.top,
      width: props.width,
      height: props.height,
      fill: false,
      stroke: false,
      interactive: props.clickable,
      focusable: false,
    });
    this.restColor = props.fillStyle;
    this.hoverColor = theme.colors.primary;
    // label 与节点同盒：verticalAlign:'middle' 是相对整行居中，而不是相对文字小盒
    this.label = new ICELabel({
      interactive: false,
      left: 0,
      top: 0,
      width: props.width,
      height: props.height,
      text: props.text,
      verticalAlign: 'middle',
      style: {
        fontSize: props.fontSize,
        fontFamily: theme.font.family,
        fontWeight: props.fontWeight,
        fillStyle: props.fillStyle,
      },
    });
    this.addChild(this.label, false);
    this.textNode = this.label.childNodes[0];
  }

  public getLabel(): ICELabel {
    return this.label;
  }

  public getText(): string {
    return this.label.getText();
  }

  protected __applyHoverState(): void {
    if (!this.textNode) {
      return;
    }
    this.textNode.setState({
      style: {
        ...this.textNode.state.style,
        fillStyle: this.hovered ? this.hoverColor : this.restColor,
      },
    });
    this.revalidate();
  }
}

export class ICEBreadcrumb extends ICEWidget {
  private items: ICEBreadcrumbItem[];
  private separator: string;
  private maxItems: number;
  private fontSize: number;
  private onNavigate: ((item: ICEBreadcrumbItem, index: number) => void) | null;
  /** 用户点过省略号：本次数据下不再自动折叠 */
  private userExpanded = false;
  private collapsed = false;
  private itemNodes: ICEBreadcrumbItemNode[] = [];
  /** 构造期是否给了宽度（决定重排时是否沿用「宽度自适应」口径，见 `__syncInternalLayout`） */
  private __adoptWidth = false;
  private separatorNodes: ICELabel[] = [];

  constructor(props: ICEBreadcrumbOptions) {
    const theme = iceUIManager.getTheme();
    super({
      id: props.id,
      fill: false,
      stroke: false,
      left: props.left,
      top: props.top,
      width: props.width ?? 100,
      height: props.height ?? 24,
    });
    this.items = (props.items || []).slice();
    this.separator = props.separator ?? '›';
    this.maxItems = Number(props.maxItems) || 0;
    this.fontSize = props.fontSize ?? theme.font.size;
    this.onNavigate = typeof props.onNavigate === 'function' ? props.onNavigate : null;
    // 一行「项 + 分隔符」按顺序排、间距 = theme.spacing.xs → 流式布局（行对齐 left）
    this.setLayout(new ICEFlowLayout({ gap: theme.spacing.xs, align: 'left', crossAlign: 'center' }));
    this.__adoptWidth = props.width !== undefined;
    this.__render(this.__adoptWidth);
  }

  /** 当前显示的标签（折叠时中间会多出一个 `…`）。 */
  public getLabelTexts(): string[] {
    return this.itemNodes.map((node) => node.getText());
  }

  public getItemNodes(): ICEBreadcrumbItemNode[] {
    return this.itemNodes.slice();
  }

  public getSeparatorNodes(): ICELabel[] {
    return this.separatorNodes.slice();
  }

  public getItems(): ICEBreadcrumbItem[] {
    return this.items.slice();
  }

  public isCollapsed(): boolean {
    return this.collapsed;
  }

  /** 展开被折叠的中间项。 */
  public expand(): this {
    if (!this.collapsed) {
      return this;
    }
    this.userExpanded = true;
    this.collapsed = false;
    this.__render(true);
    return this;
  }

  public setItems(items: ICEBreadcrumbItem[]): this {
    this.items = (items || []).slice();
    this.userExpanded = false;
    this.__render(true);
    return this;
  }

  /** 当前可见序列：真实项，或「首项 + 省略号 + 末尾 maxItems-1 项」。 */
  private __displayed(): ICEDisplayedCrumb[] {
    const items = this.items;
    const shouldCollapse = this.maxItems > 0 && items.length > this.maxItems && !this.userExpanded;
    if (!shouldCollapse) {
      return items.map((item, index) => ({ item, index }));
    }
    const tail = items.slice(items.length - (this.maxItems - 1));
    const tailStart = items.length - tail.length;
    this.collapsed = true;
    return [
      { item: items[0], index: 0 },
      { item: { label: '…' }, index: 1, ellipsis: true },
      ...tail.map((item, offset) => ({ item, index: tailStart + offset })),
    ];
  }

  /**
   * 尺寸变化时按新宽度重新排这一行（`ICEWidget.__syncInternalLayout()`）。
   *
   * 面包屑的项宽（文字实测宽 + 分隔符）是按字号算的固定值，**要不要在给定宽度之外补足**
   * 是构造期就定下的「宽度自适应」策略；重排时必须沿用同一个口径，否则会把父层刚设的
   * 宽度覆盖掉。`__render` 内部会 `removeChildren` 重建，项上的点击事件随之重挂。
   */
  protected __syncInternalLayout(): void {
    this.__render(this.__adoptWidth);
  }

  private __render(adoptWidth: boolean): void {
    const theme = iceUIManager.getTheme();
    this.removeChildren([...this.childNodes]);
    this.itemNodes = [];
    this.separatorNodes = [];
    this.collapsed = false;

    const displayed = this.__displayed();
    const height = Number(this.state.height) || 24;
    const gap = theme.spacing.xs;
    const separatorWidth = estimateTextWidth(this.separator, this.fontSize);
    let cursor = 0; // 只用于「内容总宽」这条组件级策略（宽度自适应），位置由布局器算

    displayed.forEach((entry, order) => {
      const isLastDisplayed = order === displayed.length - 1;
      const isCurrent = !entry.ellipsis && entry.index === this.items.length - 1 && isLastDisplayed;
      const disabled = !entry.ellipsis && !!entry.item.disabled;
      const text = String(entry.item.label ?? '');
      const width = estimateTextWidth(text, this.fontSize);
      const node = new ICEBreadcrumbItemNode({
        width,
        height,
        text,
        fontSize: this.fontSize,
        fillStyle: disabled
          ? theme.colors.textDisabled
          : isCurrent
            ? theme.colors.text
            : theme.colors.textSecondary,
        fontWeight: isCurrent ? theme.font.weightSemibold : theme.font.weightNormal,
        clickable: !isCurrent && !disabled,
      });
      if (entry.ellipsis) {
        node.on('click', () => this.expand());
        node.on('mousedown', () => this.expand());
      } else if (!isCurrent && !disabled) {
        node.on('click', () => this.__navigate(entry.item, entry.index));
        node.on('mousedown', () => this.__navigate(entry.item, entry.index));
      }
      this.addChild(node, false);
      this.itemNodes.push(node);
      cursor += width;

      if (!isLastDisplayed) {
        const separatorNode = new ICELabel({
          interactive: false,
          width: separatorWidth,
          height,
          text: this.separator,
          verticalAlign: 'middle',
          style: {
            fontSize: this.fontSize,
            fontFamily: theme.font.family,
            fillStyle: theme.colors.textTertiary,
          },
        });
        this.addChild(separatorNode, false);
        this.separatorNodes.push(separatorNode);
        cursor += gap * 2 + separatorWidth;
      }
    });

    // 宽度自适应：调用方给了 width 时取「内容宽 vs 给定宽」的较大值，文字永不压出色块
    this.state.width = adoptWidth ? Math.max(Number(this.state.width) || 0, cursor) : cursor;
    // 宽度是**这一趟算出来的**：上面的 addChild 已经按旧宽度排过一遍（宽度不够会把项折行），
    // 所以这里必须**立刻**再排一次；交给 `revalidate()`（下一帧）会先看到一帧错版。
    this.doLayout();
    this.revalidate();
    if (this.ice) {
      this.ice.dirty = true;
    }
  }

  private __navigate(item: ICEBreadcrumbItem, index: number): void {
    this.trigger('navigate', null, { item, index });
    if (this.onNavigate) {
      this.onNavigate(item, index);
    }
  }
}
