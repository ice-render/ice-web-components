/**
 * 国际化（i18n）：把组件里写死的内置文案收进可切换的语言包。
 *
 * ```ts
 * import { setICELocale, t } from 'ice-web-components';
 * setICELocale('en-US');        // 之后新建/重排的组件用英文文案
 * t('table.empty');             // 'No data'
 * t('pagination.total', { total: 42 });   // '42 in total'
 * ```
 *
 * 约定：
 * - 默认语言 `zh-CN`；内置 `en-US`；`registerICELocale()` 可以加自己的包；
 * - `t(key, vars)` 的兜底链：**当前语言 → 默认语言 → key 本身**（永远有东西可显示）；
 * - 组件在「构造 / 重排」时读文案，所以切语言之后需要重建组件或触发一次重排；
 * - `setICELocale()` 只认注册过的语言，没注册过就忽略（不抛异常、也不切换）。
 */

export type ICELocaleMessages = Record<string, string>;

/** 默认语言。 */
export const ICE_DEFAULT_LOCALE = 'zh-CN';

/** 内置中文包（组件的默认文案）。 */
export const ICE_LOCALE_ZH_CN: ICELocaleMessages = {
  'common.ok': '确定',
  'common.cancel': '取消',
  'common.confirm': '确认操作？',
  'common.loading': '加载中…',
  'table.empty': '暂无数据',
  'pagination.total': '共 {total} 条',
  'form.validating': '校验中…',
  'upload.hint': '点击或拖拽文件到此处上传',
  'transfer.pending': '待选',
  'transfer.selected': '已选',
  'tour.skip': '跳过',
  'tour.prev': '上一步',
  'tour.next': '下一步',
  'tour.done': '完成',
};

/** 内置英文包。 */
export const ICE_LOCALE_EN_US: ICELocaleMessages = {
  'common.ok': 'OK',
  'common.cancel': 'Cancel',
  'common.confirm': 'Are you sure?',
  'common.loading': 'Loading…',
  'table.empty': 'No data',
  'pagination.total': '{total} in total',
  'form.validating': 'Validating…',
  'upload.hint': 'Click or drag files here to upload',
  'transfer.pending': 'Available',
  'transfer.selected': 'Selected',
  'tour.skip': 'Skip',
  'tour.prev': 'Previous',
  'tour.next': 'Next',
  'tour.done': 'Done',
};

const locales: Record<string, ICELocaleMessages> = {
  'zh-CN': ICE_LOCALE_ZH_CN,
  'en-US': ICE_LOCALE_EN_US,
};

let currentLocale = ICE_DEFAULT_LOCALE;

/** 注册（或覆盖）一个语言包。 */
export function registerICELocale(locale: string, messages: ICELocaleMessages): void {
  if (!locale) return;
  locales[locale] = { ...(locales[locale] || {}), ...(messages || {}) };
}

/** 切换语言；未注册的语言会被忽略。 */
export function setICELocale(locale: string): void {
  if (!locale || !locales[locale]) return;
  currentLocale = locale;
}

export function getICELocale(): string {
  return currentLocale;
}

export function getICELocaleNames(): string[] {
  return Object.keys(locales);
}

/** 取当前语言的完整包（拷贝，避免外部改坏内置包）。 */
export function getICELocaleMessages(locale: string = currentLocale): ICELocaleMessages {
  return { ...(locales[locale] || {}) };
}

/**
 * 取文案：当前语言 → 默认语言 → key 本身；`{name}` 会被 `vars` 里的值替换。
 */
export function t(key: string, vars?: Record<string, string | number>): string {
  const messages = locales[currentLocale] || {};
  const fallback = locales[ICE_DEFAULT_LOCALE] || {};
  const template = messages[key] !== undefined ? messages[key] : fallback[key] !== undefined ? fallback[key] : key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match,
  );
}
