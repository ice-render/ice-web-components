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
  /** 描述文案（构造时确定；语言包切换后重建组件即变） */
  private descriptionText = '';
  private iconLabel: ICELabel;
  private descLabel: ICELabel;
  /** 操作按钮的固定宽高：与组件尺寸无关，只影响居中偏移 */
  private static readonly ACTION_W = 96;
  private static readonly ACTION_H = 30;

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
    this.descriptionText = String(props.description ?? '');

    this.iconLabel = new ICELabel({
      interactive: false,
      left: 0,
      top: Math.max(8, height / 2 - 46),
      width,
      height: 32,
      align: 'center',
      verticalAlign: 'middle',
      text: icon,
      style: { fontSize: 26, fillStyle: theme.colors.textDisabled },
    });
    this.addChild(this.iconLabel, false);
    this.descLabel = new ICELabel({
      interactive: false,
      left: 0,
      top: Math.max(44, height / 2 - 8),
      width,
      height: 20,
      align: 'center',
      verticalAlign: 'middle',
      text: props.description ?? '',
      style: { fontSize: 13, fillStyle: theme.colors.textSecondary },
    });
    this.addChild(this.descLabel, false);
    if (hasAction) {
      const button = new ICEButton({
        left: (width - ICEEmpty.ACTION_W) / 2,
        top: Math.max(72, height / 2 + 20),
        width: ICEEmpty.ACTION_W,
        height: ICEEmpty.ACTION_H,
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

  /**
   * 尺寸变化时把这一摞居中元素重新摆一遍（`ICEWidget.__syncInternalLayout()`）。
   *
   * 构造期每个子项都按 `width` 与 `height / 2 ± 偏移` 算好了位置，之后父层布局改尺寸时
   * 谁都不动 —— 图标/文案留在旧的水平位置上（窄盒子里就跑到外面），垂直也不再居中。
   */
  protected __syncInternalLayout(): void {
    const width = Number(this.state.width) || 0;
    const height = Number(this.state.height) || 0;
    if (!(width > 0) || !(height > 0)) {
      return;
    }
    if (this.iconLabel) {
      this.iconLabel.setState({ left: 0, top: Math.max(8, height / 2 - 46), width });
    }
    if (this.descLabel) {
      this.descLabel.setState({ left: 0, top: Math.max(44, height / 2 - 8), width });
    }
    if (this.actionButton) {
      this.actionButton.setState({
        left: (width - ICEEmpty.ACTION_W) / 2,
        top: Math.max(72, height / 2 + 20),
      });
    }
  }

  public getActionButton(): ICEButton | null {
    return this.actionButton;
  }

  /** 空态描述文案（测试 / QA 用；语言包切换后重建组件即变）。 */
  public getDescription(): string {
    return this.descriptionText;
  }
}
