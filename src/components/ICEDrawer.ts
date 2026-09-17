import { ICEButton } from './ICEButton';
import { ICELabel } from './ICELabel';
import { ICEPanel } from './ICEPanel';
import { iceUIManager } from '../core/ICEManager';
import { ICEOverlayManager, ICEOverlayHandle, getICEOverlayManager } from '../core/ICEOverlayManager';
import { ICEFocusManager, getICEFocusManager } from '../core/ICEFocusManager';
import { slideIn } from '../util/ICEAnimation';
import type { ICEEasing, ICEFrameDriver } from '../util/ICEAnimation';
import { token } from 'ice-render';

/**
 * 抽屉：从屏幕某一边滑入的面板（带遮罩与焦点陷阱）。
 *
 * 与 ICEModal 同源（遮罩 + 焦点范围 + 关闭途径），差别只在：
 * - 面板贴边（right / left / top / bottom）并沿该方向占满整条边；
 * - 入场动效是与方向一致的滑入（A5 的 `slideIn`）。
 */

export type ICEDrawerPlacement = 'right' | 'left' | 'top' | 'bottom';
export type ICEDrawerCloseReason = 'mask' | 'esc' | 'close' | 'api';

export interface ICEDrawerOptions {
  title?: string;
  content?: string | (() => any);
  placement?: ICEDrawerPlacement;
  /** left/right 方向的宽度（默认 360） */
  width?: number;
  /** top/bottom 方向的高度（默认 240） */
  height?: number;
  /**
   * 尺寸预设：`default` / `large`，或直接给数字（像素）。
   * left/right 方向上它管宽度，top/bottom 方向上管高度。
   */
  size?: 'default' | 'large' | number;
  /** 标题栏右侧的扩展区（按钮或说明文字）；返回的组件会被摆到关闭按钮左边 */
  extra?: any | (() => any);
  /** 贴底的页脚区（确定/取消这类操作）；给了就把内容区让出这段高度 */
  footer?: any | (() => any);
  /** 页脚高度（默认 56） */
  footerHeight?: number;
  closable?: boolean;
  maskClosable?: boolean;
  closeOnEsc?: boolean;
  onClose?: (reason: ICEDrawerCloseReason) => void;
  manager?: ICEOverlayManager;
  focusManager?: ICEFocusManager;
  animation?: { duration?: number; delay?: number; easing?: ICEEasing; driver?: ICEFrameDriver };
}

export class ICEDrawer {
  private ice: any;
  private options: ICEDrawerOptions;
  private manager: ICEOverlayManager;
  private focus: ICEFocusManager;
  private handle: ICEOverlayHandle | null = null;
  private mask: ICEPanel | null = null;
  private panel: ICEPanel | null = null;
  private closeButton: ICEButton | null = null;
  private extraNode: any = null;
  private footerNode: any = null;
  private previousFocus: any = null;
  private pendingReason: ICEDrawerCloseReason | null = null;

  constructor(ice: any, options: ICEDrawerOptions = {}) {
    this.ice = ice;
    this.options = options;
    this.manager = options.manager || getICEOverlayManager(ice);
    this.focus = options.focusManager || getICEFocusManager(ice);
  }

  public isOpen(): boolean {
    return !!this.handle && this.handle.isOpen();
  }

  public getMask(): ICEPanel | null {
    return this.mask;
  }

  public getPanel(): ICEPanel | null {
    return this.panel;
  }

  public getCloseButton(): ICEButton | null {
    return this.closeButton;
  }

  /** 标题栏右侧的扩展区节点（没传就是 null）。 */
  public getExtraNode(): any {
    return this.extraNode;
  }

  /** 页脚节点（没传就是 null）。 */
  public getFooterNode(): any {
    return this.footerNode;
  }

  /** 内容区可用矩形（页脚会把底部让出来）。 */
  public getContentBox(): { left: number; top: number; width: number; height: number } {
    const panel = this.panel;
    if (!panel) {
      return { left: 0, top: 0, width: 0, height: 0 };
    }
    const width = Number(panel.state.width) || 0;
    const height = Number(panel.state.height) || 0;
    const headerHeight = this.options.title ? 48 : 16;
    const footerHeight = this.footerNode ? Math.max(0, Math.floor(Number(this.options.footerHeight) || 56)) : 0;
    return {
      left: 20,
      top: headerHeight,
      width: Math.max(0, width - 40),
      height: Math.max(0, height - headerHeight - footerHeight - 16),
    };
  }

  public open(): this {
    if (this.isOpen()) {
      return this;
    }
    const viewport = this.__visibleWorldRect();
    const placement = this.options.placement || 'right';
    const mask = new ICEPanel({
      left: 0,
      top: 0,
      width: viewport.width,
      height: viewport.height,
      radius: 0,
      fill: true,
      stroke: false,
      style: { fillStyle: 'rgba(0, 0, 0, 0.5)' },
    });
    mask.on('click', () => {
      if (this.options.maskClosable !== false) {
        this.close('mask');
      }
    });

    const panel = this.__createPanel(viewport, placement);
    mask.addChild(panel, false);
    this.mask = mask;
    this.panel = panel;

    this.previousFocus = this.focus.getFocused();
    this.handle = this.manager.open({
      centered: true,
      blocking: true,
      content: mask,
      closeOnOutsideClick: false,
      closeOnEsc: this.options.closeOnEsc !== false,
      enterAnimation: 'none',
      animation: this.options.animation,
      onClose: (reason) => {
        const mapped: ICEDrawerCloseReason =
          this.pendingReason || (reason === 'esc' ? 'esc' : reason === 'outside' ? 'mask' : 'api');
        this.pendingReason = null;
        this.__handleClosed(mapped);
      },
    });
    // 面板贴边定位（遮罩铺满，面板相对遮罩定位）
    panel.setState({ left: panel.state.left, top: panel.state.top });
    // 入场：沿对应方向滑入
    if (!this.options.animation || this.options.animation.duration !== 0) {
      slideIn(panel, {
        from: placement,
        distance: placement === 'left' || placement === 'right' ? Number(panel.state.width) : Number(panel.state.height),
        duration: 220,
        ...(this.options.animation || {}),
      });
    }
    this.focus.setFocusScope(panel);
    if (this.closeButton) {
      this.focus.focus(this.closeButton);
    }
    return this;
  }

  public close(reason: ICEDrawerCloseReason = 'api'): this {
    if (!this.handle || !this.handle.isOpen()) {
      return this;
    }
    const handle = this.handle;
    this.pendingReason = reason;
    this.handle = null;
    this.mask = null;
    this.panel = null;
    this.closeButton = null;
    this.extraNode = null;
    this.footerNode = null;
    handle.close();
    return this;
  }

  private __handleClosed(reason: ICEDrawerCloseReason): void {
    this.focus.setFocusScope(null);
    if (this.previousFocus) {
      this.focus.focus(this.previousFocus);
      this.previousFocus = null;
    }
    if (this.options.onClose) {
      this.options.onClose(reason);
    }
  }

  private __createPanel(
    viewport: { left: number; top: number; width: number; height: number },
    placement: ICEDrawerPlacement,
  ): ICEPanel {
    const theme = iceUIManager.getTheme();
    const horizontal = placement === 'left' || placement === 'right';
    const numeric = typeof this.options.size === 'number' ? Math.max(0, Math.floor(this.options.size)) : null;
    const preset =
      numeric !== null ? numeric : this.options.size === 'large' ? (horizontal ? 560 : 360) : horizontal ? 360 : 240;
    const width = horizontal ? this.options.width ?? preset : viewport.width;
    const height = horizontal ? viewport.height : this.options.height ?? preset;
    const left = placement === 'right' ? viewport.width - width : 0;
    const top = placement === 'bottom' ? viewport.height - height : 0;

    const panel = new ICEPanel({
      left,
      top,
      width,
      height,
      radius: 0,
      style: { fillStyle: token('ui.colors.surface'), strokeStyle: token('ui.colors.border'), shadow: 'lg' },
    });
    panel.on('click', (evt: any) => {
      if (evt && typeof evt.stopPropagation === 'function') {
        evt.stopPropagation();
      }
    });

    const headerHeight = this.options.title ? 48 : 16;
    if (this.options.title) {
      panel.addChild(
        new ICELabel({
          left: 20,
          top: 0,
          height: headerHeight,
          verticalAlign: 'middle',
          text: this.options.title,
          style: { fontSize: 15, fontWeight: '600', fillStyle: token('ui.colors.text') },
        }),
        false,
      );
    }
    if (this.options.closable !== false) {
      const closeButton = new ICEButton({
        left: width - 48,
        top: 12,
        width: 32,
        height: 28,
        text: '✕',
        variant: 'text',
        size: 'small',
      });
      closeButton.on('click', () => this.close('close'));
      panel.addChild(closeButton, false);
      this.closeButton = closeButton;
    } else {
      this.closeButton = null;
    }

    // 标题栏右侧扩展区：摆在关闭按钮左边（关闭按钮占右侧 48px）
    this.extraNode = null;
    if (this.options.extra) {
      const node = typeof this.options.extra === 'function' ? this.options.extra() : this.options.extra;
      if (node) {
        const right = this.options.closable === false ? width - 20 : width - 56;
        const nodeWidth = Number(node.state && node.state.width) || 0;
        node.setState({ left: Math.max(20, right - nodeWidth), top: Math.round((headerHeight - 28) / 2) });
        panel.addChild(node, false);
        this.extraNode = node;
      }
    }

    if (typeof this.options.content === 'function') {
      const node = this.options.content();
      if (node) {
        node.setState({ left: 20, top: headerHeight });
        panel.addChild(node, false);
      }
    } else {
      panel.addChild(
        new ICELabel({
          left: 20,
          top: headerHeight,
          width: Math.max(0, width - 40),
          height: 24,
          verticalAlign: 'middle',
          text: String(this.options.content ?? ''),
          style: { fontSize: 13, fillStyle: token('ui.colors.textSecondary') },
        }),
        false,
      );
    }

    // 页脚贴底：内容区（调用方自己摆的）要按 getContentBox() 让出这段高度
    this.footerNode = null;
    if (this.options.footer) {
      const footerHeight = Math.max(0, Math.floor(Number(this.options.footerHeight) || 56));
      const footer = typeof this.options.footer === 'function' ? this.options.footer() : this.options.footer;
      if (footer) {
        const bar = new ICEPanel({
          left: 0,
          top: Math.max(0, height - footerHeight),
          width,
          height: footerHeight,
          radius: 0,
          style: { fillStyle: token('ui.colors.background'), strokeStyle: token('ui.colors.border') },
        });
        footer.setState({ left: 20, top: Math.round((footerHeight - (Number(footer.state && footer.state.height) || 32)) / 2) });
        bar.addChild(footer, false);
        panel.addChild(bar, false);
        this.footerNode = footer;
      }
    }
    return panel;
  }

  private __visibleWorldRect(): { left: number; top: number; width: number; height: number } {
    const width = Number(this.ice && this.ice.canvasWidth) || 0;
    const height = Number(this.ice && this.ice.canvasHeight) || 0;
    const vp = this.ice && typeof this.ice.getRenderViewport === 'function' ? this.ice.getRenderViewport() : null;
    const scale = vp && vp.scale ? vp.scale : 1;
    return {
      left: vp ? -(vp.tx || 0) / scale : 0,
      top: vp ? -(vp.ty || 0) / scale : 0,
      width: width / scale,
      height: height / scale,
    };
  }
}

/** 便捷入口：`openDrawer(ice, options)`。 */
export function openDrawer(ice: any, options: ICEDrawerOptions = {}): ICEDrawer {
  return new ICEDrawer(ice, options).open();
}
