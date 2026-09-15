import { ICEWidget } from '../core/ICEWidget';
import { ICELayoutManager } from 'ice-render';
import { iceUIManager } from '../core/ICEManager';
import { getICEWorldBox } from '../util/ICEWorldBox';

/** 分隔条：悬停 / 拖动时高亮（视觉状态自己维护，父组件只管拖动逻辑）。 */
class ICESplitterDivider extends ICEWidget {
  private active = false;

  constructor(props: any = {}) {
    const theme = iceUIManager.getTheme();
    super({
      fill: true,
      stroke: false,
      radius: 0,
      ...props,
      style: { fillStyle: theme.colors.border, ...(props.style || {}) },
    });
  }

  public setActive(active: boolean): this {
    if (this.active === !!active) {
      return this;
    }
    this.active = !!active;
    this.__sync();
    return this;
  }

  protected __applyHoverState(): void {
    this.__sync();
  }

  private __sync(): void {
    const theme = iceUIManager.getTheme();
    this.setState({
      style: {
        ...this.state.style,
        fillStyle: this.active || this.hovered ? theme.colors.primary : theme.colors.border,
      },
    });
  }
}

/**
 * 分隔面板：两栏 + 可拖动的分隔条。
 *
 * - `direction: 'horizontal'`（默认）左右分栏，`'vertical'` 上下分栏；
 * - `size` 是第一栏的像素尺寸，夹取范围 `[min, 容器尺寸 - dividerSize - min]`；
 * - 拖动分隔条改变尺寸（mousedown 必须落在分隔条上），拖动中触发 `resize`
 *   （载荷 `{ size }`）与 `onResize`；
 * - 两栏是调用方传进来的组件，本组件只负责摆位置与改尺寸。
 */
export interface ICESplitterOptions {
  /** 组件 id（引擎会用它做唯一标识，e2e/调试时可按 id 定位） */
  id?: string;
  /** horizontal = 左右分栏（默认），vertical = 上下分栏 */
  direction?: 'horizontal' | 'vertical';
  /** 第一栏尺寸（像素） */
  size?: number;
  /** 两栏最小尺寸，默认 40 */
  min?: number;
  /** 分隔条粗细，默认 6 */
  dividerSize?: number;
  /** 第一栏组件 */
  first?: any;
  /** 第二栏组件 */
  second?: any;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  onResize?: (size: number) => void;
}

/**
 * 分隔布局的自持策略（2026-09-15）。
 *
 * 库里第三类"该自持"的容器：两栏 + 分隔条的尺寸**由拖拽驱动**，不是布局算出来的 ——
 * 通用布局器表达不了"第一栏宽度 = 用户拖到哪"，于是组件自己实现一个 `ICELayoutManager`
 * （对齐 Swing 的 `JSplitPane` + `BasicSplitPaneUI`：分隔条尺寸由 UI 管，不由 LayoutManager 管）。
 *
 * 策略只摆位置：`requestedSize → clamp → size` 的夹取、拖拽态、`onResize` 回调都留在组件里。
 */
class ICESplitterLayout extends ICELayoutManager {
  layoutContainer(container: any): void {
    const splitter = container as ICESplitter;
    const width = Number(container.state.width) || 0;
    const height = Number(container.state.height) || 0;
    // 用 requestedSize 重新夹取：容器可能"先建后量"（初始 100×100），早先夹取过的值不能粘住
    const size = splitter.__resolveSize();
    const dividerSize = splitter.getDividerSize();
    const horizontal = splitter.getDirection() === 'horizontal';
    const first = splitter.getFirstNode();
    const second = splitter.getSecondNode();
    const divider = splitter.getDividerNode();

    if (horizontal) {
      if (first) {
        first.setState({ left: 0, top: 0, width: size, height });
      }
      divider.setState({ left: size, top: 0, width: dividerSize, height });
      if (second) {
        second.setState({ left: size + dividerSize, top: 0, width: Math.max(0, width - size - dividerSize), height });
      }
    } else {
      if (first) {
        first.setState({ left: 0, top: 0, width, height: size });
      }
      divider.setState({ left: 0, top: size, width, height: dividerSize });
      if (second) {
        second.setState({ left: 0, top: size + dividerSize, width, height: Math.max(0, height - size - dividerSize) });
      }
    }
  }

  /** 内部策略：不进文档（`null` = 由 `ICESplitter` 构造时重建，分隔位置在 state 里）。 */
  public toJSON(): any {
    return null;
  }
}

export class ICESplitter extends ICEWidget {
  private direction: 'horizontal' | 'vertical';
  /** 调用方要的尺寸（不被「当下容器的夹取」覆盖，容器变大后能恢复） */
  private requestedSize: number;
  private size: number;
  private min: number;
  private dividerSize: number;
  private first: any = null;
  private second: any = null;
  private divider: ICESplitterDivider;
  private onResize: ((size: number) => void) | null;
  private dragging = false;
  private bound = false;

  constructor(props: ICESplitterOptions) {
    const theme = iceUIManager.getTheme();
    const dividerSize = props.dividerSize ?? 6;
    const direction = props.direction === 'vertical' ? 'vertical' : 'horizontal';
    super({
      id: props.id,
      fill: false,
      stroke: false,
      // 分隔面板本身是个「纯容器」：它的矩形不该参与命中，否则后创建的分隔器
      // 会把两栏内部（更早创建的组件）的点击全吃掉。拖动只依赖分隔条 + 全局鼠标事件。
      interactive: false,
      left: props.left,
      top: props.top,
      width: props.width ?? 320,
      height: props.height ?? 200,
    });
    this.direction = direction;
    this.dividerSize = Math.max(2, dividerSize);
    this.min = Math.max(0, Number(props.min) || 40);
    this.onResize = typeof props.onResize === 'function' ? props.onResize : null;
    this.requestedSize = Number(props.size) || 0;
    this.size = this.__clamp(this.requestedSize);
    this.first = props.first ?? null;
    this.second = props.second ?? null;
    this.divider = new ICESplitterDivider({
      left: 0,
      top: 0,
      width: direction === 'horizontal' ? this.dividerSize : Number(this.state.width),
      height: direction === 'horizontal' ? Number(this.state.height) : this.dividerSize,
    });
    // 创建顺序 = z 序：两栏先建、分隔条最后，拖动手柄永远在最上层
    if (this.first) {
      this.addChild(this.first, false);
    }
    if (this.second) {
      this.addChild(this.second, false);
    }
    this.addChild(this.divider, false);
    // 排布交给自持策略（见 ICESplitterLayout 的说明）
    this.setLayout(new ICESplitterLayout());
    this.doLayout();
  }

  /** 当前第一栏尺寸。 */
  public getSize(): number {
    return this.size;
  }

  /** 第一栏占比（0..1）。 */
  public getRatio(): number {
    const total = this.__total();
    return total > 0 ? this.size / total : 0;
  }

  public setRatio(ratio: number): this {
    const clamped = Math.max(0, Math.min(1, Number(ratio) || 0));
    return this.setSize(clamped * this.__total());
  }

  public setSize(size: number): this {
    this.requestedSize = Number(size) || 0;
    const next = this.__clamp(this.requestedSize);
    if (next === this.size) {
      return this;
    }
    this.size = next;
    this.doLayout();
    this.trigger('resize', null, { size: this.size });
    if (this.onResize) {
      this.onResize(this.size);
    }
    return this;
  }

  public getDividerNode(): ICESplitterDivider {
    return this.divider;
  }

  public getFirstNode(): any {
    return this.first;
  }

  public getSecondNode(): any {
    return this.second;
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

  /** 自身尺寸变化后重排两栏（引擎在 setState 尺寸变化时会调这个钩子）。 */
  public revalidate(): this {
    super.revalidate();
    this.doLayout();
    return this;
  }

  /** 自身尺寸被程序式改动（setState）时也要重排两栏（引擎只回调这个钩子）。 */
  protected __afterStateMerge(sizeChanged: boolean): void {
    super.__afterStateMerge(sizeChanged);
    if (sizeChanged) {
      this.doLayout();
    }
  }

  protected __applyHoverState(): void {
    // 悬停在分隔条上由分隔条自己处理
  }

  /** 拖动手柄的可视反馈。 */
  private __syncDivider(): void {
    this.divider.setActive(this.dragging);
  }

  /** 第一栏可用的最大尺寸：容器减去分隔条与第二栏最小尺寸。 */
  private __max(): number {
    return Math.max(this.min, this.__total() - this.dividerSize - this.min);
  }

  private __total(): number {
    return this.direction === 'horizontal' ? Number(this.state.width) || 0 : Number(this.state.height) || 0;
  }

  private __clamp(size: number): number {
    return Math.max(this.min, Math.min(this.__max(), Number(size) || 0));
  }

  /** 策略用：按当前 requestedSize 重新夹取并回写 `size`（容器尺寸可能刚变过）。 */
  public __resolveSize(): number {
    this.size = this.__clamp(this.requestedSize);
    return this.size;
  }

  public getDirection(): 'horizontal' | 'vertical' {
    return this.direction;
  }

  public getDividerSize(): number {
    return this.dividerSize;
  }

  private __onGlobalMouseDown(evt: any): void {
    if (!this.enabled || !this.__isOnDivider(evt)) {
      return;
    }
    this.dragging = true;
    this.__updateFromEvent(evt);
    this.__syncDivider();
  }

  private __onGlobalMouseMove(evt: any): void {
    if (!this.dragging) {
      return;
    }
    this.__updateFromEvent(evt);
  }

  private __onGlobalMouseUp(): void {
    if (!this.dragging) {
      return;
    }
    this.dragging = false;
    this.__syncDivider();
  }

  /** 是否可拖动：分隔条自身 + 2px 容错（细条不好瞄）。 */
  public isDragging(): boolean {
    return this.dragging;
  }

  private __isOnDivider(evt: any): boolean {
    if (!evt || typeof evt.offsetX !== 'number' || typeof evt.offsetY !== 'number') {
      return false;
    }
    if (!this.ice || typeof this.ice.screenToWorld !== 'function') {
      return false;
    }
    const [wx, wy] = this.ice.screenToWorld(evt.offsetX, evt.offsetY);
    const box = getICEWorldBox(this.divider);
    const slop = 2;
    return (
      wx >= box.left - slop &&
      wx <= box.left + box.width + slop &&
      wy >= box.top - slop &&
      wy <= box.top + box.height + slop
    );
  }

  private __updateFromEvent(evt: any): void {
    if (!evt || typeof evt.offsetX !== 'number') {
      return;
    }
    if (!this.ice || typeof this.ice.screenToWorld !== 'function') {
      return;
    }
    const [wx, wy] = this.ice.screenToWorld(evt.offsetX, evt.offsetY);
    const box = getICEWorldBox(this);
    const next = (this.direction === 'horizontal' ? wx - box.left : wy - box.top) - this.dividerSize / 2;
    this.setSize(next);
  }
}
