import { ICELabel } from './ICELabel';
import { ICEComponent } from '../core/ICEComponent';
import { ICEScrollPane } from './ICEScrollPane';
import { iceUIManager } from '../core/ICEManager';
import { ICESelectionModel, ICESelectionMode } from '../model/ICESelectionModel';

/**
 * 树（Swing JTree / 业界组件库 Tree 的最小可用版）。
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
}

interface FlatRow {
  node: ICETreeNode;
  depth: number;
  parentKey: string | null;
  hasChildren: boolean;
}

export class ICETree extends ICEComponent {
  private nodes: ICETreeNode[];
  private model: ICESelectionModel;
  private expanded: string[];
  private itemHeight: number;
  private indent: number;
  private onSelect: ((keys: string[], node?: ICETreeNode) => void) | null;
  private onExpand: ((expandedKeys: string[]) => void) | null;
  private pane: ICEScrollPane | null = null;
  private content: ICEComponent;
  private rows: FlatRow[] = [];
  private rowNodes = new Map<string, ICEComponent>();
  private activeKey: string | null = null;
  private running = false;

  constructor(props: ICETreeOptions) {
    const theme = iceUIManager.getTheme();
    const width = props.width ?? 240;
    const height = props.height ?? 200;
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
    this.nodes = props.nodes || [];
    this.itemHeight = props.itemHeight ?? 32;
    this.indent = props.indent ?? 16;
    this.onSelect = typeof props.onSelect === 'function' ? props.onSelect : null;
    this.onExpand = typeof props.onExpand === 'function' ? props.onExpand : null;
    this.model = new ICESelectionModel({ mode: props.mode || 'single', selected: props.value || [] });
    this.model.addChangeListener(() => this.__syncRows());
    this.expanded = props.defaultExpandAll
      ? this.__collectExpandableKeys(this.nodes)
      : (props.expandedKeys || []).slice();
    this.content = new ICEComponent({ left: 0, top: 0, width: width - 8, height });
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

  public getExpandedKeys(): string[] {
    return this.expanded.slice();
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

  public getRowNode(key: string): ICEComponent | null {
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

  /** 键盘：只有焦点在树上时生效。 */
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
    this.__syncRows();

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
      this.addChild(pane, false);
      this.pane = pane;
    } else {
      this.addChild(this.content, false);
    }
    if (this.ice && this.ice.dirty !== undefined) {
      this.ice.dirty = true;
    }
  }

  private __syncRows(): void {
    const theme = iceUIManager.getTheme();
    const width = Number(this.content.state.width) || 220;
    this.content.removeChildren([...this.content.childNodes]);
    this.rowNodes.clear();

    this.rows.forEach((row, index) => {
      const selected = this.model.isSelected(row.node.key);
      const active = row.node.key === this.activeKey;
      const node = new ICEComponent({
        left: 4,
        top: index * this.itemHeight,
        width: width - 8,
        height: this.itemHeight,
        radius: theme.radius.sm,
        fill: true,
        stroke: false,
        interactive: !row.node.disabled,
        style: {
          fillStyle: selected ? theme.colors.primaryBg : active ? theme.colors.background : 'rgba(0,0,0,0)',
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
          style: { fontSize: 11, fillStyle: theme.colors.textSecondary },
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
              ? theme.colors.textDisabled
              : selected
              ? theme.colors.primary
              : theme.colors.text,
          },
        }),
        false,
      );
      if (!row.node.disabled) {
        node.on('click', () => this.__pick(row.node));
        node.on('expand-click', () => this.__toggleExpand(row.node.key));
      }
      // 点击缩进区域（箭头附近）也算展开
      const arrowHit = new ICEComponent({
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
