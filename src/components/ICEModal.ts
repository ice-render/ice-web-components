import { ICEButton } from './ICEButton';
import { t } from '../i18n/ICEI18n';
import { ICELabel } from './ICELabel';
import { ICEPanel } from './ICEPanel';
import { iceUIManager } from '../core/ICEManager';
import { ICEOverlayManager, ICEOverlayHandle, getICEOverlayManager } from '../core/ICEOverlayManager';
import { ICEFocusManager, getICEFocusManager } from '../core/ICEFocusManager';
import type { ICEEasing, ICEFrameDriver } from '../util/ICEAnimation';
import type { ICELocalizedProps } from '../i18n/ICEI18n';
import { tFor } from '../i18n/ICEI18n';
import type { ICETranslate } from '../i18n/ICEI18n';

/**
 * 模态对话框：全屏遮罩 + 居中面板 + 焦点陷阱。
 *
 * - 遮罩铺满可见区域且可交互 —— 引擎按 zIndex 命中，模态打开时点击不会穿透到下面的组件；
 * - 焦点被限制在对话框内（`ICEFocusManager.setFocusScope`），打开时聚焦第一个可聚焦控件，
 *   关闭后恢复打开前的焦点；
 * - 关闭途径：遮罩点击（`maskClosable`）、Esc（`closeOnEsc`）、确定/取消按钮、显式 `close()`。
 */

export type ICEModalCloseReason = 'mask' | 'esc' | 'confirm' | 'cancel' | 'api';

export interface ICEModalOptions extends ICELocalizedProps {
  title?: string;
  /** 正文文本或内容工厂 */
  content?: string | (() => any);
  width?: number;
  /** 面板高度（不传按内容估算） */
  height?: number;
  confirmText?: string;
  cancelText?: string;
  showFooter?: boolean;
  /**
   * `onConfirm` 之后是否自动关闭（默认 true）。
   *
   * 异步场景（提交前要跑异步校验 / 等接口）传 `false`：回调里自己做异步操作，
   * 成功后再调 `modal.close()`，失败时弹窗留在原地展示错误。
   */
  closeOnConfirm?: boolean;
  maskClosable?: boolean;
  closeOnEsc?: boolean;
  confirmLoading?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
  onClose?: (reason: ICEModalCloseReason) => void;
  manager?: ICEOverlayManager;
  focusManager?: ICEFocusManager;
  animation?: { duration?: number; delay?: number; easing?: ICEEasing; driver?: ICEFrameDriver };
}

export class ICEModal {
  private ice: any;
  private options: ICEModalOptions;
  private manager: ICEOverlayManager;
  /** 内置文案：按 options.locale 解析（实例级；ICEModal 不是组件，自己持有翻译函数） */
  private __t: ICETranslate;
  private focus: ICEFocusManager;
  private handle: ICEOverlayHandle | null = null;
  private mask: ICEPanel | null = null;
  private dialog: ICEPanel | null = null;
  private confirmButton: ICEButton | null = null;
  private cancelButton: ICEButton | null = null;
  private previousFocus: any = null;
  /** 显式关闭时暂存的关闭原因（浮层回调只有 api/esc/outside/exclusive，认不出 confirm/cancel） */
  private pendingReason: ICEModalCloseReason | null = null;

  constructor(ice: any, options: ICEModalOptions = {}) {
    this.ice = ice;
    this.options = options;
    this.__t = tFor(options.locale);
    this.manager = options.manager || getICEOverlayManager(ice);
    this.focus = options.focusManager || getICEFocusManager(ice);
  }

  public isOpen(): boolean {
    return !!this.handle && this.handle.isOpen();
  }

  public getMask(): ICEPanel | null {
    return this.mask;
  }

  public getDialog(): ICEPanel | null {
    return this.dialog;
  }

  public getConfirmButton(): ICEButton | null {
    return this.confirmButton;
  }

  public getCancelButton(): ICEButton | null {
    return this.cancelButton;
  }

  public open(): this {
    if (this.isOpen()) {
      return this;
    }
    const theme = iceUIManager.getTheme();
    const viewport = this.__visibleWorldRect();

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
        const mapped: ICEModalCloseReason =
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

  public close(reason: ICEModalCloseReason = 'api'): this {
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

  private __handleClosed(reason: ICEModalCloseReason): void {
    this.focus.setFocusScope(null);
    if (this.previousFocus) {
      this.focus.focus(this.previousFocus);
      this.previousFocus = null;
    }
    if (this.options.onClose) {
      this.options.onClose(reason);
    }
  }

  private __createDialog(): ICEPanel {
    const theme = iceUIManager.getTheme();
    const width = this.options.width ?? 420;
    const padding = 20;
    const titleHeight = this.options.title ? 24 : 0;
    const bodyHeight = 48;
    const footerHeight = this.options.showFooter === false ? 0 : 32 + 16;
    const height = this.options.height ?? padding + titleHeight + (titleHeight ? 8 : 0) + bodyHeight + footerHeight;

    const dialog = new ICEPanel({
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
        new ICELabel({
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
        new ICELabel({
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
      const cancelButton = new ICEButton({
        left: width - padding - 172,
        top: buttonTop,
        width: 80,
        height: 32,
        text: this.options.cancelText || this.__t('common.cancel'),
        variant: 'default',
        size: 'small',
      });
      const confirmButton = new ICEButton({
        left: width - padding - 84,
        top: buttonTop,
        width: 84,
        height: 32,
        text: this.options.confirmText || this.__t('common.ok'),
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
        // closeOnConfirm:false 时把关闭时机交给调用方（异步校验通过后再关）
        if (this.options.closeOnConfirm !== false) {
          this.close('confirm');
        }
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

/** 便捷入口：`ICEModal.open(ice, options)` 等价于 new ICEModal(ice, options).open()。 */
export function openModal(ice: any, options: ICEModalOptions = {}): ICEModal {
  return new ICEModal(ice, options).open();
}
