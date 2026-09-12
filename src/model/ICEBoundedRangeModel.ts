export type ICEBoundedRangeModelListener = (model: ICEBoundedRangeModel) => void;

export class ICEBoundedRangeModel {
  private value: number;
  private min: number;
  private max: number;
  private listeners = new Set<ICEBoundedRangeModelListener>();

  constructor(options: { value?: number; min?: number; max?: number } = {}) {
    this.min = options.min ?? 0;
    this.max = options.max ?? 100;
    this.value = this.__clamp(options.value ?? this.min);
  }

  public getValue(): number {
    return this.value;
  }

  public getMinimum(): number {
    return this.min;
  }

  public getMaximum(): number {
    return this.max;
  }

  public setValue(value: number): this {
    const next = this.__clamp(value);
    if (next === this.value) {
      return this;
    }
    this.value = next;
    this.__notify();
    return this;
  }

  public addChangeListener(listener: ICEBoundedRangeModelListener): this {
    this.listeners.add(listener);
    return this;
  }

  public removeChangeListener(listener: ICEBoundedRangeModelListener): this {
    this.listeners.delete(listener);
    return this;
  }

  private __clamp(value: number): number {
    const low = Math.min(this.min, this.max);
    const high = Math.max(this.min, this.max);
    if (!Number.isFinite(value)) {
      return low;
    }
    return Math.min(high, Math.max(low, value));
  }

  private __notify(): void {
    this.listeners.forEach((listener) => listener(this));
  }
}
