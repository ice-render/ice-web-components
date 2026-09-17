/**
 * **自定义 token**：应用能不能往 token 表里加自己的颜色，并且吃满整套机制？
 *
 * 为什么要有这条：token 表是**契约**，直接加索引签名（`[k: string]: string`）会让 `colors.texxt`
 * 这类拼写错误也编译通过 —— 等于把类型检查关掉。所以走的是**声明合并**
 * （`interface ICECustomColorTokens`，见 `src/theme/ICETheme.ts`）：加得进去、也仍然报错拼写。
 *
 * 这条测运行时那一半：自定义 token 与内置 token 在**查表 / CSS 变量 / 主题作用域 / 热切换**
 * 四条路径上必须完全等价。
 */
import { token } from 'ice-render';
import { iceUIManager } from '../src/core/ICEManager';
import { themeScope } from '../src/core/ICEThemeBridge';
import { applyThemeToCss, themeCssVariables } from '../src/core/ICEThemeCss';
import { resolveColorValue } from '../src/util/ICEStyle';
import { ICE_LIGHT_THEME, ICE_DARK_THEME, type ICEThemeTokens } from '../src/theme/ICETheme';

/** 应用侧声明合并之后的样子（这里用类型断言模拟，运行期就是普通字段）。 */
const brandLight: ICEThemeTokens = {
  ...ICE_LIGHT_THEME,
  colors: { ...ICE_LIGHT_THEME.colors, 'brand-custom': '#123456' } as any,
};
const brandDark: ICEThemeTokens = {
  ...ICE_DARK_THEME,
  colors: { ...ICE_DARK_THEME.colors, 'brand-custom': '#654321' } as any,
};

describe('自定义 token（应用扩展）', () => {
  beforeEach(() => {
    iceUIManager.registerTheme('brand-light', brandLight);
    iceUIManager.registerTheme('brand-dark', brandDark);
  });
  afterEach(() => {
    iceUIManager.setTheme('light');
  });

  it('`token()` 按路径查得到自定义 token', () => {
    iceUIManager.setTheme('brand-light');
    expect(resolveColorValue(token('ui.colors.brand-custom'))).toBe('#123456');
  });

  it('热切换跟着走（自定义 token 与内置 token 同一条解析路径）', () => {
    iceUIManager.setTheme('brand-light');
    expect(resolveColorValue(token('ui.colors.brand-custom'))).toBe('#123456');
    iceUIManager.setTheme('brand-dark');
    expect(resolveColorValue(token('ui.colors.brand-custom'))).toBe('#654321');
  });

  it('`themeCssVariables()` 自动产出 `--ice-color-brand-custom`（不用改库）', () => {
    const vars = themeCssVariables(brandLight);
    expect(vars['--ice-color-brand-custom']).toBe('#123456');
    // 内置的照旧
    expect(vars['--ice-color-primary']).toBe(ICE_LIGHT_THEME.colors.primary);
  });

  it('`applyThemeToCss()` 会把自定义 token 写进根元素', () => {
    const root: any = { style: { setProperty: jest.fn() }, dataset: {} };
    const original = (globalThis as any).document;
    (globalThis as any).document = { documentElement: root };
    try {
      applyThemeToCss(undefined, brandLight);
      const written = root.style.setProperty.mock.calls.map((c: any[]) => c[0]);
      expect(written).toContain('--ice-color-brand-custom');
    } finally {
      (globalThis as any).document = original;
    }
  });

  it('主题作用域也认自定义 token（`themeScope(自己那套)`）', () => {
    iceUIManager.setTheme('light');
    const patch: any = themeScope(brandDark);
    expect(patch.semantic.ui.colors['brand-custom']).toBe('#654321');
  });
});
