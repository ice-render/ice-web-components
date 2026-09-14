/**
 * 三个全局质量开关：密度 / 减少动效 / 高对比主题。
 *
 * 这三个都属于「说一句话，全库受益」的东西：
 * - **密度**：密集后台里表格与表单偏松，`setDensity('compact')` 把高度与间距压到 85%；
 * - **减少动效**：跟随系统 `prefers-reduced-motion`，开了之后所有过渡同步落到终点；
 * - **高对比**：暗底高对比主题，正文对底色 21:1（AAA 要求 7:1）。
 */
import { ICE_DARK_THEME, ICE_HIGH_CONTRAST_THEME, ICE_LIGHT_THEME } from '../src/theme/ICETheme';
import { iceUIManager } from '../src/core/ICEManager';
import {
  isICEReducedMotion,
  resolveICEAnimationDuration,
  setICEReducedMotion,
  tween,
} from '../src/util/ICEAnimation';

describe('密度开关', () => {
  afterEach(() => {
    iceUIManager.setDensity('default');
    iceUIManager.setTheme('light');
  });

  it('默认密度就是主题原样', () => {
    expect(iceUIManager.getDensity()).toBe('default');
    expect(iceUIManager.getTheme()).toBe(ICE_LIGHT_THEME);
    expect(iceUIManager.getTheme().control.height).toBe(32);
  });

  it('compact 压高度与间距，但不动颜色与字体', () => {
    iceUIManager.setDensity('compact');
    const theme = iceUIManager.getTheme();
    expect(iceUIManager.getDensity()).toBe('compact');
    expect(theme.control.height).toBeLessThan(ICE_LIGHT_THEME.control.height);
    expect(theme.control.height).toBeGreaterThanOrEqual(20);
    expect(theme.spacing.md).toBeLessThan(ICE_LIGHT_THEME.spacing.md);
    expect(theme.colors).toEqual(ICE_LIGHT_THEME.colors);
    expect(theme.font).toEqual(ICE_LIGHT_THEME.font);
    expect(theme.radius).toEqual(ICE_LIGHT_THEME.radius);
  });

  it('同一套主题 + 同一密度返回同一个对象（组件会比对引用）', () => {
    iceUIManager.setDensity('compact');
    expect(iceUIManager.getTheme()).toBe(iceUIManager.getTheme());
  });

  it('与主题正交：dark + compact 是「暗色的密集版」', () => {
    iceUIManager.setTheme('dark');
    iceUIManager.setDensity('compact');
    const theme = iceUIManager.getTheme();
    expect(theme.colors.text).toBe(ICE_DARK_THEME.colors.text);
    expect(theme.control.height).toBeLessThan(ICE_DARK_THEME.control.height);
    iceUIManager.setDensity('default');
    expect(iceUIManager.getTheme()).toBe(ICE_DARK_THEME);
  });
});

describe('减少动效开关', () => {
  afterEach(() => {
    setICEReducedMotion('auto');
    delete (globalThis as any).matchMedia;
  });

  it('auto 跟随系统：prefers-reduced-motion: reduce 时算「要减少」', () => {
    (globalThis as any).matchMedia = () => ({ matches: true });
    expect(isICEReducedMotion()).toBe(true);
    (globalThis as any).matchMedia = () => ({ matches: false });
    expect(isICEReducedMotion()).toBe(false);
  });

  it('运行时没有 matchMedia 也不炸（老引擎 / 小程序）', () => {
    expect(isICEReducedMotion()).toBe(false);
    expect(resolveICEAnimationDuration(200)).toBe(200);
  });

  it('开了减少动效：tween 直接落到终点并回调（不是变快，是不要动）', () => {
    setICEReducedMotion(true);
    const seen: number[] = [];
    let completed = false;
    tween({
      from: 0,
      to: 100,
      duration: 400,
      onUpdate: (value: number) => seen.push(value),
      onFinish: () => {
        completed = true;
      },
    });
    expect(completed).toBe(true);
    expect(seen[seen.length - 1]).toBe(100);
    expect(resolveICEAnimationDuration(400)).toBe(0);
  });

  it('关掉之后恢复正常时长（假计时器验证 200ms 才走完）', () => {
    jest.useFakeTimers();
    setICEReducedMotion(false);
    let value = 0;
    const driver = {
      request: (cb: any) => setTimeout(() => cb(Date.now()), 16),
      cancel: (handle: any) => clearTimeout(handle),
    };
    tween({ from: 0, to: 100, duration: 200, driver: driver as any, onUpdate: (v: number) => (value = v) });
    jest.advanceTimersByTime(48);
    expect(value).toBeLessThan(100);
    jest.advanceTimersByTime(300);
    expect(value).toBe(100);
    jest.useRealTimers();
  });
});

describe('高对比主题', () => {
  it('注册在内置主题里，可以切换', () => {
    expect(iceUIManager.hasTheme('high-contrast')).toBe(true);
    iceUIManager.setTheme('high-contrast');
    expect(iceUIManager.getThemeName()).toBe('high-contrast');
    expect(iceUIManager.getTheme().colors).toEqual(ICE_HIGH_CONTRAST_THEME.colors);
    iceUIManager.setTheme('light');
  });

  it('color token 与基准主题完全对齐（不少也不多）', () => {
    expect(Object.keys(ICE_HIGH_CONTRAST_THEME.colors).sort()).toEqual(Object.keys(ICE_LIGHT_THEME.colors).sort());
  });
});
