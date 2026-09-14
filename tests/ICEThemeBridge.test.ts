/**
 * UI 主题 → 引擎主题 的映射。
 *
 * 这条桥的意义：引擎自己画的那层（选中框 / 手柄 / 插槽 / 引导线 / 连线标签 / 阴影色）
 * 以前不跟主题走，深色主题下会出现「面板是暗的、手柄还是亮红亮绿」。
 */
import { toEngineThemePatch, applyThemeToEngine } from '../src/core/ICEThemeBridge';
import { iceUIManager } from '../src/core/ICEManager';
import { ICE_LIGHT_THEME, ICE_DARK_THEME, ICE_HIGH_CONTRAST_THEME, ICE_XP_THEME } from '../src/theme/ICETheme';

describe('toEngineThemePatch', () => {
  it('语义色直接取同名 token', () => {
    const patch = toEngineThemePatch(ICE_LIGHT_THEME);
    expect(patch.primary).toBe(ICE_LIGHT_THEME.colors.primary);
    expect(patch.success).toBe(ICE_LIGHT_THEME.colors.success);
    // 本库的语义色叫 error / danger 都认（引擎侧统一叫 danger）
    expect(patch.danger).toBe((ICE_LIGHT_THEME.colors as any).error || (ICE_LIGHT_THEME.colors as any).danger);
    expect(patch.text).toBe(ICE_LIGHT_THEME.colors.text);
    expect(patch.background).toBe(ICE_LIGHT_THEME.colors.surface);
    expect(patch.border).toBe(ICE_LIGHT_THEME.colors.border);
  });

  it('交互外壳按语义映射（选中框 / 手柄 / 插槽 / 引导线 / 标签 / 阴影）', () => {
    const patch = toEngineThemePatch(ICE_LIGHT_THEME);
    const chrome = patch.chrome;
    expect(chrome.selection.stroke).toBe(ICE_LIGHT_THEME.colors.primaryBorder);
    expect(chrome.handle.fill).toBe(ICE_LIGHT_THEME.colors.primary);
    expect(chrome.handle.stroke).toBe(ICE_LIGHT_THEME.colors.primaryText);
    expect(chrome.slot.fill).toBe(ICE_LIGHT_THEME.colors.success);
    expect(chrome.slot.hoverFill).toBe(ICE_LIGHT_THEME.colors.warning);
    expect(chrome.guide.color).toBe(ICE_LIGHT_THEME.colors.focusRing);
    expect(chrome.linkLabel.background).toBe(ICE_LIGHT_THEME.colors.surface);
    expect(chrome.linkLabel.fill).toBe(ICE_LIGHT_THEME.colors.text);
    expect(chrome.shadow.md).toBe(ICE_LIGHT_THEME.shadows.md.shadowColor);
  });

  it('换主题时外壳跟着换（深色 / 高对比 / 怀旧三套都给得出）', () => {
    const light = toEngineThemePatch(ICE_LIGHT_THEME);
    const dark = toEngineThemePatch(ICE_DARK_THEME);
    const contrast = toEngineThemePatch(ICE_HIGH_CONTRAST_THEME);
    const xp = toEngineThemePatch(ICE_XP_THEME);
    // 深色主题变的是表面 / 边框 / 焦点环（primary 仍是同一支蓝）
    expect(dark.background).not.toBe(light.background);
    expect(dark.chrome.linkLabel.background).toBe(ICE_DARK_THEME.colors.surface);
    expect(dark.chrome.guide.color).toBe(ICE_DARK_THEME.colors.focusRing);
    // 高对比主题的引导线 / 插槽 / 阴影都换成它自己的
    expect(contrast.chrome.guide.color).toBe(ICE_HIGH_CONTRAST_THEME.colors.focusRing);
    expect(contrast.chrome.shadow.md).not.toBe(light.chrome.shadow.md);
    expect(xp.chrome.selection.stroke).toBeTruthy();
    // 阴影色跟着主题（深色底上原来的纯黑阴影几乎看不见）
    expect(dark.chrome.shadow.sm).toBe(ICE_DARK_THEME.shadows.sm.shadowColor);
  });

  it('tokens 缺字段时有兜底，不会产出 undefined 颜色', () => {
    const patch: any = toEngineThemePatch({ colors: {}, shadows: {} } as any);
    expect(typeof patch.primary).toBe('string');
    expect(typeof patch.chrome.handle.fill).toBe('string');
    expect(typeof patch.chrome.shadow.sm).toBe('string');
  });
});

describe('applyThemeToEngine', () => {
  it('把补丁交给 ice.setTheme（语义色 + 外壳一次性对齐）', () => {
    const seen: any[] = [];
    const ice: any = { setTheme: (patch: any) => seen.push(patch) };
    applyThemeToEngine(ice, ICE_DARK_THEME);
    expect(seen).toHaveLength(1);
    expect(seen[0].primary).toBe(ICE_DARK_THEME.colors.primary);
    expect(seen[0].chrome.handle.fill).toBe(ICE_DARK_THEME.colors.primary);
  });

  it('不是 ICE 实例时明确报错', () => {
    expect(() => applyThemeToEngine(null)).toThrow(/ICE 实例/);
  });

  it('iceUIManager.setTheme(name, ice) 会顺带同步引擎（示例页用的就是这个写法）', () => {
    const seen: any[] = [];
    const ice: any = { setTheme: (patch: any) => seen.push(patch) };
    iceUIManager.registerTheme('probe-theme', ICE_HIGH_CONTRAST_THEME);
    iceUIManager.setTheme('probe-theme', ice);
    expect(iceUIManager.getThemeName()).toBe('probe-theme');
    expect(seen).toHaveLength(1);
    expect(seen[0].chrome.guide.color).toBe(ICE_HIGH_CONTRAST_THEME.colors.focusRing);

    // 不传 ice 时只改本库 token（保持既有行为）
    const before = seen.length;
    iceUIManager.setTheme('light');
    expect(seen.length).toBe(before);
  });
});
