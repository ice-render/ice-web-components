import { ICEText } from 'ice-render';
import type { ICEThemeTokens } from '../theme/ICETheme';

export type ICEStatusColor = 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info';

/**
 * 极简文本宽度估算（给「按最长文字定容器宽度」用的）。
 *
 * 画布文本**没有裁剪**：容器（tooltip / dropdown 面板）算窄了，中文会直接压出色块外面。
 * 中日韩与全角字符按 1em、其余按 0.6em 估算——够用且不依赖 ctx（构造期就能算）。
 */
export function estimateTextWidth(text: string, fontSize: number): number {
  let width = 0;
  for (const char of String(text ?? '')) {
    width += /[\u2e80-\u9fff\u3000-\u303f\uff00-\uffef]/.test(char) ? fontSize : fontSize * 0.6;
  }
  return Math.ceil(width);
}

/**
 * 从 `hoverchange` 事件里读取 hovered。
 *
 * 引擎的 `trigger(name, evt, param)` 把第三个参数放进 `event.param`（不是平铺在事件上），
 * 而手写的 `trigger('hoverchange', { hovered })` 又是平铺的 —— 两种都要兼容。
 * 只读 `evt.hovered` 会永远拿到 undefined，表现为「悬停反馈静默失效」。
 */
export function readHovered(evt: any): boolean {
  if (!evt) {
    return false;
  }
  return !!(evt.param ? evt.param.hovered : evt.hovered);
}

export type ICEStatusColors = {
  background: string;
  border: string;
  /** 状态实色（白底上的文字 / 进度条等填充） */
  text: string;
  /** subtle 浅底上的强调文字色（Bootstrap `*-text-emphasis`） */
  strong: string;
  /** 实底填充（Bootstrap `.text-bg-*` 的 background） */
  solid: string;
  /** 实底上的文字色（亮色底为黑字） */
  onSolid: string;
};

export function getStatusColors(theme: ICEThemeTokens, status: ICEStatusColor = 'default') {
  // `text` = 状态实色（用在白底上，如统计卡的涨跌数字）
  // `strong` = 强调文字色（用在 subtle 浅底上，如 Alert/Tag/Badge 的文字）
  // `solid` / `onSolid` = Bootstrap 的 `.text-bg-*`（实底 + 白字，亮色底配黑字）
  if (status === 'success') {
    return {
      background: theme.colors.successBg,
      border: theme.colors.successBorder,
      text: theme.colors.success,
      strong: theme.colors.successTextEmphasis,
      solid: theme.colors.success,
      onSolid: '#ffffff',
    };
  }
  if (status === 'warning') {
    return {
      background: theme.colors.warningBg,
      border: theme.colors.warningBorder,
      text: theme.colors.warning,
      strong: theme.colors.warningTextEmphasis,
      solid: theme.colors.warning,
      // Bootstrap `.text-bg-warning` 用黑字（亮黄底白字看不清）
      onSolid: '#000000',
    };
  }
  if (status === 'error') {
    return {
      background: theme.colors.errorBg,
      border: theme.colors.errorBorder,
      text: theme.colors.error,
      strong: theme.colors.errorTextEmphasis,
      solid: theme.colors.error,
      onSolid: '#ffffff',
    };
  }
  if (status === 'info') {
    return {
      background: theme.colors.infoBg,
      border: theme.colors.infoBorder,
      text: theme.colors.info,
      strong: theme.colors.infoTextEmphasis,
      solid: theme.colors.info,
      onSolid: '#000000',
    };
  }
  if (status === 'primary') {
    return {
      background: theme.colors.primaryBg,
      border: theme.colors.primaryBorder,
      text: theme.colors.primary,
      strong: theme.colors.primaryTextEmphasis,
      solid: theme.colors.primary,
      onSolid: '#ffffff',
    };
  }
  return {
    background: theme.colors.surface,
    border: theme.colors.border,
    text: theme.colors.textSecondary,
    strong: theme.colors.text,
    // Bootstrap 的 `.text-bg-secondary`
    solid: theme.colors.textSecondary,
    onSolid: '#ffffff',
  };
}

/**
 * 创建一段按照 ICE 约定居中显示的文本。
 * width/height 不传时交给 ICEText 自动测量，并保持左上角文本语义。
 */
export function createTextNode(props: {
  text?: string;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  fillStyle?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string;
  align?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
}) {
  const {
    text = '',
    left = 0,
    top = 0,
    width,
    height,
    fillStyle,
    fontFamily,
    fontSize,
    fontWeight,
    align = 'left',
    verticalAlign = 'top',
  } = props;

  const style: any = {
    fillStyle,
    fontFamily,
    fontSize,
    fontWeight,
  };

  if (align === 'center') {
    style.textAlign = 'center';
  } else if (align === 'right') {
    style.textAlign = 'right';
  }

  if (verticalAlign === 'middle') {
    style.textBaseline = 'middle';
  } else if (verticalAlign === 'bottom') {
    style.textBaseline = 'bottom';
  }

  return new ICEText({
    left,
    top,
    text,
    width,
    height,
    stroke: false,
    style,
  });
}

export function centerTextNode(
  text: string,
  theme: ICEThemeTokens,
  width: number,
  height: number,
  options: { fontSize?: number; fontWeight?: string; fillStyle?: string } = {},
) {
  return createTextNode({
    text,
    left: 0,
    top: 0,
    width,
    height,
    fillStyle: options.fillStyle ?? theme.colors.text,
    fontFamily: theme.font.family,
    fontSize: options.fontSize ?? theme.font.size,
    fontWeight: options.fontWeight ?? theme.font.weightNormal,
    align: 'center',
    verticalAlign: 'middle',
  });
}
