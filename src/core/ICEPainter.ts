import type { ICEThemeTokens } from '../theme/ICETheme';

export interface ICEPaintContext {
  ctx: any;
  theme: ICEThemeTokens;
  component: any;
}

export interface ICEPainter {
  install?(component: any): void;
  uninstall?(component: any): void;
  getPreferredSize?(component: any): [number, number];
  paint(context: ICEPaintContext): void;
}
