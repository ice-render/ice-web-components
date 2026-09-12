import { UIButton } from './UIButton';
import { UILabel } from './UILabel';
import { UIComponent } from '../core/UIComponent';
import { uiManager } from '../core/UIManager';

/**
 * 结果页（业界组件库 Result）：状态图标 + 标题 + 副标题 + 操作按钮组。
 * 用于提交成功/失败、404、无权限等场景。
 */
export type UIResultStatus = 'success' | 'error' | 'info' | 'warning';

export interface UIResultAction {
  key: string;
  text: string;
  primary?: boolean;
}

export interface UIResultOptions {
  status?: UIResultStatus;
  title?: string;
  subtitle?: string;
  actions?: UIResultAction[];
  onAction?: (key: string) => void;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
}

export class UIResult extends UIComponent {
  private buttons = new Map<string, UIButton>();

  constructor(props: UIResultOptions) {
    const theme = uiManager.getTheme();
    const width = props.width ?? 320;
    const height = props.height ?? 200;
    super({ fill: false, stroke: false, left: props.left, top: props.top, width, height });
    const status = props.status || 'info';
    const statusColor =
      status === 'success'
        ? theme.colors.success
        : status === 'error'
        ? theme.colors.error
        : status === 'warning'
        ? theme.colors.warning
        : theme.colors.info;
    const statusIcon = status === 'success' ? '✓' : status === 'error' ? '✕' : status === 'warning' ? '!' : 'ℹ';

    this.addChild(
      new UILabel({
        interactive: false,
        left: 0,
        top: Math.max(8, height / 2 - 72),
        width,
        height: 44,
        align: 'center',
        verticalAlign: 'middle',
        text: statusIcon,
        style: { fontSize: 36, fillStyle: statusColor },
      }),
      false,
    );
    if (props.title) {
      this.addChild(
        new UILabel({
          interactive: false,
          left: 0,
          top: Math.max(56, height / 2 - 28),
          width,
          height: 24,
          align: 'center',
          verticalAlign: 'middle',
          text: props.title,
          style: { fontSize: 16, fontWeight: '600', fillStyle: theme.colors.text },
        }),
        false,
      );
    }
    if (props.subtitle) {
      this.addChild(
        new UILabel({
          interactive: false,
          left: 0,
          top: Math.max(82, height / 2 - 2),
          width,
          height: 20,
          align: 'center',
          verticalAlign: 'middle',
          text: props.subtitle,
          style: { fontSize: 12, fillStyle: theme.colors.textSecondary },
        }),
        false,
      );
    }
    const actions = props.actions || [];
    if (actions.length) {
      const buttonWidth = 110;
      const gap = 12;
      const totalWidth = actions.length * buttonWidth + (actions.length - 1) * gap;
      const startLeft = (width - totalWidth) / 2;
      actions.forEach((action, index) => {
        const button = new UIButton({
          left: startLeft + index * (buttonWidth + gap),
          top: Math.max(110, height / 2 + 26),
          width: buttonWidth,
          height: 32,
          text: action.text,
          size: 'small',
          variant: action.primary ? 'primary' : 'default',
        });
        button.on('click', () => {
          if (props.onAction) {
            props.onAction(action.key);
          }
        });
        this.addChild(button, false);
        this.buttons.set(action.key, button);
      });
    }
  }

  public getActionButton(key: string): UIButton | null {
    return this.buttons.get(key) || null;
  }
}
