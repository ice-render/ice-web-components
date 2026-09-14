import { ICEWidget } from '../core/ICEWidget';
import { ICELabel } from './ICELabel';
import { iceUIManager } from '../core/ICEManager';
import { estimateTextWidth } from '../util/ICEStyle';

/**
 * 水印：把一段旋转文字平铺在自己的区域上。
 *
 * - 用于「内部资料 / 草稿 / 不可外传」这类页面级标记；
 * - 不参与交互（`interactive: false`），不会挡住底下的点击；
 * - 裁剪在自己的区域内（`clipChildren`）：边缘瓦片被切掉半截，不会溢出到邻居身上；
 * - 瓦片数量 = `(⌈width/gapX⌉ + 1) × (⌈height/gapY⌉ + 1)`，`gap` 不传时按文字宽度自适应；
 * - 颜色默认半透明灰（`rgba(0,0,0,0.08)`），可用 `color` / `opacity` 调整。
 */
export interface ICEWatermarkOptions {
  /** 组件 id（引擎会用它做唯一标识，e2e/调试时可按 id 定位） */
  id?: string;
  text: string;
  fontSize?: number;
  /** 文字颜色，默认 `rgba(0,0,0,0.08)` */
  color?: string;
  /** 整体不透明度，默认 1（颜色本身已经半透明） */
  opacity?: number;
  /** 旋转角度（度），默认 -22 */
  rotate?: number;
  /** 水平间距，默认按文字宽度 + 60 自适应 */
  gapX?: number;
  /** 垂直间距，默认 72 */
  gapY?: number;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
}

export class ICEWatermark extends ICEWidget {
  private text: string;
  private fontSize: number;
  private color: string;
  private rotate: number;
  private gapX: number;
  private gapY: number;
  private opacity: number;
  private tiles: ICELabel[] = [];

  constructor(props: ICEWatermarkOptions) {
    const theme = iceUIManager.getTheme();
    const fontSize = props.fontSize ?? 14;
    const text = String(props.text ?? '');
    super({
      id: props.id,
      fill: false,
      stroke: false,
      interactive: false,
      draggable: false,
      // 边缘瓦片会超出自身盒子，必须裁掉（否则水印会糊到旁边的组件上）
      clipChildren: true,
      left: props.left,
      top: props.top,
      width: props.width ?? 400,
      height: props.height ?? 200,
    });
    this.text = text;
    this.fontSize = fontSize;
    this.color = props.color ?? 'rgba(0,0,0,0.08)';
    this.rotate = props.rotate ?? -22;
    this.gapX = Number(props.gapX) || Math.round(estimateTextWidth(text, fontSize) + 60);
    this.gapY = Number(props.gapY) || 72;
    this.opacity = props.opacity ?? 1;
    this.__render();
  }

  public getText(): string {
    return this.text;
  }

  public getTileCount(): number {
    return this.tiles.length;
  }

  public getTileNodes(): ICELabel[] {
    return this.tiles.slice();
  }

  public setText(text: string): this {
    this.text = String(text ?? '');
    this.tiles.forEach((tile) => tile.setText(this.text));
    this.revalidate();
    return this;
  }

  /** 改尺寸后重排瓦片（数量跟着变）。 */
  public setSize(width: number, height: number): this {
    this.setState({ width: Math.max(0, Number(width) || 0), height: Math.max(0, Number(height) || 0) });
    this.__render();
    return this;
  }

  private __render(): void {
    const theme = iceUIManager.getTheme();
    this.removeChildren([...this.childNodes]);
    this.tiles = [];
    const width = Number(this.state.width) || 0;
    const height = Number(this.state.height) || 0;
    const gapX = Math.max(20, this.gapX);
    const gapY = Math.max(20, this.gapY);
    const cols = Math.ceil(width / gapX) + 1;
    const rows = Math.ceil(height / gapY) + 1;
    const textWidth = estimateTextWidth(this.text, this.fontSize);
    const textHeight = this.fontSize + 6;

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const tile = new ICELabel({
          interactive: false,
          left: col * gapX - Math.round(gapX / 2),
          top: row * gapY - Math.round(gapY / 2),
          width: textWidth,
          height: textHeight,
          text: this.text,
          verticalAlign: 'middle',
          opacity: this.opacity,
          transform: { rotate: this.rotate },
          style: {
            fontSize: this.fontSize,
            fontFamily: theme.font.family,
            fillStyle: this.color,
          },
        });
        this.addChild(tile, false);
        this.tiles.push(tile);
      }
    }
    this.revalidate();
    if (this.ice) {
      this.ice.dirty = true;
    }
  }
}
