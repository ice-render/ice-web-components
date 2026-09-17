import { iceUIManager } from './ICEManager';
import type { ICEThemeTokens } from '../theme/ICETheme';

/**
 * UI 主题 → 引擎主题 的桥。
 *
 * 背景：本库的组件取色一直是「构造时从 `iceUIManager.getTheme()` 读 token」，
 * 而**引擎自己画的那层**（选中框 / 变换手柄 / 连接插槽 / 对齐引导线 / 连线标签 / 文本选区 /
 * 阴影色 / 调试框）在引擎 2.4 之前是写死的色值 —— 于是换深色主题时会出现
 * 「面板是暗的、手柄还是亮红亮绿」。
 *
 * 引擎 2.4 把这些收成了主题里的 `chrome` token，并提供 `ice.setTheme()` / `ice.setChrome()`。
 * 这个桥只做一件事：**把本库的 token 映射成引擎主题补丁**，让两套主题只有一个事实来源。
 *
 * ```ts
 * import { iceUIManager, applyThemeToEngine } from 'ice-web-components';
 * iceUIManager.setTheme('dark');
 * applyThemeToEngine(ice);              // 把当前主题同步到引擎（外壳一起换）
 * iceUIManager.setTheme('light', ice);  // 或切主题时直接带上 ICE 实例
 * ```
 */

/** 把颜色压成半透明（`#rgb` / `#rrggbb` / `rgb()`；其它写法原样返回）。 */
function withAlpha(color: string, alpha: number): string {
  if (typeof color !== 'string') return color;
  const value = color.trim();
  if (value.charAt(0) === '#') {
    let hex = value.slice(1);
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    if (hex.length !== 6) return value;
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  if (value.indexOf('rgb(') === 0) return value.replace('rgb(', 'rgba(').replace(')', `,${alpha})`);
  return value;
}

/**
 * 把一套 UI token 映射成引擎主题补丁。
 *
 * 映射原则（都取「同一个语义」的 token，不新造颜色）：
 * - 语义色：primary / success / warning / danger / info / text / muted / hint / border / background；
 * - 外壳：选中框用 primaryBorder + primaryBg 半透明、手柄用 primary（描边用 primaryText）、
 *   插槽用 success（悬停高亮用 warning）、引导线用 focusRing、连线标签用 surface + text、
 *   文本选区用 focusRing 半透明、阴影色直接取 `shadows.*.shadowColor`。
 */
export function toEngineThemePatch(tokens: ICEThemeTokens): any {
  const c: any = (tokens && tokens.colors) || {};
  const shadows: any = (tokens && tokens.shadows) || {};
  const shadowColor = (key: 'sm' | 'md' | 'lg', fallback: string) =>
    (shadows[key] && shadows[key].shadowColor) || fallback;
  const primary = c.primary || '#0d6efd';
  const success = c.success || '#198754';
  const warning = c.warning || '#ffc107';
  const text = c.text || '#212529';
  const surface = c.surface || c.background || '#ffffff';

  return {
    primary,
    success,
    warning,
    danger: c.error || c.danger || '#dc3545',
    info: c.info || '#0dcaf0',
    text,
    muted: c.textSecondary || text,
    hint: c.textTertiary || c.textSecondary || text,
    border: c.border || '#dee2e6',
    background: surface,
    chrome: {
      selection: {
        stroke: c.primaryBorder || primary,
        fill: withAlpha(c.primaryBg || primary, 0.16),
      },
      handle: {
        fill: primary,
        stroke: c.primaryText || '#ffffff',
      },
      linkHook: {
        fill: success,
        stroke: c.primaryText || '#ffffff',
      },
      slot: {
        fill: success,
        stroke: c.primaryText || '#ffffff',
        hoverFill: warning,
      },
      guide: { color: c.focusRing || primary },
      linkLabel: { background: surface, fill: text },
      textSelection: { color: withAlpha(c.focusRing || primary, 0.35) },
      shadow: {
        sm: shadowColor('sm', 'rgba(0,0,0,0.075)'),
        md: shadowColor('md', 'rgba(0,0,0,0.15)'),
        lg: shadowColor('lg', 'rgba(0,0,0,0.175)'),
      },
      lineBorder: c.borderSecondary || c.border || '#e9ecef',
    },
    /**
     * **整份 UI token 树**也塞进引擎主题（落在 `semantic.ui`）。
     *
     * 为什么：引擎的样式支持**主题引用**（`token('…')`，paint 时解析，见引擎
     * `src/theme/ICETheme.ts` 的 ④）。把 UI token 树放进去之后，库里的组件就能写
     * `fillStyle: token('ui.colors.text')` —— 于是：
     *
     * - **热切换**：`ice.setTheme()` 标脏即可，不必重建组件（引擎外墙早就是这么做的）；
     * - **每个 ICE 实例各自的主题**：引用按**该实例**的主题解析，多实例/多品牌天然成立；
     * - 漏了 `applyThemeToEngine()` 也不会"取不到色" —— 见那边新增的自动登记。
     *
     * ⚠️ 这同时是"组件库与引擎之间唯一的取色通道"：组件不该再在构造期把颜色抄成字面量
     * （那正是热切换做不成的原因）。派生色（`mix` / `shade` / alpha）仍是构造期算的，
     * 要让它们也跟随，组件自己实现 `ICEWidget.onThemeChange()`。
     */
    ui: tokens,
  };
}

/**
 * 把当前（或指定）UI 主题应用到引擎实例：语义色 + 交互外壳一次性对齐。
 *
 * 幂等：重复调用只是再合并一次同样的补丁；`ice.setTheme` 会标脏，下一帧按新色重绘。
 */
export function applyThemeToEngine(ice: any, tokens?: ICEThemeTokens): any {
  if (!ice || typeof ice.setTheme !== 'function') {
    throw new Error('applyThemeToEngine(ice) 需要一个 ICE 实例');
  }
  const theme = tokens || iceUIManager.getTheme();
  ice.setTheme(toEngineThemePatch(theme));
  // 记下"这个实例上的 UI token 树是哪一版"：组件挂载时据此判断要不要补打（见 ICEManager.revision）
  ice.__uiThemeRevision = iceUIManager.themeRevision();
  /**
   * **登记这个实例**：之后 `iceUIManager.setTheme()` 会把所有登记过的实例一起换掉 ——
   * 应用不必自己维护"我有哪些画布"的清单，也不会再出现"漏打一个实例、那块还是旧色"。
   * （销毁的实例在下一次应用时按 `destroyed` 剪掉，不会积住。）
   */
  iceUIManager.trackEngine(ice);
  return ice;
}
