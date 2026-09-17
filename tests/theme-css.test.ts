/**
 * DOM 那半：token → CSS 变量的口径（`ICEThemeCss`）。
 *
 * 判据不是"函数没抛异常"，而是**写出来的变量与 token 表对得上** —— 这是"画布与 DOM 只有一份色表"
 * 这件事唯一能自动验的部分（DOM 实际长什么样得靠浏览器 QA）。
 */
import { applyThemeToCss, themeCssVariables } from '../src/core/ICEThemeCss';
import { ICE_DARK_THEME, ICE_LIGHT_THEME } from '../src/theme/ICETheme';

describe('主题 → CSS 变量', () => {
  it('颜色能"一份表两处用"：变量名由 token 名 kebab 化而来', () => {
    const vars = themeCssVariables(ICE_LIGHT_THEME);
    expect(vars['--ice-color-text']).toBe(ICE_LIGHT_THEME.colors.text);
    expect(vars['--ice-color-text-secondary']).toBe(ICE_LIGHT_THEME.colors.textSecondary);
    expect(vars['--ice-color-primary']).toBe(ICE_LIGHT_THEME.colors.primary);
    expect(vars['--ice-color-link']).toBe(ICE_LIGHT_THEME.colors.link);
    expect(vars['--ice-color-surface']).toBe(ICE_LIGHT_THEME.colors.surface);
  });

  it('切主题 => 同一批变量换值（DOM 那半因此不用各自抄色）', () => {
    const light = themeCssVariables(ICE_LIGHT_THEME);
    const dark = themeCssVariables(ICE_DARK_THEME);
    expect(dark['--ice-color-surface']).toBe(ICE_DARK_THEME.colors.surface);
    expect(dark['--ice-color-surface']).not.toBe(light['--ice-color-surface']);
    expect(dark['--ice-color-background']).not.toBe(light['--ice-color-background']);
    // 键集合一致 —— 否则"换主题"会漏掉一批变量，DOM 就会出现半新半旧
    expect(Object.keys(dark).sort()).toEqual(Object.keys(light).sort());
  });

  it('数值加单位、字重不加（CSS 直接用得上，不需要调用方再拼 px）', () => {
    const vars = themeCssVariables(ICE_LIGHT_THEME);
    expect(vars['--ice-space-md']).toBe(`${ICE_LIGHT_THEME.spacing.md}px`);
    expect(vars['--ice-radius-md']).toBe(`${ICE_LIGHT_THEME.radius.md}px`);
    expect(vars['--ice-font-size']).toBe(`${ICE_LIGHT_THEME.font.size}px`);
    expect(vars['--ice-font-weight-semibold']).toBe(ICE_LIGHT_THEME.font.weightSemibold);
    expect(vars['--ice-font-weight-semibold']).not.toMatch(/px$/);
  });

  it('阴影拍成可直接用的 box-shadow 值（对象 → 一个字符串）', () => {
    const vars = themeCssVariables(ICE_LIGHT_THEME);
    expect(vars['--ice-shadow-md']).toMatch(/^-?\d+px -?\d+px \d+px rgba?\(/);
  });

  it('applyThemeToCss 会写进根元素并打上 data-ice-theme', () => {
    const root: any = {
      style: { set: new Map(), setProperty(name: string, value: string) { this.set.set(name, value); } },
      dataset: {},
    };
    const vars = applyThemeToCss(root, ICE_DARK_THEME);
    expect(root.style.set.get('--ice-color-surface')).toBe(ICE_DARK_THEME.colors.surface);
    expect(root.style.set.size).toBe(Object.keys(vars).length);
    expect(root.dataset.iceTheme).toBe('custom');
  });
});
