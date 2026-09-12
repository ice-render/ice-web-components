/**
 * 像素画布的纯逻辑模型（不碰 canvas）。
 *
 * 用途：像素编辑器（`examples/pixel-editor.html`）。规则和渲染分家的老规矩：
 * 模型只管「一格一格的索引 + 历史 + 导出」，页面负责把它画成节点和下载文件。
 *
 * 约定：
 * - 画布是 `rows × cols` 的一维数组（行优先），存的是**调色板下标**，不是颜色字符串；
 * - `setPixel` / `drawLine` / `drawRect` / `fill` 都是「实时改动」，改完由调用方 `commit()`
 *   落一次历史 —— 一次拖动笔画 = 一次 commit = 一次撤销，而不是每个像素一次；
 * - `undo()` / `redo()` 回放**已提交的**快照（没提交的改动会被丢掉，这是编辑器的常规语义）；
 * - `toSVG()` 把同色横向连续像素合并成一个 `<rect>`（run-length），1024 格也不会吐出 1024 个元素；
 * - `toRGBA(scale)` 给页面喂 `ImageData` 用（PNG 导出），纯函数、可单测。
 */
import { ICEPixelModel } from '../src/model/ICEPixelModel';

const SMALL = { rows: 4, cols: 4, palette: ['#000000', '#ff0000', '#00ff00'], background: 0 };

/** 画布上有多少个非背景像素。 */
const painted = (model: ICEPixelModel) => model.getCells().filter((value) => value !== model.getBackground()).length;

describe('画布与调色板', () => {
  it('新画布：全是背景色索引，行列与调色板可读', () => {
    const model = new ICEPixelModel(SMALL);
    expect(model.getRows()).toBe(4);
    expect(model.getCols()).toBe(4);
    expect(model.getCells()).toHaveLength(16);
    expect(model.getCells().every((value) => value === 0)).toBe(true);
    expect(model.getPalette()).toEqual(['#000000', '#ff0000', '#00ff00']);
    expect(model.getBackground()).toBe(0);
    expect(model.isDirty()).toBe(false);
  });

  it('setPixel：画上 / 擦掉 / 越界都不抛，值没变就不算改动', () => {
    const model = new ICEPixelModel(SMALL);
    expect(model.setPixel(1, 2, 1)).toBe(true);
    expect(model.getPixel(1, 2)).toBe(1);
    expect(model.setPixel(1, 2, 1)).toBe(false); // 已经是这个颜色
    expect(model.setPixel(1, 2, 0)).toBe(true);
    expect(model.getPixel(1, 2)).toBe(0);
    expect(model.setPixel(-1, 0, 1)).toBe(false);
    expect(model.setPixel(0, 99, 1)).toBe(false);
  });

  it('非法调色板下标一律当背景处理（不会画出不存在的颜色）', () => {
    const model = new ICEPixelModel(SMALL);
    model.setPixel(0, 0, 99);
    expect(model.getPixel(0, 0)).toBe(0);
  });
});

describe('历史：一次笔画一次撤销', () => {
  it('多个 setPixel 只 commit 一次 → undo 全部退回', () => {
    const model = new ICEPixelModel(SMALL);
    model.setPixel(0, 0, 1);
    model.setPixel(0, 1, 1);
    model.setPixel(0, 2, 1);
    expect(model.isDirty()).toBe(true);
    expect(model.canUndo()).toBe(false); // 还没提交
    model.commit();
    expect(model.isDirty()).toBe(false);
    expect(model.canUndo()).toBe(true);
    expect(painted(model)).toBe(3);

    expect(model.undo()).toBe(true);
    expect(painted(model)).toBe(0);
    expect(model.redo()).toBe(true);
    expect(painted(model)).toBe(3);
  });

  it('commit 没有变化时不入栈（不会攒出一堆空撤销）', () => {
    const model = new ICEPixelModel(SMALL);
    model.commit();
    expect(model.canUndo()).toBe(false);
    model.setPixel(0, 0, 1);
    model.commit();
    model.commit();
    expect(model.getHistoryDepth()).toEqual({ undo: 1, redo: 0 });
  });

  it('undo / redo 到边界返回 false，画布不动', () => {
    const model = new ICEPixelModel(SMALL);
    expect(model.undo()).toBe(false);
    expect(model.redo()).toBe(false);
    model.setPixel(0, 0, 2);
    model.commit();
    expect(model.undo()).toBe(true);
    expect(model.undo()).toBe(false);
    expect(model.getPixel(0, 0)).toBe(0);
    expect(model.redo()).toBe(true);
    expect(model.redo()).toBe(false);
    expect(model.getPixel(0, 0)).toBe(2);
  });

  it('clear / fill / 图形绘制都进历史（顺序撤销能一步步退回去）', () => {
    const model = new ICEPixelModel(SMALL);
    model.clear(1);
    model.commit();
    model.drawRect(0, 0, 2, 2, 2);
    model.commit();
    expect(model.getPixel(0, 0)).toBe(2);
    expect(model.getPixel(1, 1)).toBe(1); // 矩形是描边，不是实心
    model.undo();
    expect(model.getPixel(0, 0)).toBe(1);
    model.undo();
    expect(painted(model)).toBe(0);
  });
});

describe('绘制工具', () => {
  it('drawLine 走 Bresenham：横线 / 竖线 / 斜线的像素数都对', () => {
    const model = new ICEPixelModel({ rows: 8, cols: 8, palette: ['#000', '#fff'], background: 0 });
    model.drawLine(0, 0, 0, 3, 1);
    expect(painted(model)).toBe(4);
    model.drawLine(2, 0, 2, 3, 1);
    expect(painted(model)).toBe(8);
    model.clear(0);
    model.drawLine(0, 0, 3, 3, 1);
    expect(painted(model)).toBe(4);
    expect(model.getPixel(0, 0)).toBe(1);
    expect(model.getPixel(3, 3)).toBe(1);
  });

  it('drawRect 只画描边（4×4 的框是 12 个像素）', () => {
    const model = new ICEPixelModel({ rows: 6, cols: 6, palette: ['#000', '#fff'], background: 0 });
    model.drawRect(1, 1, 4, 4, 1);
    expect(painted(model)).toBe(12);
    expect(model.getPixel(1, 1)).toBe(1);
    expect(model.getPixel(4, 4)).toBe(1);
    expect(model.getPixel(2, 2)).toBe(0);
  });

  it('getLineCells / getRectCells：预览用的坐标，和真正落笔的是同一套', () => {
    const model = new ICEPixelModel({ rows: 8, cols: 8, palette: ['#000', '#fff'], background: 0 });
    expect(model.getLineCells(0, 0, 0, 3)).toHaveLength(4);
    expect(model.getLineCells(0, 0, 3, 3)).toEqual([
      [0, 0],
      [1, 1],
      [2, 2],
      [3, 3],
    ]);
    const rect = model.getRectCells(1, 1, 4, 4);
    expect(rect).toHaveLength(12);
    // 预览坐标直接喂给 drawLine / drawRect，画出来的像素数必须一致
    const preview = new ICEPixelModel({ rows: 8, cols: 8, palette: ['#000', '#fff'], background: 0 });
    rect.forEach(([row, col]) => preview.setPixel(row, col, 1));
    model.drawRect(1, 1, 4, 4, 1);
    expect(preview.getCells()).toEqual(model.getCells());
  });

  it('fill 是四邻域油漆桶：墙里填满、墙外不动，目标和填充色相同就直接返回 false', () => {
    const model = new ICEPixelModel({ rows: 6, cols: 6, palette: ['#000', '#fff', '#f00'], background: 0 });
    model.drawRect(1, 1, 4, 4, 1); // 一堵 4×4 的墙，内部 2×2
    model.commit();
    expect(model.fill(2, 2, 2)).toBe(true);
    expect(model.getPixel(2, 2)).toBe(2);
    expect(model.getPixel(3, 3)).toBe(2);
    expect(model.getPixel(0, 0)).toBe(0); // 墙外没被淹
    expect(painted(model)).toBe(16);

    expect(model.fill(2, 2, 2)).toBe(false); // 已经是这个颜色
    expect(model.fill(0, 0, 0)).toBe(false); // 目标和填充色相同
  });
});

describe('导出', () => {
  it('toSVG：同色连续像素合并成一个 rect，尺寸与背景都在', () => {
    const model = new ICEPixelModel({ rows: 2, cols: 4, palette: ['#ffffff', '#ff0000'], background: 0 });
    model.drawLine(0, 0, 0, 3, 1); // 一整行红
    const svg = model.toSVG({ cellSize: 10 });
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('viewBox="0 0 40 20"');
    expect(svg).toContain('width="40"');
    expect(svg).toContain('height="20"');
    expect(svg).toContain('fill="#ffffff"'); // 背景
    const rects = svg.match(/<rect /g) || [];
    expect(rects).toHaveLength(2); // 背景 + 合并后的那一行
    expect(svg).toContain('x="0" y="0" width="40" height="10" fill="#ff0000"');
  });

  it('toSVG：断开的同色像素不会被合并（不是简单按行去重）', () => {
    const model = new ICEPixelModel({ rows: 1, cols: 4, palette: ['#ffffff', '#ff0000'], background: 0 });
    model.setPixel(0, 0, 1);
    model.setPixel(0, 2, 1);
    const svg = model.toSVG({ cellSize: 4 });
    expect((svg.match(/<rect /g) || []).length).toBe(3); // 背景 + 两段
  });

  it('toRGBA：给 ImageData 喂数据，scale 会把每个像素放大', () => {
    const model = new ICEPixelModel({ rows: 1, cols: 2, palette: ['#000000', '#ff8000'], background: 0 });
    model.setPixel(0, 1, 1);
    const rgba = model.toRGBA();
    expect(rgba).toHaveLength(2 * 1 * 4);
    expect(Array.from(rgba.slice(0, 4))).toEqual([0, 0, 0, 255]);
    expect(Array.from(rgba.slice(4, 8))).toEqual([255, 128, 0, 255]);

    const scaled = model.toRGBA(2);
    expect(scaled).toHaveLength(4 * 2 * 4);
    // 放大 2 倍之后：第 0 行 = [黑 黑 橙 橙]，橙色从第 2 个像素开始（字节 8）
    expect(Array.from(scaled.slice(0, 4))).toEqual([0, 0, 0, 255]);
    expect(Array.from(scaled.slice(8, 12))).toEqual([255, 128, 0, 255]);
  });

  it('toJSON / fromJSON：往返之后画布一模一样（含尺寸与调色板）', () => {
    const model = new ICEPixelModel(SMALL);
    model.drawLine(0, 0, 3, 0, 1);
    model.commit();
    const json = model.toJSON();
    expect(json).toContain('"rows":4');
    const restored = ICEPixelModel.fromJSON(json);
    expect(restored.getRows()).toBe(4);
    expect(restored.getCols()).toBe(4);
    expect(restored.getPalette()).toEqual(['#000000', '#ff0000', '#00ff00']);
    expect(restored.getCells()).toEqual(model.getCells());
  });

  it('fromJSON 遇到坏数据抛一个能看懂的错（不静默画白板）', () => {
    expect(() => ICEPixelModel.fromJSON('{')).toThrow(/像素画布/);
    expect(() => ICEPixelModel.fromJSON('{"rows":4,"cols":4}')).toThrow(/像素画布/);
  });
});

describe('变更通知', () => {
  it('setPixel / commit / undo / 换尺寸都会通知，取消订阅后不再通知', () => {
    const model = new ICEPixelModel(SMALL);
    let count = 0;
    const off = model.addChangeListener(() => { count += 1; });
    model.setPixel(0, 0, 1);
    expect(count).toBe(1);
    model.setPixel(0, 0, 1); // 没变就不通知
    expect(count).toBe(1);
    model.commit();
    expect(count).toBe(2);
    model.undo();
    expect(count).toBe(3);
    model.resize(6, 6);
    expect(count).toBe(4);
    expect(model.getRows()).toBe(6);
    off();
    model.setPixel(0, 0, 2);
    expect(count).toBe(4);
  });
});
