import { ICE_DARK_THEME, ICE_LIGHT_THEME, ICEThemeTokens } from '../theme/ICETheme';

export type ICEThemeName = 'light' | 'dark';

/**
 * 主题管理单例（`iceUIManager`）：持有当前 token 表，组件构造时从这里取主题。
 */
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
