/**
 * 排行榜的纯逻辑模型（不碰 canvas，也不直接依赖 localStorage）。
 *
 * - `add(score)` 插入后按**分数降序**排，并列时保持先来后到，超过 `maxEntries` 截断；
 * - `getBest()` 给最高分（空榜 0）；`isInTop(score)` 判断「这一局值不值得炫耀」；
 * - 存储通过构造函数注入（默认 `globalThis.localStorage`）：key 按卡带隔离；
 * - 存档损坏（非法 JSON / 结构不对 / 里层字段不合法）一律降级成空榜，绝不抛；
 * - 写盘失败（隐私模式、配额满）不影响内存里的成绩。
 */

export interface ICEHighScoreEntry {
  score: number;
  /** 可选标签（用户名 / 备注） */
  label?: string;
  /** 可选时间戳 */
  at?: number;
}

/** 只需要这两个方法，注入内存实现即可在 node 里测。 */
export interface ICEHighScoreStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

export interface ICEHighScoreOptions {
  /** 榜单标识（一般用卡带 key：tetris / snake…） */
  key: string;
  /** 最多保留几条，默认 5 */
  maxEntries?: number;
  /** 存储实现；传 null 表示只放内存；不传则用 globalThis.localStorage（没有就退化成内存） */
  storage?: ICEHighScoreStorage | null;
  /** 存储键前缀，默认 `ice-arcade-scores-` */
  prefix?: string;
}

export class ICEHighScoreModel {
  private key: string;
  private maxEntries: number;
  private storage: ICEHighScoreStorage | null;
  private prefix: string;
  private entries: ICEHighScoreEntry[] = [];

  constructor(options: ICEHighScoreOptions) {
    this.key = String(options.key || 'default');
    this.maxEntries = Math.max(1, Math.floor(options.maxEntries === undefined ? 5 : options.maxEntries));
    this.prefix = options.prefix || 'ice-arcade-scores-';
    this.storage = options.storage === undefined ? this.__defaultStorage() : options.storage;
    this.entries = this.__load();
  }

  public getKey(): string {
    return this.key;
  }

  public getStorageKey(): string {
    return `${this.prefix}${this.key}`;
  }

  public getMaxEntries(): number {
    return this.maxEntries;
  }

  /** 榜单拷贝（降序）。 */
  public getScores(): ICEHighScoreEntry[] {
    return this.entries.map((item) => ({ ...item }));
  }

  /** 最高分（空榜为 0）。 */
  public getBest(): number {
    return this.entries.length ? this.entries[0].score : 0;
  }

  /** 这个分数能不能进榜（榜没满一律能进；并列最小分也算能进）。 */
  public isInTop(score: number): boolean {
    const value = Number(score);
    if (!Number.isFinite(value) || value <= 0) return false;
    if (this.entries.length < this.maxEntries) return true;
    return value >= this.entries[this.entries.length - 1].score;
  }

  /** 记一笔成绩，返回更新后的榜单。非法分数直接忽略。 */
  public add(score: number, options: { label?: string; at?: number } = {}): ICEHighScoreEntry[] {
    const value = Number(score);
    if (!Number.isFinite(value) || value <= 0) return this.getScores();
    const entry: ICEHighScoreEntry = { score: value };
    if (options.label !== undefined) entry.label = String(options.label);
    entry.at = Number.isFinite(Number(options.at)) ? Number(options.at) : Date.now();
    const next = this.entries.concat([entry]);
    // 分数降序；并列时 JS 的 sort 是稳定排序 → 先来的在前
    next.sort((a, b) => b.score - a.score);
    this.entries = next.slice(0, this.maxEntries);
    this.__save();
    return this.getScores();
  }

  public clear(): void {
    this.entries = [];
    this.__save();
  }

  /** 从存储重新读一遍（多标签页/多窗口场景）。 */
  public reload(): ICEHighScoreEntry[] {
    this.entries = this.__load();
    return this.getScores();
  }

  // ---------------------------------------------------------------- 内部

  private __defaultStorage(): ICEHighScoreStorage | null {
    const globalStorage = (globalThis as any).localStorage;
    return globalStorage && typeof globalStorage.getItem === 'function' ? globalStorage : null;
  }

  private __load(): ICEHighScoreEntry[] {
    if (!this.storage) return [];
    let raw: string | null = null;
    try {
      raw = this.storage.getItem(this.getStorageKey());
    } catch (err) {
      return [];
    }
    if (!raw) return [];
    let parsed: any = null;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      return [];
    }
    const list = parsed && Array.isArray(parsed.entries) ? parsed.entries : null;
    if (!list) return [];
    const entries: ICEHighScoreEntry[] = [];
    list.forEach((item: any) => {
      if (!item || typeof item !== 'object') return;
      const score = Number(item.score);
      if (!Number.isFinite(score) || score <= 0) return;
      const entry: ICEHighScoreEntry = { score };
      if (item.label !== undefined) entry.label = String(item.label);
      entry.at = Number.isFinite(Number(item.at)) ? Number(item.at) : undefined;
      entries.push(entry);
    });
    entries.sort((a, b) => b.score - a.score);
    return entries.slice(0, this.maxEntries);
  }

  private __save(): void {
    if (!this.storage) return;
    try {
      this.storage.setItem(this.getStorageKey(), JSON.stringify({ entries: this.entries }));
    } catch (err) {
      /* 写盘失败（隐私模式 / 配额满）不影响内存里的成绩 */
    }
  }
}
