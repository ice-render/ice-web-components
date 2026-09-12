import { UIButton } from './UIButton';
import { UILabel } from './UILabel';
import { UIPanel } from './UIPanel';
import { uiManager } from '../core/UIManager';
import { UIPopover, UIPopoverOptions } from './UIPopover';

/**
 * 气泡确认框：点击目标弹出「标题 + 说明 + 取消/确定」的小卡片。
 *
 * 复用 UIPopover 的触发与定位；确认/取消后自动关闭并回调。
 */

export interface UIPopconfirmOptions extends UIPopoverOptions {
  description?: string;
  confirmText?: string;
  cancelText?: string;
  /** 危险操作：确认按钮用 error 色 */
  danger?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
}

export class UIPopconfirm extends UIPopover {
  private confirmOptions: UIPopconfirmOptions;

  constructor(ice: any, target: any, options: UIPopconfirmOptions = {}) {
    super(ice, target, { placement: 'topRight', trigger: 'click', ...options });
    this.confirmOptions = options;
  }

  protected __createContent(): any {
    const theme = uiManager.getTheme();
    const width = 220;
    const paddingX = 12;
    const title = this.confirmOptions.title || '确认操作？';
    const description = this.confirmOptions.description;
    const titleHeight = 20;
    const descHeight = description ? 18 : 0;
    const buttonsTop = 12 + titleHeight + descHeight + 4;
    const height = buttonsTop + 32 + 12;

    const panel = new UIPanel({
      width,
      height,
      radius: 6,
      style: { fillStyle: theme.colors.surface, strokeStyle: theme.colors.border, shadow: 'md' },
    });
    panel.addChild(
      new UILabel({
        left: paddingX,
        top: 10,
        height: titleHeight,
        verticalAlign: 'middle',
        text: title,
        style: { fontSize: 13, fontWeight: '600', fillStyle: theme.colors.text },
      }),
      false,
    );
    if (description) {
      panel.addChild(
        new UILabel({
          left: paddingX,
          top: 10 + titleHeight,
          width: width - paddingX * 2,
          height: descHeight,
          verticalAlign: 'middle',
          text: description,
          style: { fontSize: 12, fillStyle: theme.colors.textSecondary },
        }),
        false,
      );
    }

    const cancelButton = new UIButton({
      left: width - paddingX - 152,
      top: buttonsTop,
      width: 72,
      height: 32,
      text: this.confirmOptions.cancelText || '取消',
      variant: 'default',
      size: 'small',
    });
    const confirmButton = new UIButton({
      left: width - paddingX - 72,
      top: buttonsTop,
      width: 72,
      height: 32,
      text: this.confirmOptions.confirmText || '确定',
      variant: 'primary',
      size: 'small',
      danger: this.confirmOptions.danger === true,
    });
    cancelButton.on('click', () => {
      this.hide();
      if (this.confirmOptions.onCancel) {
        this.confirmOptions.onCancel();
      }
    });
    confirmButton.on('click', () => {
      this.hide();
      if (this.confirmOptions.onConfirm) {
        this.confirmOptions.onConfirm();
      }
    });
    panel.addChild(cancelButton, false);
    panel.addChild(confirmButton, false);
    return panel;
  }
}

export function attachPopconfirm(ice: any, target: any, options: UIPopconfirmOptions = {}): UIPopconfirm {
  return new UIPopconfirm(ice, target, options).start();
}
