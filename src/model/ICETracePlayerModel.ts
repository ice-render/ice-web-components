/**
 * 「轨迹播放器」：把一串预先算好的帧按时间回放（纯逻辑，不碰 canvas）。
 *
 * 算法可视化（排序、寻路、正则匹配、Diff…）都是同一个套路：**先把整段过程算成一串帧，
 * 再按时间回放**。播放 / 暂停 / 单步 / 调速 / 进度 / 到头停住这套逻辑跟具体算法无关，
 * 所以单独抽出来 —— 算法只负责产帧（`ICESortModel` / `ICEMazeModel`），播放器只管「第几帧、要不要走」。
 *
 * 约定：
 * - `load(frames)` 从头开始（游标 0、暂停）；帧是只读的，播放器不复制、不改写；
 * - `tick(dt)` 只在播放态推进，按 `stepsPerSecond` 换算（一帧 = 1000 / speed 毫秒）：
 *   攒够几帧就走几帧（页面每帧调一次，所以正常就是每帧一帧；卡顿后不会「欠着时间」）；
 * - 走到最后一帧自动停（`isFinished()`），此时再 `play()` 会从头重放；
 * - 速度夹在 1..60 步/秒，非法值忽略（NaN / 0 / 负数都当没调用）。
 */

export type ICETraceListener = (model: ICETracePlayerModel<any>) => void;

export interface ICETracePlayerOptions {
  /** 初始速度（步/秒），默认 6 */
  speed?: number;
}

export class ICETracePlayerModel<T> {
  private frames: T[] = [];
  private index = 0;
  private playing = false;
  private speed = 6;
  private accumulator = 0;
  private listeners: Array<ICETraceListener> = [];

  constructor(options: ICETracePlayerOptions = {}) {
    if (options.speed !== undefined) this.speed = this.__clampSpeed(options.speed) ?? this.speed;
  }

  // ------------------------------------------------------------------ 查询
  public getFrameCount(): number { return this.frames.length; }
  public getIndex(): number { return this.index; }
  public getFrame(): T | null { return this.frames.length ? this.frames[this.index] : null; }
  public getFrames(): T[] { return this.frames.slice(); }
  public isPlaying(): boolean { return this.playing; }
  public getSpeed(): number { return this.speed; }
  public getProgress(): number {
    if (this.frames.length <= 1) return this.frames.length ? 1 : 1;
    return this.index / (this.frames.length - 1);
  }
  /** 已经走到（或停在）最后一帧。 */
  public isFinished(): boolean {
    if (!this.frames.length) return true;
    return this.index >= this.frames.length - 1;
  }

  // ------------------------------------------------------------------ 装载与控制
  public load(frames: T[]): void {
    this.frames = Array.isArray(frames) ? frames : [];
    this.index = 0;
    this.playing = false;
    this.accumulator = 0;
    this.notify();
  }

  public play(): void {
    if (this.playing) return;
    // 停在末尾时再按播放 = 从头重放（可视化工具的常规语义）
    if (this.isFinished() && this.frames.length) {
      this.index = 0;
      this.accumulator = 0;
    }
    if (!this.frames.length) return;
    this.playing = true;
    this.notify();
  }

  public pause(): void {
    if (!this.playing) return;
    this.playing = false;
    this.notify();
  }

  public togglePlay(): void {
    if (this.playing) this.pause();
    else this.play();
  }

  public stepForward(): boolean {
    if (this.index >= this.frames.length - 1) return false;
    this.index += 1;
    this.notify();
    return true;
  }

  public stepBackward(): boolean {
    if (this.index <= 0) return false;
    this.index -= 1;
    this.notify();
    return true;
  }

  public seek(index: number): boolean {
    if (!this.frames.length) return false;
    const next = Math.floor(Number(index));
    if (!Number.isFinite(next) || next < 0 || next >= this.frames.length || next === this.index) return false;
    this.index = next;
    this.notify();
    return true;
  }

  public reset(): void {
    this.index = 0;
    this.playing = false;
    this.accumulator = 0;
    this.notify();
  }

  public setSpeed(stepsPerSecond: number): void {
    const next = this.__clampSpeed(stepsPerSecond);
    if (next === null || next === this.speed) return;
    this.speed = next;
    this.notify();
  }

  /** 播放中按真实时间推进（页面每帧调用）。 */
  public tick(delta: number): boolean {
    if (!this.playing || this.frames.length === 0) return false;
    const dt = Math.max(0, Number(delta) || 0);
    this.accumulator += dt;
    const perFrame = 1000 / this.speed;
    if (this.accumulator < perFrame) return false;
    let advanced = 0;
    // 上界防御：dt 再离谱也不会转成死循环
    while (this.accumulator >= perFrame && this.index < this.frames.length - 1 && advanced < 600) {
      this.accumulator -= perFrame;
      this.index += 1;
      advanced += 1;
    }
    if (this.index >= this.frames.length - 1) {
      this.playing = false; // 到头停住
      this.accumulator = 0;
    }
    this.notify();
    return true;
  }

  public addChangeListener(listener: ICETraceListener): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index !== -1) this.listeners.splice(index, 1);
    };
  }

  // ------------------------------------------------------------------ 内部
  /** 夹到 1..60；非法值返回 null（调用方据此忽略）。 */
  private __clampSpeed(value: number): number | null {
    const speed = Number(value);
    if (!Number.isFinite(speed)) return null;
    return Math.max(1, Math.min(60, Math.round(speed)));
  }

  private notify(): void {
    [...this.listeners].forEach((listener) => listener(this));
  }
}

export default ICETracePlayerModel;
