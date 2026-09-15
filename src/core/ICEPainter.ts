import type { ICEThemeTokens } from '../theme/ICETheme';

export interface ICEPaintContext {
  ctx: any;
  theme: ICEThemeTokens;
  component: any;
  /**
   * 组件本地坐标系的原点（= `component.state.localOrigin`，默认是**盒子中心**）。
   *
   * 想按「盒子左上角为 (0,0)」画，就把每个坐标减去它（引擎自绘的 `ICETileMap` 就是这个口径）。
   * 盒子范围因此是 `[-originX, -originY] ~ [width - originX, height - originY]`。
   */
  origin: [number, number];
}

export interface ICEPainter {
  install?(component: any): void;
  uninstall?(component: any): void;
  getPreferredSize?(component: any): [number, number];
  paint(context: ICEPaintContext): void;
}
