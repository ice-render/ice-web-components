/**
 * 街机主题（`ICE_ARCADE_THEME` + `ICE_ARCADE_PALETTE`）。
 *
 * 背景：arcade 示例一开始把方块/蛇的配色写死在页面里（`PIECE_COLORS = {...}`），
 * 结果是「面板文字跟着主题走、游戏美术不跟」，一套页面两套配色来源。现在把游戏配色也
 * 收进 token：注册 `arcade` 主题后，`ICETileMap` 的调色板直接从 token 取。
 *
 * 规格：
 * - `ICE_ARCADE_THEME` 是**完整的**主题（token 组和内置 dark 一致，只换颜色）；
 * - 可以 `registerTheme('arcade', …).setTheme('arcade')`，`getTheme()` 拿到的就是它；
 * - `ICE_ARCADE_PALETTE` 覆盖 7 种方块 + 蛇头/蛇身/食物，每项都是合法的绘图样式。
 */
import { iceUIManager } from '../src/core/ICEManager';
import { ICE_ARCADE_PALETTE, ICE_ARCADE_THEME } from '../src/theme/ICEArcadeTheme';
import { ICE_DARK_THEME } from '../src/theme/ICETheme';

describe('ICE_ARCADE_THEME', () => {
  afterEach(() => {
    iceUIManager.setTheme('light');
  });

  it('token 组与内置 dark 主题一致（是完整主题，不是补丁）', () => {
    expect(Object.keys(ICE_ARCADE_THEME).sort()).toEqual(Object.keys(ICE_DARK_THEME).sort());
    expect(Object.keys(ICE_ARCADE_THEME.colors).sort()).toEqual(Object.keys(ICE_DARK_THEME.colors).sort());
    expect(Object.keys(ICE_ARCADE_THEME.control).sort()).toEqual(Object.keys(ICE_DARK_THEME.control).sort());
  });

  it('注册并切换后 getTheme 返回它', () => {
    iceUIManager.registerTheme('arcade', ICE_ARCADE_THEME).setTheme('arcade');
    expect(iceUIManager.getThemeName()).toBe('arcade');
    expect(iceUIManager.getTheme()).toBe(ICE_ARCADE_THEME);
  });

  it('配色确实与 dark 不同（否则等于白做一套主题）', () => {
    expect(ICE_ARCADE_THEME.colors.surface).not.toBe(ICE_DARK_THEME.colors.surface);
    expect(ICE_ARCADE_THEME.colors.background).not.toBe(ICE_DARK_THEME.colors.background);
  });
});

describe('ICE_ARCADE_PALETTE', () => {
  it('覆盖空格 + 7 种方块 + 蛇头 / 蛇身 / 食物', () => {
    ['empty', 'I', 'O', 'T', 'S', 'Z', 'J', 'L', 'snakeHead', 'snakeBody', 'snakeBodyAlt', 'food'].forEach((key) => {
      expect(ICE_ARCADE_PALETTE[key]).toBeTruthy();
    });
  });

  it('每一项都是合法的绘图样式（有填充色，描边色可选但必须是字符串）', () => {
    Object.keys(ICE_ARCADE_PALETTE).forEach((key) => {
      const style = ICE_ARCADE_PALETTE[key];
      expect(typeof style.fillStyle).toBe('string');
      expect(style.fillStyle.length).toBeGreaterThan(0);
      if (style.strokeStyle !== undefined) {
        expect(typeof style.strokeStyle).toBe('string');
        expect(String(style.strokeStyle).length).toBeGreaterThan(0);
      }
    });
  });
});
