import { ICEText } from 'ice-render';
import type { ICEThemeTokens } from '../theme/ICETheme';

export type ICEStatusColor = 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info';

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
