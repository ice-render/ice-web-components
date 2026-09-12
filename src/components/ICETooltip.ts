import { ICEWidget } from '../core/ICEWidget';
import { ICELabel } from './ICELabel';
import { ICEPanel } from './ICEPanel';
import { iceUIManager } from '../core/ICEManager';
import { ICEOverlayManager, ICEOverlayHandle, getICEOverlayManager } from '../core/ICEOverlayManager';
import type { ICEOverlayPlacement } from '../util/ICEOverlayPosition';
import { estimateTextWidth, readHovered } from '../util/ICEStyle';

/** tooltip 文本字号与左右内边距（面板宽度按它估算） */
export const ICE_TOOLTIP_FONT_SIZE = 12;
export const ICE_TOOLTIP_PADDING_X = 8;

/** 气泡面板宽度：按文字估算（中文 1em、拉丁 0.6em），避免长中文被压出色块外面。 */
export function tooltipPanelWidth(title: string): number {
  return Math.max(32, estimateTextWidth(title, ICE_TOOLTIP_FONT_SIZE) + ICE_TOOLTIP_PADDING_X * 2);
}

/**
 * 工具提示：鼠标悬停在目标组件上、延时后弹出的小浮层。
 *
 * - 悬停检测复用 `ICEWidget` 的 hover 状态（ICEHoverManager 命中后调 `setHovered`，
 *   本组件监听目标的 `hoverchange` 事件）；
 * - 弹出/关闭都有延时（业界组件库 的 mouseEnterDelay / mouseLeaveDelay 语义），进入延时期内离开则不弹；
 * - 浮层定位、点外关闭、z 序全部交给 `ICEOverlayManager`（工具层，恒在组件之上）；
 * - 浮层关闭时内容会被销毁，所以内容每次弹出都新建（`title` 字符串自动包成小面板，
 *   或用 `content: () => component` 自定义）。
 */

export interface ICETooltipOptions {
  /** 文本内容（自动包成深色小气泡） */
  title?: string;
  /** 自定义内容工厂：每次弹出调用一次 */
  content?: () => any;
  placement?: ICEOverlayPlacement;
  /** 与目标的间距（默认 8） */
  offset?: number;
  mouseEnterDelay?: number;
  mouseLeaveDelay?: number;
  enterAnimation?: 'none' | 'fade' | 'scale';
  /** 复用外部浮层管理器（测试注入） */
  manager?: ICEOverlayManager;
}

export class ICETooltip {
  private ice: any;
  private target: any;
  private options: ICETooltipOptions;
  private manager: ICEOverlayManager;
  private handle: ICEOverlayHandle | null = null;
  private enterTimer: any = null;
  private leaveTimer: any = null;
  private running = false;

  constructor(ice: any, target: any, options: ICETooltipOptions = {}) {
    this.ice = ice;
    this.target = target;
    this.options = options;
    this.manager = options.manager || getICEOverlayManager(ice);
  }

  /** 绑定目标的 hover 事件（幂等）。 */
  public start(): this {
    if (this.running || !this.target || typeof this.target.on !== 'function') {
      return this;
    }
    this.target.on('hoverchange', this.__onHoverChange, this);
    this.running = true;
    return this;
  }

  public destroy(): this {
    if (!this.running) {
      return this;
    }
    if (typeof this.target.off === 'function') {
      this.target.off('hoverchange', this.__onHoverChange, this);
    }
    this.__clearTimers();
    this.hide();
    this.running = false;
    return this;
  }

  public isOpen(): boolean {
    return !!this.handle && this.handle.isOpen();
  }

  /** 立即弹出（不走进入延时）。 */
  public show(): this {
    if (this.isOpen()) {
      return this;
    }
    const content = this.__createContent();
    if (!content) {
      return this;
    }
    this.handle = this.manager.open({
      anchor: this.target,
      content,
      placement: this.options.placement || 'bottomLeft',
      offset: this.options.offset ?? 8,
      closeOnOutsideClick: false,
      closeOnEsc: true,
      enterAnimation: this.options.enterAnimation || 'none',
    });
    return this;
  }

  /** 立即关闭。 */
  public hide(): this {
    this.__clearTimers();
    if (this.handle) {
      this.handle.close();
      this.handle = null;
    }
    return this;
  }

  private __onHoverChange(evt: any): void {
    const hovered = readHovered(evt);
    if (hovered) {
      this.__clearTimers();
      const delay = Number(this.options.mouseEnterDelay ?? 100);
      if (delay <= 0) {
        this.show();
        return;
      }
      this.enterTimer = setTimeout(() => {
        this.enterTimer = null;
        this.show();
      }, delay);
      return;
    }
    if (this.enterTimer) {
      clearTimeout(this.enterTimer);
      this.enterTimer = null;
    }
    if (!this.isOpen()) {
      return;
    }
    this.__clearTimers();
    const delay = Number(this.options.mouseLeaveDelay ?? 100);
    if (delay <= 0) {
      this.hide();
      return;
    }
    this.leaveTimer = setTimeout(() => {
      this.leaveTimer = null;
      this.hide();
    }, delay);
  }

  private __createContent(): any {
    if (typeof this.options.content === 'function') {
      return this.options.content();
    }
    const theme = iceUIManager.getTheme();
    const title = String(this.options.title ?? '');
    const fontSize = ICE_TOOLTIP_FONT_SIZE;
    const paddingX = ICE_TOOLTIP_PADDING_X;
    const width = tooltipPanelWidth(title);
    const height = 26;
    const panel = new ICEPanel({
      width,
      height,
      radius: 4,
      style: { fillStyle: theme.colors.text, strokeStyle: theme.colors.text, shadow: 'md' },
    });
    const label = new ICELabel({
      left: paddingX,
      top: 0,
      height,
      verticalAlign: 'middle',
      text: title,
      style: { fontSize, fillStyle: theme.colors.surface },
    });
    panel.addChild(label, false);
    return panel;
  }

  private __clearTimers(): void {
    if (this.enterTimer) {
      clearTimeout(this.enterTimer);
      this.enterTimer = null;
    }
    if (this.leaveTimer) {
      clearTimeout(this.leaveTimer);
      this.leaveTimer = null;
    }
  }
}

/** 便捷绑定：`attachTooltip(ice, target, options)`。 */
export function attachTooltip(ice: any, target: any, options: ICETooltipOptions = {}): ICETooltip {
  return new ICETooltip(ice, target, options).start();
}
