import { ICE_DARK_THEME, ICE_LIGHT_THEME, ICEThemeTokens } from '../theme/ICETheme';

/** 内置 `light` / `dark`；也可以用 `registerTheme()` 注册自定义（例如 `xp`）。 */
export type ICEThemeName = string;

/**
 * 主题管理单例（`iceUIManager`）：持有当前 token 表，组件构造时从这里取主题。
 *
 * - 内置 `light` / `dark`；
 * - `registerTheme(name, tokens)` 注册自定义主题（例如库内置的 `ICE_XP_THEME`），
 *   然后 `setTheme('xp')` 切换；
 * - **主题在组件构造时读取一次**，要热切换就重建组件（见 docs/guides/theming.md）。
 */
export class ICEManager {
  private themeName: string = 'light';
  private themes = new Map<string, ICEThemeTokens>([
    ['light', ICE_LIGHT_THEME],
    ['dark', ICE_DARK_THEME],
  ]);

  public setTheme(name: ICEThemeName): this {
    // 未注册的名字直接忽略：保持「setTheme 不抛异常」的既有行为
    if (typeof name === 'string' && this.themes.has(name)) {
      this.themeName = name;
    }
    return this;
  }

  public getThemeName(): ICEThemeName {
    return this.themeName;
  }

  /** 注册（或覆盖）一套主题 token。 */
  public registerTheme(name: string, tokens: ICEThemeTokens): this {
    if (typeof name === 'string' && name && tokens) {
      this.themes.set(name, tokens);
    }
    return this;
  }

  public hasTheme(name: string): boolean {
    return this.themes.has(name);
  }

  /** 已注册的主题名（内置 + 自定义）。 */
  public getThemeNames(): string[] {
    return [...this.themes.keys()];
  }

  public getTheme(): ICEThemeTokens {
    return this.themes.get(this.themeName) || ICE_LIGHT_THEME;
  }
}

export const iceUIManager = new ICEManager();
