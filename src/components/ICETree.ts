import { ICELabel } from './ICELabel';
import { ICEWidget } from '../core/ICEWidget';
import { ICEScrollPane } from './ICEScrollPane';
import { computeTreeDropTarget, moveTreeNode } from '../util/ICEDragReorder';
import { iceUIManager } from '../core/ICEManager';
import { ICESelectionModel, ICESelectionMode } from '../model/ICESelectionModel';
import { readHovered } from '../util/ICEStyle';
import { computeVirtualRange } from './ICEVirtualList';
import { token } from 'ice-render';

/**
 * 树（Swing JTree 的最小可用版）。
 *
 * - 可见行 = 深度优先遍历、只展开 expandedKeys 里的节点；
 * - 每层缩进 16px，有子节点的行显示 ▸ / ▾（点箭头只切换展开，不改选择）；
 * - 选择走 `ICESelectionModel`（single / multiple）；
 * - 键盘：↑/↓ 移动激活行、→ 展开（已展开则进入首个子节点）、← 折叠（叶子则回父节点）、
 *   Enter/Space 选中；
 * - 内容超出可视高度时自动套 `ICEScrollPane`。
 */

export interface ICETreeNode {
  key: string;
  label: string;
  children?: ICETreeNode[];
  disabled?: boolean;
}

export interface ICETreeOptions {
  /** 组件 id（引擎会用它做唯一标识，e2e/调试时可按 id 定位） */
  id?: string;
  nodes: ICETreeNode[];
  mode?: ICESelectionMode;
  value?: string[];
  expandedKeys?: string[];
  defaultExpandAll?: boolean;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  itemHeight?: number;
  indent?: number;
  onSelect?: (keys: string[], node?: ICETreeNode) => void;
  onExpand?: (expandedKeys: string[]) => void;
  /** 开启节点拖拽（按住行拖：上 1/3 插前面、中 1/3 放进去、下 1/3 插后面） */
  draggable?: boolean;
  /** 拖拽落下后的回调（与 `nodedrop` 事件同义） */
  onDrop?: (info: { key: string; targetKey: string; position: string; nodes: ICETreeNode[] }) => void;
  /** 可见节点达到这个数量就只渲染可视窗口（默认 200；传 0 关闭虚拟化） */
  virtualThreshold?: number;
  /** 虚拟窗口上下各多渲染几行（默认 2） */
  virtualBuffer?: number;
}

interface FlatRow {
  node: ICETreeNode;
  depth: number;
  parentKey: string | null;
  hasChildren: boolean;
}

export class ICETree extends ICEWidget {
  private nodes: ICETreeNode[];
  private model: ICESelectionModel;
  private expanded: string[];
  private itemHeight: number;
  private indent: number;
  private onSelect: ((keys: string[], node?: ICETreeNode) => void) | null;
  private onExpand: ((expandedKeys: string[]) => void) | null;
  private pane: ICEScrollPane | null = null;
  /** 节点拖拽：按行拖，三分法决定 before / inside / after */
  private draggable = false;
  private dragState: { key: string; target: { index: number; position: 'before' | 'inside' | 'after' } | null; indicator: any; highlight: any } | null = null;
  private onDrop: ((info: { key: string; targetKey: string; position: string; nodes: ICETreeNode[] }) => void) | null = null;
  private content: ICEWidget;
  private rows: FlatRow[] = [];
  private rowNodes = new Map<string, ICEWidget>();
  private activeKey: string | null = null;
  private virtualThreshold: number;
  private virtualBuffer: number;
  private virtual = false;
  private scrollTop = 0;
  private windowRange: { start: number; end: number; count: number } = { start: 0, end: 0, count: 0 };
  private running = false;

  constructor(props: ICETreeOptions) {
    const theme = iceUIManager.getTheme();
    const width = props.width ?? 240;
    const height = props.height ?? 200;
    super({
      id: props.id,
      fill: true,
      stroke: true,
      left: props.left,
      top: props.top,
      width,
      height,
      radius: theme.radius.md,
      style: {
        fillStyle: token('ui.colors.surface'),
        strokeStyle: token('ui.colors.border'),
        lineWidth: theme.control.lineWidth,
      },
    });
    this.nodes = props.nodes || [];
    this.itemHeight = props.itemHeight ?? 32;
    this.indent = props.indent ?? 16;
    this.onSelect = typeof props.onSelect === 'function' ? props.onSelect : null;
    this.onExpand = typeof props.onExpand === 'function' ? props.onExpand : null;
    this.draggable = props.draggable === true;
    this.onDrop = typeof props.onDrop === 'function' ? props.onDrop : null;
    this.virtualThreshold = Math.max(0, Math.floor(Number(props.virtualThreshold === undefined ? 200 : props.virtualThreshold) || 0));
    this.virtualBuffer = Math.max(0, Math.floor(Number(props.virtualBuffer === undefined ? 2 : props.virtualBuffer) || 0));
    this.model = new ICESelectionModel({ mode: props.mode || 'single', selected: props.value || [] });
    this.model.addChangeListener(() => this.__syncRows());
    this.expanded = props.defaultExpandAll
      ? this.__collectExpandableKeys(this.nodes)
      : (props.expandedKeys || []).slice();
    this.content = new ICEWidget({ left: 0, top: 0, width: width - 8, height });
    this.focusable = true;
    this.__render();
  }

  protected afterAddHandler(): void {
    super.afterAddHandler();
    if (!this.running && this.ice && this.ice.evtBus && typeof this.ice.evtBus.on === 'function') {
      this.ice.evtBus.on('keydown', this.__onKeyDown, this);
      this.ice.evtBus.on('mousedown', this.__onGlobalMouseDown, this);
      this.ice.evtBus.on('mousemove', this.__onGlobalMouseMove, this);
      this.ice.evtBus.on('mouseup', this.__onGlobalMouseUp, this);
      this.running = true;
    }
  }

  public getExpandedKeys(): string[] {
    return this.expanded.slice();
  }

  /** 当前树数据（跨父级移动 / 增删之后拿到的就是最新结构）。 */
  public getNodes(): ICETreeNode[] {
    return this.nodes;
  }

  public setExpandedKeys(keys: string[]): this {
    this.expanded = (keys || []).slice();
    this.__render();
    return this;
  }

  public expandAll(): this {
    this.expanded = this.__collectExpandableKeys(this.nodes);
    this.__render();
    return this;
  }

  public collapseAll(): this {
    this.expanded = [];
    this.__render();
    return this;
  }

  public getSelectedKeys(): string[] {
    return this.model.getSelectedKeys();
  }

  public setSelectedKeys(keys: string[]): this {
    this.model.setSelected(keys);
    return this;
  }

  public getActiveKey(): string | null {
    return this.activeKey;
  }

  public getRowNode(key: string): ICEWidget | null {
    return this.rowNodes.get(key) || null;
  }

  public getVisibleNodes(): ICETreeNode[] {
    return this.rows.map((row) => row.node);
  }

  /** 行所在层级（0 = 根层；缩进 = depth × indent）。 */
  public getRowDepth(key: string): number {
    const row = this.rows.find((item) => item.node.key === key);
    return row ? row.depth : -1;
  }

  public getScrollPane(): ICEScrollPane | null {
    return this.pane;
  }

  // ---- 虚拟滚动（大树的性能开关） ----

  public isVirtual(): boolean {
    return this.virtual;
  }

  /** 当前真的建了行的 key（虚拟时就是那个窗口）。 */
  public getRenderedRowKeys(): string[] {
    return Array.from(this.rowNodes.keys());
  }

  public getScrollTop(): number {
    return this.scrollTop;
  }

  /** 指针的局部纵坐标 → 全局行号（把滚动偏移加回来；命中计算与拖拽都靠它）。 */
  public getRowIndexAt(localY: number): number {
    return this.__rowIndexAt(localY);
  }

  /** 直接设置滚动位置（会夹到可滚动范围），常用于「滚到某个节点」与测试。 */
  public setScrollTop(y: number): this {
    if (this.pane) {
      this.pane.setScroll(0, Number(y) || 0);
      const [, actual] = this.pane.getScroll();
      this.scrollTop = actual;
      this.__syncRows();
    }
    return this;
  }

  /** 键盘：只有焦点在树上时生效。 */
  // ---------------------------------------------------------------- 节点拖拽
  public isDraggable(): boolean {
    return this.draggable;
  }
  public isDragging(): boolean {
    return !!this.dragState;
  }
  public getDropTarget(): { index: number; position: 'before' | 'inside' | 'after' } | null {
    return this.dragState ? this.dragState.target : null;
  }
  /**
   * 把 `dragKey` 移到 `targetKey` 的 before / inside / after。
   *
   * 生效后重排整棵树并抛 `nodedrop`（带新树）。返回是否真的动了 ——
   * 拖进自己的后代、未知 key、位置没变都返回 false（判定逻辑在纯函数 `moveTreeNode` 里）。
   */
  public moveNode(dragKey: string, targetKey: string, position: 'before' | 'inside' | 'after'): boolean {
    const result = moveTreeNode(this.nodes as any, dragKey, targetKey, position);
    if (!result.moved) return false;
    this.nodes = result.nodes as any;
    if (position === 'inside' && this.expanded.indexOf(targetKey) === -1) {
      this.expanded = this.expanded.concat([targetKey]); // 放进去就展开，能立刻看见
    }
    this.__render();
    this.trigger('nodedrop', null, { key: dragKey, targetKey, position, nodes: this.nodes });
    if (this.onDrop) this.onDrop({ key: dragKey, targetKey, position, nodes: this.nodes });
    return true;
  }
  /** 指针落在第几行（把滚动偏移加回来）。 */
  private __rowIndexAt(localY: number): number {
    const scrollY = this.pane ? this.pane.getScroll()[1] : 0;
    const y = localY - 1 + scrollY;
    return Math.min(Math.max(Math.floor(y / this.itemHeight), 0), Math.max(0, this.rows.length - 1));
  }
  private __onGlobalMouseDown(evt: any): void {
    if (!this.draggable || !evt || typeof evt.offsetX !== 'number' || !this.ice || typeof this.ice.screenToWorld !== 'function') return;
    const [wx, wy] = this.ice.screenToWorld(evt.offsetX, evt.offsetY);
    const box = this.getMinBoundingBox(true);
    if (wx < box.tl[0] || wx > box.br[0] || wy < box.tl[1] || wy > box.br[1]) return;
    const row = this.rows[this.__rowIndexAt(wy - box.tl[1])];
    if (!row || row.node.disabled) return;
    const theme = iceUIManager.getTheme();
    const indicator = new ICEWidget({ left: 0, top: 0, width: Number(this.content.state.width) || 0, height: 2, fill: true, stroke: false, display: false, interactive: false, style: { fillStyle: token('ui.colors.primary') } });
    const highlight = new ICEWidget({ left: 0, top: 0, width: Number(this.content.state.width) || 0, height: this.itemHeight, radius: 3, fill: true, stroke: false, display: false, interactive: false, style: { fillStyle: token('ui.colors.primaryBg') } });
    this.content.addChild(highlight, false);
    this.content.addChild(indicator, false);
    this.dragState = { key: row.node.key, target: null, indicator, highlight };
    this.__updateDrag(wy - box.tl[1]);
  }
  private __onGlobalMouseMove(evt: any): void {
    if (!this.dragState || !this.ice || typeof this.ice.screenToWorld !== 'function') return;
    const [, wy] = this.ice.screenToWorld(evt.offsetX, evt.offsetY);
    const box = this.getMinBoundingBox(true);
    this.__updateDrag(wy - box.tl[1]);
  }
  private __onGlobalMouseUp(): void {
    if (!this.dragState) return;
    const state = this.dragState;
    this.dragState = null;
    state.indicator.setState({ display: false });
    state.highlight.setState({ display: false });
    const target = state.target;
    if (target && this.rows[target.index]) {
      this.moveNode(state.key, this.rows[target.index].node.key, target.position);
    }
  }
  private __updateDrag(localY: number): void {
    if (!this.dragState) return;
    const scrollY = this.pane ? this.pane.getScroll()[1] : 0;
    const index = this.__rowIndexAt(localY);
    const target = computeTreeDropTarget({ pointerY: localY - 1 + scrollY, itemHeight: this.itemHeight, itemCount: this.rows.length });
    this.dragState.target = target && this.rows[index] ? { index: target.index, position: target.position } : null;
    if (!target) {
      this.dragState.indicator.setState({ display: false });
      this.dragState.highlight.setState({ display: false });
      return;
    }
    const width = Number(this.content.state.width) || 0;
    if (target.position === 'inside') {
      this.dragState.highlight.setState({ display: true, left: 0, top: target.index * this.itemHeight, width });
      this.dragState.indicator.setState({ display: false });
    } else {
      const top = target.index * this.itemHeight + (target.position === 'after' ? this.itemHeight - 2 : 0);
      this.dragState.indicator.setState({ display: true, left: 0, top, width });
      this.dragState.highlight.setState({ display: false });
    }
  }

  private __onKeyDown(evt: any): void {
    if (!this.isFocused() || !this.rows.length) {
      return;
    }
    const raw = evt && (evt.originalEvent || evt);
    const key = raw && (raw.key || raw.code);
    const index = this.__activeIndex();
    if (key === 'ArrowDown' || key === 'ArrowUp') {
      if (this.activeKey === null) {
        // 还没有激活行：↓ 落到第一行、↑ 落到最后一行
        const target = key === 'ArrowDown' ? this.rows.find((row) => !row.node.disabled) : undefined;
        const fallback = target || this.rows[this.rows.length - 1];
        if (fallback && !fallback.node.disabled) {
          this.activeKey = fallback.node.key;
          this.__syncRows();
        }
        return;
      }
      const step = key === 'ArrowDown' ? 1 : -1;
      let next = index;
      for (let i = 0; i < this.rows.length; i++) {
        next = (next + step + this.rows.length) % this.rows.length;
        if (!this.rows[next].node.disabled) {
          this.activeKey = this.rows[next].node.key;
          this.__syncRows();
          return;
        }
      }
      return;
    }
    const row = this.rows[index];
    if (!row) {
      return;
    }
    if (key === 'ArrowRight') {
      if (row.hasChildren && this.expanded.indexOf(row.node.key) === -1) {
        this.__toggleExpand(row.node.key);
      } else if (row.hasChildren) {
        const child = this.rows.slice(index + 1).find((item) => item.parentKey === row.node.key);
        if (child) {
          this.activeKey = child.node.key;
          this.__syncRows();
        }
      }
      return;
    }
    if (key === 'ArrowLeft') {
      if (row.hasChildren && this.expanded.indexOf(row.node.key) !== -1) {
        this.__toggleExpand(row.node.key);
      } else if (row.parentKey) {
        this.activeKey = row.parentKey;
        this.__syncRows();
      }
      return;
    }
    if (key === 'Enter' || key === ' ') {
      if (!row.node.disabled) {
        this.__pick(row.node);
      }
    }
  }

  private __activeIndex(): number {
    if (!this.activeKey) {
      return this.rows.length ? 0 : -1;
    }
    const index = this.rows.findIndex((row) => row.node.key === this.activeKey);
    return index === -1 ? 0 : index;
  }

  private __toggleExpand(key: string): void {
    const index = this.expanded.indexOf(key);
    if (index === -1) {
      this.expanded = this.expanded.concat([key]);
    } else {
      this.expanded = this.expanded.filter((item) => item !== key);
    }
    this.__render();
    if (this.onExpand) {
      this.onExpand(this.getExpandedKeys());
    }
  }

  private __pick(node: ICETreeNode): void {
    if (node.disabled) {
      return;
    }
    const before = this.model.getSelectedKeys();
    this.model.toggle(node.key);
    if (this.model.getMode() === 'single' && before[0] === node.key) {
      return;
    }
    if (this.onSelect) {
      this.onSelect(this.model.getSelectedKeys(), node);
    }
  }

  /** 可见行 = 深度优先、只展开 expanded 内的分支。 */
  private __flatten(): FlatRow[] {
    const rows: FlatRow[] = [];
    const visit = (list: ICETreeNode[], depth: number, parentKey: string | null) => {
      list.forEach((node) => {
        const hasChildren = !!(node.children && node.children.length);
        rows.push({ node, depth, parentKey, hasChildren });
        if (hasChildren && this.expanded.indexOf(node.key) !== -1) {
          visit(node.children as ICETreeNode[], depth + 1, node.key);
        }
      });
    };
    visit(this.nodes, 0, null);
    return rows;
  }

  private __collectExpandableKeys(list: ICETreeNode[]): string[] {
    const keys: string[] = [];
    const visit = (nodes: ICETreeNode[]) => {
      nodes.forEach((node) => {
        if (node.children && node.children.length) {
          keys.push(node.key);
          visit(node.children);
        }
      });
    };
    visit(list);
    return keys;
  }

  /**
   * 尺寸变化时整段重排内部零件（`ICEWidget.__syncInternalLayout()`）。
   *
   * 树的每一行（缩进、行宽、连接线）都是按自身宽度算出来的，所以直接重跑 `__render()`：
   * 它内部重建子项，不会留下停在旧宽度的行。
   */
  protected __syncInternalLayout(): void {
    this.__render();
  }

  private __render(): void {
    this.removeChildren([...this.childNodes]);
    this.pane = null;
    const width = Number(this.state.width) || 240;
    const height = Number(this.state.height) || 200;
    this.rows = this.__flatten();
    const contentHeight = Math.max(this.itemHeight, this.rows.length * this.itemHeight);
    const needScroll = contentHeight > height;
    const hostWidth = width - 2;
    this.content.setState({ width: hostWidth - (needScroll ? 10 : 0), height: contentHeight });

    if (needScroll) {
      const pane = new ICEScrollPane({
        left: 1,
        top: 1,
        width: hostWidth,
        height: height - 2,
        scrollbar: true,
        style: { fillStyle: 'rgba(0,0,0,0)', strokeStyle: 'rgba(0,0,0,0)' },
      });
      pane.setContent(this.content);
      pane.setContentSize(Number(this.content.state.width), contentHeight);
      pane.on('scroll', (evt: any) => {
        this.scrollTop = evt && evt.param ? Number(evt.param.y) || 0 : 0;
        this.__syncRows();
      });
      this.addChild(pane, false);
      this.pane = pane;
    } else {
      this.scrollTop = 0;
      this.addChild(this.content, false);
    }
    // 窗口要在滚动视口就位之后再算：没有 pane 时算不出「可视区」，会退化成全量渲染
    this.__syncRows();
    if (this.ice && this.ice.dirty !== undefined) {
      this.ice.dirty = true;
    }
  }

  private __syncRows(): void {
    const theme = iceUIManager.getTheme();
    const width = Number(this.content.state.width) || 220;
    this.content.removeChildren([...this.content.childNodes]);
    this.rowNodes.clear();

    // 虚拟窗口：只在「可视区 + 缓冲」里建行；节点少（或没有滚动视口）时就是全部
    const viewportHeight = this.pane ? this.pane.getViewportSize()[1] : Number(this.state.height) || 200;
    this.virtual =
      !!this.pane && this.virtualThreshold > 0 && this.rows.length >= this.virtualThreshold;
    const range = this.virtual
      ? computeVirtualRange({
          scrollTop: this.scrollTop,
          viewportHeight,
          itemHeight: this.itemHeight,
          itemCount: this.rows.length,
          buffer: this.virtualBuffer,
        })
      : { start: 0, end: this.rows.length, count: this.rows.length };
    this.windowRange = range;

    this.rows.slice(range.start, range.end).forEach((row, offset) => {
      const index = range.start + offset;
      const selected = this.model.isSelected(row.node.key);
      const active = row.node.key === this.activeKey;
      const node = new ICEWidget({
        left: 4,
        top: index * this.itemHeight,
        width: width - 8,
        height: this.itemHeight,
        radius: theme.radius.sm,
        fill: true,
        stroke: false,
        interactive: !row.node.disabled,
        style: {
          fillStyle: selected ? token('ui.colors.primaryBg') : active ? token('ui.colors.background') : 'rgba(0,0,0,0)',
        },
      });
      const indent = 6 + row.depth * this.indent;
      if (row.hasChildren) {
        const arrow = new ICELabel({
          interactive: false,
          left: indent,
          top: 0,
          width: 14,
          height: this.itemHeight,
          verticalAlign: 'middle',
          text: this.expanded.indexOf(row.node.key) !== -1 ? '▾' : '▸',
          style: { fontSize: 11, fillStyle: token('ui.colors.textSecondary') },
        });
        node.addChild(arrow, false);
      }
      node.addChild(
        new ICELabel({
          interactive: false,
          left: indent + (row.hasChildren ? 16 : 14),
          top: 0,
          height: this.itemHeight,
          verticalAlign: 'middle',
          text: row.node.label,
          style: {
            fontSize: 13,
            fillStyle: row.node.disabled
              ? token('ui.colors.textDisabled')
              : selected
              ? token('ui.colors.primary')
              : token('ui.colors.text'),
          },
        }),
        false,
      );
      if (!row.node.disabled) {
        node.on('click', () => this.__pick(row.node));
        node.on('expand-click', () => this.__toggleExpand(row.node.key));
      }
      // 悬停反馈：树行常被当成导航入口，缺 hover 会显得没反应
      node.on(
        'hoverchange',
        (evt: any) => {
          const hovered = readHovered(evt);
          node.setState({
            style: {
              ...node.state.style,
              fillStyle: selected
                ? token('ui.colors.primaryBg')
                : hovered || active
                  ? token('ui.colors.background')
                  : 'rgba(0,0,0,0)',
            },
          });
        },
        this,
      );
      // 点击缩进区域（箭头附近）也算展开
      const arrowHit = new ICEWidget({
        left: indent - 2,
        top: 0,
        width: row.hasChildren ? 18 : 0,
        height: this.itemHeight,
        fill: false,
        stroke: false,
        interactive: row.hasChildren && !row.node.disabled,
      });
      if (row.hasChildren && !row.node.disabled) {
        arrowHit.on('click', () => this.__toggleExpand(row.node.key));
      }
      node.addChild(arrowHit, false);
      this.content.addChild(node, false);
      this.rowNodes.set(row.node.key, node);
    });
    if (this.ice && this.ice.dirty !== undefined) {
      this.ice.dirty = true;
    }
  }
}
