import { UIContainer } from '../core/UIContainer';
import { uiManager } from '../core/UIManager';

export class UIPanel extends UIContainer {
  constructor(props: any = {}) {
    const theme = uiManager.getTheme();
    super({
      fill: true,
      stroke: true,
      style: {
        fillStyle: theme.colors.surface,
        strokeStyle: theme.colors.border,
        lineWidth: 1,
        ...(props.style || {}),
      },
      ...props,
    });
  }
}
