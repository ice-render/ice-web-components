import { ICELabel } from './ICELabel';
import { ICEPanel } from './ICEPanel';
import { iceUIManager } from '../core/ICEManager';
import { ICEOverlayManager, ICEOverlayHandle, getICEOverlayManager } from '../core/ICEOverlayManager';
import type { ICEOverlayPlacement } from '../util/ICEOverlayPosition';
import { readHovered } from '../util/ICEStyle';
import { token } from 'ice-render';

/**
 * 卡片式浮层：点击（默认）或悬停触发，内容可以是文本或自定义组件工厂。
 *
 * 与 ICETooltip 的区别：
 * - 触发方式默认是 click（可切 hover）；
 * - 内容通常是「标题 + 正文」的卡片，也支持自定义组件；
 * - 点击目标会 toggle；点浮层外、按 Esc 关闭（由 ICEOverlayManager 负责）。
 */

export interface ICEPopoverOptions {
  title?: string;
  /** 正文文本，或内容工厂（每次弹出新建） */
  content?: string | (() => any);
  trigger?: 'click' | 'hover';
  placement?: ICEOverlayPlacement;
  offset?: number;
  mouseEnterDelay?: number;
  mouseLeaveDelay?: number;
  enterAnimation?: 'none' | 'fade' | 'scale';
  exitAnimation?: 'none' | 'fade';
  /** 复用外部浮层管理器（测试注入） */
  manager?: ICEOverlayManager;
  onOpenChange?: (open: boolean) => void;
}

export class ICEPopover {
  protected ice: any;
  protected target: any;
  protected options: ICEPopoverOptions;
  protected manager: ICEOverlayManager;
  protected handle: ICEOverlayHandle | null = null;
  private enterTimer: any = null;
  private leaveTimer: any = null;
  private running = false;

  constructor(ice: any, target: any, options: ICEPopoverOptions = {}) {
    this.ice = ice;
    this.target = target;
    this.options = options;
    this.manager = options.manager || getICEOverlayManager(ice);
  }

  public start(): this {
    if (this.running || !this.target || typeof this.target.on !== 'function') {
      return this;
    }
    if (this.options.trigger === 'hover') {
      this.target.on('hoverchange', this.__onHoverChange, this);
    } else {
      this.target.on('click', this.__onClick, this);
    }
    this.running = true;
    return this;
  }

  public destroy(): this {
    if (!this.running) {
      return this;
    }
    if (typeof this.target.off === 'function') {
      this.target.off('hoverchange', this.__onHoverChange, this);
      this.target.off('click', this.__onClick, this);
    }
    this.__clearTimers();
    this.hide();
    this.running = false;
    return this;
  }

  public isOpen(): boolean {
    return !!this.handle && this.handle.isOpen();
  }

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
      enterAnimation: this.options.enterAnimation || 'scale',
      exitAnimation: this.options.exitAnimation ?? 'fade',
    });
    if (this.options.onOpenChange) {
      this.options.onOpenChange(true);
    }
    return this;
  }

  public hide(): this {
    this.__clearTimers();
    if (this.handle) {
      this.handle.close();
      this.handle = null;
      if (this.options.onOpenChange) {
        this.options.onOpenChange(false);
      }
    }
    return this;
  }

  public toggle(): this {
    return this.isOpen() ? this.hide() : this.show();
  }

  /** 内容面板：标题（可选）+ 正文/自定义内容。子类可覆盖做更复杂的卡片。 */
  protected __createContent(): any {
    const theme = iceUIManager.getTheme();
    const { title, content } = this.options;
    if (typeof content === 'function') {
      return content();
    }
    const body = String(content ?? '');
    const width = 240;
    const paddingX = 12;
    const titleHeight = title ? 22 : 0;
    const bodyHeight = 22;
    const height = titleHeight + bodyHeight + 16;
    const panel = new ICEPanel({
      width,
      height,
      radius: 6,
      style: { fillStyle: token('ui.colors.surface'), strokeStyle: token('ui.colors.border'), shadow: 'md' },
    });
    if (title) {
      panel.addChild(
        new ICELabel({
          left: paddingX,
          top: 8,
          height: titleHeight,
          verticalAlign: 'middle',
          text: title,
          style: { fontSize: 13, fontWeight: '600', fillStyle: token('ui.colors.text') },
        }),
        false,
      );
    }
    panel.addChild(
      new ICELabel({
        left: paddingX,
        top: 8 + titleHeight,
        width: width - paddingX * 2,
        height: bodyHeight,
        verticalAlign: 'middle',
        text: body,
        style: { fontSize: 12, fillStyle: token('ui.colors.textSecondary') },
      }),
      false,
    );
    return panel;
  }

  private __onClick(): void {
    this.toggle();
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

export function attachPopover(ice: any, target: any, options: ICEPopoverOptions = {}): ICEPopover {
  return new ICEPopover(ice, target, options).start();
}
