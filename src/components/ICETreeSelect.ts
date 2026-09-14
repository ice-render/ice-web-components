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
  value?: string;
  placeholder?: string;
  disabled?: boolean;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  treeHeight?: number;
  defaultExpandAll?: boolean;
  onChange?: (key: string, node: ICETreeNode) => void;
  manager?: ICEOverlayManager;
}

export class ICETreeSelect extends ICEWidget {
  private nodes: ICETreeNode[];
  private value: string | null;
  private placeholder: string;
  private disabled: boolean;
  private treeHeight: number;
  private defaultExpandAll: boolean;
  private manager: ICEOverlayManager | null;
  private handle: ICEOverlayHandle | null = null;
  private panel: ICEPanel | null = null;
  private tree: ICETree | null = null;
  private fieldLabel: ICELabel | null = null;
  private onChangeCallback: ((key: string, node: ICETreeNode) => void) | null;
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
    this.value = props.value ?? null;
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

  public getValue(): string | null {
    return this.value;
  }

  public setValue(key: string | null): this {
    this.value = key;
    this.__syncField();
    if (this.isOpen() && this.tree) {
      this.tree.setSelectedKeys(key ? [key] : []);
    }
    return this;
  }

  public getFormValue(): any {
    return this.value;
  }

  public setFormValue(value: any): void {
    this.setValue(value === undefined || value === null ? null : String(value));
  }

  public getFieldLabel(): string {
    return this.fieldLabel ? this.fieldLabel.getText() : '';
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
    const panel = new ICEPanel({
      width,
      height: this.treeHeight + 8,
      radius: theme.radius.md,
      style: { fillStyle: theme.colors.surface, strokeStyle: theme.colors.border, shadow: 'md' },
    });
    const tree = new ICETree({
      nodes: this.nodes,
      left: 4,
      top: 4,
      width: width - 8,
      height: this.treeHeight,
      defaultExpandAll: this.defaultExpandAll,
      value: this.value ? [this.value] : [],
      onSelect: (keys: string[], node?: ICETreeNode) => {
        if (node) {
          this.__pick(node);
        }
      },
    });
    panel.addChild(tree, false);
    this.panel = panel;
    this.tree = tree;
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
    this.value = node.key;
    this.__syncField();
    this.close();
    if (this.onChangeCallback) {
      this.onChangeCallback(node.key, node);
    }
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
    const selected = this.value ? this.__findNode(this.value) : null;
    const label = selected ? selected.label : this.placeholder;
    this.fieldLabel = new ICELabel({
      interactive: false,
      left: 10,
      top: 0,
      width: Math.max(0, width - 34),
      height,
      verticalAlign: 'middle',
      text: label,
      style: { fontSize: 13, fillStyle: selected ? theme.colors.text : theme.colors.textTertiary },
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
