/**
 * 撤销 / 重做栈（纯逻辑，泛型）。
 *
 * 不是给某个画板专用的：任何「编辑 → 提交 → 后悔」的界面都能用（像素画板、看板、
 * 表格编辑、表单草稿…），所以它只认泛型快照，不认识 canvas、颜色和数据结构。
 *
 * 约定：
 * - `push(state)` 入栈并**清空 redo 栈** —— 从历史中间改一下，原来那条「未来」就作废了；
 * - `undo()` / `redo()` 返回目标快照，到边界返回 `null`（调用方据此把按钮置灰）；
 * - 超过 `limit` 丢**最旧**的一条（默认 50：够用，且内存不会无限涨）；
 * - 变更通知带 `reason`（push / undo / redo / clear），页面按需刷新按钮态；
 * - 快照的存取由调用方负责 `slice()` / 深拷贝 —— 栈只存引用，不做深拷贝（性能）。
 */

export type ICEHistoryReason = 'push' | 'undo' | 'redo' | 'clear';

export type ICEHistoryListener<T> = (model: ICEHistoryModel<T>, reason: ICEHistoryReason) => void;

export interface ICEHistoryOptions<T> {
  /** 最多保留多少个**可撤销**的快照，默认 50 */
  limit?: number;
  /** 初始当前值（不占历史深度） */
  initial?: T;
}

export class ICEHistoryModel<T> {
  private limit: number;
  /** 已提交的快照，最后一个就是当前值 */
  private past: T[] = [];
  private future: T[] = [];
  private listeners: Array<ICEHistoryListener<T>> = [];

  constructor(options: ICEHistoryOptions<T> = {}) {
    this.limit = Math.max(1, Math.floor(options.limit === undefined ? 50 : options.limit));
    if (options.initial !== undefined) {
      this.past.push(options.initial);
    }
  }

  public getLimit(): number {
    return this.limit;
  }

  public getCurrent(): T | null {
    return this.past.length ? this.past[this.past.length - 1] : null;
  }

  public canUndo(): boolean {
    return this.past.length > 1;
  }

  public canRedo(): boolean {
    return this.future.length > 0;
  }

  /** 栈深：undo = 还能撤销几步，redo = 还能重做几步。 */
  public getDepth(): { undo: number; redo: number } {
    return { undo: Math.max(0, this.past.length - 1), redo: this.future.length };
  }

  public push(state: T): void {
    this.past.push(state);
    // 丢掉最旧的：limit 限制的是「可撤销步数」，所以保留 limit + 1 个快照
    const maxPast = this.limit + 1;
    if (this.past.length > maxPast) {
      this.past.splice(0, this.past.length - maxPast);
    }
    this.future.length = 0;
    this.notify('push');
  }

  public undo(): T | null {
    if (!this.canUndo()) {
      return null;
    }
    const current = this.past.pop() as T;
    this.future.push(current);
    this.notify('undo');
    return this.getCurrent();
  }

  public redo(): T | null {
    if (!this.canRedo()) {
      return null;
    }
    const next = this.future.pop() as T;
    this.past.push(next);
    this.notify('redo');
    return next;
  }

  public clear(initial?: T): void {
    this.past = initial === undefined ? [] : [initial];
    this.future = [];
    this.notify('clear');
  }

  public addChangeListener(listener: ICEHistoryListener<T>): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index !== -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notify(reason: ICEHistoryReason): void {
    [...this.listeners].forEach((listener) => listener(this, reason));
  }
}

export default ICEHistoryModel;
