import { ICE_DARK_THEME, ICEThemeTokens } from './ICETheme';
import { ICETileMapPalette } from '../components/ICETileMap';

/**
 * 街机主题：给「掌机 / 游戏」这类深色场景用的一套 token。
 *
 * 为什么要有它：arcade 示例一开始把方块和蛇的颜色写死在页面里，结果是**面板文字跟着主题走、
 * 游戏美术不跟** —— 一个页面两套配色来源。现在游戏配色也收进 token：
 *
 * ```ts
 * iceUIManager.registerTheme('arcade', ICE_ARCADE_THEME).setTheme('arcade');
 * const board = new ICETileMap({ rows, cols, palette: ICE_ARCADE_PALETTE });
 * ```
 *
 * 它是**完整主题**（不是补丁）：token 组与内置 dark 完全一致，只换颜色，所以任何组件切过去
 * 都不会缺 token。
 */
export const ICE_ARCADE_THEME: ICEThemeTokens = {
  ...ICE_DARK_THEME,
  colors: {
    ...ICE_DARK_THEME.colors,
    // 机壳与屏幕：比 dark 主题更冷、更暗一点，像老式街机的塑料壳
    background: '#080a0f',
    surface: '#1b2130',
    elevated: '#232a36',
    border: '#39424f',
    borderSecondary: '#2b3340',
    // 文字保持 dark 的层级，只把三级的对比再压一点
    textTertiary: '#6b7480',
  },
};

/**
 * 游戏调色板：方块 7 种 + 蛇头 / 蛇身 / 食物。
 * 颜色取 Bootstrap 语义色，描边统一是填充色压暗 35%（和页面里 `shade(color, -0.35)` 一致）。
 */
export const ICE_ARCADE_PALETTE: ICETileMapPalette = {
  /** 空格：带一点点描边的暗格，棋盘才有网格感（不画的话整块就是一坨黑） */
  empty: { fillStyle: '#161d27', strokeStyle: '#232c3a', lineWidth: 1 },
  I: { fillStyle: '#0dcaf0', strokeStyle: '#097e96' },
  O: { fillStyle: '#ffc107', strokeStyle: '#a67c00' },
  T: { fillStyle: '#a370f7', strokeStyle: '#6a43a6' },
  S: { fillStyle: '#198754', strokeStyle: '#0f5634' },
  Z: { fillStyle: '#dc3545', strokeStyle: '#8f222d' },
  J: { fillStyle: '#0d6efd', strokeStyle: '#0847a4' },
  L: { fillStyle: '#fd7e14', strokeStyle: '#a4510d' },
  snakeHead: { fillStyle: '#20c997', strokeStyle: '#158363' },
  snakeBody: { fillStyle: '#198754', strokeStyle: '#0f5634' },
  snakeBodyAlt: { fillStyle: '#157347', strokeStyle: '#0d4a2e' },
  food: { fillStyle: '#dc3545', strokeStyle: '#8f222d', radius: 9 },
};
