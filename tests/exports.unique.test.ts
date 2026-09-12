/**
 * 导出命名回归：本库的运行时导出与引擎（ice-render）**零重叠**。
 *
 * 背景：两边都用 ICE 前缀，历史上本库的 `ICEComponent` / `ICEImage` 与引擎同名不同物，
 * 同时 import 会直接撞名（Duplicate declaration）。现在本库的基类叫 `ICEWidget`、
 * 图片控件叫 `ICEImageView`，布局类直接从引擎取、本库不再重复导出 —— 这条测试守住该性质。
 */
import * as Engine from 'ice-render';
import * as Library from '../src';

describe('导出命名', () => {
  it('运行时导出与引擎无重名', () => {
    const engine = new Set(Object.keys(Engine));
    const clash = Object.keys(Library).filter((key) => engine.has(key));
    expect(clash).toEqual([]);
  });

  it('类/类型级导出（首字母大写）全部带 ICE 前缀，且不存在 UI 前缀', () => {
    const keys = Object.keys(Library);
    expect(keys.filter((key) => /^UI/.test(key))).toEqual([]);
    // 小写开头的是工具函数（createTextNode / attachTooltip / tween …），不受前缀约束
    expect(keys.filter((key) => /^[A-Z]/.test(key) && !/^ICE/.test(key))).toEqual([]);
  });

  it('与引擎同概念的名字已避开（ICEWidget / ICEImageView）', () => {
    expect(typeof (Library as any).ICEWidget).toBe('function');
    expect(typeof (Library as any).ICEImageView).toBe('function');
    expect((Library as any).ICEComponent).toBeUndefined();
    expect((Library as any).ICEImage).toBeUndefined();
  });
});
