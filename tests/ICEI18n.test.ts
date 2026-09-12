/**
 * 国际化（i18n）规格。
 *
 * 目标不大但很实在：把组件里写死的中文文案收进一份**可切换的语言包**，
 * 让「共 N 条 / 暂无数据 / 确定 / 取消 / 下一步」这类内置文案能跟着语言走。
 *
 * 约定：
 * - 默认语言 `zh-CN`（内置中文包），内置 `en-US`；
 * - `t(key, vars)`：当前语言 → 默认语言 → key 本身（逐级兜底，永远有个可读结果）；
 *   `{name}` 形式插值；
 * - `setICELocale()` 只认注册过的语言（没注册过就忽略，不抛也不切换）；
 * - 组件在**构造 / 重排时**读一次文案，所以切语言后需要重建或触发一次重排（文档里写明）。
 */
import {
  ICE_DEFAULT_LOCALE,
  ICE_LOCALE_EN_US,
  ICE_LOCALE_ZH_CN,
  getICELocale,
  getICELocaleNames,
  registerICELocale,
  setICELocale,
  t,
} from '../src/i18n/ICEI18n';

describe('语言包与切换', () => {
  afterEach(() => {
    setICELocale(ICE_DEFAULT_LOCALE);
  });

  it('默认中文，内置 zh-CN / en-US', () => {
    expect(getICELocale()).toBe('zh-CN');
    expect(getICELocaleNames()).toEqual(expect.arrayContaining(['zh-CN', 'en-US']));
    expect(ICE_LOCALE_ZH_CN['table.empty']).toBe('暂无数据');
    expect(ICE_LOCALE_EN_US['table.empty']).toBe('No data');
  });

  it('切到英文后 t() 取英文；切回来取中文', () => {
    expect(t('table.empty')).toBe('暂无数据');
    setICELocale('en-US');
    expect(getICELocale()).toBe('en-US');
    expect(t('table.empty')).toBe('No data');
    setICELocale('zh-CN');
    expect(t('table.empty')).toBe('暂无数据');
  });

  it('未注册的语言直接忽略（保持当前语言，不抛异常）', () => {
    setICELocale('xx-XX');
    expect(getICELocale()).toBe('zh-CN');
  });

  it('可以注册自定义语言包，并覆盖内置 key', () => {
    registerICELocale('ja-JP', { 'table.empty': 'データなし' });
    setICELocale('ja-JP');
    expect(t('table.empty')).toBe('データなし');
    // 没覆盖的 key 回退到默认语言（中文），而不是露 key
    expect(t('common.ok')).toBe('确定');
  });

  it('t() 支持 {name} 插值；未知 key 原样返回（便于发现问题）', () => {
    setICELocale('en-US');
    expect(t('pagination.total', { total: 42 })).toBe('42 in total');
    expect(t('pagination.total', { total: 7 })).toBe('7 in total');
    expect(t('not.exist.key')).toBe('not.exist.key');
  });

  it('同一个 key 在两种语言里都存在（避免只改一半）', () => {
    Object.keys(ICE_LOCALE_ZH_CN).forEach((key) => {
      expect(Object.prototype.hasOwnProperty.call(ICE_LOCALE_EN_US, key)).toBe(true);
    });
  });
});
