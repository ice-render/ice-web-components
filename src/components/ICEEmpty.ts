import { ICEButton } from './ICEButton';
import { ICELabel } from './ICELabel';
import { ICEWidget } from '../core/ICEWidget';
import { iceUIManager } from '../core/ICEManager';

/**
 * 空状态：居中的图标 + 描述 + 可选操作按钮。
 * 常用于列表/表格无数据、搜索无结果。
 */
export interface ICEEmptyOptions {
  /** 组件 id（引擎会用它做唯一标识，e2e/调试时可按 id 定位） */
  id?: string;
  description?: string;
  /** 图标字形（默认 ◌） */
  icon?: string;
  actionText?: string;
  onAction?: () => void;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
}

export class ICEEmpty extends ICEWidget {
  private actionButton: ICEButton | null = null;

  constructor(props: ICEEmptyOptions) {
    const theme = iceUIManager.getTheme();
    const width = props.width ?? 240;
    const height = props.height ?? 140;
    super({
      id: props.id,
      fill: false, stroke: false, left: props.left, top: props.top, width, height ,
    });
    const icon = props.icon ?? '◌';
    const hasAction = !!props.actionText;

    this.addChild(
      new ICELabel({
        interactive: false,
        left: 0,
        top: Math.max(8, height / 2 - 46),
        width,
        height: 32,
        align: 'center',
        verticalAlign: 'middle',
        text: icon,
        style: { fontSize: 26, fillStyle: theme.colors.textDisabled },
      }),
      false,
    );
    this.addChild(
      new ICELabel({
        interactive: false,
        left: 0,
        top: Math.max(44, height / 2 - 8),
        width,
        height: 20,
        align: 'center',
        verticalAlign: 'middle',
        text: props.description ?? '',
        style: { fontSize: 13, fillStyle: theme.colors.textSecondary },
      }),
      false,
    );
    if (hasAction) {
      const button = new ICEButton({
        left: (width - 96) / 2,
        top: Math.max(72, height / 2 + 20),
        width: 96,
        height: 30,
        text: props.actionText as string,
        size: 'small',
        variant: 'default',
      });
      button.on('click', () => {
        if (props.onAction) {
          props.onAction();
        }
      });
      this.addChild(button, false);
      this.actionButton = button;
    }
  }

  public getActionButton(): ICEButton | null {
    return this.actionButton;
  }
}
