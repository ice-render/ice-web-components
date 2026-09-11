import { ICERect } from 'ice-render';
import { UIComponent } from '../core/UIComponent';
import { uiManager } from '../core/UIManager';

export class UISeparator extends UIComponent {
  constructor(props: any = {}) {
    const theme = uiManager.getTheme();
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
