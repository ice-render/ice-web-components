import { ICEWidget } from './ICEWidget';
import { ICELabel } from '../components/ICELabel';
import { ICEPanel } from '../components/ICEPanel';
import { ICEButton } from '../components/ICEButton';
import { iceUIManager } from './ICEManager';
import { fadeOut, slideIn, ICEEasing, ICEFrameDriver } from '../util/ICEAnimation';
import { token, type ICEThemeTokenRef } from 'ice-render';

/**
 * 全局提示（Message / Notification）。
 *
 * - 消息挂在**独立的工具层容器**上，与浮层系统解耦：打开 Modal / Popover 不会清掉消息，
 *   消息也不参与浮层的 exclusive 关闭；
 * - `show()` 顶部居中堆叠，`notification()` 右下角倒序堆叠；
 * - duration 到期自动淡出后移除（0 表示常驻）；每条消息返回 handle 可单独关闭。
 */

export type ICEMessageType = 'info' | 'success' | 'warning' | 'error' | 'loading';

export interface ICEMessageOptions {
  text: string;
  type?: ICEMessageType;
  /** 毫秒；0 表示不自动消失（默认 3000） */
  duration?: number;
  /** 关闭后回调 */
  onClose?: () => void;
  animation?: { duration?: number; delay?: number; easing?: ICEEasing; driver?: ICEFrameDriver };
}

export interface ICENotificationOptions {
  title: string;
  description?: string;
  type?: ICEMessageType;
  duration?: number;
  onClose?: () => void;
  animation?: { duration?: number; delay?: number; easing?: ICEEasing; driver?: ICEFrameDriver };
}

export interface ICEMessageHandle {
  close(): void;
  isOpen(): boolean;
  getNode(): any;
}

interface ICEMessageEntry {
  handle: ICEMessageHandle;
  node: any;
  options: ICEMessageOptions;
  kind: 'message' | 'notification';
  timer: any;
}

const MESSAGE_GAP = 12;
const EDGE = 16;
const MIN_WIDTH = 160;
/**
 * 单条消息的最大宽度。
 *
 * 以前是 320 —— 对中文太窄：13px 一行只放得下约 24 个字，
 * 「报警：生化池溶解氧偏低，建议提高鼓风机频率并检查曝气头堵塞情况」这种**正常长度的告警**
 * 都会被截掉一截。放宽到 480（约 36 个中文字），同时不超过画布宽度（两边各留 EDGE）。
 */
const MAX_WIDTH = 480;
/** 文案区两侧预留给类型图标与内边距的宽度（与下面 show() 里的布局保持一致）。 */
const TEXT_INSET = 46;

/**
 * 引擎「置顶档」的起点 —— `bigZIndexNum`（ice-render `src/consts/BIG_ZINDEX_NUMBER.ts`）。
 * 引擎自带的工具层（变换 / 连线控制面板、连线插槽）都落在这一档里（`1e7 + 1 .. +1002`）。
 */
const ENGINE_TOP_BAND = 10000000;

/**
 * 消息层及其子树的 zIndex。
 *
 * 为什么不靠默认的自增 zIndex（必须显式给定一个「高于全部工具」的固定值）：
 * 各工具层（浮层管理器 / 焦点环 / 控制面板）的 zIndex 都是**构造时自增**的，而消息层是首次
 * `show()` 才懒创建，于是**任何在第一条消息之后创建的工具层都会拿到更大的自增值而反超它**
 * （典型现象：「先弹消息、再打开 Modal」时，后建的浮层把顶部的消息盖住）。
 * 因此消息层与每条消息的整棵子树都固定抬到置顶档之上，保证永远在最上层。
 *
 * ⚠️ **2026-09-17（引擎 2.13）之后的现状**：绘制顺序已改成「树序 + 兄弟按 zIndex」，
 * 且工具层整体画在组件层之上 —— 单靠 `MESSAGE_LAYER_ZINDEX` 抬**层**本身就已经够用，
 * 下面 `__raiseSubtree()` 那套"整棵子树设成同一个 zIndex"是旧语义（全局按 zIndex 排序）留下的
 * 兜底。保留它有两个理由：① 老引擎（<2.13）仍要能跑；② 同值不破坏子树内部顺序，无害。
 * 新代码不要照抄这个手法。
 */
const MESSAGE_LAYER_ZINDEX = ENGINE_TOP_BAND * 2;

export class ICEMessageManager {
  private ice: any;
  private layer: ICEWidget | null = null;
  private entries: ICEMessageEntry[] = [];
  private bound = false;

  constructor(ice: any) {
    this.ice = ice;
  }

  /** 幂等：创建消息容器（挂 ICE 工具层）。 */
  public start(): this {
    if (this.bound || !this.ice) {
      return this;
    }
    this.layer = new ICEWidget({
      id: 'ice-ui-message-layer',
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
    // 消息层固定置顶：其余工具层都是构造时自增的 zIndex，后建者会反超（见 MESSAGE_LAYER_ZINDEX）。
    this.layer.state.zIndex = MESSAGE_LAYER_ZINDEX;
    if (typeof this.ice.addTool === 'function') {
      this.ice.addTool(this.layer);
    }
    this.bound = true;
    return this;
  }

  public stop(): this {
    this.closeAll();
    if (this.bound && this.layer && typeof this.ice.removeTool === 'function') {
      this.ice.removeTool(this.layer);
    }
    this.layer = null;
    this.bound = false;
    return this;
  }

  public getLayer(): ICEWidget | null {
    return this.layer;
  }

  /**
   * 量一行文字的宽度：借引擎的 `ICELabel`（内层是 `ICEText`）实测。
   *
   * 拿不到实测值时按「中文一字 = 一个字号」粗估 —— 比旧的 `length × 7` 靠谱得多
   * （那等于假设每个字都是半个字号，中文必然溢出）。
   */
  private __measureTextWidth(text: string, fontSize: number): number {
    try {
      const probe = new ICELabel({ text, style: { fontSize } });
      const width = Number(probe.state && probe.state.width) || 0;
      // 构造期还没有 canvas ctx，`ICEText` 走 DOM 兜底测量；在无 DOM 量测的运行时（jsdom / 小程序）
      // 拿到的会是包装盒的默认值（10）—— 小于一个字号就当作"没量出来"，走下面的粗估。
      // 真实浏览器里这条分支给出的是按同一套字体量出来的宽度，比按字数估准得多。
      if (width >= fontSize) return width;
    } catch (error) {
      // 量不出来（无 DOM / 极端环境）就走下面的粗估，不要让消息发不出来
    }
    return Array.from(text).length * fontSize;
  }

  /** 消息的最大宽度：不越过画布（两边各留 EDGE），避免窄画布上出界。 */
  private __messageMaxWidth(): number {
    const canvasWidth = Number(this.ice && this.ice.canvasWidth) || 0;
    if (!(canvasWidth > 0)) return MAX_WIDTH;
    return Math.min(MAX_WIDTH, canvasWidth - 2 * EDGE);
  }

  /** 顶部居中消息。 */
  public show(options: ICEMessageOptions): ICEMessageHandle {
    const text = String(options.text ?? '');
    return this.__push('message', options, (theme) => {
      // 宽度按**实测**文字算，不再用 `text.length * 7` 粗估：中文一字约等于字号宽、拉丁约 0.55 字号宽，
      // 一个系数必然一边溢出、一边留白 —— 溢出的那一侧以前会被 canvas 压扁字形（见 ice-render 的 textOverflow）。
      const width = Math.max(
        MIN_WIDTH,
        Math.min(this.__messageMaxWidth(), Math.round(this.__measureTextWidth(text, 13)) + TEXT_INSET)
      );
      const height = 34;
      const panel = new ICEPanel({
        width,
        height,
        radius: theme.radius.md,
        style: { fillStyle: token('ui.colors.surface'), strokeStyle: token('ui.colors.border'), shadow: 'md' },
      });
      const color = this.__typeColor(options.type);
      panel.addChild(
        new ICELabel({
          left: 12,
          top: 0,
          width: 18,
          height,
          verticalAlign: 'middle',
          text: this.__typeIcon(options.type),
          style: { fontSize: 14, fillStyle: color },
        }),
        false,
      );
      panel.addChild(
        new ICELabel({
            left: 34,
            top: 0,
            width: width - TEXT_INSET,
            height,
          verticalAlign: 'middle',
          text,
          style: { fontSize: 13, fillStyle: token('ui.colors.text') },
        }),
        false,
      );
      return panel;
    });
  }

  /** 右下角通知（带标题、说明与关闭按钮）。 */
  public notification(options: ICENotificationOptions): ICEMessageHandle {
    const title = String(options.title ?? '');
    const description = String(options.description ?? '');
    return this.__push(
      'notification',
      { ...options, text: title },
      (theme, entry) => {
        const width = 300;
        const bodyHeight = description ? 20 : 0;
        const height = 16 + 22 + bodyHeight + 14;
        const panel = new ICEPanel({
          width,
          height,
          radius: theme.radius.md,
          style: { fillStyle: token('ui.colors.surface'), strokeStyle: token('ui.colors.border'), shadow: 'lg' },
        });
        panel.addChild(
          new ICELabel({
            left: 14,
            top: 14,
            width: width - 60,
            height: 22,
            verticalAlign: 'middle',
            text: title,
            style: { fontSize: 14, fontWeight: '600', fillStyle: token('ui.colors.text') },
          }),
          false,
        );
        if (description) {
          panel.addChild(
            new ICELabel({
              left: 14,
              top: 14 + 22,
              width: width - 28,
              height: bodyHeight,
              verticalAlign: 'middle',
              text: description,
              style: { fontSize: 12, fillStyle: token('ui.colors.textSecondary') },
            }),
            false,
          );
        }
        const closeButton = new ICEButton({
          left: width - 44,
          top: 12,
          width: 32,
          height: 24,
          text: '✕',
          variant: 'text',
          size: 'small',
        });
        closeButton.on('click', () => this.__closeEntry(entry));
        panel.addChild(closeButton, false);
        return panel;
      },
      true,
    );
  }

  public closeAll(): void {
    this.entries.slice().forEach((entry) => this.__closeEntry(entry));
  }

  public isOpen(): boolean {
    return this.entries.length > 0;
  }

  private __push(
    kind: 'message' | 'notification',
    options: ICEMessageOptions,
    create: (theme: any, entry: ICEMessageEntry) => any,
    closable = false,
  ): ICEMessageHandle {
    this.start();
    const theme = iceUIManager.getTheme();
    const entry: ICEMessageEntry = {
      handle: null as any,
      node: null,
      options,
      kind,
      timer: null,
    };
    const node = create(theme, entry);
    entry.node = node;
    const handle: ICEMessageHandle = {
      close: () => this.__closeEntry(entry),
      isOpen: () => this.entries.indexOf(entry) !== -1,
      getNode: () => node,
    };
    entry.handle = handle;

    this.layer!.addChild(node);
    // 整棵消息子树同抬到置顶档（拉平后是全局 zIndex 排序，只抬层不够）。
    this.__raiseSubtree(node, MESSAGE_LAYER_ZINDEX);
    this.entries.push(entry);
    this.__relayout();

    // 入场动效（滑入 + 淡入）
    const from = kind === 'notification' ? 'right' : 'top';
    const targetLeft = Number(node.state.left) || 0;
    const targetTop = Number(node.state.top) || 0;
    if (options.animation && options.animation.duration === 0) {
      node.setState({ left: targetLeft, top: targetTop, opacity: 1 });
    } else {
      slideIn(node, { from, distance: kind === 'notification' ? 16 : 8, duration: 180, ...(options.animation || {}) });
      // slideIn 会以「当前 state.left/top」为目标，这里确保目标就是排布结果
      node.setState({ left: targetLeft, top: targetTop });
    }

    const duration = options.duration === undefined ? 3000 : Number(options.duration);
    if (duration > 0) {
      // 超时自动消失：淡出后再移除（显式 close() 则是立即移除）
      entry.timer = setTimeout(() => this.__closeEntry(entry, true), duration);
    }
    if (this.ice && this.ice.dirty !== undefined) {
      this.ice.dirty = true;
    }
    void closable;
    return handle;
  }

  private __closeEntry(entry: ICEMessageEntry, animate = false): void {
    const index = this.entries.indexOf(entry);
    if (index === -1) {
      return;
    }
    this.entries.splice(index, 1);
    if (entry.timer) {
      clearTimeout(entry.timer);
      entry.timer = null;
    }
    const finish = () => {
      if (this.layer && this.layer.childNodes.indexOf(entry.node) !== -1) {
        this.layer.removeChild(entry.node);
      }
      this.__relayout();
      if (entry.options.onClose) {
        entry.options.onClose();
      }
    };
    if (!animate || (entry.options.animation && entry.options.animation.duration === 0)) {
      finish();
    } else {
      fadeOut(entry.node, { duration: 120, ...(entry.options.animation || {}), onFinish: finish });
    }
  }

  /** 顶部居中：自上而下；右下角：自下而上。 */
  private __relayout(): void {
    const layer = this.layer;
    if (!layer) {
      return;
    }
    const canvasWidth = Number(this.ice.canvasWidth) || 0;
    const canvasHeight = Number(this.ice.canvasHeight) || 0;
    const messages = this.entries.filter((entry) => entry.kind === 'message');
    const notifications = this.entries.filter((entry) => entry.kind === 'notification');

    let top = EDGE;
    messages.forEach((entry) => {
      const width = Number(entry.node.state.width) || MIN_WIDTH;
      entry.node.setState({ left: Math.round((canvasWidth - width) / 2), top });
      top += Number(entry.node.state.height) + MESSAGE_GAP;
    });

    let bottom = canvasHeight - EDGE;
    notifications.forEach((entry) => {
      const height = Number(entry.node.state.height) || 40;
      const width = Number(entry.node.state.width) || 300;
      entry.node.setState({ left: canvasWidth - EDGE - width, top: bottom - height });
      bottom -= height + MESSAGE_GAP;
    });
  }

  /** 把整棵子树统一抬到指定 zIndex（同值不破坏子树内「先父后子」的绘制顺序）。⚠️ 见 `MESSAGE_LAYER_ZINDEX` 的说明：2.13 起是兜底，不再必需。 */
  private __raiseSubtree(node: any, zIndex: number): void {
    if (!node || !node.state) {
      return;
    }
    node.state.zIndex = zIndex;
    (node.childNodes || []).forEach((child: any) => this.__raiseSubtree(child, zIndex));
  }

  private __typeColor(type?: ICEMessageType): string | ICEThemeTokenRef {
    const theme = iceUIManager.getTheme();
    if (type === 'success') return token('ui.colors.success');
    if (type === 'warning') return token('ui.colors.warning');
    if (type === 'error') return token('ui.colors.error');
    if (type === 'loading') return token('ui.colors.primary');
    return token('ui.colors.info');
  }

  private __typeIcon(type?: ICEMessageType): string {
    if (type === 'success') return '✓';
    if (type === 'warning') return '!';
    if (type === 'error') return '✕';
    if (type === 'loading') return '◌';
    return 'ℹ';
  }
}

const managers = new WeakMap<object, ICEMessageManager>();

export function getICEMessageManager(ice: any): ICEMessageManager {
  if (!ice || typeof ice !== 'object') {
    throw new Error('getICEMessageManager(ice) 需要一个 ICE 实例');
  }
  let manager = managers.get(ice);
  if (!manager) {
    manager = new ICEMessageManager(ice);
    managers.set(ice, manager);
  }
  return manager;
}

/** 便捷入口：`ICEMessage.success(ice, '已保存')`。 */
export const ICEMessage = {
  show(ice: any, text: string, options: Omit<ICEMessageOptions, 'text'> = {}) {
    return getICEMessageManager(ice).show({ text, ...options });
  },
  success(ice: any, text: string, options: Omit<ICEMessageOptions, 'text' | 'type'> = {}) {
    return getICEMessageManager(ice).show({ text, type: 'success', ...options });
  },
  error(ice: any, text: string, options: Omit<ICEMessageOptions, 'text' | 'type'> = {}) {
    return getICEMessageManager(ice).show({ text, type: 'error', ...options });
  },
  warning(ice: any, text: string, options: Omit<ICEMessageOptions, 'text' | 'type'> = {}) {
    return getICEMessageManager(ice).show({ text, type: 'warning', ...options });
  },
  info(ice: any, text: string, options: Omit<ICEMessageOptions, 'text' | 'type'> = {}) {
    return getICEMessageManager(ice).show({ text, type: 'info', ...options });
  },
  loading(ice: any, text: string, options: Omit<ICEMessageOptions, 'text' | 'type'> = {}) {
    return getICEMessageManager(ice).show({ text, type: 'loading', ...options });
  },
};

/** 便捷入口：`ICENotification.open(ice, { title, description })`。 */
export const ICENotification = {
  open(ice: any, options: ICENotificationOptions) {
    return getICEMessageManager(ice).notification(options);
  },
};
