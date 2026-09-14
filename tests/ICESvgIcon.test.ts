/**
 * ICESvgIcon 单测（之前既没单测也没进示例，属于一条明账债）。
 *
 * 规格：
 * - 给一段 `d` 路径与 `viewBox`，按 `size` 缩放；
 * - 路径节点原点必须是 `top-left`（ICE 组件默认是中心原点，不改的话整条路径会偏移半个图标、
 *   压到右边的内容上 —— 这是踩过的坑，用一条断言钉住）；
 * - `setColor()` / `setStrokeWidth()` / `setPath()` 改完立刻反映到绘制状态；
 * - 没有 `Path2D` 的运行时（老引擎 / 测试环境）走 polyfill，不抛异常。
 */
import { ICESvgIcon } from '../src/components/ICESvgIcon';

const PATH = 'M4 12 L10 18 L20 6';

describe('ICESvgIcon', () => {
  it('按 size 定盒子，路径节点铺满并采用左上原点', () => {
    const icon = new ICESvgIcon({ size: 32, d: PATH, viewBox: 24 });
    const path = icon.childNodes[0] as any;
    expect(icon.state.width).toBe(32);
    expect(icon.state.height).toBe(32);
    expect(path.state.width).toBe(32);
    expect(path.state.height).toBe(32);
    expect(path.state.origin).toBe('top-left');
    expect(path.state.pathData).toBe(PATH);
    expect(path.state.viewBox).toBe(24);
  });

  it('兼容 `path` 别名与默认尺寸', () => {
    const icon = new ICESvgIcon({ path: PATH });
    const path = icon.childNodes[0] as any;
    expect(icon.state.width).toBe(24);
    expect(path.state.pathData).toBe(PATH);
  });

  it('颜色与描边宽度：构造期用主题文字色，setColor / setStrokeWidth 立刻生效', () => {
    const icon = new ICESvgIcon({ size: 20, d: PATH, strokeWidth: 2 });
    const path = icon.childNodes[0] as any;
    expect(path.state.style.lineWidth).toBe(2);
    icon.setColor('#ff0000');
    expect(path.state.style.strokeStyle).toBe('#ff0000');
    icon.setStrokeWidth(3.5);
    expect(path.state.style.lineWidth).toBe(3.5);
  });

  it('setPath 换图标，不重建组件', () => {
    const icon = new ICESvgIcon({ size: 20, d: PATH });
    const path = icon.childNodes[0] as any;
    icon.setPath('M2 2 L18 18');
    expect(path.state.pathData).toBe('M2 2 L18 18');
  });

  it('没有 Path2D 的运行时走 polyfill（不抛异常）', () => {
    const icon = new ICESvgIcon({ size: 20, d: PATH });
    const path = icon.childNodes[0] as any;
    expect(() => path.createPathObject()).not.toThrow();
  });

  it('空 d 不炸（占位图标）', () => {
    const icon = new ICESvgIcon({ size: 16 });
    const path = icon.childNodes[0] as any;
    expect(path.state.pathData).toBe('');
    expect(icon.state.width).toBe(16);
  });
});
