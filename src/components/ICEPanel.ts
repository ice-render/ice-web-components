import { ICEContainer } from '../core/ICEContainer';
import { iceUIManager } from '../core/ICEManager';

export class ICEPanel extends ICEContainer {
  constructor(props: any = {}) {
    const theme = iceUIManager.getTheme();
    super({
      ...props,
      fill: true,
      stroke: true,
      radius: props.radius ?? theme.radius.lg,
      style: {
        fillStyle: theme.colors.surface,
        strokeStyle: theme.colors.border,
        lineWidth: theme.control.lineWidth,
        ...theme.shadows.sm,
        ...(props.style || {}),
      },
    });
  }
}
