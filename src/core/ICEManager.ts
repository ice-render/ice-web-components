import { ICE_DARK_THEME, ICE_HIGH_CONTRAST_THEME, ICE_LIGHT_THEME, ICEThemeTokens } from '../theme/ICETheme';
import { applyThemeToEngine } from './ICEThemeBridge';

/** 内置 `light` / `dark`；也可以用 `registerTheme()` 注册自定义（例如 `xp`）。 */
export type ICEThemeName = string;

/** 密度：`default` 常规，`compact` 密集（表格/表单能多放几行）。 */
export type ICEDensity = 'default' | 'compact';

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
    ['high-contrast', ICE_HIGH_CONTRAST_THEME],
  ]);
  private density: ICEDensity = 'default';
  /** 密度派生的主题缓存：同一套主题 + 同一密度必须返回**同一个对象**（组件会比对引用） */
  private densityCache = new Map<string, ICEThemeTokens>();

  /**
   * 切换密度。
   *
   * 只改「控件高度与间距」这类尺寸 token，颜色与字体不动 —— 密集指的是排版，不是配色。
   * 与主题一样，**组件在构造时读一次**，要热切换请重建组件。
   */
  public setDensity(density: ICEDensity): this {
    this.density = density === 'compact' ? 'compact' : 'default';
    return this;
  }

  public getDensity(): ICEDensity {
    return this.density;
  }

  /**
   * 切换主题。
   *
   * 传了 `ice` 就顺带把主题同步到引擎（语义色 + 交互外壳 token）—— 引擎自己画的那层
   * （选中框 / 手柄 / 插槽 / 引导线 / 连线标签 / 阴影色）以前是写死的，换了主题不会跟着变，
   * 见 `ICEThemeBridge`。不传 `ice` 时只改本库 token（网页里后续新建的组件才会用新主题）。
   */
  public setTheme(name: ICEThemeName, ice?: any): this {
    // 未注册的名字直接忽略：保持「setTheme 不抛异常」的既有行为
    if (typeof name === 'string' && this.themes.has(name)) {
      this.themeName = name;
      if (ice) {
        // 静态 import：两边都是"函数内部才用对方"，模块循环是安全的；
        // 这里**不能用 require** —— UMD 产物在浏览器里没有 require，页面会直接报错（踩过）。
        applyThemeToEngine(ice);
      }
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
    const base = this.themes.get(this.themeName) || ICE_LIGHT_THEME;
    if (this.density === 'default') {
      return base;
    }
    const cacheKey = `${this.themeName}:${this.density}`;
    const cached = this.densityCache.get(cacheKey);
    if (cached) {
      return cached;
    }
    const compact = applyCompactDensity(base);
    this.densityCache.set(cacheKey, compact);
    return compact;
  }
}

/** 把常规主题压成密集主题：高度与间距 ×0.85（四舍五入到整像素），触控目标不低于 20。 */
function applyCompactDensity(base: ICEThemeTokens): ICEThemeTokens {
  const scale = (value: number) => Math.max(1, Math.round(value * 0.85));
  const spacing = Object.keys(base.spacing).reduce((out: any, key) => {
    out[key] = scale((base.spacing as any)[key]);
    return out;
  }, {});
  const control = Object.keys(base.control).reduce((out: any, key) => {
    const value = (base.control as any)[key];
    // 高度类不下 20（再小就不像控件了），其它数值按比例缩
    out[key] = key.startsWith('height') ? Math.max(20, scale(value)) : scale(value);
    return out;
  }, {});
  return { ...base, spacing, control } as ICEThemeTokens;
}

export const iceUIManager = new ICEManager();
