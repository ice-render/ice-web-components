export type ICEToggleModelListener = (model: ICEToggleModel) => void;

export class ICEToggleModel {
  private selected: boolean;
  private listeners = new Set<ICEToggleModelListener>();

  constructor(options: { selected?: boolean } = {}) {
    this.selected = options.selected === true;
  }

  public isSelected(): boolean {
    return this.selected;
  }

  public setSelected(selected: boolean): this {
    const next = !!selected;
    if (next === this.selected) {
      return this;
    }
    this.selected = next;
    this.__notify();
    return this;
  }

  public toggle(): this {
    return this.setSelected(!this.selected);
  }

  public addChangeListener(listener: ICEToggleModelListener): this {
    this.listeners.add(listener);
    return this;
  }

  public removeChangeListener(listener: ICEToggleModelListener): this {
    this.listeners.delete(listener);
    return this;
  }

  private __notify(): void {
    this.listeners.forEach((listener) => listener(this));
  }
}
