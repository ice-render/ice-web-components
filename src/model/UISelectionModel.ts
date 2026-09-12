/**
 * 选择模型：列表 / 树 / 穿梭框共用的选择状态。
 *
 * 与其它模型（UIButtonModel / UIToggleModel / UIBoundedRangeModel）同风格：
 * 纯状态 + 监听器，UI 组件只负责把状态画出来。
 */

export type UISelectionMode = 'single' | 'multiple';

export interface UISelectionModelOptions {
  mode?: UISelectionMode;
  selected?: string[];
}

export type UISelectionListener = (model: UISelectionModel) => void;

export class UISelectionModel {
  private mode: UISelectionMode;
  private selected: string[];
  private listeners = new Set<UISelectionListener>();

  constructor(options: UISelectionModelOptions = {}) {
    this.mode = options.mode || 'single';
    this.selected = this.__normalize(options.selected || []);
  }

  public getMode(): UISelectionMode {
    return this.mode;
  }

  public setMode(mode: UISelectionMode): this {
    if (mode === this.mode) {
      return this;
    }
    this.mode = mode;
    this.selected = this.__normalize(this.selected);
    this.__notify();
    return this;
  }

  public getSelectedKeys(): string[] {
    return this.selected.slice();
  }

  public isSelected(key: string): boolean {
    return this.selected.indexOf(key) !== -1;
  }

  /** 选中（single 替换；multiple 追加，已选中则不变）。 */
  public select(key: string): this {
    if (this.mode === 'single') {
      if (this.selected.length === 1 && this.selected[0] === key) {
        return this;
      }
      this.selected = [key];
      this.__notify();
      return this;
    }
    if (this.selected.indexOf(key) === -1) {
      this.selected = this.selected.concat([key]);
      this.__notify();
    }
    return this;
  }

  /** 切换选中状态（点一下选中、再点取消）。 */
  public toggle(key: string): this {
    if (this.mode === 'single') {
      return this.select(key);
    }
    const index = this.selected.indexOf(key);
    if (index === -1) {
      this.selected = this.selected.concat([key]);
    } else {
      this.selected = this.selected.filter((item) => item !== key);
    }
    this.__notify();
    return this;
  }

  public setSelected(keys: string[]): this {
    const next = this.__normalize(keys || []);
    if (next.length === this.selected.length && next.every((key, index) => key === this.selected[index])) {
      return this;
    }
    this.selected = next;
    this.__notify();
    return this;
  }

  public clear(): this {
    if (!this.selected.length) {
      return this;
    }
    this.selected = [];
    this.__notify();
    return this;
  }

  public addChangeListener(listener: UISelectionListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private __normalize(keys: string[]): string[] {
    const unique: string[] = [];
    keys.forEach((key) => {
      const value = String(key);
      if (unique.indexOf(value) === -1) {
        unique.push(value);
      }
    });
    return this.mode === 'single' ? unique.slice(-1) : unique;
  }

  private __notify(): void {
    this.listeners.forEach((listener) => listener(this));
  }
}
