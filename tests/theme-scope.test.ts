/**
 * `themeScope()` —— 局部主题作用域的补丁形状。
 *
 * 机制在引擎（`props.theme` + `themeOf()` 沿祖先链合并）；这个单测只管**库这层产出的补丁对不对**：
 * 三样东西缺一样都会"半生效"（引用色跟随、派生色/painter 不跟随），真机判据在
 * `e2e/theme-scope.spec.ts`。
 */
import { themeScope } from '../src/core/ICEThemeBridge';
import { iceUIManager } from '../src/core/ICEManager';
import { ICE_DARK_THEME, ICE_LIGHT_THEME, ICE_XP_THEME } from '../src/theme/ICETheme';

describe('themeScope', () => {
  it('按名字取"那套"主题，而不是当前这套', () => {
    iceUIManager.setTheme('light');
    const patch: any = themeScope('dark');
    expect(patch.semantic.ui.colors.surface).toBe(ICE_DARK_THEME.colors.surface);
    expect(patch.semantic.ui.colors.surface).not.toBe(ICE_LIGHT_THEME.colors.surface);
    // 取完作用域不改当前主题 —— 否则"给面板换肤"会顺手把整页换掉
    expect(iceUIManager.getThemeName()).toBe('light');
  });

  it('补丁两件套齐全：整份 ui token 树（含圆角/字体/控件尺寸）+ 引擎外壳', () => {
    const patch: any = themeScope('dark');
    // ① 本库所有 `token('ui.colors.x')` 的查表目标
    expect(patch.semantic.ui).toBeTruthy();
    //    库内 `ICEWidget.theme()` 读到的也是这一份 → 圆角/字体/控件尺寸跟着作用域走
    expect(patch.semantic.ui.radius.md).toBe(ICE_DARK_THEME.radius.md);
    expect(patch.semantic.ui.font.family).toBe(ICE_DARK_THEME.font.family);
    expect(patch.semantic.ui.control.height).toBe(ICE_DARK_THEME.control.height);
    // ② 引擎自己画的那层（选中框 / 手柄 / 引导线 / 阴影）
    expect(patch.chrome).toBeTruthy();
    expect(patch.chrome.guide.color).toBe(ICE_DARK_THEME.colors.focusRing);
    expect(patch.chrome.shadow.md).toBe(ICE_DARK_THEME.shadows.md.shadowColor);
    expect(patch.shadow).toBeUndefined(); // 阴影走 chrome.shadow，别在顶层再造一份
  });

  it('也能直接吃一套 token（自定义主题 / 临时微调）', () => {
    const patch: any = themeScope(ICE_XP_THEME);
    expect(patch.semantic.ui.colors.primary).toBe(ICE_XP_THEME.colors.primary);
  });

  it('名字没注册过时回退当前主题，不抛异常（URL 上写错一个词不该白屏）', () => {
    iceUIManager.setTheme('light');
    const patch: any = themeScope('nope-not-registered');
    expect(patch.semantic.ui.colors.surface).toBe(ICE_LIGHT_THEME.colors.surface);
  });

  it('getThemeTokens(name) 与当前主题解耦（作用域要的正是这一点）', () => {
    iceUIManager.setTheme('light');
    expect(iceUIManager.getThemeTokens('dark').colors.surface).toBe(ICE_DARK_THEME.colors.surface);
    expect(iceUIManager.getTheme()).toBe(iceUIManager.getThemeTokens());
    expect(iceUIManager.getThemeName()).toBe('light');
  });
});
