import type { ICELayoutManager } from 'ice-render';
import { ICEComponent } from './ICEComponent';

export class ICEContainer extends ICEComponent {
  constructor(props: any = {}) {
    super(props);
  }

  /** 设置布局策略（引擎 ICEGroup.setLayout 的链式版本）。 */
  public setLayout(layout: ICELayoutManager): this {
    super.setLayout(layout);
    return this;
  }
}
