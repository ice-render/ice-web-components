export type ICEColor = string;

/** 阴影：直接给引擎认的四个数值字段（比自己再造一套 shadow 名字更可控）。 */
export type ICEShadowTokens = {
  shadowColor: string;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
};

export type ICEThemeTokens = {
  colors: {
    primary: ICEColor;
    primaryHover: ICEColor;
    primaryActive: ICEColor;
    primaryBg: ICEColor;
    primaryBorder: ICEColor;
    primaryText: ICEColor;
    background: ICEColor;
    surface: ICEColor;
    elevated: ICEColor;
    border: ICEColor;
    borderSecondary: ICEColor;
    text: ICEColor;
    textSecondary: ICEColor;
    textTertiary: ICEColor;
    textDisabled: ICEColor;
    muted: ICEColor;
    disabled: ICEColor;
    disabledText: ICEColor;
    success: ICEColor;
    successBg: ICEColor;
    successBorder: ICEColor;
    warning: ICEColor;
    warningBg: ICEColor;
    warningBorder: ICEColor;
    error: ICEColor;
    errorBg: ICEColor;
    errorBorder: ICEColor;
    info: ICEColor;
    infoBg: ICEColor;
    infoBorder: ICEColor;
    /**
     * 强调文字色（Bootstrap 的 `*-text-emphasis`）：用在 **subtle 底**上的文字。
     * 直接把 `warning: #ffc107` 这样的亮色当文字压不住（对比度不足），
     * 所以浅底场景（Alert/Tag/Badge）统一取这一组深色。
     */
    primaryTextEmphasis: ICEColor;
    successTextEmphasis: ICEColor;
    warningTextEmphasis: ICEColor;
    errorTextEmphasis: ICEColor;
    infoTextEmphasis: ICEColor;
    /** 聚焦态描边色（Bootstrap 的 `$input-btn-focus-color` / 聚焦输入框边框 `#86b7fe`）。 */
    focusRing: ICEColor;
  };
  spacing: {
    xxs: number;
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    xxl: number;
  };
  radius: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    pill: number;
  };
  font: {
    family: string;
    size: number;
    sizeSmall: number;
    sizeLarge: number;
    weightNormal: string;
    weightMedium: string;
    weightSemibold: string;
    weightBold: string;
  };
  control: {
    heightSmall: number;
    height: number;
    heightLarge: number;
    paddingXXS: number;
    paddingXS: number;
    paddingSmall: number;
    padding: number;
    paddingLarge: number;
    lineWidth: number;
    lineWidthFocused: number;
    switchWidth: number;
    switchHeight: number;
    switchHandle: number;
    checkboxSize: number;
    radioSize: number;
    progressHeight: number;
    sliderTrackHeight: number;
    sliderHandle: number;
  };
  shadows: {
    sm: ICEShadowTokens;
    md: ICEShadowTokens;
    lg: ICEShadowTokens;
  };
};

/**
 * 配色取 **Bootstrap 5** 的语义色板（不是 业界组件库 那套）：
 * - 主色 `#0d6efd`，悬停 `#0b5ed7`（shade），按下 `#0a58ca`；
 * - subtle 背景 / 边框用 Bootstrap 的 `*-bg-subtle` / `*-border-subtle`
 *   （primary #cfe2ff / #9ec5fe、success #d1e7dd / #a3cfbb …）；
 * - 正文 `#212529`（gray-900）、次级 `#6c757d`（gray-600）、三级 `#adb5bd`（gray-500）；
 * - 页面底色 `#f8f9fa`（gray-100）、描边 `#dee2e6`（gray-300）、次描边 `#e9ecef`（gray-200）。
 */
const LIGHT_TEXT = '#212529';
const LIGHT_TEXT_SECONDARY = '#6c757d';
const LIGHT_TEXT_TERTIARY = '#adb5bd';
const LIGHT_TEXT_DISABLED = '#adb5bd';

export const ICE_LIGHT_THEME: ICEThemeTokens = {
  colors: {
    primary: '#0d6efd',
    primaryHover: '#0b5ed7',
    primaryActive: '#0a58ca',
    primaryBg: '#cfe2ff',
    primaryBorder: '#9ec5fe',
    primaryText: '#ffffff',
    background: '#f8f9fa',
    surface: '#ffffff',
    elevated: '#ffffff',
    border: '#dee2e6',
    borderSecondary: '#e9ecef',
    text: LIGHT_TEXT,
    textSecondary: LIGHT_TEXT_SECONDARY,
    textTertiary: LIGHT_TEXT_TERTIARY,
    textDisabled: LIGHT_TEXT_DISABLED,
    muted: LIGHT_TEXT_SECONDARY,
    disabled: '#e9ecef',
    disabledText: LIGHT_TEXT_DISABLED,
    success: '#198754',
    successBg: '#d1e7dd',
    successBorder: '#a3cfbb',
    warning: '#ffc107',
    warningBg: '#fff3cd',
    warningBorder: '#ffe69c',
    error: '#dc3545',
    errorBg: '#f8d7da',
    errorBorder: '#f1aeb5',
    info: '#0dcaf0',
    infoBg: '#cff4fc',
    infoBorder: '#9eeaf9',
    primaryTextEmphasis: '#052c65',
    successTextEmphasis: '#0a3622',
    warningTextEmphasis: '#664d03',
    errorTextEmphasis: '#58151c',
    infoTextEmphasis: '#055160',
    focusRing: '#86b7fe',
  },
  spacing: {
    xxs: 4,
    xs: 8,
    sm: 12,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  radius: {
    xs: 2,
    sm: 4,
    md: 6,
    lg: 8,
    xl: 16,
    pill: 999,
  },
  font: {
    family:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'",
    size: 14,
    sizeSmall: 12,
    sizeLarge: 16,
    weightNormal: 'normal',
    weightMedium: '500',
    weightSemibold: '600',
    weightBold: 'bold',
  },
  control: {
    heightSmall: 24,
    height: 32,
    heightLarge: 40,
    paddingXXS: 4,
    paddingXS: 8,
    paddingSmall: 12,
    padding: 16,
    paddingLarge: 24,
    lineWidth: 1,
    lineWidthFocused: 2,
    switchWidth: 44,
    switchHeight: 22,
    switchHandle: 18,
    checkboxSize: 18,
    radioSize: 18,
    progressHeight: 8,
    sliderTrackHeight: 6,
    sliderHandle: 18,
  },
  shadows: {
    // Bootstrap 的阴影：低透明度、大模糊半径（$box-shadow-sm / default / lg）
    sm: { shadowColor: 'rgba(0, 0, 0, 0.075)', shadowBlur: 6, shadowOffsetX: 0, shadowOffsetY: 2 },
    md: { shadowColor: 'rgba(0, 0, 0, 0.15)', shadowBlur: 16, shadowOffsetX: 0, shadowOffsetY: 8 },
    lg: { shadowColor: 'rgba(0, 0, 0, 0.175)', shadowBlur: 48, shadowOffsetX: 0, shadowOffsetY: 16 },
  },
};

/** Bootstrap 5.3 暗色模式：正文 #dee2e6、次描边 #495057、subtle 用深色档。 */
const DARK_TEXT = '#dee2e6';
const DARK_TEXT_SECONDARY = '#adb5bd';
const DARK_TEXT_TERTIARY = '#6c757d';
const DARK_TEXT_DISABLED = '#6c757d';

export const ICE_DARK_THEME: ICEThemeTokens = {
  ...ICE_LIGHT_THEME,
  colors: {
    primary: '#0d6efd',
    primaryHover: '#3d8bfd',
    primaryActive: '#0a58ca',
    primaryBg: '#031633',
    primaryBorder: '#084298',
    primaryText: '#ffffff',
    background: '#212529',
    surface: '#2b3035',
    elevated: '#343a40',
    border: '#495057',
    borderSecondary: '#343a40',
    text: DARK_TEXT,
    textSecondary: DARK_TEXT_SECONDARY,
    textTertiary: DARK_TEXT_TERTIARY,
    textDisabled: DARK_TEXT_DISABLED,
    muted: DARK_TEXT_SECONDARY,
    disabled: '#343a40',
    disabledText: DARK_TEXT_DISABLED,
    success: '#198754',
    successBg: '#051b11',
    successBorder: '#0f5132',
    warning: '#ffc107',
    warningBg: '#332701',
    warningBorder: '#664d03',
    error: '#dc3545',
    errorBg: '#2c0b0e',
    errorBorder: '#842029',
    info: '#0dcaf0',
    infoBg: '#032830',
    infoBorder: '#087990',
    primaryTextEmphasis: '#cfe2ff',
    successTextEmphasis: '#d1e7dd',
    warningTextEmphasis: '#fff3cd',
    errorTextEmphasis: '#f8d7da',
    infoTextEmphasis: '#cff4fc',
    focusRing: '#6ea8fe',
  },
};
