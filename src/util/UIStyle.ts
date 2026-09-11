import { ICEText } from 'ice-render';
import type { UIThemeTokens } from '../theme/UITheme';

export type UIStatusColor = 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info';

export function getStatusColors(theme: UIThemeTokens, status: UIStatusColor = 'default') {
  if (status === 'success') {
    return {
      background: theme.colors.successBg,
      border: theme.colors.successBorder,
      text: theme.colors.success,
    };
  }
  if (status === 'warning') {
    return {
      background: theme.colors.warningBg,
      border: theme.colors.warningBorder,
      text: theme.colors.warning,
    };
  }
  if (status === 'error') {
    return {
      background: theme.colors.errorBg,
      border: theme.colors.errorBorder,
      text: theme.colors.error,
    };
  }
  if (status === 'info') {
    return {
      background: theme.colors.infoBg,
      border: theme.colors.infoBorder,
      text: theme.colors.info,
    };
  }
  if (status === 'primary') {
    return {
      background: theme.colors.primaryBg,
      border: theme.colors.primaryBorder,
      text: theme.colors.primary,
    };
  }
  return {
    background: theme.colors.surface,
    border: theme.colors.border,
    text: theme.colors.textSecondary,
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
  theme: UIThemeTokens,
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
