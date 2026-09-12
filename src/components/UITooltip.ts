import { UIComponent } from '../core/UIComponent';
import { UILabel } from './UILabel';
import { UIPanel } from './UIPanel';
import { uiManager } from '../core/UIManager';
import { UIOverlayManager, UIOverlayHandle, getUIOverlayManager } from '../core/UIOverlayManager';
import type { UIOverlayPlacement } from '../util/UIOverlayPosition';

/**
 * 工具提示：鼠标悬停在目标组件上、延时后弹出的小浮层。
 *
 * - 悬停检测复用 `UIComponent` 的 hover 状态（UIHoverManager 命中后调 `setHovered`，
 *   本组件监听目标的 `hoverchange` 事件）；
 * - 弹出/关闭都有延时（业界组件库 的 mouseEnterDelay / mouseLeaveDelay 语义），进入延时期内离开则不弹；
 * - 浮层定位、点外关闭、z 序全部交给 `UIOverlayManager`（工具层，恒在组件之上）；
 * - 浮层关闭时内容会被销毁，所以内容每次弹出都新建（`title` 字符串自动包成小面板，
 *   或用 `content: () => component` 自定义）。
 */

export interface UITooltipOptions {
  /** 文本内容（自动包成深色小气泡） */
  title?: string;
  /** 自定义内容工厂：每次弹出调用一次 */
  content?: () => any;
  placement?: UIOverlayPlacement;
  /** 与目标的间距（默认 8） */
  offset?: number;
  mouseEnterDelay?: number;
  mouseLeaveDelay?: number;
  enterAnimation?: 'none' | 'fade' | 'scale';
  /** 复用外部浮层管理器（测试注入） */
  manager?: UIOverlayManager;
}

export class UITooltip {
  private ice: any;
  private target: any;
  private options: UITooltipOptions;
  private manager: UIOverlayManager;
  private handle: UIOverlayHandle | null = null;
  private enterTimer: any = null;
  private leaveTimer: any = null;
  private running = false;

  constructor(ice: any, target: any, options: UITooltipOptions = {}) {
    this.ice = ice;
    this.target = target;
    this.options = options;
    this.manager = options.manager || getUIOverlayManager(ice);
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
    const hovered = !!(evt && evt.param ? evt.param.hovered : evt && evt.hovered);
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
    const theme = uiManager.getTheme();
    const title = String(this.options.title ?? '');
    const fontSize = 12;
    const paddingX = 8;
    const width = Math.max(32, Math.round(title.length * fontSize * 0.62) + paddingX * 2);
    const height = 26;
    const panel = new UIPanel({
      width,
      height,
      radius: 4,
      style: { fillStyle: theme.colors.text, strokeStyle: theme.colors.text, shadow: 'md' },
    });
    const label = new UILabel({
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
export function attachTooltip(ice: any, target: any, options: UITooltipOptions = {}): UITooltip {
  return new UITooltip(ice, target, options).start();
}
