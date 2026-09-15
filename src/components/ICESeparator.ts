import { ICERect } from 'ice-render';
import { ICEWidget } from '../core/ICEWidget';
import { iceUIManager } from '../core/ICEManager';

/**
 * 分隔线：1px 的水平或垂直分隔。
 */
export class ICESeparator extends ICEWidget {
  private line: any;

  constructor(props: any = {}) {
    const theme = iceUIManager.getTheme();
    super({
      fill: false,
      stroke: false,
      ...props,
    });
    this.line = new ICERect({
      left: 0,
      top: 0,
      width: props.width || 1,
      height: props.height || 1,
      style: {
        fillStyle: theme.colors.border,
        strokeStyle: theme.colors.border,
      },
    });
    this.addChild(this.line, false);
  }

  /**
   * 尺寸变化时让线铺满新的盒子（`ICEWidget.__syncInternalLayout()`）。
   *
   * 构造期把 `props.width/height` 当成了线的长度就再没对过账：父层布局改尺寸后
   * 线还是旧长度 —— 分隔线要么短一截、要么直接画到邻居身上（等分网格里必现）。
   */
  protected __syncInternalLayout(): void {
    if (!this.line) {
      return;
    }
    this.line.setState({
      left: 0,
      top: 0,
      width: Number(this.state.width) || 0,
      height: Number(this.state.height) || 0,
    });
  }
}
