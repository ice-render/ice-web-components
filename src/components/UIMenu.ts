import { UIComponent } from '../core/UIComponent';
import { UIContainer } from '../core/UIContainer';
import { uiManager } from '../core/UIManager';
import { createTextNode } from '../util/UIStyle';
import { UISvgIcon } from './UISvgIcon';

export type UIMenuItem = {
  key: string;
  label: string;
  icon?: string;
  iconPath?: string;
};

export class UIMenu extends UIContainer {
  private items: UIMenuItem[];
  private itemPanels: any[] = [];
  private itemIcons: any[] = [];
  private selectedKey: string | null;
  private itemHeight: number;
  private onSelect: ((item: UIMenuItem, index: number) => void) | null;
  private __bound = false;

  constructor(props: any = {}) {
    const theme = uiManager.getTheme();
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
    if (index >= 0 && index < this.items.length) {
      this.selectedKey = this.items[index].key;
      this.__syncSelection();
      if (this.onSelect) {
        this.onSelect(this.items[index], index);
      }
    }
  }

  private __render(): void {
    this.removeChildren([...this.childNodes]);
    const theme = uiManager.getTheme();
    const width = Number(this.state.width) || 240;
    this.itemPanels = [];
    this.itemIcons = [];
    const inset = theme.spacing.xxs;

    this.items.forEach((item, index) => {
      const panel = new UIComponent({
        fill: true,
        stroke: false,
        width: width - inset * 2,
        height: this.itemHeight,
        left: inset,
        top: index * this.itemHeight,
        radius: theme.radius.md,
        style: {
          fillStyle: item.key === this.selectedKey ? theme.colors.primaryBg : 'rgba(0,0,0,0)',
        },
      });
      this.addChild(panel, false);
      this.itemPanels.push(panel);

      if (item.iconPath) {
        const icon = new UISvgIcon({
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
          width: Math.max(0, width - labelLeft - theme.spacing.sm),
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
    });
    this.__syncSelection();
  }

  private __syncSelection(): void {
    const theme = uiManager.getTheme();
    this.itemPanels.forEach((panel, index) => {
      const active = this.items[index].key === this.selectedKey;
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
