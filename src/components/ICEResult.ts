import { ICEButton } from './ICEButton';
import { ICELabel } from './ICELabel';
import { ICEWidget } from '../core/ICEWidget';
import { iceUIManager } from '../core/ICEManager';
import { ICEFlowLayout } from 'ice-render';

/**
 * 结果页：状态图标 + 标题 + 副标题 + 操作按钮组。
 * 用于提交成功/失败、404、无权限等场景。
 */
export type ICEResultStatus = 'success' | 'error' | 'info' | 'warning';

export interface ICEResultAction {
  key: string;
  text: string;
  primary?: boolean;
}

export interface ICEResultOptions {
  /** 组件 id（引擎会用它做唯一标识，e2e/调试时可按 id 定位） */
  id?: string;
  status?: ICEResultStatus;
  title?: string;
  subtitle?: string;
  actions?: ICEResultAction[];
  onAction?: (key: string) => void;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
}

export class ICEResult extends ICEWidget {
  private buttons = new Map<string, ICEButton>();

  constructor(props: ICEResultOptions) {
    const theme = iceUIManager.getTheme();
    const width = props.width ?? 320;
    const height = props.height ?? 200;
    super({
      id: props.id,
      fill: false, stroke: false, left: props.left, top: props.top, width, height ,
    });
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
      new ICELabel({
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
        new ICELabel({
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
        new ICELabel({
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
      /** 动作按钮是一行居中的等宽按钮 → 流式布局（`align:'center'` 就是整行居中） */
      const actionRow = new ICEWidget({
        left: 0,
        top: Math.max(110, height / 2 + 26),
        width,
        height: 32,
        fill: false,
        stroke: false,
        interactive: false,
      });
      actionRow.setLayout(new ICEFlowLayout({ gap, align: 'center', crossAlign: 'center' }));
      this.addChild(actionRow, false);
      actions.forEach((action) => {
        const button = new ICEButton({
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
        actionRow.addChild(button, false);
        this.buttons.set(action.key, button);
      });
    }
  }

  public getActionButton(key: string): ICEButton | null {
    return this.buttons.get(key) || null;
  }
}
