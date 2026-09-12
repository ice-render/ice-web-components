/**
 * UIImage 单测（图片展示 + 适配模式）。
 *
 * 规格：
 * - `computeFit` 按 fill/contain/cover 算出内容矩形（contain/cover 居中）；
 * - 构造出图片原语（ICEImage），src 可读写；
 * - 未知原始尺寸时内容矩形 = 容器盒；`setNaturalSize` 后按 fit 重排；
 * - 载入失败标记错误态；视口开启 clipChildren（cover 超出的部分被裁掉）。
 */
import { UIImage } from '../src/components/UIImage';

describe('UIImage', () => {
  it('computeFit：fill / contain / cover 三种适配', () => {
    const fill = UIImage.computeFit(200, 100, 100, 100, 'fill');
    expect(fill).toEqual({ left: 0, top: 0, width: 100, height: 100 });

    const contain = UIImage.computeFit(200, 100, 100, 100, 'contain');
    expect(contain).toEqual({ left: 0, top: 25, width: 100, height: 50 });

    const cover = UIImage.computeFit(200, 100, 100, 100, 'cover');
    expect(cover).toEqual({ left: -50, top: 0, width: 200, height: 100 });
  });

  it('construct 出图片原语，src 可读写，默认未加载', () => {
    const image = new UIImage({ src: 'a.png', width: 120, height: 80 });
    expect(image.getSrc()).toBe('a.png');
    expect(image.getImageNode()).not.toBeNull();
    expect(image.getImageNode()!.state.src).toBe('a.png');
    expect(image.isLoaded()).toBe(false);
    expect(image.isErrored()).toBe(false);
    expect(image.getFit()).toBe('fill');
    image.setSrc('b.png');
    expect(image.getSrc()).toBe('b.png');
    expect(image.getImageNode()!.state.src).toBe('b.png');
  });

  it('未知原始尺寸时占满容器盒；setNaturalSize 后按 fit 重排', () => {
    const image = new UIImage({ src: 'a.png', width: 100, height: 100, fit: 'contain' });
    expect(image.getContentBox()).toEqual({ left: 0, top: 0, width: 100, height: 100 });

    image.setNaturalSize(200, 100);
    expect(image.isLoaded()).toBe(true);
    expect(image.getContentBox()).toEqual({ left: 0, top: 25, width: 100, height: 50 });
    expect(image.getImageNode()!.state.left).toBe(0);
    expect(image.getImageNode()!.state.top).toBe(25);
    expect(image.getImageNode()!.state.width).toBe(100);
    expect(image.getImageNode()!.state.height).toBe(50);
  });

  it('setFit 切换适配模式；视口开启 clipChildren；错误态', () => {
    const image = new UIImage({ src: 'a.png', width: 100, height: 100, fit: 'contain' });
    image.setNaturalSize(200, 100);
    const viewport = image.getViewportNode()!;
    expect(viewport.state.clipChildren).toBe(true);
    expect(viewport.state.interactive).toBe(false);

    image.setFit('cover');
    expect(image.getFit()).toBe('cover');
    expect(image.getContentBox()).toEqual({ left: -50, top: 0, width: 200, height: 100 });

    image.markError();
    expect(image.isErrored()).toBe(true);
    expect(image.isLoaded()).toBe(false);
  });
});
