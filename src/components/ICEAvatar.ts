import { ICEWidget } from '../core/ICEWidget';
import type { ICEPaintContext, ICEPainter } from '../core/ICEPainter';

/**
 * 头像的内部装饰（圆底 + 首字）由 painter 直接画 —— **不进 `childNodes`**。
 *
 * 迁移前这里是两个子节点（`ICECircle` + 居中文字），于是"头像"在引擎眼里是个容器：
 * 一旦有人给它挂布局，圆和文字就会被当成内容一起排掉。装饰走 painter（Swing 的
 * `ComponentUI` 位）之后，头像的 `childNodes` 为空，怎么挂布局都不会碰到装饰。
 *
 * 坐标系：`ctx` 的原点是组件本地原点（默认盒子中心），所以按"盒子左上角"画时要减 `origin`。
 */
class ICEAvatarPainter implements ICEPainter {
  /** 头像背景色（调用方显式给过就用它，否则用主题主色）。 */
  private backgroundColor: string | null;

  constructor(backgroundColor?: string) {
    this.backgroundColor = backgroundColor || null;
  }

  paint({ ctx, theme, component, origin }: ICEPaintContext): void {
    const size = Math.min(Number(component.state.width) || 0, Number(component.state.height) || 0);
    if (size <= 0 || !ctx) {
      return;
    }
    const [ox, oy] = origin;
    const radius = size / 2;
    const cx = radius - ox;
    const cy = radius - oy;
    const canSave = typeof ctx.save === 'function' && typeof ctx.restore === 'function';
    if (canSave) {
      ctx.save();
    }

    // 圆底 + 描边（描边把相邻头像分开）
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(0, radius - 1), 0, Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = this.backgroundColor || theme.colors.primary;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = theme.colors.surface;
    ctx.stroke();

    // 首字
    const text = component.getText();
    if (text) {
      ctx.fillStyle = theme.colors.primaryText;
      ctx.font = `${theme.font.weightSemibold} ${Math.round(size * 0.4)}px ${theme.font.family}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, cx, cy);
    }

    if (canSave) {
      ctx.restore();
    }
  }
}

/**
 * 文字头像：取首字母/汉字，背景色可配，自带描边把相邻头像分开。
 *
 * 装饰（圆底 + 首字）由 painter 画，组件自己只保存文本、宽高与背景色。
 */
export class ICEAvatar extends ICEWidget {
  private avatarText: string;

  constructor(props: any = {}) {
    const size = props.size || 40;
    super({
      fill: false,
      stroke: false,
      width: size,
      height: size,
      ...props,
    });
    this.avatarText = String(props.text || 'U');
    this.setPainter(new ICEAvatarPainter(props.backgroundColor));
  }

  public setText(text: string): this {
    const next = String(text || 'U');
    if (next === this.avatarText) {
      return this;
    }
    this.avatarText = next;
    this.dirty = true;
    this.revalidate();
    return this;
  }

  public getText(): string {
    return this.avatarText;
  }
}
