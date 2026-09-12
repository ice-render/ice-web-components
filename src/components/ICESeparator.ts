import { ICERect } from 'ice-render';
import { ICEWidget } from '../core/ICEWidget';
import { iceUIManager } from '../core/ICEManager';

/**
 * 分隔线：1px 的水平或垂直分隔。
 */
export class ICESeparator extends ICEWidget {
  constructor(props: any = {}) {
    const theme = iceUIManager.getTheme();
    super({
      fill: false,
      stroke: false,
      ...props,
    });
    this.addChild(
      new ICERect({
        left: 0,
        top: 0,
        width: props.width || 1,
        height: props.height || 1,
        style: {
          fillStyle: theme.colors.border,
          strokeStyle: theme.colors.border,
        },
      }),
      false,
    );
  }
}
