/**
 * 主题对比度体检（WCAG 2.1）—— 把"token 到底能不能用"变成可断言的判据。
 *
 * 为什么需要它：`primary` 当文字压在暗底上只有 **2.96:1**、`textTertiary` 浅底 **2.07:1**，
 * 这两个都不是"看着有点淡"，而是实打实不达标 —— 但它们不会让任何测试变红，只有在真实
 * 应用里被眼睛发现（2026-09-17 在 smart-water 的深色主题里数出 49866 个 `#0d6efd` 像素
 * 才挖出来）。所以把判据写死在这里：**改 token 就会被这条拦住**。
 *
 * 口径（都按 WCAG 2.1 相对亮度）：
 * - **正文 / 次级 / 链接**：≥ 4.5:1（AA 正文）；
 * - **三级文字**：≥ 3.0:1 —— 它是"提示语 / 占位符"那一档，不承担正文，但也不该低到看不见；
 * - **强调文字 / subtle 底**（`*TextEmphasis` on `*Bg`）：≥ 4.5:1；
 * - **实底上的字**（`primaryText` on `primary`）：≥ 4.5:1；
 * - **聚焦环 / 选中框**（非文本 UI 部件）：≥ 3.0:1；
 * - `border` **不设阈值**：描边是装饰性的（Bootstrap 自己也一样），要测它得先定"边界必须可见"
 *   的产品口径。
 */
import {
  ICE_ARCADE_THEME,
  ICE_DARK_THEME,
  ICE_HIGH_CONTRAST_THEME,
  ICE_LIGHT_THEME,
  ICE_XP_THEME,
  type ICEThemeTokens,
} from '../src/index';

type RGB = [number, number, number];

/** `#rgb` / `#rrggbb` → RGB；其它写法（rgba / transparent）在这里不参与体检。 */
function parse(color: string): RGB | null {
  const value = String(color || '').trim();
  if (value.charAt(0) !== '#') return null;
  let hex = value.slice(1);
  if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  if (hex.length !== 6) return null;
  return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
}

/** WCAG 相对亮度。 */
function luminance(color: string): number | null {
  const rgb = parse(color);
  if (!rgb) return null;
  const [r, g, b] = rgb.map((value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** 两色的对比度（≥1）。 */
export function contrast(a: string, b: string): number | null {
  const [la, lb] = [luminance(a), luminance(b)];
  if (la === null || lb === null) return null;
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return Number(((hi + 0.05) / (lo + 0.05)).toFixed(2));
}

/** 承载文字的三种底。 */
const SURFACES: Array<[string, (t: ICEThemeTokens) => string]> = [
  ['surface', (t) => t.colors.surface],
  ['background', (t) => t.colors.background],
  ['elevated', (t) => t.colors.elevated],
];

/**
 * 参与体检的主题：**出厂的全套**（浅 / 深 / 高对比 / 街机 / XP）。
 *
 * XP 也一起测：它是仿真主题、调色板另有出处，但"链接压在米色页面底上看不清"这种事
 * 一样会犯 —— 实测它原来的链接蓝 `#316ac5` 在 `#ece9d8` 上只有 4.31，已调深到 `#2d61b5`。
 */
const THEMES: Array<[string, ICEThemeTokens]> = [
  ['light', ICE_LIGHT_THEME],
  ['dark', ICE_DARK_THEME],
  ['high-contrast', ICE_HIGH_CONTRAST_THEME],
  ['arcade', ICE_ARCADE_THEME],
  ['xp', ICE_XP_THEME],
];

describe('主题对比度体检（WCAG 2.1）', () => {
  describe.each(THEMES)('%s 主题', (_name, theme) => {
    it.each(SURFACES)('正文 / 次级 / 链接在 %s 上都过 AA（≥4.5）', (_label, pick) => {
      const surface = pick(theme);
      const bad: string[] = [];
      for (const token of ['text', 'textSecondary', 'link'] as const) {
        const ratio = contrast(theme.colors[token], surface);
        if (ratio === null || ratio < 4.5) bad.push(`${token} on ${surface} = ${ratio}`);
      }
      expect(bad).toEqual([]);
    });

    it.each(SURFACES)('三级文字在 %s 上至少有 3:1', (_label, pick) => {
      const surface = pick(theme);
      const ratio = contrast(theme.colors.textTertiary, surface);
      expect({ surface, ratio, ok: ratio !== null && ratio >= 3 }).toMatchObject({ ok: true });
    });

    it('强调文字压在各自的 subtle 底上过 AA（≥4.5）', () => {
      const pairs: Array<[string, string]> = [
        ['primaryTextEmphasis', 'primaryBg'],
        ['successTextEmphasis', 'successBg'],
        ['warningTextEmphasis', 'warningBg'],
        ['errorTextEmphasis', 'errorBg'],
        ['infoTextEmphasis', 'infoBg'],
      ];
      const bad = pairs
        .map(([text, bg]) => ({ pair: `${text} on ${bg}`, ratio: contrast((theme.colors as any)[text], (theme.colors as any)[bg]) }))
        .filter((row) => row.ratio === null || row.ratio < 4.5);
      expect(bad).toEqual([]);
    });

    it('主色底上的字过 AA（primaryText on primary）', () => {
      const ratio = contrast(theme.colors.primaryText, theme.colors.primary);
      expect({ ratio, ok: ratio !== null && ratio >= 4.5 }).toMatchObject({ ok: true });
    });

    it('聚焦环在三种底上都够看得见（非文本 UI 部件 ≥3）', () => {
      const bad = SURFACES.map(([label, pick]) => ({
        pair: `focusRing on ${label}`,
        ratio: contrast(theme.colors.focusRing, pick(theme)),
      })).filter((row) => row.ratio === null || row.ratio < 3);
      expect(bad).toEqual([]);
    });

    it('`link` 与 `primary` 都取到了值（分工不能糊成一个）', () => {
      expect(!!theme.colors.link && !!theme.colors.primary).toBe(true);
    });
  });

  it('主力两套（浅 / 深）里 `link` 与 `primary` 取值必须不同 —— 它们分工不同', () => {
    // 浅色：link 更深（#0a58ca vs #0d6efd）；暗色：link 更亮（#6ea8fe vs #0d6efd）。
    // 这条是防止有人为了"省事"把 link 指回 primary —— 那等于把 2.96:1 的坑重新埋回来。
    // 高对比主题不在此列：它靠同一支明黄同时当填充与文字（在黑底上本来就过 AA）。
    expect(ICE_LIGHT_THEME.colors.link).not.toBe(ICE_LIGHT_THEME.colors.primary);
    expect(ICE_DARK_THEME.colors.link).not.toBe(ICE_DARK_THEME.colors.primary);
  });

  it('两套主题都提供了体检用到的全部 token（漏一个就会被静默跳过）', () => {
    const required = [
      'primary',
      'primaryText',
      'primaryBg',
      'link',
      'background',
      'surface',
      'elevated',
      'text',
      'textSecondary',
      'textTertiary',
      'focusRing',
      'successBg',
      'warningBg',
      'errorBg',
      'infoBg',
      'primaryTextEmphasis',
      'successTextEmphasis',
      'warningTextEmphasis',
      'errorTextEmphasis',
      'infoTextEmphasis',
    ];
    for (const [name, theme] of THEMES) {
      const missing = required.filter((key) => !(theme.colors as any)[key]);
      expect({ theme: name, missing }).toMatchObject({ missing: [] });
    }
  });
});
