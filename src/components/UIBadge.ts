import { UIComponent } from '../core/UIComponent';
import { uiManager } from '../core/UIManager';
import { createTextNode, getStatusColors } from '../util/UIStyle';

export class UIBadge extends UIComponent {
  private textNode: any;
  private dot: boolean;

  constructor(props: any = {}) {
    const theme = uiManager.getTheme();
    const dot = props.dot === true;
    // 红点语义（业界组件库：状态点默认告警色），普通徽标默认主色
    const status = props.status || props.color || (dot ? 'error' : 'primary');
    const colors = getStatusColors(theme, status);
    const dotSize = Number(props.dotSize) || 8;
    const text = props.text !== undefined ? String(props.text) : props.count !== undefined ? UIBadge.__countText(props) : '0';
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
        // 红点是实心圆点（业界组件库 语义）：用状态实色，而不是徽标那种浅底 + 描边
        fillStyle: dot ? colors.text : colors.background,
        strokeStyle: dot ? colors.text : colors.border,
        lineWidth: theme.control.lineWidth,
        ...(props.style || {}),
      },
    });
    this.dot = dot;
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
      fillStyle: colors.text,
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
