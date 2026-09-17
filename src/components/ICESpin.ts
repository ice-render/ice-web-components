import { ICEPath, token } from 'ice-render';
import { ICELabel } from './ICELabel';
import { ICEWidget } from '../core/ICEWidget';
import { iceUIManager } from '../core/ICEManager';

/** 旋转弧线：用 Path2D 画一段 270° 圆弧，颜色走主色。 */
class ICESpinArc extends ICEPath {
  constructor(props: any = {}) {
    super({ fill: false, stroke: true, ...props });
  }

  protected createPathObject(): any {
    const size = Number(this.state.width) || 24;
    const lineWidth = Number(this.state.style.lineWidth) || 2;
    const radius = Math.max(1, size / 2 - lineWidth / 2);
    const path = new Path2D();
    if (typeof path.arc === 'function') {
      path.arc(0, 0, radius, 0, Math.PI * 1.5);
    }
    this.path2D = path;
    return this.path2D;
  }
}

/**
 * 加载指示器：一段圆弧绕中心旋转。
 *
 * - 旋转复用引擎的动画系统（`transform.rotate` 0→360 循环），与流动虚线同一套路；
 * - `spinning: false` 停止旋转（弧线保持显示）；`tip` 可在右侧显示提示文字。
 */
export interface ICESpinOptions {
  size?: number;
  spinning?: boolean;
  tip?: string;
  color?: string;
  left?: number;
  top?: number;
}

export class ICESpin extends ICEWidget {
  private arc: ICESpinArc;
  private spinning: boolean;

  constructor(props: ICESpinOptions = {}) {
    const theme = iceUIManager.getTheme();
    const size = props.size ?? 24;
    const tip = props.tip || '';
    super({
      fill: false,
      stroke: false,
      left: props.left,
      top: props.top,
      width: size,
      height: size,
      interactive: false,
    });
    this.spinning = props.spinning !== false;
    this.arc = new ICESpinArc({
      left: 0,
      top: 0,
      width: size,
      height: size,
      style: {
        strokeStyle: props.color || token('ui.colors.primary'),
        lineWidth: Math.max(2, Math.round(size / 10)),
        lineCap: 'round',
        fillStyle: 'rgba(0,0,0,0)',
      },
    });
    this.addChild(this.arc, false);
    if (tip) {
      this.addChild(
        new ICELabel({
          interactive: false,
          left: size + 8,
          top: 0,
          height: size,
          verticalAlign: 'middle',
          text: tip,
          style: { fontSize: 12, fillStyle: token('ui.colors.textSecondary') },
        }),
        false,
      );
      this.setState({ width: size + 8 + tip.length * 12 + 4 });
    }
    if (this.spinning) {
      this.__startSpin();
    }
  }

  protected afterAddHandler(): void {
    super.afterAddHandler();
    // 构造期还没入场景（拿不到 animationManager），入场景后再注册旋转动画
    if (this.spinning) {
      this.__startSpin();
    }
  }

  public isSpinning(): boolean {
    return this.spinning;
  }

  public getArcNode(): ICESpinArc {
    return this.arc;
  }

  public setSpinning(spinning: boolean): this {
    const next = !!spinning;
    if (next === this.spinning) {
      return this;
    }
    this.spinning = next;
    if (next) {
      this.__startSpin();
    } else {
      this.__stopSpin();
    }
    return this;
  }

  private __startSpin(): void {
    this.arc.setState({ transform: { ...(this.arc.state.transform || {}), rotate: 0 } });
    // 注意：animations 的「键」就是属性路径（点号分隔），不是随便起的动画名
    this.arc.props.animations = {
      ...(this.arc.props.animations || {}),
      'transform.rotate': { from: 0, to: 360, duration: 900, loop: true },
    };
    if (this.ice && this.ice.animationManager) {
      this.ice.animationManager.add(this.arc);
    }
  }

  private __stopSpin(): void {
    if (this.arc.props.animations) {
      const animations = { ...this.arc.props.animations } as any;
      delete animations['transform.rotate'];
      this.arc.props.animations = animations;
    }
    if (this.ice && this.ice.animationManager && typeof this.ice.animationManager.remove === 'function') {
      this.ice.animationManager.remove(this.arc);
    }
  }
}
