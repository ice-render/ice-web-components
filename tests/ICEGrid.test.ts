/**
 * 页面骨架：24 栅格（业界组件库 Row / Col）。
 *
 * 规格：
 * - `span` 按 24 等分，`gutter` 计在列与列之间；
 * - `offset` 左移若干格；
 * - 同一行放不下 24 格时自动换行，行高取该行最高列；
 * - 列内容通过 `content` 提供。
 */
import { ICEPanel } from '../src/components/ICEPanel';
import { ICEGrid, ICEGridCol } from '../src/components/ICEGrid';

describe('ICEGrid', () => {
  it('12 + 12：两列各占一半，中间留 gutter', () => {
    const grid = new ICEGrid({ width: 480, gutter: 16 });
    const left = new ICEGridCol({ span: 12, content: new ICEPanel({ width: 10, height: 40 }) });
    const right = new ICEGridCol({ span: 12, content: new ICEPanel({ width: 10, height: 40 }) });
    grid.addCol(left);
    grid.addCol(right);
    expect(left.state.left).toBe(0);
    expect(left.state.width).toBe(232);
    expect(right.state.left).toBe(248);
    expect(right.state.width).toBe(232);
    expect(grid.state.height).toBe(40);
    expect(left.getContent()).toBeTruthy();
  });

  it('8 + 8 + 8：三列等宽', () => {
    const grid = new ICEGrid({ width: 464, gutter: 16 });
    [0, 1, 2].forEach(() =>
      grid.addCol(new ICEGridCol({ span: 8, content: new ICEPanel({ width: 10, height: 20 }) })),
    );
    const [first, second, third] = grid.getCols();
    const colWidth = (464 - 32) / 3;
    expect(first.state.width).toBeCloseTo(colWidth, 5);
    expect(second.state.left).toBeCloseTo(colWidth + 16, 5);
    expect(third.state.left).toBeCloseTo((colWidth + 16) * 2, 5);
  });

  it('offset 左移；超过 24 格自动换行', () => {
    const grid = new ICEGrid({ width: 480, gutter: 10, gutterY: 12 });
    const first = new ICEGridCol({ span: 8, content: new ICEPanel({ width: 10, height: 30 }) });
    const second = new ICEGridCol({ span: 8, offset: 8, content: new ICEPanel({ width: 10, height: 30 }) });
    const third = new ICEGridCol({ span: 12, content: new ICEPanel({ width: 10, height: 50 }) });
    grid.addCol(first);
    grid.addCol(second);
    grid.addCol(third);
    // 该行 2 列 → 1 个 gutter；unit = (480 - 10) / 24
    const unit = (480 - 10) / 24;
    // 第二列：跳过 8 格（offset 8），起点 = (8+8) 格宽 + 一格 gutter
    expect(second.state.left).toBeCloseTo(16 * unit + 10, 3);
    // 第三个 12 格放不下（8+8+8=24），换行到第二行
    expect(third.state.top).toBe(30 + 12);
    expect(grid.state.height).toBe(30 + 12 + 50);
  });

  it('addCol 返回自身便于链式；列里的内容按列宽排', () => {
    const grid = new ICEGrid({ width: 240, gutter: 0 });
    const content = new ICEPanel({ width: 0, height: 20 });
    const col = new ICEGridCol({ span: 24, content });
    expect(grid.addCol(col)).toBe(grid);
    expect(col.state.width).toBe(240);
    expect(content.state.width).toBe(240);
  });
});
