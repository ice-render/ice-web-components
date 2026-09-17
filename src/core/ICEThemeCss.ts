/**
 * 主题 → **CSS 变量**（DOM 那一半）。
 *
 * ## 为什么要有它
 *
 * "every pixel drawn by the engine"是理想，但对话面板、启动遮罩这类 DOM 免不了
 * （要能选中复制、走输入法、被屏幕阅读器读）。于是颜色有两个出口：画布里的组件读
 * `iceUIManager.getTheme()`，DOM 里的样式读 CSS —— 两处各抄一套色值必然漂。
 *
 * 这个函数把**同一张 token 表**原样写成 CSS 变量，DOM 样式只引用 `var(--ice-…)`：
 * 换主题只改一处，两半一起变。`ice-agent-console` / `ice-smart-water` 之前各自手写了一份
 * （变量名还不一样），现在收到库里。
 *
 * ```ts
 * import { applyThemeToCss, iceUIManager } from 'ice-web-components';
 *
 * applyThemeToCss(document.documentElement);                                    // 开页一次
 * iceUIManager.onThemeChange(() => applyThemeToCss(document.documentElement));  // 热切换跟随
 * ```
 *
 * ## 命名与"不搞别名"
 *
 * 变量名 = `--ice-<组>-<kebab 化的 token 名>`（`--ice-color-text`、`--ice-space-md`、
 * `--ice-shadow-md`…）。**故意不做 `--bg` / `--panel` 这种短别名** —— 别名是第二套命名，
 * 改 token 就得记得改别名映射，正是要消灭的那种漂移。要短就自己在样式表里
 * `--bg: var(--ice-color-background);` 定义一次。
 *
 * 另外给根元素打一个 `data-ice-theme="light|dark"`：需要按主题整体切换**结构**（而不只是色值）
 * 的样式可以据此写选择器。
 */
import { iceUIManager } from './ICEManager';
import type { ICEThemeTokens } from '../theme/ICETheme';

/** token 名 → kebab-case（`textSecondary` → `text-secondary`）。 */
const kebab = (name: string): string => name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

/** 引擎的阴影 token 是 `{shadowColor, shadowBlur, shadowOffsetX, shadowOffsetY}`，转成 CSS 的 box-shadow 值。 */
const shadowValue = (shadow: any): string | null => {
  if (!shadow || !shadow.shadowColor) return null;
  const ox = Number(shadow.shadowOffsetX) || 0;
  const oy = Number(shadow.shadowOffsetY) || 0;
  const blur = Number(shadow.shadowBlur) || 0;
  return `${ox}px ${oy}px ${blur}px ${shadow.shadowColor}`;
};

/**
 * 把一套 token 拍平成 CSS 变量表（纯函数，便于单测与"和 token 表对账"）。
 *
 * 数值类 token（spacing / radius / control / 字号）加 `px` 单位；字重与字体族这类字符串原样写。
 * **只导出标量与阴影**：嵌套结构（渐变色数组、对象）跳过。
 */
export function themeCssVariables(tokens: ICEThemeTokens): Record<string, string> {
  const out: Record<string, string> = {};
  const put = (name: string, value: unknown): void => {
    if (value === undefined || value === null) return;
    if (typeof value === 'number') out[name] = `${value}px`;
    else if (typeof value === 'string') out[name] = value;
  };
  const putScalars = (group: string, source: any, unitless: string[] = []): void => {
    if (!source) return;
    for (const [key, value] of Object.entries(source)) {
      const name = `--ice-${kebab(group)}-${kebab(key)}`;
      if (typeof value === 'number' && unitless.indexOf(key) >= 0) out[name] = String(value);
      else put(name, value);
    }
  };

  for (const [key, value] of Object.entries(tokens.colors || {})) {
    if (typeof value === 'string') out[`--ice-color-${kebab(key)}`] = value;
  }
  putScalars('space', tokens.spacing);
  putScalars('radius', tokens.radius);
  putScalars('control', tokens.control);
  // 字号是数字 → 自动带 px（CSS 里 `font-size: var(…)` 必须有单位）；
  // 字重是 "600" / "normal" 这类字符串 → 原样写，不会带上单位
  putScalars('font', tokens.font);
  for (const [key, value] of Object.entries(tokens.shadows || {})) {
    const css = shadowValue(value);
    if (css) out[`--ice-shadow-${kebab(key)}`] = css;
  }
  if (tokens.window) {
    for (const [key, value] of Object.entries(tokens.window)) {
      if (typeof value === 'string') out[`--ice-window-${kebab(key)}`] = value;
    }
  }
  return out;
}

/**
 * 把当前（或指定）主题写成 CSS 变量，并给根元素打上 `data-ice-theme`。
 *
 * 返回写进去的变量表 —— 单测 / 调试可以据此对账，不必去读计算样式。
 */
export function applyThemeToCss(
  root?: HTMLElement | null,
  tokens?: ICEThemeTokens
): Record<string, string> {
  const target: any = root || (typeof document !== 'undefined' ? document.documentElement : null);
  const theme = tokens || iceUIManager.getTheme();
  const variables = themeCssVariables(theme);
  if (!target || !target.style) return variables;

  for (const [name, value] of Object.entries(variables)) {
    target.style.setProperty(name, value);
  }
  if (target.dataset) {
    target.dataset.iceTheme = tokens ? 'custom' : iceUIManager.getThemeName();
  }
  return variables;
}
