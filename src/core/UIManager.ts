import { UI_DARK_THEME, UI_LIGHT_THEME, UIThemeTokens } from '../theme/UITheme';

export type UIThemeName = 'light' | 'dark';

export class UIManager {
  private themeName: UIThemeName = 'light';

  public setTheme(name: UIThemeName): this {
    this.themeName = name;
    return this;
  }

  public getThemeName(): UIThemeName {
    return this.themeName;
  }

  public getTheme(): UIThemeTokens {
    return this.themeName === 'dark' ? UI_DARK_THEME : UI_LIGHT_THEME;
  }
}

export const uiManager = new UIManager();
