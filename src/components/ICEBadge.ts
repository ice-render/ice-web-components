import { ICEWidget } from '../core/ICEWidget';
import { iceUIManager } from '../core/ICEManager';
import { createTextNode, getStatusColors } from '../util/ICEStyle';

/**
 * 徽标：数字/文字胶囊；`dot` 是红点模式，`count` 超过阈值自动显示 `99+`。
 */
export class ICEBadge extends ICEWidget {
  private textNode: any;
  private dot: boolean;
  /** `solid` = Bootstrap `.text-bg-*` 实底（默认）；`soft` = subtle 浅底 */
  private variant: 'solid' | 'soft';

  constructor(props: any = {}) {
    const theme = iceUIManager.getTheme();
    const dot = props.dot === true;
    // 红点语义（状态点默认告警色），普通徽标默认主色
    const status = props.status || props.color || (dot ? 'error' : 'primary');
    const colors = getStatusColors(theme, status);
    const variant: 'solid' | 'soft' = props.variant === 'soft' ? 'soft' : 'solid';
    const dotSize = Number(props.dotSize) || 8;
    const text = props.text !== undefined ? String(props.text) : props.count !== undefined ? ICEBadge.__countText(props) : '0';
    const height = dot ? dotSize : props.height || 20;
    const width = dot ? dotSize : props.width || Math.max(24, height);
    super({
      ...props,
      fill: true,
      stroke: true,
      width,
      height,
      radius: dot ? dotSize / 2 : theme.radius.pill,
      style: {
        // 红点本身就是实心；普通徽标走 Bootstrap 的实底 + 白字（亮色底黑字）
        fillStyle: dot || variant === 'solid' ? colors.solid : colors.background,
        strokeStyle: dot || variant === 'solid' ? colors.solid : colors.border,
        lineWidth: theme.control.lineWidth,
        ...(props.style || {}),
      },
    });
    this.dot = dot;
    this.variant = variant;
    if (dot) {
      // 红点只画一个小圆，没有文字
      return;
    }
    const padX = theme.spacing.sm;
    this.textNode = createTextNode({
      left: padX,
      top: 0,
      width: Math.max(0, width - padX * 2),
      height,
      text,
      fillStyle: variant === 'solid' ? colors.onSolid : colors.strong,
      fontFamily: theme.font.family,
      fontSize: theme.font.sizeSmall,
      fontWeight: theme.font.weightSemibold,
      // 在「去掉左右内边距后的内盒」里居中：按文字宽度给的胶囊依然贴合文字，
      // 固定宽度的胶囊（如表格状态列）文字也不会偏左。
      align: 'center',
      verticalAlign: 'middle',
    });
    this.addChild(this.textNode, false);
  }

  /**
   * 尺寸变化时把内层文字盒铺到新的胶囊盒上（`ICEWidget.__syncInternalLayout()`）。
   *
   * 构造期按 `props.width/height` 算好文字盒（左右各让出 `spacing.sm` 内边距）就再没对过账：
   * 父层布局把胶囊拉宽/拉窄之后，文字盒还停在旧尺寸，`align: center` 于是在旧盒子里居中 ——
   * 文字偏出胶囊（表格状态列这类定宽胶囊一定会看到）。
   */
  protected __syncInternalLayout(): void {
    if (!this.textNode) {
      return; // dot 模式/无文字
    }
    const padX = iceUIManager.getTheme().spacing.sm;
    const width = Number(this.state.width) || 0;
    const height = Number(this.state.height) || 0;
    this.textNode.setState({ left: padX, top: 0, width: Math.max(0, width - padX * 2), height });
  }

  public setText(text: string): this {
    if (this.dot) {
      return this;
    }
    this.textNode.setText(text ?? '0');
    this.revalidate();
    return this;
  }

  /** 是否红点模式（只有圆点、没有文字）。 */
  public isDot(): boolean {
    return this.dot;
  }

  public getText(): string {
    if (this.dot || !this.textNode) {
      return '';
    }
    return this.textNode.getText();
  }

  /** 计数文案：超过 overflowCount（默认 99）显示 `N+`。 */
  private static __countText(props: any): string {
    const count = Number(props.count) || 0;
    const overflow = Number(props.overflowCount) || 99;
    return count > overflow ? `${overflow}+` : String(count);
  }
}
