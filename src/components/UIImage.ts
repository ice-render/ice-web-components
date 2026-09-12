import { ICEImage } from 'ice-render';
import { UIComponent } from '../core/UIComponent';
import { uiManager } from '../core/UIManager';

/**
 * 图片（业界组件库 Image 的最小版，基于引擎原语 `ICEImage`）。
 *
 * - 适配模式 `fill`（拉伸）/ `contain`（留白）/ `cover`（裁剪填满，居中）；
 * - 原始尺寸未知时先按容器盒铺满，图片载入后由引擎的 ImageCache 回调重排；
 * - 视口开 `clipChildren`，cover 溢出的部分被裁掉；
 * - 载入失败标记错误态（保留占位底）。
 */
export type UIImageFit = 'fill' | 'contain' | 'cover';

export interface UIImageOptions {
  src?: string;
  width?: number;
  height?: number;
  fit?: UIImageFit;
  /** 底衬颜色（未加载 / 加载失败时可见） */
  placeholder?: string;
  left?: number;
  top?: number;
}

export interface UIImageContentBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export class UIImage extends UIComponent {
  private src: string;
  private fit: UIImageFit;
  private natural: { width: number; height: number } | null = null;
  private errored = false;
  private viewport: UIComponent | null = null;
  private imageNode: ICEImage | null = null;
  private hookedSrc: string | null = null;

  constructor(props: UIImageOptions = {}) {
    const theme = uiManager.getTheme();
    const width = props.width ?? 120;
    const height = props.height ?? 80;
    super({
      fill: true,
      stroke: false,
      left: props.left,
      top: props.top,
      width,
      height,
      style: { fillStyle: props.placeholder || theme.colors.borderSecondary },
    });
    this.src = props.src ?? '';
    this.fit = props.fit || 'fill';
    this.__render();
  }

  protected afterAddHandler(): void {
    super.afterAddHandler();
    this.__syncFromCache();
  }

  /** 按 fill/contain/cover 计算内容矩形（原始尺寸未知时铺满容器盒）。 */
  public static computeFit(
    naturalWidth: number,
    naturalHeight: number,
    boxWidth: number,
    boxHeight: number,
    fit: UIImageFit,
  ): UIImageContentBox {
    if (fit === 'fill' || !naturalWidth || !naturalHeight) {
      return { left: 0, top: 0, width: boxWidth, height: boxHeight };
    }
    const scale =
      fit === 'contain'
        ? Math.min(boxWidth / naturalWidth, boxHeight / naturalHeight)
        : Math.max(boxWidth / naturalWidth, boxHeight / naturalHeight);
    const width = naturalWidth * scale;
    const height = naturalHeight * scale;
    return { left: (boxWidth - width) / 2, top: (boxHeight - height) / 2, width, height };
  }

  public getSrc(): string {
    return this.src;
  }

  public setSrc(src: string): this {
    const next = src ?? '';
    if (this.src === next) {
      return this;
    }
    this.src = next;
    this.natural = null;
    this.errored = false;
    this.hookedSrc = null;
    if (this.imageNode) {
      this.imageNode.setState({ src: next });
    }
    this.__layout();
    this.__syncFromCache();
    this.revalidate();
    return this;
  }

  public getFit(): UIImageFit {
    return this.fit;
  }

  public setFit(fit: UIImageFit): this {
    if (this.fit === fit) {
      return this;
    }
    this.fit = fit;
    this.__layout();
    this.revalidate();
    return this;
  }

  public isLoaded(): boolean {
    return !this.errored && this.natural !== null;
  }

  public isErrored(): boolean {
    return this.errored;
  }

  public markError(): this {
    this.errored = true;
    this.natural = null;
    this.__layout();
    this.revalidate();
    return this;
  }

  /** 已知原始尺寸时直接设定（图片 onload 回调 / 单测使用）。 */
  public setNaturalSize(width: number, height: number): this {
    const w = Number(width) || 0;
    const h = Number(height) || 0;
    if (!w || !h) {
      return this;
    }
    this.natural = { width: w, height: h };
    this.errored = false;
    this.__layout();
    this.revalidate();
    return this;
  }

  public getContentBox(): UIImageContentBox {
    return this.__computeContentBox();
  }

  public getViewportNode(): UIComponent | null {
    return this.viewport;
  }

  public getImageNode(): ICEImage | null {
    return this.imageNode;
  }

  private __render(): void {
    this.removeChildren([...this.childNodes]);
    const width = Number(this.state.width) || 120;
    const height = Number(this.state.height) || 80;
    // 视口负责裁剪：cover 时内容比容器大，只在视口内可见
    const viewport = new UIComponent({
      left: 0,
      top: 0,
      width,
      height,
      fill: false,
      stroke: false,
      interactive: false,
      clipChildren: true,
    });
    const imageNode = new ICEImage({
      left: 0,
      top: 0,
      width,
      height,
      src: this.src,
    });
    viewport.addChild(imageNode, false);
    this.addChild(viewport, false);
    this.viewport = viewport;
    this.imageNode = imageNode;
    this.__layout();
  }

  private __layout(): void {
    if (!this.imageNode) {
      return;
    }
    const box = this.__computeContentBox();
    this.imageNode.setState({
      left: box.left,
      top: box.top,
      width: box.width,
      height: box.height,
    });
  }

  private __computeContentBox(): UIImageContentBox {
    const width = Number(this.state.width) || 120;
    const height = Number(this.state.height) || 80;
    const natural = this.natural;
    if (!natural) {
      return { left: 0, top: 0, width, height };
    }
    return UIImage.computeFit(natural.width, natural.height, width, height, this.fit);
  }

  /** 图片就绪后按原始尺寸重排（引擎 ImageCache 负责真实加载）。 */
  private __syncFromCache(): void {
    const ice: any = this.ice;
    if (!this.src || !ice || !ice.imageCache || this.hookedSrc === this.src) {
      return;
    }
    this.hookedSrc = this.src;
    const srcAtRequest = this.src;
    const { loaded, image } = ice.imageCache.setImage(this.src);
    const apply = () => {
      if (this.src !== srcAtRequest) {
        return;
      }
      if (image.naturalWidth > 0) {
        this.setNaturalSize(image.naturalWidth, image.naturalHeight);
      }
    };
    if (loaded) {
      apply();
      return;
    }
    if (image && typeof image.addEventListener === 'function') {
      image.addEventListener('load', apply);
      image.addEventListener('error', () => {
        if (this.src === srcAtRequest) {
          this.markError();
        }
      });
    }
  }
}
