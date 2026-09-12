import { UILabel } from './UILabel';
import { UIPanel } from './UIPanel';
import { UIComponent } from '../core/UIComponent';
import { UIScrollPane } from './UIScrollPane';
import { uiManager } from '../core/UIManager';
import { UIOverlayManager, UIOverlayHandle, getUIOverlayManager } from '../core/UIOverlayManager';

/**
 * 级联选择（业界组件库 Cascader 的最小版）。
 *
 * - 字段显示已选路径（`separator` 可定制），未选显示 placeholder，错误态边框标红；
 * - 浮层按层级横向排列：点父节点展开下一列（不关闭），点叶子定值并关闭；
 * - 值统一是最深一层的 `value`，路径可由 `getPath()` 取回（便于回显上级）；
 * - 关闭策略与 Select 系列一致：浮层 closeOnOutsideClick:false，由组件自己判断点外 + Esc。
 */

export interface UICascaderOption {
  value: string;
  label: string;
  disabled?: boolean;
  children?: UICascaderOption[];
}

export type UICascaderPlacement = 'bottomLeft' | 'bottomRight';

export interface UICascaderOptions {
  options: UICascaderOption[];
  value?: string;
  placeholder?: string;
  disabled?: boolean;
  separator?: string;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  placement?: UICascaderPlacement;
  onChange?: (value: string, path: UICascaderOption[]) => void;
  manager?: UIOverlayManager;
}

const COLUMN_WIDTH = 104;
const ROW_HEIGHT = 30;
const VISIBLE_ROWS = 6;
const PANEL_PADDING = 6;

export class UICascader extends UIComponent {
  private options: UICascaderOption[];
  private value?: string;
  private placeholder: string;
  private disabled: boolean;
  private separator: string;
  private placement: UICascaderPlacement;
  private manager: UIOverlayManager | null;
  private onChangeCallback: ((value: string, path: UICascaderOption[]) => void) | null;
  private handle: UIOverlayHandle | null = null;
  private panel: UIPanel | null = null;
  private fieldLabel: UILabel | null = null;
  private columns: UIScrollPane[] = [];
  private optionNodes = new Map<string, UIComponent>();
  private activePath: UICascaderOption[] = [];
  private running = false;

  constructor(props: UICascaderOptions) {
    const theme = uiManager.getTheme();
    const width = props.width ?? 220;
    const height = props.height ?? theme.control.height;
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
    this.options = (props.options || []).slice();
    this.value = props.value === undefined || props.value === null ? undefined : String(props.value);
    this.placeholder = props.placeholder || '';
    this.disabled = props.disabled === true;
    this.separator = props.separator ?? ' / ';
    this.placement = props.placement || 'bottomLeft';
    this.manager = props.manager || null;
    this.onChangeCallback = typeof props.onChange === 'function' ? props.onChange : null;
    this.focusable = !this.disabled;
    this.activePath = this.__findPath(this.value);
    this.__syncField();
  }

  protected afterAddHandler(): void {
    super.afterAddHandler();
    if (!this.running) {
      if (!this.manager && this.ice) {
        this.manager = getUIOverlayManager(this.ice);
      }
      if (this.ice && this.ice.evtBus && typeof this.ice.evtBus.on === 'function') {
        this.ice.evtBus.on('keydown', this.__onKeyDown, this);
        this.ice.evtBus.on('mousedown', this.__onGlobalMouseDown, this);
      }
      this.on('click', this.__onClick, this);
      this.running = true;
    }
  }

  public getValue(): string | undefined {
    return this.value;
  }

  public setValue(value: string | null | undefined): this {
    this.value = value === undefined || value === null || value === '' ? undefined : String(value);
    this.activePath = this.__findPath(this.value);
    this.__syncField();
    if (this.isOpen()) {
      this.__renderPanel();
    }
    return this;
  }

  public getFormValue(): any {
    return this.value;
  }

  public setFormValue(value: any): void {
    this.setValue(value);
  }

  /** 已选路径（根 → 叶子）；未选时为空数组。 */
  public getPath(): UICascaderOption[] {
    return this.__findPath(this.value);
  }

  public getFieldLabel(): string {
    return this.fieldLabel ? this.fieldLabel.getText() : '';
  }

  public isOpen(): boolean {
    return !!this.handle && this.handle.isOpen();
  }

  public getPanel(): UIPanel | null {
    return this.panel;
  }

  public getColumnNodes(): UIScrollPane[] {
    return this.columns.slice();
  }

  public getColumnNode(level: number): UIScrollPane | null {
    return this.columns[level] || null;
  }

  public getOptionNode(level: number, value: string): UIComponent | null {
    return this.optionNodes.get(`${level}:${value}`) || null;
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
        throw new Error('UICascader 需要先加入 ICE 场景');
      }
      this.manager = getUIOverlayManager(this.ice);
    }
    this.activePath = this.__findPath(this.value);
    const theme = uiManager.getTheme();
    const panel = new UIPanel({
      width: PANEL_PADDING * 2 + Math.max(1, this.__maxDepth()) * COLUMN_WIDTH,
      height: PANEL_PADDING * 2 + Math.max(1, this.__maxRows()) * ROW_HEIGHT,
      radius: theme.radius.md,
      style: { fillStyle: theme.colors.surface, strokeStyle: theme.colors.border, shadow: 'md' },
    });
    this.panel = panel;
    this.__renderPanel();
    this.handle = this.manager.open({
      anchor: this,
      content: panel,
      placement: this.placement,
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
    this.columns = [];
    this.optionNodes.clear();
    return this;
  }

  protected __applyValidateState(): void {
    this.__syncField();
  }

  /** 按 value 在选项树里回溯出「根 → 叶子」路径。 */
  private __findPath(value: string | undefined): UICascaderOption[] {
    if (value === undefined) {
      return [];
    }
    const walk = (nodes: UICascaderOption[], trail: UICascaderOption[]): UICascaderOption[] | null => {
      for (const node of nodes) {
        const next = trail.concat(node);
        if (node.value === value) {
          return next;
        }
        if (node.children && node.children.length) {
          const found = walk(node.children, next);
          if (found) {
            return found;
          }
        }
      }
      return null;
    };
    return walk(this.options, []) || [];
  }

  /** 选项树的最大层级数（= 最多几列）。 */
  private __maxDepth(): number {
    const walk = (nodes: UICascaderOption[]): number => {
      let depth = 1;
      for (const node of nodes) {
        if (node.children && node.children.length) {
          depth = Math.max(depth, 1 + walk(node.children));
        }
      }
      return depth;
    };
    return this.options.length ? walk(this.options) : 1;
  }

  /** 单列最多几行（封顶 VISIBLE_ROWS，保证浮层高度稳定）。 */
  private __maxRows(): number {
    const walk = (nodes: UICascaderOption[]): number => {
      let rows = nodes.length;
      for (const node of nodes) {
        if (node.children && node.children.length) {
          rows = Math.max(rows, walk(node.children));
        }
      }
      return rows;
    };
    return this.options.length ? Math.min(VISIBLE_ROWS, walk(this.options)) : 1;
  }

  private __pick(node: UICascaderOption, level: number): void {
    if (node.disabled) {
      return;
    }
    this.activePath = this.activePath.slice(0, level).concat(node);
    if (node.children && node.children.length) {
      this.__renderPanel();
      return;
    }
    this.value = node.value;
    this.__syncField();
    const path = this.activePath.slice();
    this.close();
    if (this.onChangeCallback) {
      this.onChangeCallback(node.value, path);
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

  private __onGlobalMouseDown(evt: any): void {
    if (!this.isOpen() || !evt || typeof evt.offsetX !== 'number' || typeof evt.offsetY !== 'number') {
      return;
    }
    if (!this.ice || typeof this.ice.screenToWorld !== 'function') {
      return;
    }
    const [wx, wy] = this.ice.screenToWorld(evt.offsetX, evt.offsetY);
    const inside = (box: { left: number; top: number; width: number; height: number }) =>
      wx >= box.left && wx <= box.left + box.width && wy >= box.top && wy <= box.top + box.height;
    if (!inside(this.__worldBox(this)) && !inside(this.__worldBox(this.panel))) {
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
    const theme = uiManager.getTheme();
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
    const path = this.getPath();
    const text = path.length ? path.map((node) => node.label).join(this.separator) : this.placeholder;
    this.fieldLabel = new UILabel({
      interactive: false,
      left: 10,
      top: 0,
      width: Math.max(0, width - 34),
      height,
      verticalAlign: 'middle',
      text,
      style: { fontSize: 13, fillStyle: path.length ? theme.colors.text : theme.colors.textTertiary },
    });
    this.addChild(this.fieldLabel, false);
    this.addChild(
      new UILabel({
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

  private __renderPanel(): void {
    const panel = this.panel;
    if (!panel) {
      return;
    }
    const theme = uiManager.getTheme();
    panel.removeChildren([...panel.childNodes]);
    this.columns = [];
    this.optionNodes.clear();
    const rowCount = Math.max(1, this.__maxRows());
    const viewportHeight = rowCount * ROW_HEIGHT;

    // 拼出当前要显示的各级选项：第 0 列是根，之后跟着 activePath 展开
    const levels: UICascaderOption[][] = [this.options];
    for (const picked of this.activePath) {
      if (picked.children && picked.children.length) {
        levels.push(picked.children);
      } else {
        break;
      }
    }

    levels.forEach((nodes, level) => {
      const pane = new UIScrollPane({
        left: PANEL_PADDING + level * COLUMN_WIDTH,
        top: PANEL_PADDING,
        width: COLUMN_WIDTH,
        height: viewportHeight,
        fill: false,
        stroke: false,
        style: { fillStyle: 'transparent', strokeStyle: 'transparent' },
      });
      const content = new UIComponent({
        width: COLUMN_WIDTH,
        height: Math.max(viewportHeight, nodes.length * ROW_HEIGHT),
        fill: false,
        stroke: false,
      });
      const selectedAtLevel = this.activePath[level];
      nodes.forEach((node, rowIndex) => {
        const selected = !!selectedAtLevel && selectedAtLevel.value === node.value;
        const row = new UIComponent({
          left: 0,
          top: rowIndex * ROW_HEIGHT,
          width: COLUMN_WIDTH,
          height: ROW_HEIGHT,
          radius: theme.radius.sm,
          fill: true,
          stroke: false,
          style: { fillStyle: selected ? theme.colors.primaryBg : 'transparent' },
        });
        row.addChild(
          new UILabel({
            interactive: false,
            left: 8,
            top: 0,
            width: COLUMN_WIDTH - 26,
            height: ROW_HEIGHT,
            verticalAlign: 'middle',
            text: node.label,
            style: {
              fontSize: 13,
              fillStyle: node.disabled
                ? theme.colors.textDisabled
                : selected
                  ? theme.colors.primary
                  : theme.colors.text,
            },
          }),
          false,
        );
        if (node.children && node.children.length) {
          row.addChild(
            new UILabel({
              interactive: false,
              left: COLUMN_WIDTH - 18,
              top: 0,
              width: 12,
              height: ROW_HEIGHT,
              align: 'center',
              verticalAlign: 'middle',
              text: '›',
              style: { fontSize: 12, fillStyle: theme.colors.textTertiary },
            }),
            false,
          );
        }
        row.on('click', () => this.__pick(node, level));
        content.addChild(row, false);
        this.optionNodes.set(`${level}:${node.value}`, row);
      });
      pane.setContent(content);
      panel.addChild(pane, false);
      this.columns.push(pane);
    });
  }
}
