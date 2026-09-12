import { ICE_DARK_THEME, ICE_LIGHT_THEME, ICEThemeTokens } from '../theme/ICETheme';

export type ICEThemeName = 'light' | 'dark';

export class ICEManager {
  private themeName: ICEThemeName = 'light';

  public setTheme(name: ICEThemeName): this {
    this.themeName = name;
    return this;
  }

  public getThemeName(): ICEThemeName {
    return this.themeName;
  }

  public getTheme(): ICEThemeTokens {
    return this.themeName === 'dark' ? ICE_DARK_THEME : ICE_LIGHT_THEME;
  }
}

export const iceUIManager = new ICEManager();
