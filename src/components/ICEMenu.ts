import { ICEWidget } from '../core/ICEWidget';
import { ICEContainer } from '../core/ICEContainer';
import { iceUIManager } from '../core/ICEManager';
import { createTextNode } from '../util/ICEStyle';
import { ICESvgIcon } from './ICESvgIcon';

export type ICEMenuItem = {
  key: string;
  label: string;
  icon?: string;
  iconPath?: string;
  /** 子菜单：带非空 children 的项是父节点（内联展开，点它不触发 onSelect） */
  children?: ICEMenuItem[];
};

export class ICEMenu extends ICEContainer {
  private items: ICEMenuItem[];
  /** 扁平化后的可见行（展开的父节点后紧跟其子项） */
  private rows: Array<{ item: ICEMenuItem; depth: number }> = [];
  private expanded = new Set<string>();
  private itemPanels: any[] = [];
  private itemNodes = new Map<string, any>();
  private itemIcons: any[] = [];
  private selectedKey: string | null;
  private itemHeight: number;
  private onSelect: ((item: ICEMenuItem, index: number) => void) | null;
  private __bound = false;

  constructor(props: any = {}) {
    const theme = iceUIManager.getTheme();
    const width = props.width || 240;
    const itemHeight = props.itemHeight || 40;
    const items = props.items || [];
    const height = itemHeight * items.length;

    super({
      ...props,
      fill: true,
      stroke: false,
      width,
      height,
      style: {
        fillStyle: theme.colors.surface,
        ...(props.style || {}),
      },
    });

    this.items = items;
    this.itemHeight = itemHeight;
    this.selectedKey = props.selectedKey ?? null;
    this.onSelect = typeof props.onSelect === 'function' ? props.onSelect : null;
    if (Array.isArray(props.defaultExpandedKeys)) {
      props.defaultExpandedKeys.forEach((key: string) => this.expanded.add(key));
    }
    this.__render();
  }

  public setSelectedKey(key: string | null): this {
    this.selectedKey = key;
    this.__syncSelection();
    return this;
  }

  public getSelectedKey(): string | null {
    return this.selectedKey;
  }

  /** 可见行（展开状态下的扁平列表）。 */
  public getVisibleItems(): ICEMenuItem[] {
    return this.rows.map((row) => row.item);
  }

  public getItemNode(key: string): any {
    return this.itemNodes.get(key) || null;
  }

  public isExpanded(key: string): boolean {
    return this.expanded.has(key);
  }

  public toggleExpand(key: string): this {
    if (this.expanded.has(key)) {
      this.expanded.delete(key);
    } else {
      this.expanded.add(key);
    }
    this.__render();
    return this;
  }

  public setExpandedKeys(keys: string[]): this {
    this.expanded = new Set(keys || []);
    this.__render();
    return this;
  }

  /** 激活某个可见项：父节点展开/收起，叶子项选中并回调。 */
  public activateItem(key: string): this {
    const row = this.rows.find((entry) => entry.item.key === key);
    if (!row) {
      return this;
    }
    if (this.__hasChildren(row.item)) {
      this.toggleExpand(key);
      return this;
    }
    this.selectedKey = key;
    this.__syncSelection();
    if (this.onSelect) {
      this.onSelect(row.item, this.rows.indexOf(row));
    }
    return this;
  }

  private __hasChildren(item: ICEMenuItem): boolean {
    return !!item.children && item.children.length > 0;
  }

  /** 按展开状态把树拍平。 */
  private __flatten(items: ICEMenuItem[], depth: number, out: Array<{ item: ICEMenuItem; depth: number }>): void {
    items.forEach((item) => {
      out.push({ item, depth });
      if (this.__hasChildren(item) && this.expanded.has(item.key)) {
        this.__flatten(item.children as ICEMenuItem[], depth + 1, out);
      }
    });
  }

  protected afterAddHandler(): void {
    super.afterAddHandler();
    this.__bindGlobalEvents();
  }

  private __bindGlobalEvents(): void {
    if (this.__bound || !this.ice || !this.ice.evtBus) {
      return;
    }
    this.__bound = true;
    this.ice.evtBus.on('mousedown', this.__onGlobalMouseDown, this);
  }

  private __onGlobalMouseDown(evt: any): void {
    if (!evt || typeof evt.offsetX !== 'number' || typeof evt.offsetY !== 'number') {
      return;
    }
    const [wx, wy] = this.ice.screenToWorld(evt.offsetX, evt.offsetY);
    const box = this.getMinBoundingBox(true);
    if (wx < box.tl[0] || wx > box.br[0] || wy < box.tl[1] || wy > box.br[1]) {
      return;
    }
    const index = Math.floor((wy - box.tl[1]) / this.itemHeight);
    if (index >= 0 && index < this.rows.length) {
      this.activateItem(this.rows[index].item.key);
    }
  }

  private __render(): void {
    this.removeChildren([...this.childNodes]);
    const theme = iceUIManager.getTheme();
    const width = Number(this.state.width) || 240;
    this.itemPanels = [];
    this.itemIcons = [];
    this.itemNodes = new Map();
    const inset = theme.spacing.xxs;
    this.rows = [];
    this.__flatten(this.items, 0, this.rows);
    this.setState({ height: this.rows.length * this.itemHeight });

    this.rows.forEach((row, index) => {
      const item = row.item;
      const indent = row.depth * theme.spacing.md;
      const panel = new ICEWidget({
        fill: true,
        stroke: false,
        width: Math.max(0, width - inset * 2 - indent),
        height: this.itemHeight,
        left: inset + indent,
        top: index * this.itemHeight,
        radius: theme.radius.md,
        style: {
          fillStyle: item.key === this.selectedKey ? theme.colors.primaryBg : 'rgba(0,0,0,0)',
        },
      });
      this.addChild(panel, false);
      this.itemPanels.push(panel);
      this.itemNodes.set(item.key, panel);

      if (item.iconPath) {
        const icon = new ICESvgIcon({
          left: theme.spacing.md,
          top: Math.round((this.itemHeight - 18) / 2),
          size: 18,
          d: item.iconPath,
          color: item.key === this.selectedKey ? theme.colors.primary : theme.colors.textSecondary,
          strokeWidth: 1.6,
        });
        panel.addChild(icon, false);
        this.itemIcons.push(icon);
      } else if (item.icon) {
        panel.addChild(
          createTextNode({
            left: theme.spacing.md,
            top: 0,
            width: 24,
            height: this.itemHeight,
            text: item.icon,
            fillStyle: item.key === this.selectedKey ? theme.colors.primary : theme.colors.textSecondary,
            fontFamily: theme.font.family,
            fontSize: theme.font.sizeLarge,
            fontWeight: theme.font.weightNormal,
            align: 'center',
            verticalAlign: 'middle',
          }),
          false,
        );
        this.itemIcons.push(null);
      } else {
        this.itemIcons.push(null);
      }

      const labelLeft = item.icon || item.iconPath ? theme.spacing.xl + 8 : theme.spacing.md;
      panel.addChild(
        createTextNode({
          left: labelLeft,
          top: 0,
          width: Math.max(0, width - labelLeft - theme.spacing.sm - indent),
          height: this.itemHeight,
          text: item.label,
          fillStyle: item.key === this.selectedKey ? theme.colors.primary : theme.colors.text,
          fontFamily: theme.font.family,
          fontSize: theme.font.size,
          fontWeight: item.key === this.selectedKey ? theme.font.weightSemibold : theme.font.weightNormal,
          align: 'left',
          verticalAlign: 'middle',
        }),
        false,
      );
      // 父节点右侧的展开指示：收起 › / 展开 ⌄
      if (this.__hasChildren(item)) {
        panel.addChild(
          createTextNode({
            left: Math.max(0, width - indent - theme.spacing.md - 14),
            top: 0,
            width: 14,
            height: this.itemHeight,
            text: this.expanded.has(item.key) ? '⌄' : '›',
            fillStyle: theme.colors.textTertiary,
            fontFamily: theme.font.family,
            fontSize: theme.font.size,
            align: 'center',
            verticalAlign: 'middle',
          }),
          false,
        );
      }
    });
    this.__syncSelection();
  }

  private __syncSelection(): void {
    const theme = iceUIManager.getTheme();
    this.itemPanels.forEach((panel, index) => {
      const active = this.rows[index] && this.rows[index].item.key === this.selectedKey;
      panel.setState({
        style: {
          fillStyle: active ? theme.colors.primaryBg : 'rgba(0,0,0,0)',
        },
      });
      (panel.childNodes || []).forEach((label: any) => {
        label.setState({
          style: {
            ...label.state.style,
            fillStyle: active ? theme.colors.primary : theme.colors.text,
          },
        });
      });
      const icon = this.itemIcons[index];
      if (icon && typeof icon.setColor === 'function') {
        icon.setColor(active ? theme.colors.primary : theme.colors.textSecondary);
      }
    });
    this.revalidate();
  }
}
