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

  /** 被 `applyThemeToEngine()` 登记过的引擎实例：`setTheme()` 时统一换主题（见 trackEngine）。 */
  private engines = new Set<any>();
  /** 主题变更订阅者（`ICEWidget.onThemeChange` 与宿主侧共用同一个广播）。 */
  private themeListeners = new Set<(change: { name: string; tokens: ICEThemeTokens }) => void>();
  /**
   * 主题**版本号**：每次切主题 / 注册主题 / 改密度都 +1。
   *
   * 用途：组件挂载时用它判断"我这个引擎上的 UI token 树是不是当前这一版"——
   * 不是才补一次补丁。没有它就得每次挂载都打一遍（gallery 里有 1757 个节点，
   * 每个都 deepMerge 一整棵 token 树会直接拖垮首帧）。
   */
  private revision = 0;

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
      // 静态 import：两边都是"函数内部才用对方"，模块循环是安全的；
      // 这里**不能用 require** —— UMD 产物在浏览器里没有 require，页面会直接报错（踩过）。
      /**
       * **广播**：把新主题应用到所有登记过的引擎实例上。
       *
       * 这是"热切换"落地的关键一步：组件样式里的**主题引用**（`token('ui.colors.text')`）
       * 是 paint 时解析的，所以只要引擎主题换了、再标脏，界面下一帧就是新色 —— 不用重建组件树。
       * 登记来自 `applyThemeToEngine()`（每个实例第一次被主题化时自动登记）。
       *
       * 传进来的 `ice` 先登记、再由这一次广播统一应用 —— 不单独打一遍，否则同一实例会被
       * 连打两次（既浪费，也会让"setTheme 调了几次引擎"这种断言变成 2）。
       */
      if (ice) this.trackEngine(ice);
      this.applyToTrackedEngines();
      this.notifyThemeChange(name);
      this.revision++;
    }
    return this;
  }

  /** 当前主题版本号（见 `revision` 的注释）。 */
  public themeRevision(): number {
    return this.revision;
  }

  /**
   * 登记一个引擎实例（`applyThemeToEngine()` 内部调用）。
   *
   * 为什么要登记：应用侧"漏打一个画布"是很难查的静默故障（那块永远是旧色），
   * 而 `setTheme()` 又只有应用自己知道"我有哪几块画布"。登记一次之后，切主题时
   * 库自己会把清单跑一遍。
   */
  public trackEngine(ice: any): this {
    if (ice && typeof ice.setTheme === 'function') this.engines.add(ice);
    return this;
  }

  /** 已登记的引擎数量（调试 / 测试用）。 */
  public trackedEngineCount(): number {
    return this.engines.size;
  }

  /** 把当前主题应用到所有登记过的实例；顺手剪掉已销毁的（不积住）。 */
  private applyToTrackedEngines(): void {
    for (const engine of [...this.engines]) {
      if (!engine || engine.destroyed) {
        this.engines.delete(engine);
        continue;
      }
      try {
        applyThemeToEngine(engine);
      } catch (err) {
        // 单个实例出问题不该拖垮整次切换（多实例场景下更明显）：摘掉它，继续处理其余的
        this.engines.delete(engine);
      }
    }
  }

  /**
   * 订阅主题变更（`setTheme` 应用完成后触发）。
   *
   * 用途分两类：
   * - **组件的派生色**：颜色是算出来的（`mix` / `shade` / alpha），引用式取色救不了它，
   *   在回调里重算自己的样式即可（`ICEWidget` 把它包装成 `onThemeChange()` 钩子）；
   * - **宿主侧**：DOM 那半（CSS 变量）、图表调色板、第三方控件，需要自己跟着换。
   *
   * 返回取消订阅的函数。
   */
  public onThemeChange(listener: (change: { name: string; tokens: ICEThemeTokens }) => void): () => void {
    if (typeof listener !== 'function') return () => undefined;
    this.themeListeners.add(listener);
    return () => {
      this.themeListeners.delete(listener);
    };
  }

  private notifyThemeChange(name: string): void {
    const change = { name, tokens: this.getTheme() };
    for (const listener of [...this.themeListeners]) {
      try {
        listener(change);
      } catch (err) {
        // 一个订阅者抛异常不该影响其它订阅者，也不该让 setTheme 半途而废
      }
    }
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
    return this.getThemeTokens(this.themeName);
  }

  /**
   * 按名字取一套主题 token（**不改当前主题**）。
   *
   * 用途：`themeScope('dark')` —— 给某个子树单独指定主题时，要拿到"那套"而不是"当前这套"。
   * 名字没注册过时回退到当前主题（比抛异常好用：URL 上写错一个词不该白屏）。
   *
   * 密度（紧凑模式）是**全局 UI 模式**，所以这里和 `getTheme()` 走同一套换算 ——
   * 否则紧密模式下嵌一块面板，那块面板的控件会比外面高一头。
   */
  public getThemeTokens(name?: string): ICEThemeTokens {
    const key = typeof name === 'string' && this.themes.has(name) ? name : this.themeName;
    const base = this.themes.get(key) || ICE_LIGHT_THEME;
    if (this.density === 'default') {
      return base;
    }
    const cacheKey = `${key}:${this.density}`;
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
