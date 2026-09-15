import { ICEWidget } from '../core/ICEWidget';
import { ICELabel } from './ICELabel';
import { iceUIManager } from '../core/ICEManager';
import { estimateTextWidth } from '../util/ICEStyle';
import { ICEBoxLayout } from 'ice-render';

/**
 * 锚点导航：一列锚点，点击滚到目标位置，滚动时自动高亮当前项。
 *
 * 与 `ICEScrollPane` 配合使用：`target` 传滚动容器，`items[].top` 是该段落在
 * **内容坐标系**里的纵向位置。滚动事件由 `ICEScrollPane` 的 `scroll` 事件驱动。
 */
export interface ICEAnchorItem {
  key: string;
  label: string;
  /** 目标位置（内容坐标系里的 y） */
  top: number;
}

export interface ICEAnchorOptions {
  /** 组件 id（引擎会用它做唯一标识，e2e/调试时可按 id 定位） */
  id?: string;
  /** 跟随的滚动容器 */
  target: any;
  items: ICEAnchorItem[];
  /** 初始活动项，默认第一项 */
  activeKey?: string;
  left?: number;
  top?: number;
  width?: number;
  itemHeight?: number;
  fontSize?: number;
  /** 用户点击 / 键盘切换锚点时的回调（滚动带出来的高亮不回调） */
  onChange?: (key: string) => void;
}

export class ICEAnchor extends ICEWidget {
  private target: any;
  private items: ICEAnchorItem[];
  private activeKey: string | null = null;
  private itemHeight: number;
  private fontSize: number;
  private onChange: ((key: string) => void) | null;
  private itemNodes: ICEWidget[] = [];
  private labelNodes: ICELabel[] = [];
  private barNodes: ICEWidget[] = [];
  private bound = false;
  /**
   * 点击锚点后由我们自己触发的那次滚动位置。
   *
   * 目标滚不到底时（最后一节下面没有内容了）滚动会被夹取，随后的 `scroll` 事件
   * 会把活动项算回「上一个够得着的锚点」—— 表现为「点了最后一个锚点，高亮又跳回去」。
   * 这里把这一次事件认出来并忽略，用户后续真正滚动时（位置不同）再恢复跟随。
   */
  private ignoreNextScroll = false;

  constructor(props: ICEAnchorOptions) {
    const theme = iceUIManager.getTheme();
    const itemHeight = props.itemHeight ?? 32;
    super({
      id: props.id,
      fill: false,
      stroke: false,
      left: props.left,
      top: props.top,
      width: props.width ?? 160,
      height: itemHeight * Math.max(1, (props.items || []).length),
    });
    this.focusable = true;
    this.target = props.target || null;
    this.items = (props.items || []).slice();
    this.itemHeight = itemHeight;
    this.fontSize = props.fontSize ?? theme.font.size;
    this.onChange = typeof props.onChange === 'function' ? props.onChange : null;
    this.activeKey = props.activeKey ?? (this.items[0] ? this.items[0].key : null);
    // 条目是一列等距行（行距 = itemHeight，无额外缝）→ 纵向 BoxLayout
    this.setLayout(new ICEBoxLayout({ axis: 'y', gap: 0 }));
    this.__render();
    if (this.target && typeof this.target.on === 'function') {
      this.target.on('scroll', () => this.__syncFromScroll(), this);
    }
  }

  public getActiveKey(): string | null {
    return this.activeKey;
  }

  public getLabelTexts(): string[] {
    return this.labelNodes.map((node) => node.getText());
  }

  public getItemNode(key: string): ICEWidget | null {
    const index = this.items.findIndex((item) => item.key === key);
    return index === -1 ? null : this.itemNodes[index];
  }

  public getLabelColor(key: string): string {
    const index = this.items.findIndex((item) => item.key === key);
    const label = index === -1 ? null : this.labelNodes[index];
    const textNode = label && label.childNodes[0];
    return textNode ? String(textNode.state.style.fillStyle) : '';
  }

  /** 程序式切换活动项（默认不滚动，传 scroll: true 才滚）。 */
  public setActiveKey(key: string, options: { scroll?: boolean } = {}): this {
    const index = this.items.findIndex((item) => item.key === key);
    if (index === -1) {
      return this;
    }
    this.activeKey = key;
    this.__syncActive();
    if (options.scroll && this.target && typeof this.target.setScroll === 'function') {
      this.target.setScroll(0, this.items[index].top);
    }
    return this;
  }

  public getItems(): ICEAnchorItem[] {
    return this.items.slice();
  }

  public setItems(items: ICEAnchorItem[]): this {
    this.items = (items || []).slice();
    this.activeKey = this.items[0] ? this.items[0].key : null;
    this.__render();
    return this;
  }

  protected afterAddHandler(): void {
    super.afterAddHandler();
    if (this.bound || !this.ice || !this.ice.evtBus) {
      return;
    }
    this.bound = true;
    this.ice.evtBus.on('keydown', this.__onKeyDown, this);
  }

  /** 键盘 ↑/↓：移动活动项并滚动过去。 */
  private __onKeyDown(evt: any): void {
    if (!this.ice || !this.enabled || !this.isFocused()) {
      return;
    }
    const raw = evt && (evt.originalEvent || evt);
    const key = raw && (raw.key || raw.code);
    const delta = key === 'ArrowDown' ? 1 : key === 'ArrowUp' ? -1 : 0;
    if (!delta) {
      return;
    }
    const index = this.items.findIndex((item) => item.key === this.activeKey);
    const next = Math.min(this.items.length - 1, Math.max(0, index + delta));
    if (next === index || !this.items[next]) {
      return;
    }
    this.__select(this.items[next], true);
  }

  /** 点击 / 键盘选中：滚动 + 回调。 */
  private __select(item: ICEAnchorItem, user: boolean): void {
    this.activeKey = item.key;
    this.__syncActive();
    if (this.target && typeof this.target.setScroll === 'function') {
      if (user) {
        // setScroll 是同步派发 scroll 的：先立标志，再滚（否则下面的同步逻辑会立刻把高亮算回去）
        this.ignoreNextScroll = true;
      }
      this.target.setScroll(0, item.top);
      if (user && this.ignoreNextScroll) {
        // 位置没变就不会派发 scroll 事件 → 别把这个标志留给下一次真实滚动
        this.ignoreNextScroll = false;
      }
    }
    if (user) {
      this.trigger('change', null, { key: item.key });
      if (this.onChange) {
        this.onChange(item.key);
      }
    }
    return;
  }

  /** 滚动带出来的高亮：取最后一个「已经越过」的锚点。 */
  private __syncFromScroll(): void {
    if (!this.target || typeof this.target.getScroll !== 'function' || !this.items.length) {
      return;
    }
    if (this.ignoreNextScroll) {
      this.ignoreNextScroll = false;
      return;
    }
    const y = Number(this.target.getScroll()[1]) || 0;
    let active = this.items[0].key;
    for (const item of this.items) {
      if (item.top <= y + 1) {
        active = item.key;
      }
    }
    if (active !== this.activeKey) {
      this.activeKey = active;
      this.__syncActive();
    }
  }

  private __syncActive(): void {
    const theme = iceUIManager.getTheme();
    this.items.forEach((item, index) => {
      const active = item.key === this.activeKey;
      const bar = this.barNodes[index];
      const label = this.labelNodes[index];
      if (bar) {
        bar.setState({ style: { ...bar.state.style, fillStyle: active ? theme.colors.primary : 'rgba(0,0,0,0)' } });
      }
      const textNode = label && label.childNodes[0];
      if (textNode) {
        textNode.setState({
          style: {
            ...textNode.state.style,
            fillStyle: active ? theme.colors.primary : theme.colors.textSecondary,
          },
        });
      }
    });
    this.revalidate();
    if (this.ice) {
      this.ice.dirty = true;
    }
  }

  private __render(): void {
    const theme = iceUIManager.getTheme();
    this.removeChildren([...this.childNodes]);
    this.itemNodes = [];
    this.labelNodes = [];
    this.barNodes = [];
    const width = Number(this.state.width) || 160;

    this.items.forEach((item, index) => {
      const row = new ICEWidget({
        width,
        height: this.itemHeight,
        fill: false,
        stroke: false,
        interactive: true,
        focusable: false,
      });
      // 活动项左侧竖条（非活动时透明，保持布局稳定）
      const bar = new ICEWidget({
        left: 0,
        top: 0,
        width: 2,
        height: this.itemHeight,
        fill: true,
        stroke: false,
        style: { fillStyle: 'rgba(0,0,0,0)' },
      });
      const label = new ICELabel({
        interactive: false,
        left: theme.spacing.sm,
        top: 0,
        width: Math.max(0, width - theme.spacing.sm),
        height: this.itemHeight,
        text: item.label,
        verticalAlign: 'middle',
        style: {
          fontSize: this.fontSize,
          fontFamily: theme.font.family,
          fillStyle: theme.colors.textSecondary,
        },
      });
      row.addChild(bar, false);
      row.addChild(label, false);
      row.on('click', () => this.__select(item, true));
      this.addChild(row, false);
      this.itemNodes.push(row);
      this.labelNodes.push(label);
      this.barNodes.push(bar);
    });
    this.state.height = this.itemHeight * Math.max(1, this.items.length);
    this.__syncActive();
  }
}
