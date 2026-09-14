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
  /**
   * 拟物窗口（`ICEWindow`）的默认外观。
   *
   * 以前这套配色**写死在组件里**（注释还写着"与组件库主题无关"），于是换主题时窗口是唯一不跟着变的东西。
   * 现在归主题：默认取这里的值，`props.appearance` 仍然可以逐项覆盖。
   * 怀旧主题（XP / arcade）在这里放它们自己的窗口外观，所以那些页面的观感不变。
   */
  window: {
    /** 激活态标题栏渐变（两段色）。 */
    titleActive: [ICEColor, ICEColor];
    /** 非激活态标题栏渐变。 */
    titleInactive: [ICEColor, ICEColor];
    titleText: ICEColor;
    titleTextInactive: ICEColor;
    /** 客户端区域底色。 */
    body: ICEColor;
    /** 窗口外框。 */
    border: ICEColor;
    /** 标题栏上的按钮底（常态 / 悬停）与字形色。 */
    captionFace: ICEColor;
    captionFaceHover: ICEColor;
    captionGlyph: ICEColor;
  };
};

/**
 * 配色取 **Bootstrap 5** 的语义色板：
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
  // 拟物窗口：浅色主题下用"白体 + 主色标题栏"，与卡片/面板同一套语义色
  window: {
    titleActive: ['#0d6efd', '#3d8bfd'],
    titleInactive: ['#adb5bd', '#ced4da'],
    titleText: '#ffffff',
    titleTextInactive: '#f8f9fa',
    body: '#ffffff',
    border: '#0d6efd',
    captionFace: 'rgba(255,255,255,0.45)',
    captionFaceHover: 'rgba(255,255,255,0.85)',
    captionGlyph: '#0d6efd',
  },
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
  // 拟物窗口：深色主题下标题栏用暗蓝、窗体用 elevated 面，别再是亮黄的 XP 脸
  window: {
    titleActive: ['#0a58ca', '#3d8bfd'],
    titleInactive: ['#343a40', '#495057'],
    titleText: '#ffffff',
    titleTextInactive: '#adb5bd',
    body: '#343a40',
    border: '#495057',
    captionFace: 'rgba(255,255,255,0.18)',
    captionFaceHover: 'rgba(255,255,255,0.32)',
    captionGlyph: '#e9ecef',
  },
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

/**
 * Windows XP 经典主题（Luna 蓝 + 米灰控件）。
 *
 * 用途：桌面 / 怀旧风格的应用。用 `iceUIManager.registerTheme('xp', ICE_XP_THEME).setTheme('xp')`
 * 切换（主题在组件构造时读取，先切主题再建组件）。
 *
 * 取色要点：
 * - 主色取 XP 选择蓝 `#316ac5`，控件面 `#ece9d8`（经典米灰），输入框白底 + `#7f9db9` 边框；
 * - 圆角压到 2~3px、控件更矮更紧凑（XP 的按钮比 Bootstrap 小一圈）；
 * - 阴影几乎不用（XP 是描边风格，不是投影风格）。
 */
export const ICE_XP_THEME: ICEThemeTokens = {
  // 怀旧主题的窗口外观 = 原来的 Windows XP Luna 配色（从组件里搬过来的，观感不变）
  window: {
    titleActive: ['#0058ee', '#3f8cf3'],
    titleInactive: ['#7f9db9', '#a8c0dd'],
    titleText: '#ffffff',
    titleTextInactive: '#e9eef5',
    body: '#ece9d8',
    border: '#0054e3',
    captionFace: 'rgba(255,255,255,0.45)',
    captionFaceHover: 'rgba(255,255,255,0.85)',
    captionGlyph: '#0a246a',
  },
  colors: {
    primary: '#316ac5',
    primaryHover: '#4a86e8',
    primaryActive: '#24529a',
    primaryBg: '#d6e5fb',
    primaryBorder: '#7f9db9',
    primaryText: '#ffffff',
    background: '#ece9d8',
    surface: '#ffffff',
    elevated: '#ffffff',
    border: '#7f9db9',
    borderSecondary: '#d4d0c8',
    text: '#000000',
    textSecondary: '#4a4a4a',
    textTertiary: '#6d6d6d',
    textDisabled: '#9a9a9a',
    muted: '#6d6d6d',
    disabled: '#d4d0c8',
    disabledText: '#9a9a9a',
    success: '#1c7c31',
    successBg: '#dff0d8',
    successBorder: '#a6c99a',
    warning: '#b8860b',
    warningBg: '#fdf3d8',
    warningBorder: '#e0c37a',
    error: '#c1272d',
    errorBg: '#f8d7da',
    errorBorder: '#d9a0a3',
    info: '#0a5cd8',
    infoBg: '#d6e5fb',
    infoBorder: '#9db4d0',
    primaryTextEmphasis: '#1b3f75',
    successTextEmphasis: '#0f4a1e',
    warningTextEmphasis: '#6b4e05',
    errorTextEmphasis: '#7a191d',
    infoTextEmphasis: '#0a3b8c',
    focusRing: '#316ac5',
  },
  spacing: {
    xxs: 4,
    xs: 6,
    sm: 10,
    md: 14,
    lg: 20,
    xl: 28,
    xxl: 40,
  },
  radius: {
    xs: 2,
    sm: 2,
    md: 3,
    lg: 4,
    xl: 6,
    pill: 999,
  },
  font: {
    family: 'Tahoma, "Microsoft YaHei", "Segoe UI", Verdana, sans-serif',
    size: 12,
    sizeSmall: 11,
    sizeLarge: 13,
    weightNormal: 'normal',
    weightMedium: '500',
    weightSemibold: '600',
    weightBold: 'bold',
  },
  control: {
    heightSmall: 20,
    height: 24,
    heightLarge: 28,
    paddingXXS: 3,
    paddingXS: 6,
    paddingSmall: 8,
    padding: 12,
    paddingLarge: 18,
    lineWidth: 1,
    lineWidthFocused: 2,
    switchWidth: 40,
    switchHeight: 20,
    switchHandle: 16,
    checkboxSize: 14,
    radioSize: 14,
    progressHeight: 14,
    sliderTrackHeight: 4,
    sliderHandle: 12,
  },
  shadows: {
    // XP 基本不用投影：给一个极轻的，避免模态/浮层完全贴在一起
    sm: { shadowColor: 'rgba(0, 0, 0, 0.10)', shadowBlur: 4, shadowOffsetX: 0, shadowOffsetY: 1 },
    md: { shadowColor: 'rgba(0, 0, 0, 0.18)', shadowBlur: 10, shadowOffsetX: 0, shadowOffsetY: 3 },
    lg: { shadowColor: 'rgba(0, 0, 0, 0.25)', shadowBlur: 20, shadowOffsetX: 0, shadowOffsetY: 6 },
  },
};

/**
 * 高对比度主题（`high-contrast`）。
 *
 * 给「屏幕反光 / 视力不好 / 投影仪」这些场景：纯黑底 + 纯白正文，
 * 语义色一律换成暗底上也够亮的版本，描边从浅灰提到中灰 —— 不然边界在暗底上根本看不见。
 * 正文对底色 21:1、次要文字 ~15:1（WCAG AAA 是 7:1），主色对底色也在 10:1 以上。
 */
export const ICE_HIGH_CONTRAST_THEME: ICEThemeTokens = {
  ...ICE_LIGHT_THEME,
  // 高对比：窗体外黑内黑、标题栏亮黄，边框白（对比度优先）
  window: {
    titleActive: ['#000000', '#101010'],
    titleInactive: ['#101010', '#181818'],
    titleText: '#ffd54f',
    titleTextInactive: '#ffffff',
    body: '#101010',
    border: '#ffffff',
    captionFace: 'rgba(255,255,255,0.2)',
    captionFaceHover: 'rgba(255,255,255,0.4)',
    captionGlyph: '#ffd54f',
  },
  colors: {
    primary: '#ffd54f',
    primaryHover: '#ffe082',
    primaryActive: '#ffca28',
    primaryBg: '#3a2f00',
    primaryBorder: '#ffd54f',
    primaryText: '#000000',
    background: '#000000',
    surface: '#101010',
    elevated: '#1a1a1a',
    border: '#8a8a8a',
    borderSecondary: '#5c5c5c',
    text: '#ffffff',
    textSecondary: '#e8e8e8',
    textTertiary: '#c8c8c8',
    textDisabled: '#8a8a8a',
    muted: '#e8e8e8',
    disabled: '#2a2a2a',
    disabledText: '#9a9a9a',
    success: '#69db7c',
    successBg: '#0f2a17',
    successBorder: '#69db7c',
    warning: '#ffd43b',
    warningBg: '#2f2a00',
    warningBorder: '#ffd43b',
    error: '#ff8787',
    errorBg: '#2f0f0f',
    errorBorder: '#ff8787',
    info: '#74c0fc',
    infoBg: '#0b2436',
    infoBorder: '#74c0fc',
    primaryTextEmphasis: '#ffe082',
    successTextEmphasis: '#8ce99a',
    warningTextEmphasis: '#ffe066',
    errorTextEmphasis: '#ffa8a8',
    infoTextEmphasis: '#a5d8ff',
    focusRing: '#ffd54f',
  },
  shadows: {
    sm: { shadowColor: 'rgba(0, 0, 0, 0.85)', shadowBlur: 4, shadowOffsetX: 0, shadowOffsetY: 1 },
    md: { shadowColor: 'rgba(0, 0, 0, 0.9)', shadowBlur: 10, shadowOffsetX: 0, shadowOffsetY: 3 },
    lg: { shadowColor: 'rgba(0, 0, 0, 0.95)', shadowBlur: 20, shadowOffsetX: 0, shadowOffsetY: 6 },
  },
};
