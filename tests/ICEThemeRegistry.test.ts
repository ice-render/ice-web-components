/**
 * 主题注册（`iceUIManager.registerTheme`）+ 内置 XP 主题。
 *
 * 背景：原来主题只有 light / dark 两个硬编码分支 —— 应用想做「Windows XP 桌面」
 * 这类固定配色的场景时，只能逐个组件传 style，很啰嗦。现在可以注册自定义 token 表：
 *
 *   iceUIManager.registerTheme('xp', ICE_XP_THEME).setTheme('xp');
 *
 * 注意：主题在**组件构造时**读取一次，所以要「先切主题、再建组件」。
 */
import { ICEButton } from '../src/components/ICEButton';
import { iceUIManager } from '../src/core/ICEManager';
import { ICE_LIGHT_THEME, ICE_XP_THEME } from '../src/theme/ICETheme';

describe('主题注册', () => {
  afterEach(() => {
    iceUIManager.setTheme('light');
  });

  it('内置 light / dark，可注册自定义主题名', () => {
    expect(iceUIManager.hasTheme('light')).toBe(true);
    expect(iceUIManager.hasTheme('dark')).toBe(true);
    iceUIManager.registerTheme('xp', ICE_XP_THEME);
    expect(iceUIManager.hasTheme('xp')).toBe(true);
    expect(iceUIManager.getThemeNames()).toEqual(expect.arrayContaining(['light', 'dark', 'xp']));
  });

  it('切换到自定义主题后 getTheme 返回该 token 表', () => {
    iceUIManager.registerTheme('xp', ICE_XP_THEME).setTheme('xp');
    expect(iceUIManager.getThemeName()).toBe('xp');
    expect(iceUIManager.getTheme()).toBe(ICE_XP_THEME);
    expect(iceUIManager.getTheme().colors.background).toBe('#ece9d8');
  });

  it('未注册的主题名被忽略（不抛异常，也不改变当前主题）', () => {
    iceUIManager.setTheme('light');
    iceUIManager.setTheme('nope');
    expect(iceUIManager.getThemeName()).toBe('light');
    expect(iceUIManager.getTheme()).toBe(ICE_LIGHT_THEME);
  });

  it('组件构造时读取当前主题（XP 主题下默认按钮用 XP 的选择蓝）', () => {
    iceUIManager.registerTheme('xp', ICE_XP_THEME).setTheme('xp');
    const xpButton = new ICEButton({ text: '确定', width: 80, height: 24 });
    iceUIManager.setTheme('light');
    const lightButton = new ICEButton({ text: '确定', width: 80, height: 24 });
    expect(xpButton.state.style.fillStyle).not.toBe(lightButton.state.style.fillStyle);
    expect(xpButton.state.style.fillStyle).toBe(ICE_XP_THEME.colors.primary);
    expect(lightButton.state.style.fillStyle).toBe(ICE_LIGHT_THEME.colors.primary);
  });
});
