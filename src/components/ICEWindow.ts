import { ICEWidget } from '../core/ICEWidget';
import { ICELabel } from './ICELabel';
import { iceUIManager } from '../core/ICEManager';
import { getICEWorldBox } from '../util/ICEWorldBox';

/**
 * 通用窗口外壳（桌面 / 多窗口场景的底座）：标题栏 + 按钮 + 客户端区域 + 缩放手柄。
 *
 * - **拖动**：按住标题栏移动（受 `bounds` 限制，拖不出桌面）；点在按钮上不触发拖动；
 * - **焦点**：`active` 决定标题栏配色（XP 蓝 / 灰），点窗口任意位置会 `activate()` 并广播
 *   `activate` 事件 —— 由外部窗口管理器据此抬 zIndex；
 * - **最大化 / 还原**：记住还原前的盒子，按 `bounds` 铺满；`minimize()` 只广播事件，
 *   怎么藏（隐藏 or 收到任务栏）交给调用方；
 * - **缩放**：右下角手柄（`resizable: false` 可关），受 `minWidth` / `minHeight` 限制；
 * - **内容**：`content` 或 `setContent()` 装进客户端区域，自动铺满。
 *
 * 外观默认走 Windows XP Luna 配色（可传 `appearance` 覆盖），与组件库主题无关 ——
 * 这类“拟物外壳”本来就要固定配色。
 */
export type ICEWindowAppearance = {
  /** 激活态标题栏渐变（两段色） */
  titleActive?: [string, string];
  /** 非激活态标题栏渐变 */
  titleInactive?: [string, string];
  titleText?: string;
  titleTextInactive?: string;
  body?: string;
  border?: string;
};

export interface ICEWindowOptions {
  /** 组件 id（引擎会用它做唯一标识，e2e/调试时可按 id 定位） */
  id?: string;
  title?: string;
  /** 标题栏左侧的图标字形 */
  icon?: string;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  /** 拖动 / 最大化的活动范围（一般是桌面工作区） */
  bounds?: { left: number; top: number; width: number; height: number };
  titleBarHeight?: number;
  movable?: boolean;
  resizable?: boolean;
  closable?: boolean;
  minimizable?: boolean;
  maximizable?: boolean;
  active?: boolean;
  minWidth?: number;
  minHeight?: number;
  /** 客户端内容（会铺满客户端区域） */
  content?: any;
  appearance?: ICEWindowAppearance;
  onClose?: () => void;
  onMinimize?: () => void;
  onMaximize?: (maximized: boolean) => void;
  onActivate?: () => void;
  onMove?: (left: number, top: number) => void;
  onResize?: (width: number, height: number) => void;
}

/** 标题栏上的小按钮（hover 亮、按下沉）。 */
class ICEWindowButton extends ICEWidget {
  private glyph: ICELabel;
  private baseColor: string;

  constructor(props: { left: number; top: number; size: number; text: string; onClick: () => void }) {
    const theme = iceUIManager.getTheme();
    super({
      left: props.left,
      top: props.top,
      width: props.size,
      height: props.size - 4,
      radius: 3,
      fill: true,
      stroke: false,
      style: { fillStyle: 'rgba(255,255,255,0.45)' },
    });
    this.baseColor = 'rgba(255,255,255,0.45)';
    this.glyph = new ICELabel({
      interactive: false,
      left: 0,
      top: 0,
      width: props.size,
      height: props.size - 4,
      text: props.text,
      align: 'center',
      verticalAlign: 'middle',
      style: { fontSize: 11, fontWeight: theme.font.weightBold, fillStyle: '#0a246a' },
    });
    this.addChild(this.glyph, false);
    this.on('click', props.onClick);
  }

  protected __applyHoverState(): void {
    this.setState({
      style: {
        ...this.state.style,
        fillStyle: this.hovered ? 'rgba(255,255,255,0.85)' : this.baseColor,
      },
    });
    this.revalidate();
  }
}

const DEFAULT_APPEARANCE: Required<ICEWindowAppearance> = {
  titleActive: ['#0058ee', '#3f8cf3'],
  titleInactive: ['#7f9db9', '#a8c0dd'],
  titleText: '#ffffff',
  titleTextInactive: '#e9eef5',
  body: '#ece9d8',
  border: '#0054e3',
};

const TITLE_BANDS = 10;

/** 颜色插值（只处理 #rrggbb）。 */
function mixHex(from: string, to: string, t: number): string {
  const parse = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const [r1, g1, b1] = parse(from);
  const [r2, g2, b2] = parse(to);
  const channel = (a: number, b: number) => Math.round(a + (b - a) * t);
  const toHex = (value: number) => value.toString(16).padStart(2, '0');
  return `#${toHex(channel(r1, r2))}${toHex(channel(g1, g2))}${toHex(channel(b1, b2))}`;
}

export class ICEWindow extends ICEWidget {
  private titleBar: ICEWidget;
  private titleLabel: ICELabel;
  private iconNode: ICELabel;
  private client: ICEWidget;
  private closeButton: ICEWindowButton;
  private minimizeButton: ICEWindowButton;
  private maximizeButton: ICEWindowButton;
  private resizeHandle: ICEWidget;
  private titleBands: ICEWidget[] = [];
  private appearance: Required<ICEWindowAppearance>;
  private titleBarHeight: number;
  private active: boolean;
  private maximized = false;
  private restoreBox: { left: number; top: number; width: number; height: number } | null = null;
  private bounds: { left: number; top: number; width: number; height: number } | null;
  private minWidth: number;
  private minHeight: number;
  private movable: boolean;
  private resizable: boolean;
  private content: any = null;
  private dragOffset: { x: number; y: number } | null = null;
  private resizing = false;
  private resizeStart: { x: number; y: number; width: number; height: number } | null = null;
  private bound = false;
  private readonly options: ICEWindowOptions;

  constructor(props: ICEWindowOptions = {}) {
    const titleBarHeight = props.titleBarHeight ?? 28;
    super({
      id: props.id,
      fill: false,
      stroke: false,
      interactive: true,
      left: props.left,
      top: props.top,
      width: props.width ?? 420,
      height: props.height ?? 320,
    });
    this.options = props;
    this.appearance = { ...DEFAULT_APPEARANCE, ...(props.appearance || {}) };
    this.titleBarHeight = titleBarHeight;
    this.active = props.active !== false;
    this.bounds = props.bounds || null;
    this.minWidth = props.minWidth ?? 220;
    this.minHeight = props.minHeight ?? 140;
    this.movable = props.movable !== false;
    this.resizable = props.resizable !== false;

    // 外壳：XP 窗口的米色窗体 + 蓝色描边
    const body = new ICEWidget({
      left: 0,
      top: 0,
      width: Number(this.state.width),
      height: Number(this.state.height),
      radius: 7,
      fill: true,
      stroke: true,
      style: { fillStyle: this.appearance.body, strokeStyle: this.appearance.border, lineWidth: 1 },
    });
    this.addChild(body, false);

    this.titleBar = new ICEWidget({
      left: 3,
      top: 3,
      width: Number(this.state.width) - 6,
      height: titleBarHeight,
      radius: 5,
      fill: false,
      stroke: false,
    });
    for (let i = 0; i < TITLE_BANDS; i += 1) {
      const band = new ICEWidget({
        left: 0,
        top: (i * titleBarHeight) / TITLE_BANDS,
        width: Number(this.state.width) - 6,
        height: titleBarHeight / TITLE_BANDS + 1,
        fill: true,
        stroke: false,
        style: { fillStyle: '#0058ee' },
      });
      this.titleBar.addChild(band, false);
      this.titleBands.push(band);
    }
    this.iconNode = new ICELabel({
      interactive: false,
      left: 6,
      top: 0,
      width: 18,
      height: titleBarHeight,
      text: props.icon ?? '',
      align: 'center',
      verticalAlign: 'middle',
      style: { fontSize: 13, fillStyle: '#ffffff' },
    });
    this.titleLabel = new ICELabel({
      interactive: false,
      left: 26,
      top: 0,
      width: Number(this.state.width) - 120,
      height: titleBarHeight,
      text: props.title ?? '',
      verticalAlign: 'middle',
      style: { fontSize: 12, fontWeight: '700', fillStyle: this.appearance.titleText },
    });
    this.titleBar.addChild(this.iconNode, false);
    this.titleBar.addChild(this.titleLabel, false);

    const buttonSize = 20;
    const buttonTop = Math.round((titleBarHeight - (buttonSize - 4)) / 2);
    const rightEdge = Number(this.state.width) - 6 - 4;
    this.closeButton = new ICEWindowButton({
      left: rightEdge - buttonSize,
      top: buttonTop,
      size: buttonSize,
      text: '✕',
      onClick: () => {
        if (this.options.closable === false) return;
        this.trigger('close', null, {});
        if (this.options.onClose) this.options.onClose();
      },
    });
    this.maximizeButton = new ICEWindowButton({
      left: rightEdge - buttonSize * 2 - 2,
      top: buttonTop,
      size: buttonSize,
      text: '□',
      onClick: () => {
        if (this.options.maximizable === false) return;
        this.maximized ? this.restore() : this.maximize();
      },
    });
    this.minimizeButton = new ICEWindowButton({
      left: rightEdge - buttonSize * 3 - 4,
      top: buttonTop,
      size: buttonSize,
      text: '─',
      onClick: () => {
        if (this.options.minimizable === false) return;
        this.trigger('minimize', null, {});
        if (this.options.onMinimize) this.options.onMinimize();
      },
    });
    this.titleBar.addChild(this.closeButton, false);
    this.titleBar.addChild(this.maximizeButton, false);
    this.titleBar.addChild(this.minimizeButton, false);
    this.addChild(this.titleBar, false);

    this.client = new ICEWidget({
      left: 3,
      top: 3 + titleBarHeight,
      width: Number(this.state.width) - 6,
      height: Number(this.state.height) - titleBarHeight - 6,
      fill: true,
      stroke: false,
      clipChildren: true,
      style: { fillStyle: '#ffffff' },
    });
    this.addChild(this.client, false);

    this.resizeHandle = new ICEWidget({
      left: Number(this.state.width) - 14,
      top: Number(this.state.height) - 14,
      width: 12,
      height: 12,
      fill: false,
      stroke: false,
    });
    this.addChild(this.resizeHandle, false);

    if (props.content) {
      this.setContent(props.content);
    }
    this.__syncTitleBands();
    // 点窗体任意位置都算激活（含客户端区域）
    this.on('mousedown', () => this.activate());
  }

  public getTitle(): string {
    return this.titleLabel.getText();
  }

  public setTitle(title: string): this {
    this.titleLabel.setText(title ?? '');
    return this;
  }

  public getTitleBar(): ICEWidget {
    return this.titleBar;
  }

  public getTitleBarHeight(): number {
    return this.titleBarHeight;
  }

  /** 客户端区域的盒子（相对窗口自身）。 */
  public getClientBox(): { left: number; top: number; width: number; height: number } {
    return {
      left: Number(this.client.state.left),
      top: Number(this.client.state.top),
      width: Number(this.client.state.width),
      height: Number(this.client.state.height),
    };
  }

  public getClientNode(): ICEWidget {
    return this.client;
  }

  public getCloseButton(): ICEWindowButton {
    return this.closeButton;
  }

  public getMinimizeButton(): ICEWindowButton {
    return this.minimizeButton;
  }

  public getMaximizeButton(): ICEWindowButton {
    return this.maximizeButton;
  }

  public getResizeHandle(): ICEWidget {
    return this.resizeHandle;
  }

  /** 标题栏当前色（激活/非激活的中间色）——测试与主题调试用。 */
  public getTitleBarColor(): string {
    const mid = Math.floor(this.titleBands.length / 2);
    const band = this.titleBands[mid];
    return band ? String(band.state.style.fillStyle) : '';
  }

  public isActive(): boolean {
    return this.active;
  }

  public setActive(active: boolean): this {
    const next = !!active;
    if (next === this.active) {
      return this;
    }
    this.active = next;
    this.__syncTitleBands();
    return this;
  }

  /** 激活窗口并广播（外部据此抬 zIndex）。已经激活时也会广播，方便“置顶”）。 */
  public activate(): this {
    const was = this.active;
    this.active = true;
    if (!was) {
      this.__syncTitleBands();
    }
    this.trigger('activate', null, {});
    if (this.options.onActivate) {
      this.options.onActivate();
    }
    return this;
  }

  public isMaximized(): boolean {
    return this.maximized;
  }

  public maximize(): this {
    if (this.maximized) {
      return this;
    }
    this.restoreBox = {
      left: Number(this.state.left) || 0,
      top: Number(this.state.top) || 0,
      width: Number(this.state.width) || 0,
      height: Number(this.state.height) || 0,
    };
    const bounds = this.__bounds();
    this.maximized = true;
    this.setState({ left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height });
    this.__layout();
    this.trigger('maximize', null, { maximized: true });
    if (this.options.onMaximize) {
      this.options.onMaximize(true);
    }
    return this;
  }

  public restore(): this {
    if (!this.maximized) {
      return this;
    }
    this.maximized = false;
    const box = this.restoreBox;
    this.restoreBox = null;
    if (box) {
      this.setState(box);
    }
    this.__layout();
    this.trigger('maximize', null, { maximized: false });
    if (this.options.onMaximize) {
      this.options.onMaximize(false);
    }
    return this;
  }

  public setContent(node: any): this {
    if (this.content && this.content.parentNode === this.client) {
      this.client.removeChild(this.content);
    }
    this.content = node || null;
    if (this.content) {
      this.client.addChild(this.content, false);
      const box = this.getClientBox();
      this.content.setState({ left: 0, top: 0, width: box.width, height: box.height });
      // 内容自己通常按尺寸重排（列表 / 表格 / 自定义面板），给它一次机会
      if (typeof this.content.revalidate === 'function') {
        this.content.revalidate();
      }
    }
    return this;
  }

  public getContent(): any {
    return this.content;
  }

  public isDragging(): boolean {
    return !!this.dragOffset;
  }

  public isResizing(): boolean {
    return this.resizing;
  }

  public setBounds(bounds: { left: number; top: number; width: number; height: number }): this {
    this.bounds = bounds;
    return this;
  }

  public setSize(width: number, height: number): this {
    this.setState({
      width: Math.max(this.minWidth, Math.round(width) || this.minWidth),
      height: Math.max(this.minHeight, Math.round(height) || this.minHeight),
    });
    this.__layout();
    return this;
  }

  protected afterAddHandler(): void {
    super.afterAddHandler();
    if (this.bound || !this.ice || !this.ice.evtBus) {
      return;
    }
    this.bound = true;
    this.ice.evtBus.on('mousedown', this.__onGlobalMouseDown, this);
    this.ice.evtBus.on('mousemove', this.__onGlobalMouseMove, this);
    this.ice.evtBus.on('mouseup', this.__onGlobalMouseUp, this);
  }

  public revalidate(): this {
    super.revalidate();
    this.__layout();
    return this;
  }

  /** 窗口尺寸被程序式改动时（setState）也要重排内部结构。 */
  protected __afterStateMerge(sizeChanged: boolean): void {
    super.__afterStateMerge(sizeChanged);
    if (sizeChanged) {
      this.__layout();
    }
  }

  private __bounds(): { left: number; top: number; width: number; height: number } {
    if (this.bounds) {
      return this.bounds;
    }
    const parent = this.parentNode;
    return {
      left: 0,
      top: 0,
      width: Number(parent && parent.state && parent.state.width) || Number(this.state.width) || 0,
      height: Number(parent && parent.state && parent.state.height) || Number(this.state.height) || 0,
    };
  }

  /** 标题栏渐变（激活 / 非激活两套色）+ 标题文字色。 */
  private __syncTitleBands(): void {
    const [from, to] = this.active ? this.appearance.titleActive : this.appearance.titleInactive;
    this.titleBands.forEach((band, index) => {
      band.setState({ style: { fillStyle: mixHex(from, to, index / (this.titleBands.length - 1)) } });
    });
    this.titleLabel.setState({
      style: { ...this.titleLabel.state.style, fillStyle: this.active ? this.appearance.titleText : this.appearance.titleTextInactive },
    });
  }

  /** 窗口尺寸变化后重排标题栏 / 客户端 / 按钮 / 手柄。 */
  private __layout(): void {
    const width = Number(this.state.width) || 0;
    const height = Number(this.state.height) || 0;
    const shell = this.childNodes[0];
    if (shell) {
      shell.setState({ width, height });
    }
    const barWidth = Math.max(0, width - 6);
    this.titleBar.setState({ width: barWidth });
    this.titleBands.forEach((band, index) => {
      band.setState({
        top: (index * this.titleBarHeight) / TITLE_BANDS,
        width: barWidth,
        height: this.titleBarHeight / TITLE_BANDS + 1,
      });
    });
    this.titleLabel.setState({ width: Math.max(0, barWidth - 120) });
    const buttonSize = 20;
    const rightEdge = width - 6 - 4;
    this.closeButton.setState({ left: rightEdge - buttonSize, top: Math.round((this.titleBarHeight - (buttonSize - 4)) / 2) });
    this.maximizeButton.setState({ left: rightEdge - buttonSize * 2 - 2 });
    this.minimizeButton.setState({ left: rightEdge - buttonSize * 3 - 4 });
    const clientWidth = Math.max(0, width - 6);
    const clientHeight = Math.max(0, height - this.titleBarHeight - 6);
    this.client.setState({ width: clientWidth, height: clientHeight });
    if (this.content) {
      this.content.setState({ left: 0, top: 0, width: clientWidth, height: clientHeight });
      if (typeof this.content.revalidate === 'function') {
        this.content.revalidate();
      }
    }
    this.resizeHandle.setState({ left: width - 14, top: height - 14 });
    if (this.ice) {
      this.ice.dirty = true;
    }
  }

  /** 节点在世界坐标里的盒子（窗口自身 + 到 this 为止的子级偏移）。 */
  private __nodeBoxWorld(node: ICEWidget): { left: number; top: number; width: number; height: number } {
    const self = getICEWorldBox(this);
    let left = 0;
    let top = 0;
    let cursor: any = node;
    while (cursor && cursor !== this) {
      left += Number(cursor.state && cursor.state.left) || 0;
      top += Number(cursor.state && cursor.state.top) || 0;
      cursor = cursor.parentNode;
    }
    return {
      left: self.left + left,
      top: self.top + top,
      width: Number(node.state.width) || 0,
      height: Number(node.state.height) || 0,
    };
  }

  private __pointIn(node: ICEWidget, evt: any): boolean {
    if (!evt || typeof evt.offsetX !== 'number' || typeof evt.offsetY !== 'number') {
      return false;
    }
    if (!this.ice || typeof this.ice.screenToWorld !== 'function') {
      return false;
    }
    const [wx, wy] = this.ice.screenToWorld(evt.offsetX, evt.offsetY);
    const box = this.__nodeBoxWorld(node);
    return (
      wx >= box.left &&
      wx <= box.left + box.width &&
      wy >= box.top &&
      wy <= box.top + box.height
    );
  }

  private __hitOwnButton(evt: any): boolean {
    return [this.closeButton, this.maximizeButton, this.minimizeButton].some((button) => this.__pointIn(button, evt));
  }

  /** 窗口在父容器坐标系里的原点（拖拽时用它把世界坐标换算回去）。 */
  private __parentOrigin(): { left: number; top: number } {
    const world = getICEWorldBox(this);
    return {
      left: world.left - (Number(this.state.left) || 0),
      top: world.top - (Number(this.state.top) || 0),
    };
  }

  private __onGlobalMouseDown(evt: any): void {
    if (!this.__pointIn(this, evt)) {
      return;
    }
    this.activate();
    if (this.maximized) {
      return;
    }
    if (this.resizable && this.__pointIn(this.resizeHandle, evt)) {
      this.resizing = true;
      const [wx, wy] = this.ice.screenToWorld(evt.offsetX, evt.offsetY);
      this.resizeStart = {
        x: wx,
        y: wy,
        width: Number(this.state.width) || 0,
        height: Number(this.state.height) || 0,
      };
      return;
    }
    if (!this.movable || this.__hitOwnButton(evt)) {
      return;
    }
    // 标题栏区域（含标题文字/图标）才开始拖动
    const inTitleBar =
      this.__pointIn(this.titleBar, evt) || this.__pointIn(this.iconNode, evt) || this.__pointIn(this.titleLabel, evt);
    if (!inTitleBar) {
      return;
    }
    const [wx, wy] = this.ice.screenToWorld(evt.offsetX, evt.offsetY);
    const origin = this.__parentOrigin();
    // 记录指针相对窗口左上角的偏移（窗口世界原点 = 父原点 + 自身 left/top）
    this.dragOffset = {
      x: wx - (origin.left + (Number(this.state.left) || 0)),
      y: wy - (origin.top + (Number(this.state.top) || 0)),
    };
  }

  private __onGlobalMouseMove(evt: any): void {
    if (!this.ice || !evt || typeof evt.offsetX !== 'number') {
      return;
    }
    if (this.resizing && this.resizeStart) {
      const [wx, wy] = this.ice.screenToWorld(evt.offsetX, evt.offsetY);
      const width = Math.max(this.minWidth, this.resizeStart.width + (wx - this.resizeStart.x));
      const height = Math.max(this.minHeight, this.resizeStart.height + (wy - this.resizeStart.y));
      this.setState({ width: Math.round(width), height: Math.round(height) });
      this.__layout();
      this.trigger('resize', null, { width: this.state.width, height: this.state.height });
      if (this.options.onResize) {
        this.options.onResize(Number(this.state.width), Number(this.state.height));
      }
      return;
    }
    if (!this.dragOffset) {
      return;
    }
    const [wx, wy] = this.ice.screenToWorld(evt.offsetX, evt.offsetY);
    const bounds = this.__bounds();
    const origin = this.__parentOrigin();
    const maxLeft = Math.max(bounds.left, bounds.left + bounds.width - (Number(this.state.width) || 0));
    const maxTop = Math.max(bounds.top, bounds.top + bounds.height - (Number(this.state.height) || 0));
    const left = Math.min(maxLeft, Math.max(bounds.left, wx - this.dragOffset.x - origin.left));
    const top = Math.min(maxTop, Math.max(bounds.top, wy - this.dragOffset.y - origin.top));
    this.setState({ left: Math.round(left), top: Math.round(top) });
    this.trigger('move', null, { left: this.state.left, top: this.state.top });
    if (this.options.onMove) {
      this.options.onMove(Number(this.state.left), Number(this.state.top));
    }
  }

  private __onGlobalMouseUp(): void {
    this.dragOffset = null;
    this.resizing = false;
    this.resizeStart = null;
  }
}
