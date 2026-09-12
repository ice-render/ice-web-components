import { UILabel } from './UILabel';
import { UIPanel } from './UIPanel';
import { UIComponent } from '../core/UIComponent';
import { UIScrollPane } from './UIScrollPane';
import { uiManager } from '../core/UIManager';
import { UISelectionModel, UISelectionMode } from '../model/UISelectionModel';

/**
 * 列表（Swing JList / 业界组件库 List 的最小版）。
 *
 * - 选择逻辑在 `UISelectionModel` 里（single 替换 / multiple 切换），组件只负责渲染与交互；
 * - 内容高于可视高度时自动套一层 `UIScrollPane`（复用 A2 的滚动底座与子树裁剪）；
 * - 交互：点击行选中（disabled 行忽略）；焦点在列表上时 ↑/↓ 移动激活行（跳过 disabled）、
 *   Enter/Space 选中激活行。
 */

export interface UIListItem {
  key: string;
  label: string;
  disabled?: boolean;
}

export interface UIListOptions {
  items: UIListItem[];
  mode?: UISelectionMode;
  value?: string[];
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  itemHeight?: number;
  onChange?: (keys: string[], item?: UIListItem) => void;
}

export class UIList extends UIComponent {
  private items: UIListItem[];
  private model: UISelectionModel;
  private itemHeight: number;
  private onChange: ((keys: string[], item?: UIListItem) => void) | null;
  private pane: UIScrollPane | null = null;
  private content: UIComponent;
  private rowNodes = new Map<string, UIComponent>();
  private activeIndex = -1;
  private running = false;

  constructor(props: UIListOptions) {
    const theme = uiManager.getTheme();
    const width = props.width ?? 200;
    const height = props.height ?? 160;
    super({
      fill: true,
      stroke: true,
      left: props.left,
      top: props.top,
      width,
      height,
      radius: theme.radius.md,
      style: {
        fillStyle: theme.colors.surface,
        strokeStyle: theme.colors.border,
        lineWidth: theme.control.lineWidth,
      },
    });
    this.items = (props.items || []).slice();
    this.itemHeight = props.itemHeight ?? 34;
    this.onChange = typeof props.onChange === 'function' ? props.onChange : null;
    this.model = new UISelectionModel({ mode: props.mode || 'single', selected: props.value || [] });
    this.model.addChangeListener(() => this.__syncRows());
    this.content = new UIComponent({ left: 0, top: 0, width: width - 8, height: this.items.length * this.itemHeight });
    this.focusable = true;
    this.__render();
  }

  protected afterAddHandler(): void {
    super.afterAddHandler();
    if (!this.running && this.ice && this.ice.evtBus && typeof this.ice.evtBus.on === 'function') {
      this.ice.evtBus.on('keydown', this.__onKeyDown, this);
      this.running = true;
    }
  }

  public getSelectedKeys(): string[] {
    return this.model.getSelectedKeys();
  }

  public setSelectedKeys(keys: string[]): this {
    this.model.setSelected(keys);
    return this;
  }

  public getSelectionModel(): UISelectionModel {
    return this.model;
  }

  public getActiveIndex(): number {
    return this.activeIndex;
  }

  public getRowNode(key: string): UIComponent | null {
    return this.rowNodes.get(key) || null;
  }

  public getScrollPane(): UIScrollPane | null {
    return this.pane;
  }

  public getItems(): UIListItem[] {
    return this.items.slice();
  }

  public setItems(items: UIListItem[]): this {
    this.items = (items || []).slice();
    this.activeIndex = -1;
    this.model.setSelected([]);
    this.__render();
    return this;
  }

  /** 焦点在列表上时才处理方向键/Enter（避免抢走页面按键）。 */
  private __onKeyDown(evt: any): void {
    if (!this.isFocused() || !this.items.length) {
      return;
    }
    const raw = evt && (evt.originalEvent || evt);
    const key = raw && (raw.key || raw.code);
    if (key === 'ArrowDown' || key === 'ArrowUp') {
      this.__moveActive(key === 'ArrowDown' ? 1 : -1);
      return;
    }
    if (key === 'Enter' || key === ' ') {
      const item = this.items[this.activeIndex];
      if (item && !item.disabled) {
        this.__pick(item);
      }
    }
  }

  private __moveActive(step: number): void {
    const count = this.items.length;
    let index = this.activeIndex;
    for (let i = 0; i < count; i++) {
      index = (index + step + count) % count;
      if (!this.items[index].disabled) {
        this.activeIndex = index;
        this.__syncRows();
        return;
      }
    }
  }

  private __pick(item: UIListItem): void {
    if (item.disabled) {
      return;
    }
    const before = this.model.getSelectedKeys();
    this.model.toggle(item.key);
    if (this.model.getMode() === 'single' && before[0] === item.key) {
      // single 模式下重复点同一项：保持选中（模型无变化，不触发回调）
      return;
    }
    if (this.onChange) {
      this.onChange(this.model.getSelectedKeys(), item);
    }
  }

  private __render(): void {
    this.removeChildren([...this.childNodes]);
    this.pane = null;
    const width = Number(this.state.width) || 200;
    const height = Number(this.state.height) || 160;
    const contentHeight = this.items.length * this.itemHeight;
    const needScroll = contentHeight > height;
    const hostWidth = width - 2;

    this.content.setState({ width: hostWidth - (needScroll ? 10 : 0), height: contentHeight });
    this.__syncRows();

    if (needScroll) {
      const pane = new UIScrollPane({
        left: 1,
        top: 1,
        width: hostWidth,
        height: height - 2,
        scrollbar: true,
        style: { fillStyle: 'rgba(0,0,0,0)', strokeStyle: 'rgba(0,0,0,0)' },
      });
      pane.setContent(this.content);
      pane.setContentSize(Number(this.content.state.width), contentHeight);
      this.addChild(pane, false);
      this.pane = pane;
    } else {
      this.addChild(this.content, false);
    }
    if (this.ice && this.ice.dirty !== undefined) {
      this.ice.dirty = true;
    }
  }

  /** 重建行（选中态 / 激活态 / 禁用态）。 */
  private __syncRows(): void {
    const theme = uiManager.getTheme();
    const width = Number(this.content.state.width) || 180;
    this.content.removeChildren([...this.content.childNodes]);
    this.rowNodes.clear();

    this.items.forEach((item, index) => {
      const selected = this.model.isSelected(item.key);
      const active = index === this.activeIndex;
      const row = new UIComponent({
        left: 4,
        top: index * this.itemHeight,
        width: width - 8,
        height: this.itemHeight,
        radius: theme.radius.sm,
        fill: true,
        stroke: false,
        interactive: !item.disabled,
        style: {
          fillStyle: selected ? theme.colors.primaryBg : active ? theme.colors.background : 'rgba(0,0,0,0)',
        },
      });
      row.addChild(
        new UILabel({
          interactive: false,
          left: 10,
          top: 0,
          height: this.itemHeight,
          verticalAlign: 'middle',
          text: item.label,
          style: {
            fontSize: 13,
            fillStyle: item.disabled
              ? theme.colors.textDisabled
              : selected
              ? theme.colors.primary
              : theme.colors.text,
          },
        }),
        false,
      );
      if (!item.disabled) {
        row.on('click', () => this.__pick(item));
      }
      this.content.addChild(row, false);
      this.rowNodes.set(item.key, row);
    });
    if (this.ice && this.ice.dirty !== undefined) {
      this.ice.dirty = true;
    }
  }
}
