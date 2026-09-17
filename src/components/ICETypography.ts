import { token, type ICEThemeTokenRef } from 'ice-render';
import { ICEWidget } from '../core/ICEWidget';
import { ICELabel } from './ICELabel';
import { iceUIManager } from '../core/ICEManager';
import { estimateTextWidth, resolveColorValue } from '../util/ICEStyle';

/**
 * 按宽度把文本切成若干行，超出部分用 `…` 收尾。
 *
 * 为什么要自己折行：画布文本**没有裁剪也不会自动换行**，业务页里长文案要么压出色块、
 * 要么被邻居盖住。这里按「中文 1em / 其余 0.6em」的估算宽度切行，
 * 保证每行都不超过 `maxWidth`（与 `estimateTextWidth` 同一套口径）。
 */
export function truncateTextLines(
  text: string,
  options: { maxWidth: number; fontSize: number; maxLines?: number },
): string[] {
  const source = String(text ?? '');
  const maxWidth = Math.max(0, Number(options.maxWidth) || 0);
  const fontSize = Math.max(1, Number(options.fontSize) || 1);
  const maxLines = Math.max(1, Math.floor(Number(options.maxLines) || 1));
  if (maxWidth <= 0 || source === '') {
    return [source];
  }
  if (estimateTextWidth(source, fontSize) <= maxWidth) {
    return [source];
  }

  const chars = Array.from(source);
  const lines: string[] = [];
  let current = '';
  for (let index = 0; index < chars.length; index += 1) {
    const char = chars[index];
    const next = current + char;
    if (estimateTextWidth(next, fontSize) > maxWidth && current !== '') {
      lines.push(current);
      current = char;
      if (lines.length === maxLines) {
        // 已经放满 maxLines：把「最后一行 + 剩余内容」重新截成一行 + 省略号
        // （注意要从**已经写进最后一行**的内容续上，否则那一行的前半截会被丢掉）
        const rest = current + chars.slice(index + 1).join('');
        lines[maxLines - 1] = __fitWithEllipsis(lines[maxLines - 1] + rest, maxWidth, fontSize);
        return lines.slice(0, maxLines);
      }
      continue;
    }
    current = next;
  }
  if (current !== '') {
    lines.push(current);
  }
  return lines.slice(0, maxLines);
}

/** 在给定宽度内取尽可能长的前缀 + `…`。 */
function __fitWithEllipsis(text: string, maxWidth: number, fontSize: number): string {
  const ellipsis = '…';
  const chars = Array.from(text);
  let kept = '';
  for (const char of chars) {
    if (estimateTextWidth(kept + char + ellipsis, fontSize) > maxWidth) {
      break;
    }
    kept += char;
  }
  return kept === '' ? ellipsis : `${kept}${ellipsis}`;
}

export type ICETypographyVariant = 'title' | 'paragraph' | 'text' | 'link';
export type ICETypographyType = 'default' | 'secondary' | 'success' | 'warning' | 'danger' | 'primary';

/**
 * 排版文本：标题层级 / 正文 / 链接，自带省略与折行。
 *
 * - `variant: 'title'` + `level: 1..5`：五级标题，字号递减；
 * - `variant: 'paragraph'`：正文，配合 `rows` 做多行折行（末行补 `…`）；
 * - `variant: 'link'`：主色 + 可点击（触发 `click` 与 `onClick`）且可聚焦；
 * - `type`：语义色（`secondary` / `success` / `warning` / `danger` / `primary`）；
 * - `ellipsis: true`（或给了 `rows`）时按宽度截断——画布不会自动换行，长文案必须显式处理。
 */
export interface ICETypographyOptions {
  /** 组件 id（引擎会用它做唯一标识，e2e/调试时可按 id 定位） */
  id?: string;
  text: string;
  variant?: ICETypographyVariant;
  /** 标题层级，1 最大（默认 1） */
  level?: number;
  type?: ICETypographyType;
  /** 省略：true = 单行省略；配合 rows > 1 = 多行折行省略 */
  ellipsis?: boolean;
  rows?: number;
  strong?: boolean;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  fontSize?: number;
  onClick?: () => void;
}

const TITLE_SIZES = [28, 24, 20, 17, 15];

export class ICETypography extends ICEWidget {
  private text: string;
  private variant: ICETypographyVariant;
  private type: ICETypographyType;
  private fontSize: number;
  private rows: number;
  private lineHeight: number;
  private lines: string[] = [];
  private labelNodes: ICELabel[] = [];
  private onClick: (() => void) | null;

  constructor(props: ICETypographyOptions) {
    const theme = iceUIManager.getTheme();
    const variant: ICETypographyVariant = props.variant ?? 'text';
    const level = Math.min(5, Math.max(1, Math.floor(Number(props.level) || 1)));
    const fontSize =
      Number(props.fontSize) ||
      (variant === 'title'
        ? TITLE_SIZES[level - 1]
        : variant === 'paragraph'
          ? theme.font.size
          : theme.font.size);
    const rows = Math.max(1, Math.floor(Number(props.rows) || 1));
    const lineHeight = Math.round(fontSize * (variant === 'paragraph' ? 1.7 : 1.4));
    const height = props.height ?? rows * lineHeight;
    super({
      id: props.id,
      fill: false,
      stroke: false,
      interactive: variant === 'link',
      focusable: false,
      left: props.left,
      top: props.top,
      width: props.width ?? 240,
      height,
    });
    this.text = String(props.text ?? '');
    this.variant = variant;
    this.type = props.type ?? 'default';
    this.fontSize = fontSize;
    this.rows = props.ellipsis || props.rows ? rows : 1;
    this.lineHeight = lineHeight;
    this.onClick = typeof props.onClick === 'function' ? props.onClick : null;
    this.focusable = variant === 'link';
    if (variant === 'link') {
      // 不要再 trigger('click')：那会在自己的 click 处理里递归触发
      this.on('click', () => {
        if (this.onClick) {
          this.onClick();
        }
      });
    }
    this.__render();
  }

  public getText(): string {
    return this.text;
  }

  /** 当前渲染出来的行（省略/折行后的结果）。 */
  public getLines(): string[] {
    return this.lines.slice();
  }

  public getFontSize(): number {
    return this.fontSize;
  }

  public getTextColor(): string {
    // 公开读数接口只给**字符串**：`__color()` 现在可能返回主题引用（热切换用），
    // 这里解析成当前主题下的实际色值（见 `ICEStyle.resolveColorValue`）。
    return resolveColorValue(this.__color(), '', this);
  }

  public getLabelNodes(): ICELabel[] {
    return this.labelNodes.slice();
  }

  public setText(text: string): this {
    this.text = String(text ?? '');
    this.__render();
    return this;
  }

  public setType(type: ICETypographyType): this {
    this.type = type;
    this.__render();
    return this;
  }

  private __color(): string | ICEThemeTokenRef {
    const theme = iceUIManager.getTheme();
    if (this.type === 'secondary') return token('ui.colors.textSecondary');
    if (this.type === 'success') return token('ui.colors.success');
    if (this.type === 'warning') return token('ui.colors.warningTextEmphasis');
    if (this.type === 'danger') return token('ui.colors.error');
    if (this.type === 'primary') return token('ui.colors.primary');
    return this.variant === 'link' ? token('ui.colors.primary') : token('ui.colors.text');
  }

  protected __applyHoverState(): void {
    if (this.variant !== 'link') {
      return;
    }
    const theme = iceUIManager.getTheme();
    const color = this.hovered ? token('ui.colors.primaryHover') : this.__color();
    this.labelNodes.forEach((node) => {
      const textNode = node.childNodes[0];
      if (textNode) {
        textNode.setState({ style: { ...textNode.state.style, fillStyle: color } });
      }
    });
    this.revalidate();
  }

  /**
   * 尺寸变化时按新宽度重新断行并重排（`ICEWidget.__syncInternalLayout()`）。
   *
   * 排版（每行怎么切、切几行）**本身就是宽度的函数**，所以这里必须整段重跑 `__render()`：
   * 只改子项宽度不够 —— 行数/断点都可能是错的。文本节点上没有事件监听，重建是安全的。
   */
  protected __syncInternalLayout(): void {
    this.__render();
  }

  private __render(): void {
    const theme = iceUIManager.getTheme();
    this.removeChildren([...this.childNodes]);
    this.labelNodes = [];
    const width = Number(this.state.width) || 240;
    const color = this.__color();
    this.lines = truncateTextLines(this.text, {
      maxWidth: width,
      fontSize: this.fontSize,
      maxLines: this.rows,
    });
    this.labelNodes = this.lines.map((line, index) => {
      const node = new ICELabel({
        interactive: false,
        left: 0,
        top: index * this.lineHeight,
        width,
        height: this.lineHeight,
        text: line,
        verticalAlign: 'middle',
        style: {
          fontSize: this.fontSize,
          fontFamily: theme.font.family,
          fontWeight: this.variant === 'title' ? theme.font.weightSemibold : theme.font.weightNormal,
          fillStyle: color,
        },
      });
      this.addChild(node, false);
      return node;
    });
    this.revalidate();
    if (this.ice) {
      this.ice.dirty = true;
    }
  }
}
