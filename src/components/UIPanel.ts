import { UIContainer } from '../core/UIContainer';
import { uiManager } from '../core/UIManager';

export class UIPanel extends UIContainer {
  constructor(props: any = {}) {
    const theme = uiManager.getTheme();
    super({
      ...props,
      fill: true,
      stroke: true,
      radius: props.radius ?? theme.radius.lg,
      style: {
        fillStyle: theme.colors.surface,
        strokeStyle: theme.colors.border,
        lineWidth: theme.control.lineWidth,
        shadow: theme.shadows.sm,
        ...(props.style || {}),
      },
    });
  }
}
