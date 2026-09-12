import type { ICELayoutManager } from 'ice-render';
import { ICEWidget } from './ICEWidget';

export class ICEContainer extends ICEWidget {
  constructor(props: any = {}) {
    super(props);
  }

  /** 设置布局策略（引擎 ICEGroup.setLayout 的链式版本）。 */
  public setLayout(layout: ICELayoutManager): this {
    super.setLayout(layout);
    return this;
  }
}
