import { UIComponent } from './UIComponent';
import type { UILayoutManager } from './UILayoutManager';

export class UIContainer extends UIComponent {
  constructor(props: any = {}) {
    super(props);
  }

  public setUILayout(layout: UILayoutManager): this {
    this.setLayout(layout as any);
    return this;
  }
}
