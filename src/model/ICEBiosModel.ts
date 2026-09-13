/**
 * 掌机 BIOS 的纯逻辑（不碰 canvas、不碰 DOM）。
 *
 * 掌机开机先跑一段「自检 → 菜单」的引导，然后才把控制权交给卡带：
 * 自检**按时序推进**（页面每帧调 `tick(dt)`），菜单是**光标 + 确认**的老式控制台交互。
 * 页面只负责把 `getSteps()` / `getMenuEntries()` 画成文字，并执行 `confirm()` 返回的动作 ——
 * 状态机与渲染分开，所以「自检要跑多久、菜单怎么绕、设置存到哪」都能在 node 里单测。
 *
 * 约定：
 * - 自检项由 `steps` 注入（默认 5 项：CPU / RAM / VRAM / SOUND / CART），每项有自己的耗时；
 * - 相位机：`post`（自检中）→ `menu`（启动菜单）或 `boot`（直接启动，快速启动开着时）；
 *   `settings`（设置页）从菜单进、`back()` 回菜单；
 * - 菜单光标上下**循环**（到头绕回去，老式 BIOS 都这样），进设置前记下位置、回来还停在那儿；
 * - 设置（快速启动 / 默认卡带）落到注入的存储里；坏数据、写盘失败一律降级，绝不抛。
 */

export type ICEBiosPhase = 'post' | 'menu' | 'settings' | 'boot';

export interface ICEBiosStep {
  /** 稳定 key（页面拿它做节点 id / 维护增量更新） */
  key: string;
  label: string;
  detail: string;
  /** 这一项「检测」要花多久（毫秒） */
  duration: number;
}

export interface ICEBiosStepState extends ICEBiosStep {
  state: 'pending' | 'running' | 'ok';
  /** 当前项的进度 0..1；非当前项是 0 或 1 */
  progress: number;
}

export interface ICEBiosCartridge {
  key: string;
  label: string;
}

export interface ICEBiosMenuEntry {
  key: string;
  label: string;
  type: 'cartridge' | 'settings' | 'boot';
}

export interface ICEBiosSettings {
  /** 开着就跳过菜单直接启动默认卡带（开机自检还是要跑） */
  quickBoot: boolean;
  defaultCartridge: string;
}

export type ICEBiosAction =
  | { type: 'boot'; cartridge: string }
  | { type: 'settings' }
  | { type: 'menu' }
  | { type: 'none' };

export interface ICEBiosStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface ICEBiosOptions {
  cartridges: ICEBiosCartridge[];
  /** 自检项，默认 `ICE_BIOS_DEFAULT_STEPS` */
  steps?: ICEBiosStep[];
  /** 初始设置（优先级低于存储里的值） */
  settings?: Partial<ICEBiosSettings>;
  /** 存储实现；传 null 表示只放内存；不传则用 globalThis.localStorage（没有就退化成内存） */
  storage?: ICEBiosStorage | null;
  /** 存储键前缀，默认 `ice-arcade-bios-` */
  prefix?: string;
}

export type ICEBiosListener = (model: ICEBiosModel) => void;

/** 默认自检项：每一项都是一句「老式 BIOS 会印在屏幕上的话」。 */
export const ICE_BIOS_DEFAULT_STEPS: ICEBiosStep[] = [
  { key: 'cpu', label: 'CPU', detail: 'ICE-8 @ 600 cycles/s', duration: 300 },
  { key: 'ram', label: 'RAM', detail: '4096 bytes tested', duration: 340 },
  { key: 'vram', label: 'VRAM', detail: '64 × 32 monochrome', duration: 280 },
  { key: 'sound', label: 'SOUND', detail: 'WebAudio beeper', duration: 260 },
  { key: 'cart', label: 'CART', detail: 'cartridge slots', duration: 320 },
];

const STORAGE_KEY = 'settings';

export class ICEBiosModel {
  private steps: ICEBiosStep[];
  private cartridges: ICEBiosCartridge[];
  private storage: ICEBiosStorage | null;
  private storageKey: string;
  private listeners: ICEBiosListener[] = [];
  private phase: ICEBiosPhase = 'post';
  private elapsed = 0;
  private cursor = 0;
  private cursorBeforeSettings = 0;
  private settings: ICEBiosSettings;

  constructor(options: ICEBiosOptions) {
    this.cartridges = (options.cartridges || []).map((item) => ({ key: String(item.key), label: String(item.label) }));
    const defaults: ICEBiosSettings = {
      quickBoot: false,
      defaultCartridge: this.cartridges.length ? this.cartridges[0].key : '',
    };
    const fromOptions: Partial<ICEBiosSettings> = options.settings || {};
    this.storage = options.storage === undefined ? this.__defaultStorage() : options.storage;
    this.storageKey = `${options.prefix || 'ice-arcade-bios-'}${STORAGE_KEY}`;
    this.settings = this.__load(defaults, fromOptions);
    this.steps = (options.steps || ICE_BIOS_DEFAULT_STEPS).map((step) => ({ ...step }));
    // 卡带那一项的自检信息写实际卡带数（页面不用再拼字符串）
    this.steps = this.steps.map((step) => (step.key === 'cart' ? { ...step, detail: `${this.cartridges.length} ${step.detail}` } : step));
    this.cursor = Math.max(0, this.cartridges.findIndex((item) => item.key === this.settings.defaultCartridge));
  }

  // ------------------------------------------------------------------ 查询
  public getPhase(): ICEBiosPhase { return this.phase; }
  public getCartridges(): ICEBiosCartridge[] { return this.cartridges.map((item) => ({ ...item })); }
  public getPostElapsed(): number { return this.elapsed; }

  /** 自检总时长（毫秒）。 */
  public getPostDuration(): number {
    return this.steps.reduce((sum, step) => sum + Math.max(0, step.duration), 0);
  }

  /** 自检进度 0..1（按时间算，页面拿它画进度条）。 */
  public getPostProgress(): number {
    const total = this.getPostDuration();
    if (total <= 0) return 1;
    return Math.max(0, Math.min(1, this.elapsed / total));
  }

  /** 自检项与它们此刻的状态（当前项 running、前面的 ok）。 */
  public getSteps(): ICEBiosStepState[] {
    let cursor = 0;
    return this.steps.map((step) => {
      const start = cursor;
      cursor += Math.max(0, step.duration);
      if (this.elapsed >= cursor) return { ...step, state: 'ok', progress: 1 };
      if (this.elapsed <= start) return { ...step, state: 'pending', progress: 0 };
      const progress = cursor > start ? (this.elapsed - start) / (cursor - start) : 1;
      return { ...step, state: 'running', progress };
    });
  }

  /** 菜单项：卡带列表 + 设置 + 退出并启动。 */
  public getMenuEntries(): ICEBiosMenuEntry[] {
    const entries: ICEBiosMenuEntry[] = this.cartridges.map((item) => ({ key: item.key, label: item.label, type: 'cartridge' as const }));
    entries.push({ key: 'settings', label: '设置 SETUP', type: 'settings' });
    entries.push({ key: 'boot', label: '退出并启动', type: 'boot' });
    return entries;
  }

  public getCursor(): number { return this.cursor; }
  public getSelectedEntry(): ICEBiosMenuEntry | null {
    const entries = this.getMenuEntries();
    return entries[this.cursor] || null;
  }

  public getSettings(): ICEBiosSettings { return { ...this.settings }; }
  public isQuickBoot(): boolean { return this.settings.quickBoot; }
  public getDefaultCartridge(): string { return this.settings.defaultCartridge; }

  // ------------------------------------------------------------------ 操作
  /** 推进自检（页面每帧调用），返回是否发生了变化。 */
  public tick(delta: number): boolean {
    if (this.phase !== 'post') return false;
    const total = this.getPostDuration();
    const next = this.elapsed + Math.max(0, Number(delta) || 0);
    if (next === this.elapsed && this.elapsed < total) return false;
    this.elapsed = Math.min(next, total);
    if (this.elapsed >= total) {
      // 自检跑完：快速启动开着就直接交棒，否则停在菜单等用户选
      this.phase = this.settings.quickBoot ? 'boot' : 'menu';
      this.__alignCursorToDefault();
    }
    this.notify();
    return true;
  }

  public moveCursor(delta: number): void {
    const count = this.getMenuEntries().length;
    if (!count) return;
    const step = Math.sign(Number(delta) || 0) || 1;
    this.cursor = (this.cursor + step + count) % count;
    this.notify();
  }

  public setCursor(index: number): void {
    const count = this.getMenuEntries().length;
    if (!count) return;
    const next = Math.max(0, Math.min(count - 1, Math.floor(Number(index) || 0)));
    if (next === this.cursor) return;
    this.cursor = next;
    this.notify();
  }

  /** 确认当前项：只返回动作，执行动作是页面的事（好测）。 */
  public confirm(): ICEBiosAction {
    const entry = this.getSelectedEntry();
    if (!entry) return { type: 'none' };
    if (entry.type === 'cartridge') {
      this.settings.defaultCartridge = entry.key;
      this.__save();
      this.phase = 'boot';
      this.notify();
      return { type: 'boot', cartridge: entry.key };
    }
    if (entry.type === 'settings') {
      this.cursorBeforeSettings = this.cursor;
      this.phase = 'settings';
      this.notify();
      return { type: 'settings' };
    }
    // 「退出并启动」：用默认卡带启动
    this.phase = 'boot';
    this.notify();
    return { type: 'boot', cartridge: this.settings.defaultCartridge };
  }

  /** 返回上一层（设置 → 菜单）。 */
  public back(): void {
    if (this.phase !== 'settings') return;
    this.phase = 'menu';
    this.cursor = this.cursorBeforeSettings;
    this.notify();
    return;
  }

  /** 从游戏里回到 BIOS 菜单（掌机的「复位」）。 */
  public openMenu(): void {
    this.phase = 'menu';
    this.__alignCursorToDefault();
    this.notify();
    return;
  }

  /** 重新跑一遍自检（再开一次机）。 */
  public restart(): void {
    this.phase = 'post';
    this.elapsed = 0;
    this.notify();
    return;
  }

  public toggleQuickBoot(): boolean {
    this.settings.quickBoot = !this.settings.quickBoot;
    this.__save();
    this.notify();
    return this.settings.quickBoot;
  }

  public setDefaultCartridge(key: string): void {
    const next = this.__normalizeCartridge(key);
    if (next === this.settings.defaultCartridge) return;
    this.settings.defaultCartridge = next;
    this.__save();
    this.notify();
    return;
  }

  public addChangeListener(listener: ICEBiosListener): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index !== -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  // ------------------------------------------------------------------ 内部
  private __alignCursorToDefault(): void {
    const index = this.getMenuEntries().findIndex((entry) => entry.key === this.settings.defaultCartridge);
    this.cursor = index === -1 ? 0 : index;
  }

  /** 卡带 key 必须真的存在，否则回退到第一个卡带。 */
  private __normalizeCartridge(key: unknown): string {
    const value = String(key || '');
    if (this.cartridges.some((item) => item.key === value)) return value;
    return this.cartridges.length ? this.cartridges[0].key : '';
  }

  private __load(defaults: ICEBiosSettings, overrides: Partial<ICEBiosSettings>): ICEBiosSettings {
    const settings: ICEBiosSettings = { ...defaults };
    // 顺序很关键：调用方给的只是「出厂默认」，存储里的用户设置永远优先
    if (typeof overrides.quickBoot === 'boolean') settings.quickBoot = overrides.quickBoot;
    if (overrides.defaultCartridge !== undefined) settings.defaultCartridge = this.__normalizeCartridge(overrides.defaultCartridge);
    const stored = this.__readStorage();
    if (stored) {
      if (typeof stored.quickBoot === 'boolean') settings.quickBoot = stored.quickBoot;
      if (stored.defaultCartridge !== undefined) settings.defaultCartridge = this.__normalizeCartridge(stored.defaultCartridge);
    }
    return settings;
  }

  private __readStorage(): Partial<ICEBiosSettings> | null {
    if (!this.storage) return null;
    let raw: string | null = null;
    try {
      raw = this.storage.getItem(this.storageKey);
    } catch (error) {
      return null;
    }
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (error) {
      return null; // 存档坏了就当没设置过
    }
  }

  private __save(): void {
    if (!this.storage) return;
    try {
      this.storage.setItem(this.storageKey, JSON.stringify(this.settings));
    } catch (error) {
      /* 隐私模式 / 配额满：内存里的设置照样生效 */
    }
  }

  private __defaultStorage(): ICEBiosStorage | null {
    const scope: any = typeof globalThis !== 'undefined' ? globalThis : null;
    return scope && scope.localStorage ? scope.localStorage : null;
  }

  private notify(): void {
    [...this.listeners].forEach((listener) => listener(this));
  }
}

export default ICEBiosModel;
