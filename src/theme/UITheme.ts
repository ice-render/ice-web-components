export type UIColor = string;

export type UIThemeTokens = {
  colors: {
    primary: UIColor;
    primaryHover: UIColor;
    primaryActive: UIColor;
    primaryText: UIColor;
    background: UIColor;
    surface: UIColor;
    border: UIColor;
    text: UIColor;
    muted: UIColor;
    disabled: UIColor;
    disabledText: UIColor;
  };
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
  radius: {
    sm: number;
    md: number;
    lg: number;
    pill: number;
  };
  font: {
    family: string;
    size: number;
    sizeSmall: number;
    sizeLarge: number;
    weightNormal: string;
    weightBold: string;
  };
};

export const UI_LIGHT_THEME: UIThemeTokens = {
  colors: {
    primary: '#2563eb',
    primaryHover: '#3b82f6',
    primaryActive: '#1d4ed8',
    primaryText: '#ffffff',
    background: '#f8fafc',
    surface: '#ffffff',
    border: '#cbd5e1',
    text: '#0f172a',
    muted: '#64748b',
    disabled: '#e2e8f0',
    disabledText: '#94a3b8',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  radius: {
    sm: 4,
    md: 8,
    lg: 12,
    pill: 999,
  },
  font: {
    family: 'Arial',
    size: 14,
    sizeSmall: 12,
    sizeLarge: 18,
    weightNormal: 'normal',
    weightBold: 'bold',
  },
};

export const UI_DARK_THEME: UIThemeTokens = {
  ...UI_LIGHT_THEME,
  colors: {
    ...UI_LIGHT_THEME.colors,
    primary: '#3b82f6',
    primaryHover: '#60a5fa',
    primaryActive: '#2563eb',
    primaryText: '#0f172a',
    background: '#0f172a',
    surface: '#1e293b',
    border: '#334155',
    text: '#e2e8f0',
    muted: '#94a3b8',
    disabled: '#1e293b',
    disabledText: '#64748b',
  },
};
