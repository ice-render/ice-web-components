import type { UIThemeTokens } from '../theme/UITheme';

export interface UIPaintContext {
  ctx: any;
  theme: UIThemeTokens;
  component: any;
}

export interface UIPainter {
  install?(component: any): void;
  uninstall?(component: any): void;
  getPreferredSize?(component: any): [number, number];
  paint(context: UIPaintContext): void;
}
