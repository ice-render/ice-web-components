/**
 * 主题完整性门禁。
 *
 * 换主题是这套库的卖点之一（内置浅色 / 暗色 / 桌面 / 街机四套）。但「能换」的前提是每套主题
 * 都得是**完整**的：少一个 token，组件就会掉回硬编码兜底色，于是出现「面板跟着主题走、
 * 面板里的字不跟」这种半截效果。
 *
 * 三条判据：token 对齐（多一个少一个都报）、对比度分档（正文 / 次要 / 交互元素各有下限）、
 * 硬编码颜色不许增长（组件应从 token 取色）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { ICE_LIGHT_THEME, ICE_DARK_THEME, ICE_XP_THEME } from '../src/theme/ICETheme';
import { ICE_ARCADE_THEME } from '../src/theme/ICEArcadeTheme';

type RGB = [number, number, number];

const parseColor = (color: unknown): RGB | null => {
  if (typeof color !== 'string') return null;
  const match = color.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) return null;
  const hex = match[1].length === 3 ? match[1].split('').map((c) => c + c).join('') : match[1];
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)) as RGB;
};

/** WCAG 相对亮度与对比度。 */
const luminance = ([r, g, b]: RGB): number => {
  const channel = (value: number) => {
    const v = value / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};
const contrast = (a: RGB, b: RGB): number => {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
};
const ratioOf = (theme: any, fg: string, bg: string) => {
  const a = parseColor(theme.colors[fg]);
  const b = parseColor(theme.colors[bg]);
  return a && b ? contrast(a, b) : 0;
};

const THEMES: Array<[string, any]> = [
  ['light', ICE_LIGHT_THEME],
  ['dark', ICE_DARK_THEME],
  ['xp', ICE_XP_THEME],
  ['arcade', ICE_ARCADE_THEME],
];

describe('主题完整性', () => {
  it('每套主题的 color token 与基准主题完全对齐', () => {
    const reference = Object.keys(ICE_LIGHT_THEME.colors).sort();
    THEMES.forEach(([name, theme]) => {
      const keys = Object.keys(theme.colors).sort();
      expect({ theme: name, missing: reference.filter((key) => !keys.includes(key)) }).toEqual({ theme: name, missing: [] });
      expect({ theme: name, extra: keys.filter((key) => !reference.includes(key)) }).toEqual({ theme: name, extra: [] });
    });
  });

  it('所有颜色值都能解析（不接受空值 / 拼错的十六进制）', () => {
    THEMES.forEach(([name, theme]) => {
      Object.entries(theme.colors).forEach(([key, value]) => {
        expect({ theme: name, key, ok: parseColor(value) !== null }).toEqual({ theme: name, key, ok: true });
      });
    });
  });

  it('正文 ≥ 7:1、次要文字 ≥ 4.5:1（对背景与卡片底色都要够）', () => {
    THEMES.forEach(([name, theme]) => {
      expect({ theme: name, onSurface: ratioOf(theme, 'text', 'surface') >= 7 }).toEqual({ theme: name, onSurface: true });
      expect({ theme: name, onBackground: ratioOf(theme, 'text', 'background') >= 7 }).toEqual({ theme: name, onBackground: true });
      expect({ theme: name, secondary: ratioOf(theme, 'textSecondary', 'surface') >= 4.5 }).toEqual({ theme: name, secondary: true });
    });
  });

  it('交互元素（主色对底色）≥ 2.5:1 —— 只保证「看得见」，不当正文标准', () => {
    THEMES.forEach(([name, theme]) => {
      const ratio = ratioOf(theme, 'primary', 'surface');
      expect({ theme: name, visible: ratio >= 2.5 }).toEqual({ theme: name, visible: true });
    });
  });

  it('已知债务：三级提示文字 ≥ 2:1、暗色主题主色对底色 ≥ 2.8 —— 钉住现状，改好之前不许变差', () => {
    THEMES.forEach(([name, theme]) => {
      const ratio = ratioOf(theme, 'textTertiary', 'surface');
      expect({ theme: name, tertiary: ratio >= 2 }).toEqual({ theme: name, tertiary: true });
    });
    expect(ratioOf(ICE_DARK_THEME, 'primary', 'surface')).toBeGreaterThanOrEqual(2.8);
  });
});

describe('组件不许自己写死颜色（只许增长上限）', () => {
  it('src/components 里的硬编码十六进制色不超过基线（新增组件请从 token 取色）', () => {
    const dir = path.join(__dirname, '..', 'src', 'components');
    const offenders: string[] = [];
    fs.readdirSync(dir)
      .filter((name) => name.endsWith('.ts'))
      .forEach((name) => {
        fs.readFileSync(path.join(dir, name), 'utf8')
          .split('\n')
          .forEach((line, index) => {
            const trimmed = line.trim();
            if (/#[0-9a-fA-F]{6}\b/.test(line) && !trimmed.startsWith('//') && !trimmed.startsWith('*')) {
              offenders.push(`${name}:${index + 1}`);
            }
          });
      });
    // 基线 29（2026-09-14 实测）：取色器的色板本身就是数据（13 处）、XP 窗口的 Luna 配色、
    // 以及「白字压彩色底」这类固定前景色。新增组件请从 token 取色，别把这个数推高。
    // 下一步可优化的方向：把反复出现的 #ffffff（on-solid 前景）收成 token。
    expect({ count: offenders.length, atMost: offenders.length <= 29 }).toEqual({ count: offenders.length, atMost: true });
    expect(offenders.join(' ')).not.toContain('undefined');
  });
});
