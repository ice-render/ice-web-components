import { UIButton } from './UIButton';
import { UILabel } from './UILabel';
import { UIPanel } from './UIPanel';
import { uiManager } from '../core/UIManager';
import { UIOverlayManager, UIOverlayHandle, getUIOverlayManager } from '../core/UIOverlayManager';
import { UIFocusManager, getUIFocusManager } from '../core/UIFocusManager';
import type { UIEasing, UIFrameDriver } from '../util/UIAnimation';

/**
 * 模态对话框：全屏遮罩 + 居中面板 + 焦点陷阱。
 *
 * - 遮罩铺满可见区域且可交互 —— 引擎按 zIndex 命中，模态打开时点击不会穿透到下面的组件；
 * - 焦点被限制在对话框内（`UIFocusManager.setFocusScope`），打开时聚焦第一个可聚焦控件，
 *   关闭后恢复打开前的焦点；
 * - 关闭途径：遮罩点击（`maskClosable`）、Esc（`closeOnEsc`）、确定/取消按钮、显式 `close()`。
 */

export type UIModalCloseReason = 'mask' | 'esc' | 'confirm' | 'cancel' | 'api';

export interface UIModalOptions {
  title?: string;
  /** 正文文本或内容工厂 */
  content?: string | (() => any);
  width?: number;
  /** 面板高度（不传按内容估算） */
  height?: number;
  confirmText?: string;
  cancelText?: string;
  showFooter?: boolean;
  maskClosable?: boolean;
  closeOnEsc?: boolean;
  confirmLoading?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
  onClose?: (reason: UIModalCloseReason) => void;
  manager?: UIOverlayManager;
  focusManager?: UIFocusManager;
  animation?: { duration?: number; delay?: number; easing?: UIEasing; driver?: UIFrameDriver };
}

export class UIModal {
  private ice: any;
  private options: UIModalOptions;
  private manager: UIOverlayManager;
  private focus: UIFocusManager;
  private handle: UIOverlayHandle | null = null;
  private mask: UIPanel | null = null;
  private dialog: UIPanel | null = null;
  private confirmButton: UIButton | null = null;
  private cancelButton: UIButton | null = null;
  private previousFocus: any = null;
  /** 显式关闭时暂存的关闭原因（浮层回调只有 api/esc/outside/exclusive，认不出 confirm/cancel） */
  private pendingReason: UIModalCloseReason | null = null;

  constructor(ice: any, options: UIModalOptions = {}) {
    this.ice = ice;
    this.options = options;
    this.manager = options.manager || getUIOverlayManager(ice);
    this.focus = options.focusManager || getUIFocusManager(ice);
  }

  public isOpen(): boolean {
    return !!this.handle && this.handle.isOpen();
  }

  public getMask(): UIPanel | null {
    return this.mask;
  }

  public getDialog(): UIPanel | null {
    return this.dialog;
  }

  public getConfirmButton(): UIButton | null {
    return this.confirmButton;
  }

  public getCancelButton(): UIButton | null {
    return this.cancelButton;
  }

  public open(): this {
    if (this.isOpen()) {
      return this;
    }
    const theme = uiManager.getTheme();
    const viewport = this.__visibleWorldRect();

    const mask = new UIPanel({
      left: 0,
      top: 0,
      width: viewport.width,
      height: viewport.height,
      radius: 0,
      fill: true,
      stroke: false,
      style: { fillStyle: 'rgba(0, 0, 0, 0.45)' },
    });
    mask.on('click', () => {
      if (this.options.maskClosable !== false) {
        this.close('mask');
      }
    });

    const dialog = this.__createDialog();
    mask.addChild(dialog, false);
    // 面板在遮罩里居中
    dialog.setState({
      left: Math.max(0, (viewport.width - Number(dialog.state.width)) / 2),
      top: Math.max(0, (viewport.height - Number(dialog.state.height)) / 2),
    });
    this.mask = mask;
    this.dialog = dialog;

    this.previousFocus = this.focus.getFocused();
    this.handle = this.manager.open({
      centered: true,
      blocking: true,
      content: mask,
      closeOnOutsideClick: false,
      closeOnEsc: this.options.closeOnEsc !== false,
      enterAnimation: 'scale',
      animation: this.options.animation,
      onClose: (reason) => {
        const mapped: UIModalCloseReason =
          this.pendingReason || (reason === 'esc' ? 'esc' : reason === 'outside' ? 'mask' : 'api');
        this.pendingReason = null;
        this.__handleClosed(mapped);
      },
    });
    // 焦点陷阱 + 默认聚焦「确定」
    this.focus.setFocusScope(dialog);
    const first = this.confirmButton || this.cancelButton;
    if (first) {
      this.focus.focus(first);
    }
    return this;
  }

  public close(reason: UIModalCloseReason = 'api'): this {
    if (!this.handle || !this.handle.isOpen()) {
      return this;
    }
    const handle = this.handle;
    this.pendingReason = reason;
    this.handle = null;
    this.mask = null;
    this.dialog = null;
    this.confirmButton = null;
    this.cancelButton = null;
    handle.close();
    return this;
  }

  private __handleClosed(reason: UIModalCloseReason): void {
    this.focus.setFocusScope(null);
    if (this.previousFocus) {
      this.focus.focus(this.previousFocus);
      this.previousFocus = null;
    }
    if (this.options.onClose) {
      this.options.onClose(reason);
    }
  }

  private __createDialog(): UIPanel {
    const theme = uiManager.getTheme();
    const width = this.options.width ?? 420;
    const padding = 20;
    const titleHeight = this.options.title ? 24 : 0;
    const bodyHeight = 48;
    const footerHeight = this.options.showFooter === false ? 0 : 32 + 16;
    const height = this.options.height ?? padding + titleHeight + (titleHeight ? 8 : 0) + bodyHeight + footerHeight;

    const dialog = new UIPanel({
      left: 0,
      top: 0,
      width,
      height,
      radius: theme.radius.lg,
      style: { fillStyle: theme.colors.surface, strokeStyle: theme.colors.border, shadow: 'lg' },
    });
    // 阻止点在面板上时冒泡到遮罩（遮罩只处理「面板外」的点击）
    dialog.on('click', (evt: any) => {
      if (evt && typeof evt.stopPropagation === 'function') {
        evt.stopPropagation();
      }
    });

    let top = padding;
    if (this.options.title) {
      dialog.addChild(
        new UILabel({
          left: padding,
          top,
          height: titleHeight,
          verticalAlign: 'middle',
          text: this.options.title,
          style: { fontSize: 16, fontWeight: '600', fillStyle: theme.colors.text },
        }),
        false,
      );
      top += titleHeight + 8;
    }

    if (typeof this.options.content === 'function') {
      const node = this.options.content();
      if (node) {
        node.setState({ left: padding, top });
        dialog.addChild(node, false);
      }
    } else {
      dialog.addChild(
        new UILabel({
          left: padding,
          top,
          width: width - padding * 2,
          height: bodyHeight,
          verticalAlign: 'middle',
          text: String(this.options.content ?? ''),
          style: { fontSize: 13, fillStyle: theme.colors.textSecondary },
        }),
        false,
      );
    }

    if (this.options.showFooter !== false) {
      const buttonTop = height - padding - 32;
      const cancelButton = new UIButton({
        left: width - padding - 172,
        top: buttonTop,
        width: 80,
        height: 32,
        text: this.options.cancelText || '取消',
        variant: 'default',
        size: 'small',
      });
      const confirmButton = new UIButton({
        left: width - padding - 84,
        top: buttonTop,
        width: 84,
        height: 32,
        text: this.options.confirmText || '确定',
        variant: 'primary',
        size: 'small',
      });
      cancelButton.on('click', () => {
        if (this.options.onCancel) {
          this.options.onCancel();
        }
        this.close('cancel');
      });
      confirmButton.on('click', () => {
        if (this.options.onConfirm) {
          this.options.onConfirm();
        }
        this.close('confirm');
      });
      dialog.addChild(cancelButton, false);
      dialog.addChild(confirmButton, false);
      this.cancelButton = cancelButton;
      this.confirmButton = confirmButton;
    }
    return dialog;
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

/** 便捷入口：`UIModal.open(ice, options)` 等价于 new UIModal(ice, options).open()。 */
export function openModal(ice: any, options: UIModalOptions = {}): UIModal {
  return new UIModal(ice, options).open();
}
