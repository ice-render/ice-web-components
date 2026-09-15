import { ICELabel } from './ICELabel';
import { ICEPanel } from './ICEPanel';
import { ICEWidget } from '../core/ICEWidget';
import { ICEScrollPane } from './ICEScrollPane';
import { iceUIManager } from '../core/ICEManager';
import { ICESelectionModel, ICESelectionMode } from '../model/ICESelectionModel';
import { getICEWorldBox } from '../util/ICEWorldBox';
import { roundRectPath } from '../util/ICEStyle';

/**
 * 列表（Swing JList 的最小版）。
 *
 * - 选择逻辑在 `ICESelectionModel` 里（single 替换 / multiple 切换），组件只负责渲染与交互；
 * - 内容高于可视高度时自动套一层 `ICEScrollPane`（复用 A2 的滚动底座与子树裁剪）；
 * - 交互：点击行选中（disabled 行忽略）；焦点在列表上时 ↑/↓ 移动激活行（跳过 disabled）、
 *   Enter/Space 选中激活行。
 *
 * **行由 painter 画**（2026-09-15，Swing 的 `JList` + `ListCellRenderer` 位）：行不再是子节点，
 * 点击用几何反查行下标（`__indexAtPoint`）。程序式点击/断言用 `clickRow(key)`（旧的
 * `getRowNode(key).trigger('click')` 已删除）；行矩形用 `getRowBox(key)` 查。
 */

export interface ICEListItem {
  key: string;
  label: string;
  disabled?: boolean;
}

export interface ICEListOptions {
  /** 组件 id（引擎会用它做唯一标识，e2e/调试时可按 id 定位） */
  id?: string;
  items: ICEListItem[];
  mode?: ICESelectionMode;
  value?: string[];
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  itemHeight?: number;
  onChange?: (keys: string[], item?: ICEListItem) => void;
}

export class ICEList extends ICEWidget {
  private items: ICEListItem[];
  private model: ICESelectionModel;
  private itemHeight: number;
  private onChange: ((keys: string[], item?: ICEListItem) => void) | null;
  private pane: ICEScrollPane | null = null;
  private content: ICEWidget;

  private activeIndex = -1;
  private running = false;

  constructor(props: ICEListOptions) {
    const theme = iceUIManager.getTheme();
    const width = props.width ?? 200;
    const height = props.height ?? 160;
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
    this.items = (props.items || []).slice();
    this.itemHeight = props.itemHeight ?? 34;
    this.onChange = typeof props.onChange === 'function' ? props.onChange : null;
    this.model = new ICESelectionModel({ mode: props.mode || 'single', selected: props.value || [] });
    this.model.addChangeListener(() => this.__markDirty());
    this.content = new ICEWidget({ left: 0, top: 0, width: width - 8, height: this.items.length * this.itemHeight });
    // 行由 painter 画（内容盒是唯一子节点，行不建节点）
    this.content.setPainter({ paint: ({ ctx, theme, origin }: any) => this.paintRows(ctx, theme, origin) });
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

  public getSelectionModel(): ICESelectionModel {
    return this.model;
  }

  public getActiveIndex(): number {
    return this.activeIndex;
  }

  /**
   * 程序式点击某一行（等价于用户点中那一行；disabled 行无效）。
   *
   * 旧 API `getRowNode(key).trigger('click')` 已删除 —— 行是画出来的，没有节点可点。
   */
  public clickRow(key: string): this {
    const item = this.items.find((entry) => entry.key === key);
    if (item) {
      this.__pick(item);
    }
    return this;
  }

  /** 某一行的矩形（内容盒坐标系；`null` = 没有这一行）。几何审计 / e2e 定位用。 */
  public getRowBox(key: string): { left: number; top: number; width: number; height: number } | null {
    const index = this.items.findIndex((entry) => entry.key === key);
    if (index < 0) {
      return null;
    }
    return { left: 4, top: index * this.itemHeight, width: Math.max(0, (Number(this.content.state.width) || 0) - 8), height: this.itemHeight };
  }

  public getScrollPane(): ICEScrollPane | null {
    return this.pane;
  }

  public getItems(): ICEListItem[] {
    return this.items.slice();
  }

  public setItems(items: ICEListItem[]): this {
    this.items = (items || []).slice();
    this.activeIndex = -1;
    this.model.setSelected([]);
    this.__render();
    return this;
  }

  /** 宽度变化时重排行宽（引擎只回调 __afterStateMerge，不调 revalidate）。 */
  protected __afterStateMerge(sizeChanged: boolean): void {
    super.__afterStateMerge(sizeChanged);
    if (sizeChanged) {
      this.__render();
    }
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
        this.__markDirty();
        return;
      }
    }
  }

  private __pick(item: ICEListItem): void {
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
    this.__markDirty();

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

  /**
   * 画所有行（浏览器里由 content 的 painter 每帧自动调用；单测可直接调它断言行矩形/颜色）。
   *
   * 一行 = 圆角底板（选中 primaryBg / 激活 background / 普通透明）+ 左内边距 10 的文字。
   */
  public paintRows(ctx: any, theme: any, origin: [number, number] = [0, 0]): void {
    if (!ctx || !theme) {
      return;
    }
    const [ox, oy] = origin;
    const width = Math.max(0, (Number(this.content.state.width) || 0) - 8);
    const radius = theme.radius.sm;
    const font = `${theme.font.size - 1}px ${theme.font.family}`;
    this.items.forEach((item, index) => {
      const selected = this.model.isSelected(item.key);
      const active = index === this.activeIndex;
      const top = index * this.itemHeight - oy;
      if (selected || active) {
        roundRectPath(ctx, 4 - ox, top, width, this.itemHeight, radius);
        ctx.fillStyle = selected ? theme.colors.primaryBg : theme.colors.background;
        ctx.fill();
      }
      ctx.fillStyle = item.disabled
        ? theme.colors.textDisabled
        : selected
        ? theme.colors.primary
        : theme.colors.text;
      ctx.font = font;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(item.label, 10 - ox, top + this.itemHeight / 2);
    });
  }

  /** 只标脏（行是画出来的，数据/选中/激活变化都不动结构）。 */
  private __markDirty(): void {
    this.content.dirty = true;
    if (this.ice && this.ice.dirty !== undefined) {
      this.ice.dirty = true;
    }
  }

  /** 世界坐标（事件）→ 行下标；越界 / 无 ICE 实例返回 -1。 */
  private __indexAtPoint(offsetX: number, offsetY: number): number {
    if (!this.ice || typeof this.ice.screenToWorld !== 'function') {
      return -1;
    }
    const [wx, wy] = this.ice.screenToWorld(offsetX, offsetY);
    const box = getICEWorldBox(this);
    const scrollY = this.pane ? this.pane.getScroll()[1] : 0;
    const localY = wy - box.top - 1 + scrollY;
    const index = Math.floor(localY / this.itemHeight);
    return index >= 0 && index < this.items.length ? index : -1;
  }

  /** 行点击（真正的用户路径：内容盒里的行是按几何反查的）。 */
  private __onClick(evt: any): void {
    const raw = evt && (evt.originalEvent || evt);
    if (!raw || typeof raw.offsetX !== 'number' || typeof raw.offsetY !== 'number') {
      return;
    }
    const index = this.__indexAtPoint(raw.offsetX, raw.offsetY);
    if (index >= 0) {
      this.__pick(this.items[index]);
    }
  }

  protected initEvents(): void {
    super.initEvents();
    this.on('click', this.__onClick, this);
  }
}
