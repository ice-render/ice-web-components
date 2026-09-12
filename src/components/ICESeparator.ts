import { ICERect } from 'ice-render';
import { ICEComponent } from '../core/ICEComponent';
import { iceUIManager } from '../core/ICEManager';

export class ICESeparator extends ICEComponent {
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
