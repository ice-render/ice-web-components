export type ICEButtonModelListener = (model: ICEButtonModel) => void;

export class ICEButtonModel {
  private enabled: boolean;
  private pressed: boolean;
  private listeners = new Set<ICEButtonModelListener>();

  constructor(options: { enabled?: boolean } = {}) {
    this.enabled = options.enabled !== false;
    this.pressed = false;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setEnabled(enabled: boolean): this {
    this.enabled = !!enabled;
    this.__notify();
    return this;
  }

  public isPressed(): boolean {
    return this.pressed;
  }

  public setPressed(pressed: boolean): this {
    this.pressed = !!pressed;
    this.__notify();
    return this;
  }

  public addChangeListener(listener: ICEButtonModelListener): this {
    this.listeners.add(listener);
    return this;
  }

  public removeChangeListener(listener: ICEButtonModelListener): this {
    this.listeners.delete(listener);
    return this;
  }

  private __notify(): void {
    this.listeners.forEach((listener) => listener(this));
  }
}
