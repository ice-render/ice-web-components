import { ICEWidget } from '../core/ICEWidget';
import { ICELayoutManager } from 'ice-render';
import { ICEContainer } from '../core/ICEContainer';
import { iceUIManager } from '../core/ICEManager';
import { createTextNode, readHovered } from '../util/ICEStyle';
import { estimateTextWidth } from '../util/ICEStyle';
import { ICESvgIcon } from './ICESvgIcon';
import { ICEPanel } from './ICEPanel';
import { getICEOverlayManager } from '../core/ICEOverlayManager';
import { tween, resolveICEAnimationDuration } from '../util/ICEAnimation';

export type ICEMenuItem = {
  key: string;
  label: string;
  icon?: string;
  iconPath?: string;
  /** 子菜单：带非空 children 的项是父节点（内联展开，点它不触发 onSelect） */
  children?: ICEMenuItem[];
  /** 禁用项：键盘会跳过它，鼠标点击也不响应 */
  disabled?: boolean;
};

/**
 * 菜单：菜单项 +（可选）子菜单内联展开；选中态与悬停态分离，父项在子项选中时只做“当前分组”提示。
 */
/**
 * 菜单行的自持策略（2026-09-15）。
 *
 * 库里最后一个手写坐标的容器。三种形态都在这里摆位：
 * - `tree`：树形竖排，缩进 = `depth × depthIndent`（展开/收起的子行也在这里排）；
 * - `flat-vertical`：收起态（侧栏只剩图标）竖排，整条宽度 = 图标宽；
 * - `flat-horizontal`：顶栏横排，按各段宽度依次推进（段间 4px）。
 *
 * 展开/收起**动画只改 `transform.translate`**（不动 left/top），所以布局跑多少次都不会把动画弹回去 —
 * 这也是本次先把动画从写 `top` 改成写 translate 的原因。
 */
class ICEMenuLayout extends ICELayoutManager {
  layoutContainer(container: any): void {
    const menu = container as ICEMenu;
    const input = menu.__getMenuLayoutInput();
    const { layoutMode, rows, itemHeight, inset, depthIndent, itemWidth } = input;
    // 用 childNodes 而不是 itemPanels：`addChild` 会**立刻**触发一次布局，
    // 而调用方是在 addChild 之后才把面板记进 itemPanels —— 用 itemPanels 会永远漏掉最后一行。
    const panels: any[] = container.childNodes;

    if (layoutMode === 'flat-horizontal') {
      let left = 0;
      panels.forEach((panel: any) => {
        panel.setState({ left, top: 2, width: itemWidth, height: itemHeight });
        left += itemWidth + 4;
      });
      return;
    }

    if (layoutMode === 'flat-vertical') {
      panels.forEach((panel: any, index: number) => {
        panel.setState({ left: inset, top: index * itemHeight, width: itemWidth, height: itemHeight });
      });
      return;
    }

    // tree：按扁平化后的每一行摆（缩进按 depth）
    const width = Number(container.state.width) || 240;
    rows.forEach((row: any, index: number) => {
      const panel = panels[index];
      if (!panel) return;
      const indent = row.depth * depthIndent;
      panel.setState({
        left: inset + indent,
        top: index * itemHeight,
        width: Math.max(0, width - inset * 2 - indent),
        height: itemHeight,
      });
    });
  }

  /** 序列化参数：菜单几何由形态与尺寸决定，策略本身无参。 */
  public toJSON(): any {
    return {};
  }
}

export class ICEMenu extends ICEContainer {
  private items: ICEMenuItem[];
  /** 扁平化后的可见行（展开的父节点后紧跟其子项） */
  private rows: Array<{ item: ICEMenuItem; depth: number }> = [];
  /** 鼠标悬停的项（仅视觉反馈，不影响选中） */
  private hoverKey: string | null = null;
  private expanded = new Set<string>();
  private itemPanels: any[] = [];
  private itemNodes = new Map<string, any>();
  private itemIcons: any[] = [];
  private selectedKey: string | null;
  private itemHeight: number;
  private onSelect: ((item: ICEMenuItem, index: number) => void) | null;
  /**
   * 父项展开 / 收起时的回调。
   *
   * 点父项**只展开、不触发 onSelect**（这是设计），于是"点了父项想做点什么"（跳页面、给个提示）
   * 就缺一个时机 —— 应用层用这个回调补上。（ice-smart-water 的侧栏就靠它在点「运行工况」时
   * 跳到工艺流程图并提示"请选择具体工况"。）
   */
  private onExpand: ((key: string, expanded: boolean) => void) | null;
  private mode: 'vertical' | 'horizontal';
  private collapsed = false;
  private collapsedWidth: number;
  private expandedWidth: number;
  private submenu: { key: string; panel: any; handle: any; nodes: Map<string, any> } | null = null;
  /** 当前画出来的项（横向 / 收起态只有顶层 + 子菜单项） */
  private itemNodesKeys: string[] = [];
  /** 键盘激活项（与「选中」「悬停」三态分离） */
  private activeKey: string | null = null;
  /** 折叠动画时长（0 = 立即展开，老行为）；展开中记下哪些 key 在动 */
  private expandAnimation = 0;
  private animatingKeys = new Set<string>();
  private __bound = false;
  /** 当前渲染形态（决定策略怎么摆行）：tree / flat-vertical / flat-horizontal */
  private __layoutMode: 'tree' | 'flat-vertical' | 'flat-horizontal' = 'tree';
  /** 平铺形态下每段的宽度（由 __renderFlat 算出） */
  private __flatItemWidth = 0;

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
    this.mode = props.mode === 'horizontal' ? 'horizontal' : 'vertical';
    this.collapsed = props.collapsed === true;
    this.expandedWidth = width;
    this.collapsedWidth = Math.max(40, Math.floor(Number(props.collapsedWidth) || 56));
    this.expandAnimation = Math.max(0, Math.floor(Number(props.expandAnimation) || 0));
    // 行摆位交给自持策略（见 ICEMenuLayout 的说明）
    this.setLayout(new ICEMenuLayout());
    if (this.collapsed) {
      this.setState({ width: this.collapsedWidth });
    }
    this.selectedKey = props.selectedKey ?? null;
    this.onSelect = typeof props.onSelect === 'function' ? props.onSelect : null;
    this.onExpand = typeof props.onExpand === 'function' ? props.onExpand : null;
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
    const wasExpanded = this.expanded.has(key);
    // 收起：先把子行「滑回父行」再重排（展开的那条路径见 __animateExpand）
    if (wasExpanded) {
      const animated = this.__animateCollapse(key);
      if (animated) {
        this.expanded.delete(key);
        if (this.onExpand) this.onExpand(key, false);
        return this;
      }
      this.expanded.delete(key);
      this.__render();
      if (this.onExpand) this.onExpand(key, false);
      return this;
    }
    this.expanded.add(key);
    this.__render();
    this.__animateExpand(key);
    if (this.onExpand) this.onExpand(key, true);
    return this;
  }

  /**
   * 收起动画：子行向上滑向父行并淡出，下方行同步上移；动画结束再真正重排。
   *
   * 返回 true 表示「已经在做动画了，调用方不要立刻重排」。
   */
  private __animateCollapse(key: string): boolean {
    const duration = resolveICEAnimationDuration(this.expandAnimation);
    if (duration <= 0) {
      return false;
    }
    const parentIndex = this.rows.findIndex((row) => row.item.key === key);
    if (parentIndex === -1) {
      return false;
    }
    const parentDepth = this.rows[parentIndex].depth;
    const parentTop = parentIndex * this.itemHeight;
    const children: Array<{ node: any; top: number }> = [];
    let collapsedHeight = 0;
    const below: Array<{ node: any; top: number }> = [];
    for (let index = parentIndex + 1; index < this.rows.length; index += 1) {
      const node = this.itemNodes.get(this.rows[index].item.key);
      if (!node) continue;
      if (this.rows[index].depth > parentDepth) {
        children.push({ node, top: index * this.itemHeight });
        collapsedHeight += this.itemHeight;
      } else {
        below.push({ node, top: index * this.itemHeight });
      }
    }
    if (!children.length || collapsedHeight <= 0) {
      return false;
    }
    this.animatingKeys.add(key);
    tween({
      from: 0,
      to: 1,
      duration,
      onUpdate: (progress: number) => {
        children.forEach((entry) => {
          this.__setTranslate(entry.node, (parentTop - entry.top) * progress, 1 - progress);
        });
        below.forEach((entry) => this.__setTranslate(entry.node, -collapsedHeight * progress));
      },
      onFinish: () => {
        this.animatingKeys.delete(key);
        // 动画演完再真正重排：此时子行已经「收」到父行上，视觉上没有跳变
        this.__render();
      },
    });
    return true;
  }



  public setExpandedKeys(keys: string[]): this {
    this.expanded = new Set(keys || []);
    this.__render();
    return this;
  }

  /** 激活某个可见项：父节点展开/收起，叶子项选中并回调。 */
  public activateItem(key: string): this {
    const row = this.rows.find((entry) => entry.item.key === key);
    if (!row || row.item.disabled) {
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

  /**
   * 展开动画：把刚露出来的子行从父行位置滑到自己的位置。
   *
   * 默认不动画（`expandAnimation: 0`，老行为）；开了「减少动效」也直接到位 ——
   * 时长统一走 `resolveICEAnimationDuration`。
   */
  private __animateExpand(key: string): void {
    const duration = resolveICEAnimationDuration(this.expandAnimation);
    if (duration <= 0 || !this.expanded.has(key)) {
      return;
    }
    const parentIndex = this.rows.findIndex((row) => row.item.key === key);
    if (parentIndex === -1) {
      return;
    }
    const parentTop = parentIndex * this.itemHeight;
    const children: Array<{ node: any; top: number }> = [];
    for (let index = parentIndex + 1; index < this.rows.length; index += 1) {
      const row = this.rows[index];
      if (row.depth <= this.rows[parentIndex].depth) {
        break;
      }
      const node = this.itemNodes.get(row.item.key);
      if (node) {
        children.push({ node, top: index * this.itemHeight });
      }
    }
    if (!children.length) {
      return;
    }
    this.animatingKeys.add(key);
    // 起点：子行已经排到自己的位置（布局摆的），用 translate 把它"拉回"父行位置
    children.forEach((entry) => {
      this.__setTranslate(entry.node, parentTop - entry.top, 0);
    });
    tween({
      from: 0,
      to: 1,
      duration,
      onUpdate: (progress: number) => {
        children.forEach((entry) => {
          this.__setTranslate(entry.node, (parentTop - entry.top) * (1 - progress), progress);
        });
      },
      onFinish: () => {
        children.forEach((entry) => this.__setTranslate(entry.node, 0, 1));
        this.animatingKeys.delete(key);
        if (this.ice) {
          this.ice.dirty = true;
        }
      },
    });
  }

  // ---------------------------------------------------------------- 形态 API

  public getMode(): 'vertical' | 'horizontal' {
    return this.mode;
  }

  public isCollapsed(): boolean {
    return this.collapsed;
  }

  /** 折叠动画时长（毫秒，0 = 立即展开）。 */
  public getExpandAnimation(): number {
    return this.expandAnimation;
  }

  public setExpandAnimation(duration: number): this {
    this.expandAnimation = Math.max(0, Math.floor(Number(duration) || 0));
    return this;
  }

  /** 某个父项正在做展开/收起动画吗。 */
  public isAnimating(key: string): boolean {
    return this.animatingKeys.has(key);
  }

  /** 某一项当前的盒子（动画中就是插值后的位置）。 */
  /**
   * 某一项的**视觉盒子**（含展开/收起动画的 `transform.translate` 位移）。
   *
   * 位置本身由 `ICEMenuLayout` 摆（`state.left/top`），动画只改 transform ——
   * 于是"动画期间查位置"拿到的仍是它当前画在哪（几何审计 / 测试口径不变）。
   */
  /** 自持策略需要的输入（形态 / 行 / 面板 / 尺寸口径）。 */
  public __getMenuLayoutInput(): {
    layoutMode: 'tree' | 'flat-vertical' | 'flat-horizontal';
    rows: Array<{ item: ICEMenuItem; depth: number }>;
    panels: any[];
    itemHeight: number;
    inset: number;
    depthIndent: number;
    itemWidth: number;
  } {
    const theme = iceUIManager.getTheme();
    return {
      layoutMode: this.__layoutMode,
      rows: this.rows,
      panels: this.itemPanels,
      itemHeight: this.itemHeight,
      inset: theme.spacing.xxs,
      depthIndent: theme.spacing.md,
      itemWidth: this.__flatItemWidth,
    };
  }

  public getItemBox(key: string): { left: number; top: number; width: number; height: number } | null {
    const node = this.itemNodes.get(key);
    if (!node) {
      return null;
    }
    return this.__visualBoxOf(node);
  }

  /** 视觉盒子：`state.left/top` 加上当前的 translate。 */
  private __visualBoxOf(node: any): { left: number; top: number; width: number; height: number } {
    const transform = (node.state && node.state.transform) || {};
    const translate = (transform.translate as number[]) || [0, 0];
    return {
      left: (Number(node.state.left) || 0) + (Number(translate[0]) || 0),
      top: (Number(node.state.top) || 0) + (Number(translate[1]) || 0),
      width: Number(node.state.width) || 0,
      height: Number(node.state.height) || 0,
    };
  }

  /** 只改动画位移（布局算出的 left/top 不动，避免布局与动画互相打架）。 */
  private __setTranslate(node: any, y: number, opacity?: number): void {
    const transform = { ...(node.state.transform || {}), translate: [0, y] };
    node.setState(opacity === undefined ? { transform } : { transform, opacity });
  }

  public setCollapsed(collapsed: boolean): this {
    const next = collapsed === true;
    if (next === this.collapsed) {
      return this;
    }
    this.collapsed = next;
    this.setState({ width: next ? this.collapsedWidth : this.expandedWidth });
    this.__render();
    return this;
  }

  /** 该项当前画没画文字（收起态只有图标）。 */
  public isLabelVisible(key: string): boolean {
    return !this.collapsed || this.mode === 'horizontal';
  }

  public hasIcon(key: string): boolean {
    const item = this.__findItem(this.items, key);
    return !!(item && (item.icon || item.iconPath));
  }

  /** 每个可见项的盒子（形态断言 / 几何审计用）。 */
  public getItemBoxes(): Array<{ key: string; left: number; top: number; width: number; height: number }> {
    return this.itemNodesKeys
      .map((key, index) => {
        const node = this.itemNodes.get(key);
        if (!node) return null;
        const box = this.__visualBoxOf(node);
        return { key, ...box };
      })
      .filter(Boolean) as Array<{ key: string; left: number; top: number; width: number; height: number }>;
  }

  // ---- 横向模式的子菜单浮层 ----

  public isSubmenuOpen(): boolean {
    return !!this.submenu && this.submenu.handle.isOpen();
  }

  public getSubmenuKey(): string | null {
    return this.submenu ? this.submenu.key : null;
  }

  /** 横向模式下父项上的指示符：收起 ⌄ / 展开 ⌃（没子菜单的项返回空串）。 */
  public getSubmenuIndicator(key: string): string {
    const item = this.__findItem(this.items, key);
    if (!item || !this.__hasChildren(item)) {
      return '';
    }
    return this.getSubmenuKey() === key ? '⌃' : '⌄';
  }

  public getSubmenuItemNode(key: string): any {
    return this.submenu ? this.submenu.nodes.get(key) || null : null;
  }

  public closeSubmenu(): this {
    if (this.submenu) {
      this.submenu.handle.close();
      this.submenu = null;
    }
    return this;
  }

  /** 打开某一项的子菜单浮层（横向模式的父项）。 */
  public openSubmenu(key: string): this {
    const item = this.__findItem(this.items, key);
    if (!item || !this.__hasChildren(item)) {
      return this;
    }
    this.closeSubmenu();
    const theme = iceUIManager.getTheme();
    const manager = getICEOverlayManager(this.ice);
    const anchor = this.itemNodes.get(key) || this;
    const width = Math.max(160, Number(this.state.width) || 160);
    const panel = new ICEPanel({
      width,
      height: (item.children as ICEMenuItem[]).length * this.itemHeight + 8,
      radius: theme.radius.md,
      style: { fillStyle: theme.colors.surface, strokeStyle: theme.colors.border, shadow: 'md' },
    });
    const nodes = new Map<string, any>();
    (item.children as ICEMenuItem[]).forEach((child, index) => {
      const row = new ICEWidget({
        left: 4,
        top: 4 + index * this.itemHeight,
        width: width - 8,
        height: this.itemHeight,
        radius: theme.radius.sm,
        fill: true,
        stroke: false,
        style: { fillStyle: child.key === this.selectedKey ? theme.colors.primaryBg : 'rgba(0,0,0,0)' },
      });
      row.addChild(
        createTextNode({
          left: theme.spacing.md,
          top: 0,
          width: width - theme.spacing.md * 2,
          height: this.itemHeight,
          text: child.label,
          fillStyle: child.key === this.selectedKey ? theme.colors.primary : theme.colors.text,
          fontFamily: theme.font.family,
          fontSize: theme.font.size,
          fontWeight: theme.font.weightNormal,
          align: 'left',
          verticalAlign: 'middle',
        }),
        false,
      );
      row.on(
        'click',
        () => {
          this.activateItem(child.key);
          this.closeSubmenu();
        },
        this,
      );
      panel.addChild(row, false);
      nodes.set(child.key, row);
    });
    const handle = manager.open({
      anchor,
      content: panel,
      placement: 'bottomLeft',
      offset: 2,
      enterAnimation: 'fade',
      exitAnimation: 'none',
      closeOnOutsideClick: true,
      onClose: () => {
        if (this.submenu && this.submenu.panel === panel) {
          this.submenu = null;
        }
      },
    });
    this.submenu = { key, panel, handle, nodes };
    return this;
  }

  private __findItem(items: ICEMenuItem[], key: string): ICEMenuItem | null {
    for (const item of items) {
      if (item.key === key) {
        return item;
      }
      if (item.children) {
        const found = this.__findItem(item.children, key);
        if (found) {
          return found;
        }
      }
    }
    return null;
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
    this.ice.evtBus.on('keydown', this.__onKeyDown, this);
  }

  public getActiveKey(): string | null {
    return this.activeKey;
  }

  public setActiveKey(key: string | null): this {
    this.activeKey = key;
    this.__syncSelection();
    return this;
  }

  /**
   * 键盘导航（只在菜单获得焦点时响应）。
   *
   * ↓/↑ 移动（跳过 disabled、到头回绕）；→ 展开父项 / 落到第一个子项；← 收起 / 回到父项；
   * Enter / Space 激活；Home / End 跳首尾；Esc 收起子菜单。
   */
  private __onKeyDown(evt: any): void {
    if (!this.isFocused() || !this.rows.length) {
      return;
    }
    const raw = evt && (evt.originalEvent || evt);
    const key = raw && (raw.key || raw.code);
    const horizontal = this.mode === 'horizontal';
    // 横向模式：顶层项之间用 ← / → 走；纵向：↑ / ↓ 走，→ / ← 管展开收起
    const nextKey = horizontal ? 'ArrowRight' : 'ArrowDown';
    const prevKey = horizontal ? 'ArrowLeft' : 'ArrowUp';
    if (key === 'Escape' || key === 'Esc') {
      this.closeSubmenu();
      return;
    }
    if (key === nextKey || key === prevKey) {
      this.__moveActive(key === nextKey ? 1 : -1);
      return;
    }
    if (!horizontal && (key === 'ArrowRight' || key === 'ArrowLeft')) {
      const row = this.rows.find((entry) => entry.item.key === this.activeKey);
      if (!row) {
        return;
      }
      if (key === 'ArrowRight') {
        if (this.__hasChildren(row.item) && !this.expanded.has(row.item.key)) {
          this.toggleExpand(row.item.key);
        } else if (this.__hasChildren(row.item)) {
          const index = this.rows.indexOf(row);
          const child = this.rows.slice(index + 1).find((entry) => entry.depth > row.depth);
          if (child) {
            this.activeKey = child.item.key;
            this.__syncSelection();
          }
        }
      } else {
        if (this.__hasChildren(row.item) && this.expanded.has(row.item.key)) {
          this.toggleExpand(row.item.key);
        } else {
          const parent = this.rows
            .slice(0, this.rows.indexOf(row))
            .reverse()
            .find((entry) => entry.depth < row.depth);
          if (parent) {
            this.activeKey = parent.item.key;
            this.__syncSelection();
          }
        }
      }
      return;
    }
    if (key === 'Home' || key === 'End') {
      const candidates = this.rows.filter((entry) => !entry.item.disabled);
      const target = key === 'Home' ? candidates[0] : candidates[candidates.length - 1];
      if (target) {
        this.activeKey = target.item.key;
        this.__syncSelection();
      }
      return;
    }
    if (key === 'Enter' || key === ' ' || key === 'Spacebar') {
      if (this.activeKey) {
        this.activateItem(this.activeKey);
      }
    }
  }

  private __moveActive(step: number): void {
    // 横向菜单只在顶层项之间走（子项在浮层里，不参与顶层的左右移动）
    const candidates = this.mode === 'horizontal' ? this.rows.filter((entry) => entry.depth === 0) : this.rows;
    const count = candidates.length;
    let index = candidates.findIndex((entry) => entry.item.key === this.activeKey);
    if (index === -1) {
      // 还没激活：往下落到第一项、往上落到最后一项
      const enabled = candidates.filter((entry) => !entry.item.disabled);
      const target = step > 0 ? enabled[0] : enabled[enabled.length - 1];
      if (target) {
        this.activeKey = target.item.key;
        this.__syncSelection();
      }
      return;
    }
    for (let i = 0; i < count; i += 1) {
      index = (index + step + count) % count;
      if (!candidates[index].item.disabled) {
        this.activeKey = candidates[index].item.key;
        this.__syncSelection();
        return;
      }
    }
  }

  private __onGlobalMouseDown(evt: any): void {
    if (!evt || typeof evt.offsetX !== 'number' || typeof evt.offsetY !== 'number') {
      return;
    }
    if (!this.ice || typeof this.ice.screenToWorld !== 'function') {
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
    // 横向（顶栏菜单）与收起态（侧栏只留图标）走各自的渲染：它们是形态，不是同一个布局
    if (this.mode === 'horizontal') {
      this.__renderHorizontal();
      return;
    }
    if (this.collapsed) {
      this.__renderCollapsed();
      return;
    }
    this.removeChildren([...this.childNodes]);
    const theme = iceUIManager.getTheme();
    const width = Number(this.state.width) || 240;
    this.itemPanels = [];
    this.itemIcons = [];
    this.itemNodes = new Map();
    this.itemNodesKeys = [];
    const inset = theme.spacing.xxs;
    this.rows = [];
    this.__flatten(this.items, 0, this.rows);
    this.__layoutMode = 'tree';
    this.setState({ height: this.rows.length * this.itemHeight });

    this.rows.forEach((row) => {
      const item = row.item;
      // 位置与宽度由 ICEMenuLayout 摆（缩进按 depth）；indent 这里只用于标签宽度
      const indent = row.depth * theme.spacing.md;
      const panel = new ICEWidget({
        fill: true,
        stroke: false,
        height: this.itemHeight,
        radius: theme.radius.md,
        style: {
          fillStyle: item.key === this.selectedKey ? theme.colors.primaryBg : 'rgba(0,0,0,0)',
        },
      });
      this.addChild(panel, false);
      this.itemPanels.push(panel);
      this.itemNodes.set(item.key, panel);
      this.itemNodesKeys.push(item.key);
      // 悬停反馈：菜单项常被当作主操作入口，没有 hover 会很"死"
      panel.on(
        'hoverchange',
        (evt: any) => {
          const hovered = readHovered(evt);
          const next = hovered ? item.key : this.hoverKey === item.key ? null : this.hoverKey;
          if (next === this.hoverKey) {
            return;
          }
          this.hoverKey = next;
          this.__syncSelection();
        },
        this,
      );

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

  /** 收起态：竖向排列，只有图标。 */
  private __renderCollapsed(): void {
    this.__renderFlat('vertical');
  }

  /** 横向（顶栏菜单）：顶层项横排，带子菜单的项点开是浮层。 */
  private __renderHorizontal(): void {
    this.__renderFlat('horizontal');
  }

  private __renderFlat(orientation: 'vertical' | 'horizontal'): void {
    this.removeChildren([...this.childNodes]);
    const theme = iceUIManager.getTheme();
    this.itemPanels = [];
    this.itemIcons = [];
    this.itemNodes = new Map();
    this.itemNodesKeys = [];
    // 横向要把子项也登记进 rows，子菜单里的点击才能按 key 找到项
    this.rows =
      orientation === 'horizontal'
        ? this.items.reduce((out: Array<{ item: ICEMenuItem; depth: number }>, item) => {
            out.push({ item, depth: 0 });
            (item.children || []).forEach((child) => out.push({ item: child, depth: 1 }));
            return out;
          }, [])
        : this.items.map((item) => ({ item, depth: 0 }));
    const inset = theme.spacing.xxs;
    const menuWidth = this.collapsed ? this.collapsedWidth : Number(this.state.width) || 240;
    const itemWidth =
      orientation === 'horizontal'
        ? Math.max(
            88,
            this.items.reduce(
              (max, item) =>
                Math.max(
                  max,
                  estimateTextWidth(item.label, theme.font.size) +
                    (item.icon || item.iconPath ? 34 : 20) +
                    (this.__hasChildren(item) ? 16 : 0),
                ),
              0,
            ),
          )
        : Math.max(0, menuWidth - inset * 2);
    this.setState({ height: orientation === 'horizontal' ? this.itemHeight : this.items.length * this.itemHeight });
    this.__layoutMode = orientation === 'horizontal' ? 'flat-horizontal' : 'flat-vertical';
    this.__flatItemWidth = itemWidth;
    this.items.forEach((item) => {
      // 位置由 ICEMenuLayout 摆（横排依次推进 / 竖排按行）
      const panel = new ICEWidget({
        fill: true,
        stroke: false,
        width: itemWidth,
        height: this.itemHeight,
        radius: theme.radius.md,
        style: { fillStyle: 'rgba(0,0,0,0)' },
      });
      this.addChild(panel, false);
      this.itemPanels.push(panel);
      this.itemNodes.set(item.key, panel);
      this.itemNodesKeys.push(item.key);
      const showLabel = orientation === 'horizontal' || !this.collapsed;
      const iconWidth = 18;
      const contentWidth = estimateTextWidth(item.label, theme.font.size) + iconWidth + 8;
      const contentLeft = orientation === 'horizontal' || this.collapsed
        ? Math.max(theme.spacing.xs, Math.round((itemWidth - (showLabel ? contentWidth : iconWidth)) / 2))
        : theme.spacing.md;
      if (item.iconPath) {
        const icon = new ICESvgIcon({
          left: contentLeft,
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
            left: contentLeft,
            top: 0,
            width: iconWidth,
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
      if (showLabel) {
        panel.addChild(
          createTextNode({
            left: contentLeft + iconWidth + 8,
            top: 0,
            width: Math.max(0, itemWidth - contentLeft - iconWidth - 16),
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
      }
      if (this.__hasChildren(item)) {
        panel.addChild(
          createTextNode({
            left: itemWidth - 18,
            top: 0,
            width: 14,
            height: this.itemHeight,
            text: '⌄',
            fillStyle: theme.colors.textTertiary,
            fontFamily: theme.font.family,
            fontSize: theme.font.sizeSmall,
            align: 'center',
            verticalAlign: 'middle',
          }),
          false,
        );
      }
      panel.on(
        'hoverchange',
        (evt: any) => {
          const hovered = readHovered(evt);
          const next = hovered ? item.key : this.hoverKey === item.key ? null : this.hoverKey;
          if (next === this.hoverKey) {
            return;
          }
          this.hoverKey = next;
          this.__syncSelection();
        },
        this,
      );
      panel.on(
        'click',
        () => {
          if (orientation === 'horizontal' && this.__hasChildren(item)) {
            // 开关语义：点已打开的父项收起，点别的父项换过去
            if (this.getSubmenuKey() === item.key) {
              this.closeSubmenu();
            } else {
              this.openSubmenu(item.key);
            }
            this.__syncSubmenuIndicators();
            return;
          }
          this.activateItem(item.key);
          if (orientation === 'horizontal') {
            this.closeSubmenu();
          }
        },
        this,
      );
    });
    if (orientation === 'horizontal') {
      // 横排总占位 = 段数 × (段宽 + 段间 4px)（与策略里的推进一致）
      const flatWidth = Math.max(0, this.items.length * (itemWidth + 4) - 4);
      this.setState({ width: Math.max(flatWidth, Number(this.state.width) || 0) });
      this.__syncSubmenuIndicators();
    }
    this.__syncSelection();
  }

  /** 横向父项的 ⌄/⌃ 指示符跟着子菜单开合状态刷新。 */
  private __syncSubmenuIndicators(): void {
    if (this.mode !== 'horizontal') {
      return;
    }
    this.items.forEach((item) => {
      if (!this.__hasChildren(item)) {
        return;
      }
      const panel = this.itemNodes.get(item.key);
      if (!panel) {
        return;
      }
      const indicator = (panel.childNodes || []).find(
        (node: any) => node.state && (node.state.text === '⌄' || node.state.text === '⌃'),
      );
      if (indicator) {
        indicator.setState({ text: this.getSubmenuIndicator(item.key) });
      }
    });
  }

  private __syncSelection(): void {
    // 收起态 / 横向：只按选中与悬停给底色，不做「父路径文字高亮」（那是纵向内联树的事）
    if (this.collapsed || this.mode === 'horizontal') {
      const theme = iceUIManager.getTheme();
      this.itemPanels.forEach((panel, index) => {
        const item = this.itemNodesKeys[index];
        if (!item) return;
        const active = item === this.selectedKey;
        const hovered = item === this.hoverKey;
        panel.setState({
          style: {
            fillStyle: active ? theme.colors.primaryBg : hovered ? theme.colors.background : 'rgba(0,0,0,0)',
          },
        });
      });
      return;
    }
    const theme = iceUIManager.getTheme();
    // 选中项所在路径上的父节点：只做「当前分组」的文字高亮，不加底色
    const ancestors = this.__ancestorKeys(this.selectedKey);
    this.itemPanels.forEach((panel, index) => {
      const active = this.rows[index] && this.rows[index].item.key === this.selectedKey;
      const hovered = this.rows[index] && this.rows[index].item.key === this.hoverKey;
      const inActivePath = !!this.rows[index] && ancestors.indexOf(this.rows[index].item.key) !== -1;
      panel.setState({
        style: {
          fillStyle: active ? theme.colors.primaryBg : hovered ? theme.colors.background : 'rgba(0,0,0,0)',
        },
      });
      (panel.childNodes || []).forEach((label: any) => {
        label.setState({
          style: {
            ...label.state.style,
            fillStyle: active || inActivePath ? theme.colors.primary : theme.colors.text,
          },
        });
      });
      const icon = this.itemIcons[index];
      if (icon && typeof icon.setColor === 'function') {
        icon.setColor(active || inActivePath ? theme.colors.primary : theme.colors.textSecondary);
      }
    });
    this.revalidate();
  }

  /** 从根走到目标项，返回途中经过的父节点 key（不含自身）。 */
  private __ancestorKeys(key: string | null): string[] {
    if (!key) {
      return [];
    }
    const walk = (items: ICEMenuItem[], trail: string[]): string[] | null => {
      for (const item of items) {
        if (item.key === key) {
          return trail;
        }
        if (item.children && item.children.length) {
          const found = walk(item.children, trail.concat(item.key));
          if (found) {
            return found;
          }
        }
      }
      return null;
    };
    return walk(this.items, []) || [];
  }
}
