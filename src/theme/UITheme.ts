export type UIColor = string;

export type UIThemeTokens = {
  colors: {
    primary: UIColor;
    primaryHover: UIColor;
    primaryActive: UIColor;
    primaryBg: UIColor;
    primaryBorder: UIColor;
    primaryText: UIColor;
    background: UIColor;
    surface: UIColor;
    elevated: UIColor;
    border: UIColor;
    borderSecondary: UIColor;
    text: UIColor;
    textSecondary: UIColor;
    textTertiary: UIColor;
    textDisabled: UIColor;
    muted: UIColor;
    disabled: UIColor;
    disabledText: UIColor;
    success: UIColor;
    successBg: UIColor;
    successBorder: UIColor;
    warning: UIColor;
    warningBg: UIColor;
    warningBorder: UIColor;
    error: UIColor;
    errorBg: UIColor;
    errorBorder: UIColor;
    info: UIColor;
    infoBg: UIColor;
    infoBorder: UIColor;
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
    sm: string;
    md: string;
    lg: string;
  };
};

const LIGHT_TEXT = 'rgba(0, 0, 0, 0.88)';
const LIGHT_TEXT_SECONDARY = 'rgba(0, 0, 0, 0.65)';
const LIGHT_TEXT_TERTIARY = 'rgba(0, 0, 0, 0.45)';
const LIGHT_TEXT_DISABLED = 'rgba(0, 0, 0, 0.25)';

export const UI_LIGHT_THEME: UIThemeTokens = {
  colors: {
    primary: '#1677ff',
    primaryHover: '#4096ff',
    primaryActive: '#0958d9',
    primaryBg: '#e6f4ff',
    primaryBorder: '#91caff',
    primaryText: '#ffffff',
    background: '#f5f5f5',
    surface: '#ffffff',
    elevated: '#ffffff',
    border: '#d9d9d9',
    borderSecondary: '#f0f0f0',
    text: LIGHT_TEXT,
    textSecondary: LIGHT_TEXT_SECONDARY,
    textTertiary: LIGHT_TEXT_TERTIARY,
    textDisabled: LIGHT_TEXT_DISABLED,
    muted: LIGHT_TEXT_SECONDARY,
    disabled: 'rgba(0, 0, 0, 0.04)',
    disabledText: LIGHT_TEXT_DISABLED,
    success: '#52c41a',
    successBg: '#f6ffed',
    successBorder: '#b7eb8f',
    warning: '#faad14',
    warningBg: '#fffbe6',
    warningBorder: '#ffe58f',
    error: '#ff4d4f',
    errorBg: '#fff2f0',
    errorBorder: '#ffccc7',
    info: '#1677ff',
    infoBg: '#e6f4ff',
    infoBorder: '#91caff',
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
    xl: 12,
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
    sm: 'sm',
    md: 'md',
    lg: 'lg',
  },
};

const DARK_TEXT = 'rgba(255, 255, 255, 0.85)';
const DARK_TEXT_SECONDARY = 'rgba(255, 255, 255, 0.65)';
const DARK_TEXT_TERTIARY = 'rgba(255, 255, 255, 0.45)';
const DARK_TEXT_DISABLED = 'rgba(255, 255, 255, 0.30)';

export const UI_DARK_THEME: UIThemeTokens = {
  ...UI_LIGHT_THEME,
  colors: {
    primary: '#1668dc',
    primaryHover: '#3c89e8',
    primaryActive: '#1554ad',
    primaryBg: '#111a2c',
    primaryBorder: '#15325b',
    primaryText: '#ffffff',
    background: '#000000',
    surface: '#141414',
    elevated: '#1f1f1f',
    border: '#424242',
    borderSecondary: '#303030',
    text: DARK_TEXT,
    textSecondary: DARK_TEXT_SECONDARY,
    textTertiary: DARK_TEXT_TERTIARY,
    textDisabled: DARK_TEXT_DISABLED,
    muted: DARK_TEXT_SECONDARY,
    disabled: 'rgba(255, 255, 255, 0.08)',
    disabledText: DARK_TEXT_DISABLED,
    success: '#49aa19',
    successBg: '#162312',
    successBorder: '#274916',
    warning: '#d89614',
    warningBg: '#2b2111',
    warningBorder: '#594214',
    error: '#dc4446',
    errorBg: '#2c1618',
    errorBorder: '#58181c',
    info: '#1668dc',
    infoBg: '#111a2c',
    infoBorder: '#15325b',
  },
};
