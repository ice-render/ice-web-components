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
 * - `tFor(locale)`：**按实例**取文案（组件用 `props.locale` 调用它）——
 *   这样同页两个面板可以各用各的语言，也不要求库持有全局状态（见 `docs/architecture/17-i18n-boundary.md`）；
 * - 组件在「构造 / 重排」时读文案，所以切语言之后需要重建组件或触发一次重排；
 * - `setICELocale()` 只认注册过的语言，没注册过就忽略（不抛异常、也不切换）。
 */

export type ICELocaleMessages = Record<string, string>;

/**
 * 支持「实例级语言」的组件选项：传 `locale` 时该实例用这个语言的内置文案
 * （未注册 / 未传则回退当前语言）。组件层文案可配、**不持全局状态** ——
 * 见 ice-render `docs/architecture/17-i18n-boundary.md`。
 */
export interface ICELocalizedProps {
  locale?: string;
}

/** 一周首日的兜底：周一（与 `Date.getDay()` 对齐：0=周日 … 6=周六）。 */
export const ICE_DEFAULT_WEEK_START = 1;

/**
 * 解析「一周从哪天开始」（0=周日 … 6=周六，与 `Date.getDay()` 对齐）。
 *
 * - `override` 合法（0..6）时优先用它 —— 调用方可以硬指定（例如固定周一开头的排班表）；
 * - 否则按**语言**推导：`Intl.Locale(tag).weekInfo.firstDay`（1=周一 … 7=周日）→ 转换成 0..6；
 * - 语言未注册 / 运行时没有 `Intl.Locale` 或 `weekInfo`（老引擎、部分小程序）→ 兜底周一。
 *
 * 这是「排版/日历语义」而不是词条：引擎不持 locale，组件层按自己的语言（`props.locale` 或
 * 当前语言）推导即可，不引入全局状态。
 */
export function resolveWeekStart(locale?: string, override?: number): number {
  if (typeof override === 'number' && Number.isFinite(override) && override >= 0 && override <= 6) {
    return Math.floor(override);
  }
  const tag = locale || currentLocale;
  const LocaleCtor: any = typeof Intl !== 'undefined' ? (Intl as any).Locale : undefined;
  if (typeof LocaleCtor === 'function') {
    try {
      const info = new LocaleCtor(tag);
      const weekInfo = info.weekInfo || (typeof info.getWeekInfo === 'function' ? info.getWeekInfo() : null);
      const firstDay = weekInfo ? Number(weekInfo.firstDay) : NaN;
      if (firstDay >= 1 && firstDay <= 7) {
        return firstDay === 7 ? 0 : firstDay; // 规范：1=周一 … 7=周日；本库：0=周日
      }
    } catch (err) {
      // 语言标签非法 / 运行时未实现 → 兜底
    }
  }
  return ICE_DEFAULT_WEEK_START;
}

/** 默认语言。 */
export const ICE_DEFAULT_LOCALE = 'zh-CN';

/** 内置中文包（组件的默认文案）。 */
export const ICE_LOCALE_ZH_CN: ICELocaleMessages = {
  'common.ok': '确定',
  'common.cancel': '取消',
  'common.confirm': '确认操作？',
  'common.loading': '加载中…',
  'common.search': '搜索…',
  'table.empty': '暂无数据',
  'pagination.total': '共 {total} 条',
  'pagination.pageSize': '{size} 条/页',
  'calendar.yearMonth': '{year} 年 {month} 月',
  'calendar.weekday.mon': '一',
  'calendar.weekday.tue': '二',
  'calendar.weekday.wed': '三',
  'calendar.weekday.thu': '四',
  'calendar.weekday.fri': '五',
  'calendar.weekday.sat': '六',
  'calendar.weekday.sun': '日',
  'dateRange.start': '开始日期',
  'dateRange.end': '结束日期',
  'dateRange.clear': '清空',
  'dateRange.pickStart': '请选择开始日期',
  'dateRange.pickEnd': '再点一天作为结束日期',
  'theme.highContrast': '高对比',
  'form.validating': '校验中…',
  'form.required': '{label}不能为空',
  'form.min': '{label}不能小于 {min}',
  'form.max': '{label}不能大于 {max}',
  'form.minLength': '{label}长度不能少于 {minLength}',
  'form.maxLength': '{label}长度不能超过 {maxLength}',
  'form.pattern': '{label}格式不正确',
  'upload.hint': '点击或拖拽文件到此处上传',
  'upload.sizeLimit': '不超过 {size} KB',
  'upload.disabled': '已禁用',
  'upload.typeUnsupported': '文件类型不支持：{name}',
  'upload.sizeExceeded': '文件大小超出限制：{name}',
  'upload.maxCount': '超过最大数量限制（{max}）',
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
  'common.search': 'Search…',
  'table.empty': 'No data',
  'pagination.total': '{total} in total',
  'pagination.pageSize': '{size} / page',
  'calendar.yearMonth': '{month}/{year}',
  'calendar.weekday.mon': 'Mon',
  'calendar.weekday.tue': 'Tue',
  'calendar.weekday.wed': 'Wed',
  'calendar.weekday.thu': 'Thu',
  'calendar.weekday.fri': 'Fri',
  'calendar.weekday.sat': 'Sat',
  'calendar.weekday.sun': 'Sun',
  'dateRange.start': 'Start date',
  'dateRange.end': 'End date',
  'dateRange.clear': 'Clear',
  'dateRange.pickStart': 'Pick a start date',
  'dateRange.pickEnd': 'Pick an end date',
  'theme.highContrast': 'High contrast',
  'form.validating': 'Validating…',
  'form.required': '{label} is required',
  'form.min': '{label} must be ≥ {min}',
  'form.max': '{label} must be ≤ {max}',
  'form.minLength': '{label} must be at least {minLength} characters',
  'form.maxLength': '{label} must be at most {maxLength} characters',
  'form.pattern': '{label} has an invalid format',
  'upload.hint': 'Click or drag files here to upload',
  'upload.sizeLimit': 'Up to {size} KB',
  'upload.disabled': 'Disabled',
  'upload.typeUnsupported': 'Unsupported file type: {name}',
  'upload.sizeExceeded': 'File exceeds the size limit: {name}',
  'upload.maxCount': 'Too many files (max {max})',
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

/** 翻译函数签名（`tFor()` 的返回类型）。 */
export type ICETranslate = (key: string, vars?: Record<string, string | number>) => string;

/**
 * 取**指定语言**的翻译函数：`locale` 未传或未注册时回退到当前语言。
 *
 * 组件用 `props.locale` 调它，从而做到「同页两个实例各用各的语言」，且不要求库持有全局状态。
 * 兜底链与 `t()` 一致：**该语言 → 默认语言 → key 本身**。
 */
export function tFor(locale?: string): ICETranslate {
  const messages = (locale && locales[locale]) || locales[currentLocale] || {};
  const fallback = locales[ICE_DEFAULT_LOCALE] || {};
  return (key: string, vars?: Record<string, string | number>): string => {
    const template = messages[key] !== undefined ? messages[key] : fallback[key] !== undefined ? fallback[key] : key;
    if (!vars) return template;
    return template.replace(/\{(\w+)\}/g, (match, name) =>
      Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match,
    );
  };
}

/**
 * 取文案（用**当前语言**）：当前语言 → 默认语言 → key 本身；`{name}` 会被 `vars` 里的值替换。
 *
 * 组件内部请改用 `tFor(props.locale)`（见 {@link tFor}），这样调用方能按实例指定语言。
 */
export function t(key: string, vars?: Record<string, string | number>): string {
  return tFor()(key, vars);
}
