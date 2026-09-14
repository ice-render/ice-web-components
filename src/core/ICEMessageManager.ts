import { ICEWidget } from './ICEWidget';
import { ICELabel } from '../components/ICELabel';
import { ICEPanel } from '../components/ICEPanel';
import { ICEButton } from '../components/ICEButton';
import { iceUIManager } from './ICEManager';
import { fadeOut, slideIn, ICEEasing, ICEFrameDriver } from '../util/ICEAnimation';

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
const MAX_WIDTH = 320;

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

  /** 顶部居中消息。 */
  public show(options: ICEMessageOptions): ICEMessageHandle {
    const text = String(options.text ?? '');
    return this.__push('message', options, (theme) => {
      const width = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(text.length * 7) + 48));
      const height = 34;
      const panel = new ICEPanel({
        width,
        height,
        radius: theme.radius.md,
        style: { fillStyle: theme.colors.surface, strokeStyle: theme.colors.border, shadow: 'md' },
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
          width: width - 46,
          height,
          verticalAlign: 'middle',
          text,
          style: { fontSize: 13, fillStyle: theme.colors.text },
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
          style: { fillStyle: theme.colors.surface, strokeStyle: theme.colors.border, shadow: 'lg' },
        });
        panel.addChild(
          new ICELabel({
            left: 14,
            top: 14,
            width: width - 60,
            height: 22,
            verticalAlign: 'middle',
            text: title,
            style: { fontSize: 14, fontWeight: '600', fillStyle: theme.colors.text },
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
              style: { fontSize: 12, fillStyle: theme.colors.textSecondary },
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

  private __typeColor(type?: ICEMessageType): string {
    const theme = iceUIManager.getTheme();
    if (type === 'success') return theme.colors.success;
    if (type === 'warning') return theme.colors.warning;
    if (type === 'error') return theme.colors.error;
    if (type === 'loading') return theme.colors.primary;
    return theme.colors.info;
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
