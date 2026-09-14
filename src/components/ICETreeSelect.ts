import { ICELabel } from './ICELabel';
import { ICEPanel } from './ICEPanel';
import { ICEWidget } from '../core/ICEWidget';
import { ICETree, ICETreeNode } from './ICETree';
import { iceUIManager } from '../core/ICEManager';
import { ICEOverlayManager, ICEOverlayHandle, getICEOverlayManager } from '../core/ICEOverlayManager';

/**
 * 树选择器：下拉里放一棵 ICETree，选中节点后回写值。
 *
 * - 字段区与 ICESelect 同构（选中标签 / placeholder + ▾），错误态边框标红；
 * - 下拉内容直接复用 `ICETree`（层级展开、缩进、箭头命中区、选择模型都在那边）；
 * - 浮层自己管关闭（`closeOnOutsideClick: false` + 自身命中盒）—— 浮层的命中盒判定会在
 *   click 派发前关掉浮层，树节点就收不到点击（Select/AutoComplete 都踩过这个坑）；
 * - 值就是节点 key，表单语义同 ICETextField（getFormValue / setFormValue）。
 */

export interface ICETreeSelectOptions {
  /** 组件 id（引擎会用它做唯一标识，e2e/调试时可按 id 定位） */
  id?: string;
  nodes: ICETreeNode[];
  value?: string | string[];
  /** `single`（默认）或 `multiple`（多选：值是 `string[]`，选中不关面板） */
  mode?: 'single' | 'multiple';
  /** 是否可搜索（按 label 过滤，命中节点的祖先链会保留并自动展开） */
  showSearch?: boolean;
  /** 字段最多显示几个标签，超出折叠成 `+N`（只影响显示） */
  maxTagCount?: number;
  placeholder?: string;
  disabled?: boolean;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  treeHeight?: number;
  defaultExpandAll?: boolean;
  onChange?: (key: any, node: ICETreeNode | null) => void;
  manager?: ICEOverlayManager;
}

export class ICETreeSelect extends ICEWidget {
  private nodes: ICETreeNode[];
  private value: string[];
  private mode: 'single' | 'multiple';
  private showSearch: boolean;
  private maxTagCount: number | null;
  private query = '';
  private filteredNodes: ICETreeNode[] | null = null;
  private searchRow: ICELabel | null = null;
  private placeholder: string;
  private disabled: boolean;
  private treeHeight: number;
  private defaultExpandAll: boolean;
  private manager: ICEOverlayManager | null;
  private handle: ICEOverlayHandle | null = null;
  private panel: ICEPanel | null = null;
  private tree: ICETree | null = null;
  private fieldLabel: ICELabel | null = null;
  private onChangeCallback: ((key: any, node: ICETreeNode | null) => void) | null;
  private running = false;

  constructor(props: ICETreeSelectOptions) {
    const theme = iceUIManager.getTheme();
    const width = props.width ?? 220;
    const height = props.height ?? theme.control.height;
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
        fillStyle: theme.colors.surface,
        strokeStyle: theme.colors.border,
        lineWidth: theme.control.lineWidth,
      },
    });
    this.nodes = props.nodes || [];
    this.mode = props.mode === 'multiple' ? 'multiple' : 'single';
    this.showSearch = props.showSearch === true;
    this.maxTagCount = Number.isFinite(Number(props.maxTagCount)) ? Math.max(0, Math.floor(Number(props.maxTagCount))) : null;
    this.value = props.value === undefined || props.value === null
      ? []
      : Array.isArray(props.value)
      ? props.value.map(String)
      : [String(props.value)];
    if (this.mode === 'single') {
      this.value = this.value.slice(0, 1);
    }
    this.placeholder = props.placeholder || '';
    this.disabled = props.disabled === true;
    this.treeHeight = props.treeHeight ?? 160;
    this.defaultExpandAll = props.defaultExpandAll === true;
    this.manager = props.manager || null;
    this.onChangeCallback = typeof props.onChange === 'function' ? props.onChange : null;
    this.focusable = !this.disabled;
    // 文本类控件：鼠标点进去也要有「正在输入」的焦点反馈（:focus 语义）
    this.focusRingMode = 'always';
    this.__syncField();
  }

  protected afterAddHandler(): void {
    super.afterAddHandler();
    if (!this.running) {
      if (!this.manager && this.ice) {
        this.manager = getICEOverlayManager(this.ice);
      }
      if (this.ice && this.ice.evtBus && typeof this.ice.evtBus.on === 'function') {
        this.ice.evtBus.on('keydown', this.__onKeyDown, this);
        this.ice.evtBus.on('mousedown', this.__onGlobalMouseDown, this);
      }
      this.on('click', this.__onClick, this);
      this.running = true;
    }
  }

  public getValue(): any {
    return this.mode === 'multiple' ? this.value.slice() : this.value.length ? this.value[0] : null;
  }

  public setValue(value: any): this {
    if (Array.isArray(value)) {
      this.value = value.map(String);
    } else if (value === undefined || value === null || value === '') {
      this.value = [];
    } else {
      this.value = [String(value)];
    }
    if (this.mode === 'single') {
      this.value = this.value.slice(0, 1);
    }
    this.__syncField();
    if (this.isOpen() && this.tree) {
      this.tree.setSelectedKeys(this.value.slice());
    }
    return this;
  }

  public getFormValue(): any {
    return this.getValue();
  }

  public setFormValue(value: any): void {
    this.setValue(value);
  }

  public getFieldLabel(): string {
    return this.fieldLabel ? this.fieldLabel.getText() : '';
  }

  public getMode(): 'single' | 'multiple' {
    return this.mode;
  }

  /** 选中的标签（按选中顺序）。 */
  public getSelectedLabels(): string[] {
    return this.value.map((key) => {
      const node = this.__findNode(key);
      return node ? node.label : key;
    });
  }

  /** 清空选择。 */
  public clear(): this {
    return this.setValue(this.mode === 'multiple' ? [] : null);
  }

  /** 删掉一个取值（多选时用）。 */
  public removeValue(key: string): this {
    if (this.value.indexOf(key) === -1) {
      return this;
    }
    const node = this.__findNode(key);
    this.setValue(this.value.filter((item) => item !== key));
    if (this.onChangeCallback) {
      this.onChangeCallback(this.getValue(), node);
    }
    return this;
  }

  // ---- 搜索 ----

  public getQuery(): string {
    return this.query;
  }

  /** 设置搜索词：过滤树（保留祖先链）并重画；空串恢复整棵树。 */
  public setQuery(query: string): this {
    this.query = String(query || '');
    if (this.isOpen()) {
      this.__rebuildTree();
    }
    return this;
  }

  /** 命中的节点 key（不含为了保留层级而带上的祖先）。 */
  public getMatchedKeys(): string[] {
    const query = this.query.trim().toLowerCase();
    const out: string[] = [];
    const visit = (list: ICETreeNode[]) => {
      list.forEach((node) => {
        if (!query || this.__matches(node, query)) {
          out.push(node.key);
        }
        if (node.children) visit(node.children);
      });
    };
    visit(this.nodes);
    return out;
  }

  /** 搜索时真正喂给树的那份（null = 没在搜索）。 */
  public getFilteredNodes(): ICETreeNode[] | null {
    return this.filteredNodes;
  }

  public isOpen(): boolean {
    return !!this.handle && this.handle.isOpen();
  }

  public getTree(): ICETree | null {
    return this.tree;
  }

  public activate(): void {
    this.toggle();
  }

  public toggle(): this {
    return this.isOpen() ? this.close() : this.open();
  }

  public open(): this {
    if (this.disabled || this.isOpen()) {
      return this;
    }
    if (!this.manager) {
      if (!this.ice) {
        throw new Error('ICETreeSelect 需要先加入 ICE 场景');
      }
      this.manager = getICEOverlayManager(this.ice);
    }
    const theme = iceUIManager.getTheme();
    const width = Number(this.state.width) || 220;
    const searchHeight = this.showSearch ? 30 : 0;
    const panel = new ICEPanel({
      width,
      height: searchHeight + this.treeHeight + 8,
      radius: theme.radius.md,
      style: { fillStyle: theme.colors.surface, strokeStyle: theme.colors.border, shadow: 'md' },
    });
    this.panel = panel;
    this.__rebuildTree();
    this.handle = this.manager.open({
      anchor: this,
      content: panel,
      placement: 'bottomLeft',
      offset: 4,
      enterAnimation: 'scale',
      exitAnimation: 'fade',
      keyboardCaptured: true,
      closeOnOutsideClick: false,
    });
    return this;
  }

  public close(): this {
    if (this.handle) {
      this.handle.close();
      this.handle = null;
    }
    this.panel = null;
    this.tree = null;
    return this;
  }

  private __pick(node: ICETreeNode): void {
    if (this.mode === 'multiple') {
      const index = this.value.indexOf(node.key);
      if (index === -1) {
        this.value.push(node.key);
      } else {
        this.value.splice(index, 1);
      }
      this.__syncField();
      if (this.tree) {
        this.tree.setSelectedKeys(this.value.slice());
      }
      if (this.onChangeCallback) {
        this.onChangeCallback(this.getValue(), node);
      }
      return;
    }
    this.value = [node.key];
    this.__syncField();
    this.close();
    if (this.onChangeCallback) {
      this.onChangeCallback(this.getValue(), node);
    }
  }

  /** 建/重建下拉内容：搜索行（可选）+ 树（搜索时只留命中路径并全展开）。 */
  private __rebuildTree(): void {
    const panel = this.panel;
    if (!panel) {
      return;
    }
    const theme = iceUIManager.getTheme();
    const width = Number(panel.state.width) || Number(this.state.width) || 220;
    const searchHeight = this.showSearch ? 30 : 0;
    panel.removeChildren([...panel.childNodes]);
    const query = this.query.trim().toLowerCase();
    this.filteredNodes = query
      ? this.__filterTree(this.nodes, (node) => node.label.toLowerCase().indexOf(query) !== -1 || node.key.toLowerCase().indexOf(query) !== -1)
      : null;
    const nodes = this.filteredNodes || this.nodes;
    if (this.showSearch) {
      this.searchRow = new ICELabel({
        interactive: false,
        left: 10,
        top: 0,
        width: width - 20,
        height: searchHeight,
        verticalAlign: 'middle',
        text: this.query ? this.query + '|' : '搜索部门…',
        style: { fontSize: 12, fillStyle: this.query ? theme.colors.text : theme.colors.textTertiary },
      });
      panel.addChild(this.searchRow, false);
    }
    // 搜索时把命中路径全展开，否则用户还得自己一层层点开
    const expandedKeys = query ? this.__collectKeys(nodes) : undefined;
    this.tree = new ICETree({
      nodes,
      left: 4,
      top: 4 + searchHeight,
      width: width - 8,
      height: this.treeHeight,
      mode: this.mode === 'multiple' ? 'multiple' : 'single',
      defaultExpandAll: this.defaultExpandAll,
      expandedKeys,
      value: this.value.slice(),
      onSelect: (_keys: string[], node?: ICETreeNode) => {
        if (node) {
          this.__pick(node);
        }
      },
    });
    panel.addChild(this.tree, false);
    if (this.ice && this.ice.dirty !== undefined) {
      this.ice.dirty = true;
    }
  }

  /** 过滤树：命中节点留下，**并保留它的祖先链**（否则不知道选的是哪一支）。 */
  private __filterTree(nodes: ICETreeNode[], match: (node: ICETreeNode) => boolean): ICETreeNode[] {
    const out: ICETreeNode[] = [];
    nodes.forEach((node) => {
      const children = node.children ? this.__filterTree(node.children, match) : [];
      if (match(node) || children.length) {
        out.push(children.length ? { ...node, children } : { ...node, children: node.children ? [] : undefined });
      }
    });
    return out;
  }

  /** 搜索命中口径：label 或 key 任一包含查询词（两种都有人用）。 */
  private __matches(node: ICETreeNode, query: string): boolean {
    return node.label.toLowerCase().indexOf(query) !== -1 || node.key.toLowerCase().indexOf(query) !== -1;
  }

  private __collectKeys(nodes: ICETreeNode[]): string[] {
    const out: string[] = [];
    const visit = (list: ICETreeNode[]) => {
      list.forEach((node) => {
        out.push(node.key);
        if (node.children) visit(node.children);
      });
    };
    visit(nodes);
    return out;
  }

  private __onClick(): void {
    if (this.disabled) {
      return;
    }
    this.toggle();
  }

  private __onKeyDown(evt: any): void {
    if (!this.isOpen()) {
      return;
    }
    const raw = evt && (evt.originalEvent || evt);
    const key = raw && (raw.key || raw.code);
    if (key === 'Escape' || key === 'Esc') {
      this.close();
      return;
    }
    if (!this.showSearch || typeof key !== 'string' || raw.metaKey || raw.ctrlKey) {
      return;
    }
    if (key === 'Backspace') {
      // 查询为空时按 Backspace 删最后一个已选（多选场景的常见手势）
      if (!this.query && this.mode === 'multiple' && this.value.length) {
        this.removeValue(this.value[this.value.length - 1]);
        return;
      }
      this.setQuery(this.query.slice(0, -1));
    } else if (key.length === 1) {
      this.setQuery(this.query + key);
    }
  }

  /** 点外关闭：点在自身与下拉面板之外就收起。 */
  private __onGlobalMouseDown(evt: any): void {
    if (!this.isOpen() || !evt || typeof evt.offsetX !== 'number' || typeof evt.offsetY !== 'number') {
      return;
    }
    if (!this.ice || typeof this.ice.screenToWorld !== 'function') {
      return;
    }
    const [wx, wy] = this.ice.screenToWorld(evt.offsetX, evt.offsetY);
    const insideBox = (box: { left: number; top: number; width: number; height: number }) =>
      wx >= box.left && wx <= box.left + box.width && wy >= box.top && wy <= box.top + box.height;
    if (!insideBox(this.__worldBox(this)) && !insideBox(this.__worldBox(this.panel))) {
      this.close();
    }
  }

  private __worldBox(node: any): { left: number; top: number; width: number; height: number } {
    let left = 0;
    let top = 0;
    let current = node;
    while (current && current.state) {
      left += Number(current.state.left) || 0;
      top += Number(current.state.top) || 0;
      current = current.parentNode;
    }
    return {
      left,
      top,
      width: Number(node && node.state && node.state.width) || 0,
      height: Number(node && node.state && node.state.height) || 0,
    };
  }

  private __syncField(): void {
    const theme = iceUIManager.getTheme();
    const width = Number(this.state.width) || 220;
    const height = Number(this.state.height) || 32;
    const borderColor = this.validateStatus === 'error' ? theme.colors.error : theme.colors.border;
    this.setState({
      style: {
        ...this.state.style,
        fillStyle: this.disabled ? theme.colors.disabled : theme.colors.surface,
        strokeStyle: borderColor,
      },
    });
    this.removeChildren([...this.childNodes]);
    const labels = this.getSelectedLabels();
    const limit = this.maxTagCount === null ? labels.length : Math.min(this.maxTagCount, labels.length);
    const overflow = labels.length - limit;
    const label = labels.length
      ? labels.slice(0, limit).join('、') + (overflow > 0 ? ` +${overflow}` : '')
      : this.placeholder;
    this.fieldLabel = new ICELabel({
      interactive: false,
      left: 10,
      top: 0,
      width: Math.max(0, width - 34),
      height,
      verticalAlign: 'middle',
      text: label,
      style: { fontSize: 13, fillStyle: labels.length ? theme.colors.text : theme.colors.textTertiary },
    });
    this.addChild(this.fieldLabel, false);
    this.addChild(
      new ICELabel({
        interactive: false,
        left: width - 22,
        top: 0,
        width: 14,
        height,
        align: 'center',
        verticalAlign: 'middle',
        text: '▾',
        style: { fontSize: 12, fillStyle: theme.colors.textTertiary },
      }),
      false,
    );
  }

  private __findNode(key: string): ICETreeNode | null {
    const visit = (list: ICETreeNode[]): ICETreeNode | null => {
      for (const node of list) {
        if (node.key === key) {
          return node;
        }
        if (node.children) {
          const found = visit(node.children);
          if (found) {
            return found;
          }
        }
      }
      return null;
    };
    return visit(this.nodes);
  }
}
