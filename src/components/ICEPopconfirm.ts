import { ICEButton } from './ICEButton';
import { t } from '../i18n/ICEI18n';
import { ICELabel } from './ICELabel';
import { ICEPanel } from './ICEPanel';
import { iceUIManager } from '../core/ICEManager';
import { ICEPopover, ICEPopoverOptions } from './ICEPopover';
import type { ICELocalizedProps } from '../i18n/ICEI18n';
import { tFor } from '../i18n/ICEI18n';
import type { ICETranslate } from '../i18n/ICEI18n';

/**
 * 气泡确认框：点击目标弹出「标题 + 说明 + 取消/确定」的小卡片。
 *
 * 复用 ICEPopover 的触发与定位；确认/取消后自动关闭并回调。
 */

export interface ICEPopconfirmOptions extends ICEPopoverOptions , ICELocalizedProps {
  description?: string;
  confirmText?: string;
  cancelText?: string;
  /** 危险操作：确认按钮用 error 色 */
  danger?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
}

export class ICEPopconfirm extends ICEPopover {
  private confirmOptions: ICEPopconfirmOptions;
  /** 内置文案：按 options.locale 解析（实例级） */
  private __t: ICETranslate;

  constructor(ice: any, target: any, options: ICEPopconfirmOptions = {}) {
    super(ice, target, { placement: 'topRight', trigger: 'click', ...options });
    this.confirmOptions = options;
    // ICEPopconfirm 继承的 ICEPopover 不是组件，自己持有翻译函数（按 options.locale 解析）
    this.__t = tFor(options.locale);
  }

  protected __createContent(): any {
    const theme = iceUIManager.getTheme();
    const width = 220;
    const paddingX = 12;
    const title = this.confirmOptions.title || this.__t('common.confirm');
    const description = this.confirmOptions.description;
    const titleHeight = 20;
    const descHeight = description ? 18 : 0;
    const buttonsTop = 12 + titleHeight + descHeight + 4;
    const height = buttonsTop + 32 + 12;

    const panel = new ICEPanel({
      width,
      height,
      radius: 6,
      style: { fillStyle: theme.colors.surface, strokeStyle: theme.colors.border, shadow: 'md' },
    });
    panel.addChild(
      new ICELabel({
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
        new ICELabel({
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

    const cancelButton = new ICEButton({
      left: width - paddingX - 152,
      top: buttonsTop,
      width: 72,
      height: 32,
      text: this.confirmOptions.cancelText || this.__t('common.cancel'),
      variant: 'default',
      size: 'small',
    });
    const confirmButton = new ICEButton({
      left: width - paddingX - 72,
      top: buttonsTop,
      width: 72,
      height: 32,
      text: this.confirmOptions.confirmText || this.__t('common.ok'),
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

export function attachPopconfirm(ice: any, target: any, options: ICEPopconfirmOptions = {}): ICEPopconfirm {
  return new ICEPopconfirm(ice, target, options).start();
}
