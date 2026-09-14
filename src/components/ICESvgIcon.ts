import { ICEPath } from 'ice-render';
import { ICEWidget } from '../core/ICEWidget';
import { iceUIManager } from '../core/ICEManager';

class ICESvgPath extends ICEPath {
  private pathData: string;
  private viewBoxSize: number;

  constructor(props: any = {}) {
    super({
      fill: false,
      stroke: true,
      ...props,
    });
    this.pathData = props.pathData || props.d || '';
    this.viewBoxSize = Number(props.viewBox) || 24;
  }

  protected createPathObject(): any {
    if (typeof (globalThis as any).Path2D !== 'function') {
      this.path2D = { _isPolyfill: true, _commands: [] };
      return this.path2D;
    }
    const source = new (globalThis as any).Path2D(this.pathData);
    const size = Number(this.state.width) || this.viewBoxSize;
    const scale = size / this.viewBoxSize;
    if (scale === 1 || typeof source.addPath !== 'function') {
      this.path2D = source;
      return this.path2D;
    }
    const scaled = new (globalThis as any).Path2D();
    const MatrixCtor = (globalThis as any).DOMMatrix;
    if (MatrixCtor) {
      scaled.addPath(source, new MatrixCtor().scale(scale));
    } else {
      scaled.addPath(source, { a: scale, b: 0, c: 0, d: scale, e: 0, f: 0 });
    }
    this.path2D = scaled;
    return this.path2D;
  }
}

/**
 * SVG 路径图标：给一段 `d` 路径数据，按 `viewBox` 缩放到目标尺寸并描边。
 */
export class ICESvgIcon extends ICEWidget {
  private pathNode: any;

  constructor(props: any = {}) {
    const theme = iceUIManager.getTheme();
    const size = props.size || 24;
    super({
      fill: false,
      stroke: false,
      width: size,
      height: size,
      ...props,
    });
    this.pathNode = new ICESvgPath({
      // ICE 组件默认原点在本地中心（origin: 'localCenter'），而 SVG 路径数据
      // 是以 viewBox 左上角为 (0,0) 的。若不改原点，整条路径会向右下偏移半个图标，
      // 溢出图标盒并压到右侧文字上。
      origin: 'top-left',
      left: 0,
      top: 0,
      width: size,
      height: size,
      pathData: props.d || props.path || '',
      viewBox: props.viewBox || 24,
      style: {
        strokeStyle: props.color || theme.colors.text,
        lineWidth: props.strokeWidth || 1.6,
        fillStyle: 'none',
        ...(props.style || {}),
      },
    });
    this.addChild(this.pathNode, false);
  }

  public setColor(color: string): this {
    this.pathNode.setState({
      style: {
        ...this.pathNode.state.style,
        strokeStyle: color,
      },
    });
    this.revalidate();
    return this;
  }

  public setStrokeWidth(width: number): this {
    this.pathNode.setState({
      style: {
        ...this.pathNode.state.style,
        lineWidth: Number(width) || 0,
      },
    });
    this.revalidate();
    return this;
  }

  /** 换一段路径数据（不重建组件，适合「图标随状态变」）。 */
  public setPath(d: string): this {
    this.pathNode.setState({ pathData: String(d || '') });
    this.revalidate();
    return this;
  }

  public getPath(): string {
    return String(this.pathNode.state.pathData || '');
  }

  public getPathNode(): any {
    return this.pathNode;
  }
}
