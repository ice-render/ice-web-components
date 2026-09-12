import { ICEWidget } from '../core/ICEWidget';
import { ICELabel } from './ICELabel';
import { iceUIManager } from '../core/ICEManager';
import { createTextNode, getStatusColors } from '../util/ICEStyle';

export type ICEAlertType = 'info' | 'success' | 'warning' | 'error';

export class ICEAlert extends ICEWidget {
  private titleNode: any;
  private messageNode: any;
  private type: ICEAlertType;
  private closable: boolean;
  private closed = false;
  private closeButton: ICEWidget | null = null;
  private iconNode: ICELabel | null = null;
  private onCloseCallback: (() => void) | null;

  constructor(props: any = {}) {
    const theme = iceUIManager.getTheme();
    const type = props.type || 'info';
    const colors = getStatusColors(theme, type);
    const width = props.width || 420;
    const height = props.height || 60;
    const closable = props.closable === true;
    const showIcon = props.showIcon !== false;

    super({
      ...props,
      fill: true,
      stroke: true,
      width,
      height,
      radius: theme.radius.md,
      style: {
        fillStyle: colors.background,
        strokeStyle: colors.border,
        lineWidth: theme.control.lineWidth,
        ...(props.style || {}),
      },
    });

    this.type = type;
    this.closable = closable;
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

  /** 关闭（隐藏整棵子树）并回调 onClose；重复调用只生效一次。 */
  public close(): this {
    if (this.closed) {
      return this;
    }
    this.closed = true;
    this.setState({ display: false });
    if (this.onCloseCallback) {
      this.onCloseCallback();
    }
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
