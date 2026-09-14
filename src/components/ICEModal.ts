import { ICEButton } from './ICEButton';
import { t } from '../i18n/ICEI18n';
import { ICELabel } from './ICELabel';
import { ICEPanel } from './ICEPanel';
import { ICEWidget } from '../core/ICEWidget';
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
  /** 按住标题栏拖动对话框（默认 false） */
  draggable?: boolean;
  /** 右下角出现缩放手柄，可拖拽改变对话框尺寸（默认 false） */
  resizable?: boolean;
  /** 尺寸预设：`sm` 360 / `md` 420（默认）/ `lg` 640 / `fullscreen` 打开即铺满 */
  size?: 'sm' | 'md' | 'lg' | 'fullscreen';
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
  /** 对话框的三个可重排部分（尺寸变化时要重新摆） */
  private titleNode: ICELabel | null = null;
  private contentNode: any = null;
  private resizeHandle: any = null;
  private fullscreen = false;
  private restoreRect: { left: number; top: number; width: number; height: number } | null = null;
  private dragState: { offsetX: number; offsetY: number } | null = null;
  private __bound = false;
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

  public isDraggable(): boolean {
    return this.options.draggable === true;
  }

  public isResizable(): boolean {
    return this.options.resizable === true;
  }

  public isFullscreen(): boolean {
    return this.fullscreen;
  }

  /** 对话框当前矩形（相对遮罩）。 */
  public getDialogRect(): { left: number; top: number; width: number; height: number } | null {
    if (!this.dialog) {
      return null;
    }
    return {
      left: Number(this.dialog.state.left) || 0,
      top: Number(this.dialog.state.top) || 0,
      width: Number(this.dialog.state.width) || 0,
      height: Number(this.dialog.state.height) || 0,
    };
  }

  /** 移动对话框（自动夹在遮罩里，不让它跑出可见区）。 */
  public setPosition(left: number, top: number): this {
    const dialog = this.dialog;
    if (!dialog) {
      return this;
    }
    const viewport = this.__visibleWorldRect();
    const width = Number(dialog.state.width) || 0;
    const height = Number(dialog.state.height) || 0;
    dialog.setState({
      left: Math.min(Math.max(0, Math.round(left)), Math.max(0, viewport.width - width)),
      top: Math.min(Math.max(0, Math.round(top)), Math.max(0, viewport.height - height)),
    });
    if (this.ice) {
      this.ice.dirty = true;
    }
    return this;
  }

  public dragBy(dx: number, dy: number): this {
    if (!this.isDraggable() || !this.dialog) {
      return this;
    }
    return this.setPosition((Number(this.dialog.state.left) || 0) + dx, (Number(this.dialog.state.top) || 0) + dy);
  }

  /** 改尺寸（有下限，且不超出遮罩）；标题/正文/页脚会重新摆位。 */
  public setSize(width: number, height: number): this {
    const dialog = this.dialog;
    if (!dialog) {
      return this;
    }
    const viewport = this.__visibleWorldRect();
    const nextWidth = Math.min(Math.max(240, Math.round(Number(width) || 0)), viewport.width);
    const nextHeight = Math.min(Math.max(140, Math.round(Number(height) || 0)), viewport.height);
    dialog.setState({ width: nextWidth, height: nextHeight });
    this.__layoutDialog();
    this.setPosition(Number(dialog.state.left) || 0, Number(dialog.state.top) || 0);
    return this;
  }

  /** 全屏 / 还原（还原到进入全屏之前的位置与尺寸）。 */
  public toggleFullscreen(): this {
    const dialog = this.dialog;
    if (!dialog) {
      return this;
    }
    const viewport = this.__visibleWorldRect();
    if (!this.fullscreen) {
      this.restoreRect = this.getDialogRect();
      this.fullscreen = true;
      this.setStateFullscreenBox(viewport);
    } else {
      this.fullscreen = false;
      const restore = this.restoreRect;
      this.restoreRect = null;
      if (restore) {
        dialog.setState({ width: restore.width, height: restore.height });
        this.__layoutDialog();
        this.setPosition(restore.left, restore.top);
      }
    }
    return this;
  }

  public setFullscreen(full: boolean): this {
    return full === this.fullscreen ? this : this.toggleFullscreen();
  }

  private setStateFullscreenBox(viewport: { width: number; height: number }): void {
    const dialog = this.dialog;
    if (!dialog) {
      return;
    }
    dialog.setState({ left: 0, top: 0, width: viewport.width, height: viewport.height });
    this.__layoutDialog();
    if (this.ice) {
      this.ice.dirty = true;
    }
  }

  /** 尺寸变化后重新摆标题 / 正文 / 页脚按钮 / 缩放手柄。 */
  private __layoutDialog(): void {
    const dialog = this.dialog;
    if (!dialog) {
      return;
    }
    const padding = 20;
    const width = Number(dialog.state.width) || 0;
    const height = Number(dialog.state.height) || 0;
    const titleHeight = this.options.title ? 24 : 0;
    let top = padding;
    if (this.titleNode) {
      this.titleNode.setState({ left: padding, top, width: Math.max(0, width - padding * 2), height: titleHeight });
      top += titleHeight + 8;
    }
    if (this.contentNode) {
      const footerHeight = this.options.showFooter === false ? 0 : 48;
      this.contentNode.setState({ left: padding, top, width: Math.max(0, width - padding * 2) });
      if (typeof this.contentNode.state === 'object' && this.options.content && typeof this.options.content === 'string') {
        this.contentNode.setState({ height: Math.max(24, height - top - footerHeight) });
      }
    }
    if (this.cancelButton) {
      this.cancelButton.setState({ left: width - padding - 172, top: height - padding - 32 });
    }
    if (this.confirmButton) {
      this.confirmButton.setState({ left: width - padding - 84, top: height - padding - 32 });
    }
    if (this.resizeHandle) {
      this.resizeHandle.setState({ left: width - 16, top: height - 16 });
    }
  }

  /** 标题栏拖拽 + 右下角缩放：都走全局鼠标事件（和表格拖列宽同一套办法）。 */
  private __bindDragEvents(): void {
    if (this.__bound || !this.ice || !this.ice.evtBus) {
      return;
    }
    const bus = this.ice.evtBus;
    this.__bound = true;
    bus.on('mousedown', this.__onMouseDown, this);
    bus.on('mousemove', this.__onMouseMove, this);
    bus.on('mouseup', this.__onMouseUp, this);
  }

  private __onMouseDown(evt: any): void {
    const dialog = this.dialog;
    if (!dialog || !evt || typeof evt.target !== 'object' || !evt.target) {
      return;
    }
    const rect = this.getDialogRect();
    if (!rect) {
      return;
    }
    const inside = (node: any, root: any) => {
      let current = node;
      while (current) {
        if (current === root) return true;
        current = current.parentNode;
      }
      return false;
    };
    if (this.resizeHandle && inside(evt.target, this.resizeHandle) && this.isResizable() && !this.fullscreen) {
      this.dragState = { offsetX: -1, offsetY: -1 };
      return;
    }
    if (!this.isDraggable() || this.fullscreen) {
      return;
    }
    const [wx, wy] = typeof this.ice.screenToWorld === 'function' ? this.ice.screenToWorld(evt.offsetX, evt.offsetY) : [0, 0];
    const inTitle = wy >= rect.top && wy <= rect.top + 44 && wx >= rect.left && wx <= rect.left + rect.width;
    if (inTitle) {
      this.dragState = { offsetX: wx - rect.left, offsetY: wy - rect.top };
      evt.stopPropagation && evt.stopPropagation();
    }
  }

  private __onMouseMove(evt: any): void {
    if (!this.dragState || !evt || !this.ice || typeof this.ice.screenToWorld !== 'function') {
      return;
    }
    const [wx, wy] = this.ice.screenToWorld(evt.offsetX, evt.offsetY);
    if (this.dragState.offsetX < 0) {
      const rect = this.getDialogRect();
      if (rect) {
        this.setSize(wx - rect.left, wy - rect.top);
      }
      return;
    }
    this.setPosition(wx - this.dragState.offsetX, wy - this.dragState.offsetY);
  }

  private __onMouseUp(): void {
    this.dragState = null;
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
    this.mask = mask;
    this.dialog = dialog;
    if (this.options.size === 'fullscreen') {
      // 打开即铺满：把「还原位置」记成居中，退出全屏时回到那里
      const centered = {
        left: Math.max(0, (viewport.width - Number(dialog.state.width)) / 2),
        top: Math.max(0, (viewport.height - Number(dialog.state.height)) / 2),
        width: Number(dialog.state.width) || 420,
        height: Number(dialog.state.height) || 220,
      };
      this.setPosition(centered.left, centered.top);
      this.toggleFullscreen();
    } else {
      // 面板在遮罩里居中
      dialog.setState({
        left: Math.max(0, (viewport.width - Number(dialog.state.width)) / 2),
        top: Math.max(0, (viewport.height - Number(dialog.state.height)) / 2),
      });
    }
    this.__bindDragEvents();

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
    this.titleNode = null;
    this.contentNode = null;
    this.resizeHandle = null;
    this.fullscreen = false;
    this.restoreRect = null;
    this.dragState = null;
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
    const preset = this.options.size;
    const width = this.options.width ?? (preset === 'sm' ? 360 : preset === 'lg' ? 640 : 420);
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

    this.titleNode = null;
    this.contentNode = null;
    this.resizeHandle = null;
    let top = padding;
    if (this.options.title) {
      this.titleNode = new ICELabel({
          left: padding,
          top,
          height: titleHeight,
          verticalAlign: 'middle',
          text: this.options.title,
          style: { fontSize: 16, fontWeight: '600', fillStyle: theme.colors.text },
        });
      dialog.addChild(this.titleNode, false);
      top += titleHeight + 8;
    }

    if (typeof this.options.content === 'function') {
      const node = this.options.content();
      if (node) {
        node.setState({ left: padding, top });
        dialog.addChild(node, false);
        this.contentNode = node;
      }
    } else {
      this.contentNode = new ICELabel({
          left: padding,
          top,
          width: width - padding * 2,
          height: bodyHeight,
          verticalAlign: 'middle',
          text: String(this.options.content ?? ''),
          style: { fontSize: 13, fillStyle: theme.colors.textSecondary },
        });
      dialog.addChild(this.contentNode, false);
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
    // 可缩放：右下角给一个看得见的手柄（不然用户根本不知道能拖）
    if (this.options.resizable) {
      const handle = new ICEWidget({
        left: width - 16,
        top: height - 16,
        width: 14,
        height: 14,
        fill: false,
        stroke: false,
        interactive: true,
      });
      handle.addChild(
        new ICELabel({
          interactive: false,
          left: 0,
          top: 0,
          width: 14,
          height: 14,
          align: 'center',
          verticalAlign: 'middle',
          text: '◢',
          style: { fontSize: 11, fillStyle: theme.colors.textTertiary },
        }),
        false,
      );
      dialog.addChild(handle, false);
      this.resizeHandle = handle;
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
