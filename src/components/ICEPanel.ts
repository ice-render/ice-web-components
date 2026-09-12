import { ICEContainer } from '../core/ICEContainer';
import { iceUIManager } from '../core/ICEManager';

/**
 * 面板：带填充、描边、圆角与阴影的基础容器，业务页面的“卡片底座”。
 */
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
