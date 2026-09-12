import { UIComponent } from './UIComponent';
import { resolveUIOverlayPosition, UIOverlayPlacement } from '../util/UIOverlayPosition';
import { fadeIn, fadeOut, scaleIn, UIEasing, UIFrameDriver } from '../util/UIAnimation';

/**
 * 弹层/浮层底座。
 *
 * 所有需要「浮在其它组件之上」的组件（Modal、Dropdown、Select、Tooltip、Popover、
 * 右键菜单…）都走这一层，避免每个组件各自实现锚点定位、z 序、点外关闭、Esc 关闭。
 *
 * 实现要点：
 * - 浮层根节点挂在 **ICE 的工具层**（`ice.addTool`）：工具层会被递归渲染、绘制在所有
 *   组件之上，且不参与 getComponentById 查找；根节点 `interactive:false`，所以它自身
 *   不会被命中，只有浮层内容可交互。
 * - 浮层内容是根节点的子组件，位置由 `resolveUIOverlayPosition()` 按锚点世界盒算出来
 *   （支持 12 种 placement、空间不足自动翻转、夹进可见范围；带视口缩放/平移也正确）。
 * - 关闭：点击浮层与锚点之外、Esc、或调用 handle.close()。
 */

export type UIOverlayCloseReason = 'api' | 'outside' | 'esc' | 'exclusive';

export interface UIOverlayOptions {
  /** 触发组件（浮层贴着它定位）；用 `centered` 时可省略 */
  anchor?: any;
  /** 居中放置（不依赖锚点）—— Modal / Drawer 这类全屏浮层用 */
  centered?: boolean;
  /** 浮层内容组件；所有权交给管理器 —— 关闭时会被移除并销毁 */
  content: any;
  placement?: UIOverlayPlacement;
  offset?: number;
  padding?: number;
  flip?: boolean;
  /** 点击浮层与锚点之外时关闭（默认 true） */
  closeOnOutsideClick?: boolean;
  /** 按下 Esc 时关闭（默认 true） */
  closeOnEsc?: boolean;
  /** 打开时先关闭其它浮层（默认 true） */
  exclusive?: boolean;
  /**
   * 阻断型浮层（Modal 的遮罩）：z 序在最上，且**不会被后来打开的非阻断浮层关掉**
   * （否则鼠标扫过页面触发 Tooltip 就会把模态一起关掉）。
   */
  blocking?: boolean;
  /** 入场动效：none（默认）/ fade / scale（淡入 + 轻微放大） */
  enterAnimation?: 'none' | 'fade' | 'scale';
  /** 出场动效：none（默认，立即移除）/ fade（淡出后再移除） */
  exitAnimation?: 'none' | 'fade';
  /** 动效参数（时长/缓动/帧驱动，测试可注入 driver） */
  animation?: { duration?: number; delay?: number; easing?: UIEasing; driver?: UIFrameDriver };
  onClose?: (reason: UIOverlayCloseReason) => void;
}

export interface UIOverlayHandle {
  close(): void;
  isOpen(): boolean;
  /** 锚点移动 / 内容尺寸变化后重算位置 */
  update(): void;
}

interface UIOverlayEntry {
  handle: UIOverlayHandle;
  anchor: any;
  content: any;
  options: UIOverlayOptions;
}

/** 组件盒子（世界坐标）：UI 组件没有旋转，按父链累加 left/top 即可。 */
function worldBox(component: any): { left: number; top: number; width: number; height: number } {
  let left = 0;
  let top = 0;
  let node = component;
  while (node && node.state) {
    left += Number(node.state.left) || 0;
    top += Number(node.state.top) || 0;
    node = node.parentNode;
  }
  return {
    left,
    top,
    width: Number(component && component.state && component.state.width) || 0,
    height: Number(component && component.state && component.state.height) || 0,
  };
}

function inside(box: { left: number; top: number; width: number; height: number }, x: number, y: number): boolean {
  return x >= box.left && x <= box.left + box.width && y >= box.top && y <= box.top + box.height;
}

export class UIOverlayManager {
  private ice: any;
  private layer: any = null;
  private entries: UIOverlayEntry[] = [];
  private bound = false;

  constructor(ice: any) {
    this.ice = ice;
  }

  /**
   * 幂等：创建浮层根节点（挂到 ICE 工具层）并绑定关闭事件。
   * `open()` 会自动调用，通常不需要手动调。
   */
  public start(): this {
    if (this.bound || !this.ice) {
      return this;
    }
    if (!this.layer) {
      this.layer = new UIComponent({
        id: 'ice-ui-overlay-layer',
        fill: false,
        stroke: false,
        interactive: false,
        draggable: false,
        transformable: false,
        left: 0,
        top: 0,
        width: Number(this.ice.canvasWidth) || 0,
        height: Number(this.ice.canvasHeight) || 0,
      });
    }
    if (typeof this.ice.addTool === 'function') {
      this.ice.addTool(this.layer);
    }
    const bus = this.ice.evtBus;
    if (bus && typeof bus.on === 'function') {
      bus.on('mousedown', this.__onMouseDown, this);
      bus.on('keydown', this.__onKeyDown, this);
    }
    this.bound = true;
    return this;
  }

  /** 解绑并移除浮层根节点（关闭所有浮层）。 */
  public stop(): this {
    this.closeAll('api');
    if (!this.bound) {
      return this;
    }
    const bus = this.ice && this.ice.evtBus;
    if (bus && typeof bus.off === 'function') {
      bus.off('mousedown', this.__onMouseDown, this);
      bus.off('keydown', this.__onKeyDown, this);
    }
    if (this.layer && this.ice && typeof this.ice.removeTool === 'function') {
      this.ice.removeTool(this.layer);
    }
    this.layer = null;
    this.bound = false;
    return this;
  }

  public open(options: UIOverlayOptions): UIOverlayHandle {
    const content = options && options.content;
    if (!content) {
      throw new Error('UIOverlayManager.open() 需要 content');
    }
    this.start();
    if (options.exclusive !== false) {
      // 非阻断浮层只关掉其它非阻断浮层；阻断浮层（模态）打开时清场
      if (options.blocking) {
        this.closeAll('exclusive');
      } else {
        const pending = this.entries.filter((entry) => !entry.options.blocking);
        pending.forEach((entry) => this.close(entry.handle, 'exclusive'));
      }
    }

    const entry: UIOverlayEntry = { handle: null as any, anchor: options.anchor, content, options };
    const handle: UIOverlayHandle = {
      close: () => this.close(handle, 'api'),
      isOpen: () => this.entries.indexOf(entry) !== -1,
      update: () => {
        if (this.entries.indexOf(entry) !== -1) {
          this.__place(entry);
        }
      },
    };
    entry.handle = handle;

    this.layer.addChild(content);
    this.entries.push(entry);
    this.__place(entry);
    const enter = options.enterAnimation || 'none';
    if (enter === 'fade') {
      fadeIn(content, options.animation);
    } else if (enter === 'scale') {
      scaleIn(content, options.animation);
    }
    this.__markDirty();
    return handle;
  }

  public close(handle: UIOverlayHandle, reason: UIOverlayCloseReason = 'api'): void {
    const index = this.entries.findIndex((entry) => entry.handle === handle);
    if (index === -1) {
      return;
    }
    const entry = this.entries[index];
    this.entries.splice(index, 1);
    if (entry.options.exitAnimation === 'fade') {
      // 淡出完再真正移除（等待期间 entry 已从列表里摘掉，isOpen 立即变 false）
      fadeOut(entry.content, {
        ...(entry.options.animation || {}),
        onFinish: () => this.__destroyEntry(entry, reason),
      });
      return;
    }
    this.__destroyEntry(entry, reason);
  }

  public closeAll(reason: UIOverlayCloseReason = 'api'): void {
    if (!this.entries.length) {
      return;
    }
    const pending = this.entries.splice(0, this.entries.length);
    pending.forEach((entry) => this.__destroyEntry(entry, reason));
  }

  public isOpen(): boolean {
    return this.entries.length > 0;
  }

  public getLayer(): any {
    return this.layer;
  }

  private __destroyEntry(entry: UIOverlayEntry, reason: UIOverlayCloseReason): void {
    const { layer } = this;
    if (layer && layer.childNodes && layer.childNodes.indexOf(entry.content) !== -1) {
      layer.removeChild(entry.content);
    }
    this.__markDirty();
    if (typeof entry.options.onClose === 'function') {
      entry.options.onClose(reason);
    }
  }

  private __place(entry: UIOverlayEntry): void {
    const { options, anchor, content } = entry;
    const container = this.__visibleWorldRect();
    if (options.centered || !anchor) {
      const width = Number(content.state && content.state.width) || 0;
      const height = Number(content.state && content.state.height) || 0;
      content.setState({
        left: container.left + (container.width - width) / 2,
        top: container.top + (container.height - height) / 2,
      });
      return;
    }
    const position = resolveUIOverlayPosition({
      anchor: worldBox(anchor),
      content: {
        width: Number(content.state && content.state.width) || 0,
        height: Number(content.state && content.state.height) || 0,
      },
      container,
      placement: options.placement,
      offset: options.offset,
      padding: options.padding,
      flip: options.flip,
    });
    content.setState({ left: position.left, top: position.top });
  }

  /** 可见世界矩形（含视口缩放/平移）；拿不到视口信息时退回画布尺寸。 */
  private __visibleWorldRect(): { left: number; top: number; width: number; height: number } {
    const width = Number(this.ice && this.ice.canvasWidth) || 0;
    const height = Number(this.ice && this.ice.canvasHeight) || 0;
    const vp =
      this.ice && typeof this.ice.getRenderViewport === 'function' ? this.ice.getRenderViewport() : null;
    const scale = vp && vp.scale ? vp.scale : 1;
    return {
      left: vp ? -(vp.tx || 0) / scale : 0,
      top: vp ? -(vp.ty || 0) / scale : 0,
      width: width / scale,
      height: height / scale,
    };
  }

  private __markDirty(): void {
    if (this.ice && this.ice.dirty !== undefined) {
      this.ice.dirty = true;
    }
  }

  private __onMouseDown(evt: any): void {
    if (!this.entries.length || !evt || typeof evt.offsetX !== 'number' || typeof evt.offsetY !== 'number') {
      return;
    }
    const closable = this.entries.filter((entry) => entry.options.closeOnOutsideClick !== false);
    if (!closable.length) {
      return;
    }
    const [wx, wy] = this.ice.screenToWorld(evt.offsetX, evt.offsetY);
    // 命中任一浮层内容或它的锚点 → 不算「点在外面」（锚点自身负责 toggle）
    const hitAny = this.entries.some(
      (entry) =>
        inside(worldBox(entry.content), wx, wy) ||
        (!!entry.anchor && inside(worldBox(entry.anchor), wx, wy)),
    );
    if (!hitAny) {
      this.closeAll('outside');
    }
  }

  private __onKeyDown(evt: any): void {
    if (!this.entries.length) {
      return;
    }
    const raw = evt && (evt.originalEvent || evt);
    const key = raw && (raw.key || raw.code);
    if (key !== 'Escape' && key !== 'Esc') {
      return;
    }
    const closable = this.entries.filter((entry) => entry.options.closeOnEsc !== false);
    closable.forEach((entry) => this.close(entry.handle, 'esc'));
  }
}

/** 每个 ICE 实例一个管理器（与 UIHoverManager 的「显式启动」风格一致，但可懒创建）。 */
const managers = new WeakMap<object, UIOverlayManager>();

export function getUIOverlayManager(ice: any): UIOverlayManager {
  if (!ice || typeof ice !== 'object') {
    throw new Error('getUIOverlayManager(ice) 需要一个 ICE 实例');
  }
  let manager = managers.get(ice);
  if (!manager) {
    manager = new UIOverlayManager(ice);
    managers.set(ice, manager);
  }
  return manager;
}
