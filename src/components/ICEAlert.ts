import { ICEWidget } from '../core/ICEWidget';
import { ICELabel } from './ICELabel';
import { iceUIManager } from '../core/ICEManager';
import { createTextNode, getStatusColors } from '../util/ICEStyle';
import { fadeTo } from '../util/ICEAnimation';

export type ICEAlertType = 'info' | 'success' | 'warning' | 'error';

/**
 * 提示条：info / success / warning / error 四种状态 + 类型图标，可关闭。
 */
export class ICEAlert extends ICEWidget {
  private titleNode: any;
  private messageNode: any;
  private type: ICEAlertType;
  private closable: boolean;
  private closed = false;
  private closeButton: ICEWidget | null = null;
  private iconNode: ICELabel | null = null;
  private onCloseCallback: (() => void) | null;
  private banner: boolean;
  private actionNode: any = null;
  private closeDuration: number;
  private animationEnabled: boolean;
  /** 是否画类型图标（决定文字块左侧让位多少） */
  private showIcon: boolean;
  /** 右侧操作区的固定宽度（0 = 没有操作区；与组件宽度无关） */
  private actionWidth = 0;

  constructor(props: any = {}) {
    const theme = iceUIManager.getTheme();
    const type = props.type || 'info';
    const colors = getStatusColors(theme, type);
    const width = props.width || 420;
    const height = props.height || 60;
    const closable = props.closable === true;
    const showIcon = props.showIcon !== false;
    const banner = props.banner === true;

    super({
      ...props,
      fill: true,
      // banner 是通栏提示条：不留圆角、不描边，直接贴在页面顶部
      stroke: !banner,
      width,
      height,
      radius: banner ? 0 : theme.radius.md,
      style: {
        fillStyle: colors.background,
        strokeStyle: colors.border,
        lineWidth: theme.control.lineWidth,
        ...(props.style || {}),
      },
    });

    this.type = type;
    this.closable = closable;
    this.banner = banner;
    this.showIcon = showIcon;
    // 默认不播动画（老行为：点 ✕ 立刻消失）；要淡出的调用方显式传 `animation: true`
    this.animationEnabled = props.animation === true;
    this.closeDuration = Math.max(0, Math.floor(props.closeDuration === undefined ? 180 : Number(props.closeDuration) || 0));
    this.onCloseCallback = typeof props.onClose === 'function' ? props.onClose : null;
    // 图标时整块文案右移，给图标让位
    const iconWidth = showIcon ? 24 : 0;
    // 可关闭时给右侧关闭按钮留位
    const textWidth = Math.max(0, width - theme.spacing.md * 2 - iconWidth - (closable ? 24 : 0));

    if (showIcon) {
      this.iconNode = new ICELabel({
        interactive: false,
        left: theme.spacing.md,
        top: theme.spacing.xs,
        width: 18,
        height: 20,
        align: 'center',
        verticalAlign: 'middle',
        text: ICEAlert.__iconOf(type),
        style: { fontSize: theme.font.size, fontWeight: theme.font.weightSemibold, fillStyle: colors.strong },
      });
      this.addChild(this.iconNode, false);
    }
    this.titleNode = createTextNode({
      left: theme.spacing.md + iconWidth,
      top: theme.spacing.xs,
      width: textWidth,
      height: 20,
      text: props.title || '',
      fillStyle: colors.strong,
      fontFamily: theme.font.family,
      fontSize: theme.font.size,
      fontWeight: theme.font.weightSemibold,
      align: 'left',
      verticalAlign: 'middle',
    });
    this.messageNode = createTextNode({
      left: theme.spacing.md + iconWidth,
      top: theme.spacing.md + 16,
      width: textWidth,
      height: 18,
      text: props.message || '',
      fillStyle: theme.colors.textSecondary,
      fontFamily: theme.font.family,
      fontSize: theme.font.sizeSmall,
      fontWeight: theme.font.weightNormal,
      align: 'left',
      verticalAlign: 'middle',
    });
    this.addChild(this.titleNode, false);
    this.addChild(this.messageNode, false);

    if (closable) {
      const button = new ICEWidget({
        left: width - 30,
        top: 10,
        width: 20,
        height: 20,
        radius: theme.radius.sm,
        fill: false,
        stroke: false,
      });
      button.addChild(
        createTextNode({
          left: 0,
          top: 0,
          width: 20,
          height: 20,
          text: '✕',
          fillStyle: colors.strong,
          fontFamily: theme.font.family,
          fontSize: theme.font.sizeSmall,
          align: 'center',
          verticalAlign: 'middle',
        }),
        false,
      );
      button.on('click', () => this.close());
      this.addChild(button, false);
      this.closeButton = button;
    }

    // 右侧操作区（「立即刷新」这类）：摆在关闭按钮左边
    if (props.action) {
      const actionText = typeof props.action === 'string' ? props.action : String(props.action.text || '');
      const actionWidth = Math.max(64, actionText.length * 13 + 16);
      this.actionWidth = actionWidth;
      const action = new ICEWidget({
        left: width - (closable ? 38 : 16) - actionWidth,
        top: Math.round((height - 26) / 2),
        width: actionWidth,
        height: 26,
        radius: theme.radius.sm,
        fill: true,
        stroke: false,
        interactive: true,
        style: { fillStyle: 'rgba(0,0,0,0)' },
      });
      action.addChild(
        createTextNode({
          left: 0,
          top: 0,
          width: actionWidth,
          height: 26,
          text: actionText,
          fillStyle: colors.strong,
          fontFamily: theme.font.family,
          fontSize: theme.font.sizeSmall,
          fontWeight: theme.font.weightSemibold,
          align: 'center',
          verticalAlign: 'middle',
        }),
        false,
      );
      const onAction = typeof props.action === 'object' && typeof props.action.onClick === 'function' ? props.action.onClick : null;
      action.on(
        'click',
        () => {
          if (onAction) {
            onAction();
          } else {
            this.close();
          }
        },
        this,
      );
      this.addChild(action, false);
      this.actionNode = action;
    }
  }

  public isBanner(): boolean {
    return this.banner;
  }

  public getActionNode(): any {
    return this.actionNode;
  }

  public setTitle(title: string): this {
    this.titleNode.setText(title ?? '');
    this.revalidate();
    return this;
  }

  public setMessage(message: string): this {
    this.messageNode.setText(message ?? '');
    this.revalidate();
    return this;
  }

  public getType(): ICEAlertType {
    return this.type;
  }

  public getIconNode(): ICELabel | null {
    return this.iconNode;
  }

  public getTitleNode(): any {
    return this.titleNode;
  }

  private static __iconOf(type: ICEAlertType): string {
    if (type === 'success') {
      return '✓';
    }
    if (type === 'warning') {
      return '!';
    }
    if (type === 'error') {
      return '✕';
    }
    return 'ℹ';
  }

  /**
   * 尺寸变化时重排文案、关闭按钮与右侧操作区（`ICEWidget.__syncInternalLayout()`）。
   *
   * 构造期按 `props.width/height` 算好了文字块宽度（`width - 左右内距 - 图标 - 关闭按钮`）、
   * 关闭按钮的右对齐位置、操作区的垂直居中位置，之后父层布局改尺寸时谁都不动 ——
   * 文字块还是旧宽度（提示条被拉窄后文字画到条外），右侧两个控件也不再贴右边。
   *
   * 操作区的**宽度**由文案长度决定（与组件宽度无关），所以只重算它的水平位置。
   */
  protected __syncInternalLayout(): void {
    const theme = iceUIManager.getTheme();
    const width = Number(this.state.width) || 0;
    const height = Number(this.state.height) || 0;
    if (!(width > 0) || !(height > 0)) {
      return;
    }
    const iconWidth = this.showIcon ? 24 : 0;
    const textWidth = Math.max(0, width - theme.spacing.md * 2 - iconWidth - (this.closable ? 24 : 0));
    if (this.iconNode) {
      this.iconNode.setState({ left: theme.spacing.md, top: theme.spacing.xs });
    }
    if (this.titleNode) {
      this.titleNode.setState({ left: theme.spacing.md + iconWidth, top: theme.spacing.xs, width: textWidth });
    }
    if (this.messageNode) {
      this.messageNode.setState({
        left: theme.spacing.md + iconWidth,
        top: theme.spacing.md + 16,
        width: textWidth,
      });
    }
    if (this.closeButton) {
      this.closeButton.setState({ left: width - 30, top: 10 });
    }
    if (this.actionNode && this.actionWidth > 0) {
      this.actionNode.setState({
        left: width - (this.closable ? 38 : 16) - this.actionWidth,
        top: Math.round((height - 26) / 2),
      });
    }
  }

  /** 关闭（隐藏整棵子树）并回调 onClose；重复调用只生效一次。 */
  public close(): this {
    if (this.closed) {
      return this;
    }
    this.closed = true;
    const finish = () => {
      this.setState({ display: false });
      if (this.onCloseCallback) {
        this.onCloseCallback();
      }
    };
    // 关了动效（或开了「减少动效」）就立即收：`fadeTo` 内部会把时长收敛到 0
    if (!this.animationEnabled || this.closeDuration === 0) {
      finish();
      return this;
    }
    fadeTo(this, 0, {
      duration: this.closeDuration,
      onFinish: finish,
    });
    return this;
  }

  public isClosed(): boolean {
    return this.closed;
  }

  public isClosable(): boolean {
    return this.closable;
  }

  public getCloseButton(): ICEWidget | null {
    return this.closeButton;
  }
}
