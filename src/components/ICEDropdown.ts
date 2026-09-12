import { ICELabel } from './ICELabel';
import { ICEPanel } from './ICEPanel';
import { ICEWidget } from '../core/ICEWidget';
import { iceUIManager } from '../core/ICEManager';
import { ICEOverlayManager, ICEOverlayHandle, getICEOverlayManager } from '../core/ICEOverlayManager';
import type { ICEOverlayPlacement } from '../util/ICEOverlayPosition';
import { estimateTextWidth } from '../util/ICEStyle';

/**
 * 下拉菜单：点击触发组件弹出选项列表。
 *
 * - 弹出/定位/点外关闭/Esc 全部复用 `ICEOverlayManager`；
 * - 菜单项支持 disabled 与选中态（primary + ✓）；点选回调 `onSelect(item, index)`；
 * - 键盘：↑/↓ 在可选项间移动（跳过 disabled、首尾回绕），Enter 选中并关闭。
 *   关闭状态下不响应方向键（避免抢走页面的按键）。
 */

export interface ICEDropdownItem {
  key: string;
  label: string;
  disabled?: boolean;
  danger?: boolean;
}

export interface ICEDropdownOptions {
  items: ICEDropdownItem[];
  selectedKey?: string;
  placement?: ICEOverlayPlacement;
  width?: number;
  itemHeight?: number;
  offset?: number;
  onSelect?: (item: ICEDropdownItem, index: number) => void;
  manager?: ICEOverlayManager;
}

export class ICEDropdown {
  private ice: any;
  private target: any;
  private options: ICEDropdownOptions;
  private manager: ICEOverlayManager;
  private handle: ICEOverlayHandle | null = null;
  private panel: ICEPanel | null = null;
  private itemNodes: ICEWidget[] = [];
  private items: ICEDropdownItem[];
  private selectedKey: string | null;
  private activeIndex = 0;
  private running = false;

  constructor(ice: any, target: any, options: ICEDropdownOptions) {
    this.ice = ice;
    this.target = target;
    this.options = options;
    this.manager = options.manager || getICEOverlayManager(ice);
    this.items = (options.items || []).slice();
    this.selectedKey = options.selectedKey ?? null;
  }

  public start(): this {
    if (this.running || !this.target || typeof this.target.on !== 'function') {
      return this;
    }
    this.target.on('click', this.__onTargetClick, this);
    if (this.ice && this.ice.evtBus && typeof this.ice.evtBus.on === 'function') {
      this.ice.evtBus.on('keydown', this.__onKeyDown, this);
    }
    this.running = true;
    return this;
  }

  public destroy(): this {
    if (!this.running) {
      return this;
    }
    if (typeof this.target.off === 'function') {
      this.target.off('click', this.__onTargetClick, this);
    }
    if (this.ice && this.ice.evtBus && typeof this.ice.evtBus.off === 'function') {
      this.ice.evtBus.off('keydown', this.__onKeyDown, this);
    }
    this.close();
    this.running = false;
    return this;
  }

  public isOpen(): boolean {
    return !!this.handle && this.handle.isOpen();
  }

  public getSelectedKey(): string | null {
    return this.selectedKey;
  }

  public setSelectedKey(key: string | null): this {
    this.selectedKey = key;
    if (this.isOpen()) {
      this.__buildMenu();
    }
    return this;
  }

  public getActiveIndex(): number {
    return this.activeIndex;
  }

  public getItemNode(index: number): ICEWidget | null {
    return this.itemNodes[index] || null;
  }

  public setItems(items: ICEDropdownItem[]): this {
    this.items = (items || []).slice();
    if (this.isOpen()) {
      this.__buildMenu();
    }
    return this;
  }

  public open(): this {
    if (this.isOpen()) {
      return this;
    }
    this.panel = this.__createPanel();
    // 激活项优先落在当前选中项上（更符合直觉），否则第一个可选项
    this.activeIndex = this.__initialActiveIndex();
    this.__buildMenu();
    this.handle = this.manager.open({
      anchor: this.target,
      content: this.panel,
      placement: this.options.placement || 'bottomLeft',
      offset: this.options.offset ?? 6,
      enterAnimation: 'scale',
      exitAnimation: 'fade',
      keyboardCaptured: true,
    });
    return this;
  }

  public close(): this {
    if (this.handle) {
      this.handle.close();
      this.handle = null;
    }
    this.panel = null;
    this.itemNodes = [];
    return this;
  }

  public toggle(): this {
    return this.isOpen() ? this.close() : this.open();
  }

  /** 键盘：↑/↓ 移动激活项（跳过 disabled），Enter 选中。 */
  private __onKeyDown(evt: any): void {
    if (!this.isOpen()) {
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
        this.__select(this.activeIndex);
      }
    }
  }

  private __moveActive(step: number): void {
    const count = this.items.length;
    if (!count) {
      return;
    }
    let index = this.activeIndex;
    for (let i = 0; i < count; i++) {
      index = (index + step + count) % count;
      if (!this.items[index].disabled) {
        this.activeIndex = index;
        this.__buildMenu();
        return;
      }
    }
  }

  private __initialActiveIndex(): number {
    const selectedIndex = this.items.findIndex((item) => item.key === this.selectedKey && !item.disabled);
    if (selectedIndex !== -1) {
      return selectedIndex;
    }
    const firstEnabled = this.items.findIndex((item) => !item.disabled);
    return firstEnabled === -1 ? 0 : firstEnabled;
  }

  private __onTargetClick(): void {
    this.toggle();
  }

  private __createPanel(): ICEPanel {
    const theme = iceUIManager.getTheme();
    // 面板宽度：调用方没指定时按最长标签估一下。画布文本没有裁剪，
    // 面板太窄会让长标签（尤其中文）直接溢出到色块外面。
    const natural = this.items.reduce(
      (max, item) => Math.max(max, estimateTextWidth(String(item.label ?? ''), 14) + 56),
      0,
    );
    const width = this.options.width ?? Math.min(360, Math.max(180, Math.round(natural)));
    const itemHeight = this.options.itemHeight ?? 34;
    const panel = new ICEPanel({
      width,
      height: this.items.length * itemHeight + 8,
      radius: theme.radius.md,
      style: { fillStyle: theme.colors.surface, strokeStyle: theme.colors.border, shadow: 'md' },
    });
    return panel;
  }

  /** 重建菜单项（选中态 / 激活态 / 禁用态都在这里落地）。 */
  private __buildMenu(): void {
    const panel = this.panel;
    if (!panel) {
      return;
    }
    const theme = iceUIManager.getTheme();
    panel.removeChildren([...panel.childNodes]);
    this.itemNodes = [];
    const width = Number(panel.state.width) || 180;
    const itemHeight = this.options.itemHeight ?? 34;

    this.items.forEach((item, index) => {
      const selected = item.key === this.selectedKey;
      const active = index === this.activeIndex;
      const row = new ICEWidget({
        left: 4,
        top: 4 + index * itemHeight,
        width: width - 8,
        height: itemHeight,
        radius: theme.radius.sm,
        fill: true,
        stroke: false,
        style: {
          fillStyle: selected ? theme.colors.primaryBg : active ? theme.colors.background : 'rgba(0,0,0,0)',
        },
      });
      row.setState({ interactive: !item.disabled });
      const color = item.disabled
        ? theme.colors.textDisabled
        : item.danger
        ? theme.colors.error
        : selected
        ? theme.colors.primary
        : theme.colors.text;
      row.addChild(
        new ICELabel({
          interactive: false,
          left: 12,
          top: 0,
          height: itemHeight,
          verticalAlign: 'middle',
          text: item.label,
          style: { fontSize: 13, fillStyle: color },
        }),
        false,
      );
      if (selected) {
        row.addChild(
          new ICELabel({
            interactive: false,
            left: width - 34,
            top: 0,
            width: 18,
            height: itemHeight,
            verticalAlign: 'middle',
            text: '✓',
            style: { fontSize: 12, fillStyle: theme.colors.primary },
          }),
          false,
        );
      }
      if (!item.disabled) {
        row.on('click', () => this.__select(index));
      }
      panel.addChild(row, false);
      this.itemNodes.push(row);
    });
    if (this.ice && this.ice.dirty !== undefined) {
      this.ice.dirty = true;
    }
  }

  private __select(index: number): void {
    const item = this.items[index];
    if (!item || item.disabled) {
      return;
    }
    this.selectedKey = item.key;
    this.close();
    if (this.options.onSelect) {
      this.options.onSelect(item, index);
    }
  }
}

/** 便捷绑定：`attachDropdown(ice, target, options)`。 */
export function attachDropdown(ice: any, target: any, options: ICEDropdownOptions): ICEDropdown {
  return new ICEDropdown(ice, target, options).start();
}
