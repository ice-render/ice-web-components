/**
 * 区间日期模型（纯逻辑，不碰 canvas）。
 *
 * 区间选择的难点全在规则上，所以先把规则钉死，界面（日历面板 + 快捷项）只负责画：
 * - 用户先点结束再点开始 → **自动交换**（操作顺序不该被惩罚）；
 * - 只点了一头 → 「进行中」，`isComplete()` 为假（界面据此不触发「确定」）；
 * - 时间部分**归一化到当天零点**（同一天的两个时刻不该被判成非法区间）；
 * - 快捷项（今天 / 近 7 天 / 近 30 天 / 本月 / 上月）按注入的 `now` 解析，测试可复现；
 * - `matchPreset()` 认出「当前区间正好等于某个快捷项」，页面据此高亮那一条。
 */

export interface ICEDateRangePreset {
  key: string;
  label: string;
  /** 用「现在」解析出 [起, 止]（都归一化到当天零点） */
  resolve(now: Date): [Date, Date];
}

export type ICEDateRangeListener = (model: ICEDateRangeModel) => void;

/** 归一化到当天零点：区间比较只关心「哪一天」，不关心几点几分。 */
function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export const ICE_DATE_RANGE_PRESETS: ICEDateRangePreset[] = [
  { key: 'today', label: '今天', resolve: (now) => [startOfDay(now), startOfDay(now)] },
  { key: 'last7', label: '近 7 天', resolve: (now) => [addDays(now, -6), startOfDay(now)] },
  { key: 'last30', label: '近 30 天', resolve: (now) => [addDays(now, -29), startOfDay(now)] },
  {
    key: 'thisMonth',
    label: '本月',
    resolve: (now) => [new Date(now.getFullYear(), now.getMonth(), 1), new Date(now.getFullYear(), now.getMonth() + 1, 0)],
  },
  {
    key: 'lastMonth',
    label: '上月',
    resolve: (now) => [new Date(now.getFullYear(), now.getMonth() - 1, 1), new Date(now.getFullYear(), now.getMonth(), 0)],
  },
];

export interface ICEDateRangeOptions {
  /** 时间源（快捷项解析用），测试可注入固定值 */
  now?: () => Date;
  /** 初始区间（可以只给一头） */
  value?: [Date | null, Date | null];
  /** 自定义快捷项；不传用内置五项 */
  presets?: ICEDateRangePreset[];
}

export class ICEDateRangeModel {
  private start: Date | null = null;
  private end: Date | null = null;
  private presets: ICEDateRangePreset[];
  private now: () => Date;
  private listeners: ICEDateRangeListener[] = [];

  constructor(options: ICEDateRangeOptions = {}) {
    this.now = options.now || (() => new Date());
    this.presets = (options.presets || ICE_DATE_RANGE_PRESETS).map((item) => ({ ...item }));
    if (options.value) this.setValue(options.value[0], options.value[1], { silent: true });
  }

  public getStart(): Date | null {
    return this.start ? new Date(this.start) : null;
  }

  public getEnd(): Date | null {
    return this.end ? new Date(this.end) : null;
  }

  public getValue(): [Date | null, Date | null] {
    return [this.getStart(), this.getEnd()];
  }

  /** 两端都有才算「完整区间」。 */
  public isComplete(): boolean {
    return !!(this.start && this.end);
  }

  public getPresets(): Array<{ key: string; label: string }> {
    return this.presets.map((item) => ({ key: item.key, label: item.label }));
  }

  /**
   * 设值：自动排序（先点结束再点开始也成立）、归一化到当天零点。
   * 只给一头表示「进行中的选择」。
   */
  public setValue(start: Date | null, end: Date | null, options: { silent?: boolean } = {}): this {
    const a = start ? startOfDay(start) : null;
    const b = end ? startOfDay(end) : null;
    const ordered = a && b && a.getTime() > b.getTime() ? [b, a] : [a, b];
    this.start = ordered[0];
    this.end = ordered[1];
    if (!options.silent) this.notify();
    return this;
  }

  /** 点快捷项：解析成区间并写回（返回值就是写进去的那一对）。 */
  public applyPreset(key: string): [Date, Date] {
    const preset = this.presets.find((item) => item.key === key);
    if (!preset) return [this.start || startOfDay(this.now()), this.end || startOfDay(this.now())];
    const [from, to] = preset.resolve(this.now());
    this.setValue(from, to, { silent: true });
    this.notify();
    return [new Date(this.start as Date), new Date(this.end as Date)];
  }

  /** 当前区间正好等于某个快捷项 → 返回它的 key（页面据此高亮）。 */
  public matchPreset(): string | null {
    if (!this.isComplete()) return null;
    const same = (a: Date | null, b: Date) => !!a && a.getTime() === startOfDay(b).getTime();
    const hit = this.presets.find((item) => {
      const [from, to] = item.resolve(this.now());
      return same(this.start, from) && same(this.end, to);
    });
    return hit ? hit.key : null;
  }

  public addChangeListener(listener: ICEDateRangeListener): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index !== -1) this.listeners.splice(index, 1);
    };
  }

  private notify(): void {
    [...this.listeners].forEach((listener) => listener(this));
  }
}

export default ICEDateRangeModel;
