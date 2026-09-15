/**
 * 虚拟列表规格（大数据的正确打开方式：只渲染可视区）。
 *
 * 分两层测：
 * 1. `computeVirtualRange` —— 纯函数，算「该渲染哪一段」：缓冲、贴底、空列表、越界全在这里守；
 * 2. `ICEVirtualList` —— 组件层：一万条数据也只保留「可视区 + 缓冲」个节点，
 *    滚动 / `scrollToIndex` 后窗口跟着动，节点数始终有上界（这条能抓「滚动泄漏节点」）。
 */
import { ICEVirtualList, computeVirtualRange } from '../src/components/ICEVirtualList';

describe('computeVirtualRange（纯窗口计算）', () => {
  const base = { viewportHeight: 300, itemHeight: 30, itemCount: 1000, buffer: 0 };

  it('顶部窗口：正好一屏，end 是开区间', () => {
    expect(computeVirtualRange({ ...base, scrollTop: 0 })).toEqual({ start: 0, end: 10, count: 10 });
  });

  it('滚动到中间：窗口跟着走，且包含半露出的那一条', () => {
    expect(computeVirtualRange({ ...base, scrollTop: 300 })).toEqual({ start: 10, end: 20, count: 10 });
    expect(computeVirtualRange({ ...base, scrollTop: 315 })).toEqual({ start: 10, end: 21, count: 11 });
  });

  it('缓冲：上下各多渲染 buffer 条', () => {
    expect(computeVirtualRange({ ...base, scrollTop: 300, buffer: 2 })).toEqual({ start: 8, end: 22, count: 14 });
  });

  it('贴顶 / 贴底都不越界，空列表给空窗口', () => {
    expect(computeVirtualRange({ ...base, scrollTop: 0, buffer: 5 })).toEqual({ start: 0, end: 15, count: 15 });
    const bottom = computeVirtualRange({ ...base, scrollTop: 1000 * 30, buffer: 2 });
    expect(bottom.end).toBe(1000);
    expect(bottom.start).toBeGreaterThan(980);
    expect(computeVirtualRange({ ...base, itemCount: 0 })).toEqual({ start: 0, end: 0, count: 0 });
  });

  it('非法入参按最保守的方式处理（不抛、不返回负区间）', () => {
    expect(computeVirtualRange({ viewportHeight: 0, itemHeight: 30, itemCount: 10 })).toEqual({ start: 0, end: 0, count: 0 });
    expect(computeVirtualRange({ viewportHeight: 300, itemHeight: 0, itemCount: 10 })).toEqual({ start: 0, end: 0, count: 0 });
    expect(computeVirtualRange({ viewportHeight: 300, itemHeight: 30, itemCount: -5 })).toEqual({ start: 0, end: 0, count: 0 });
    expect(computeVirtualRange({ viewportHeight: 300, itemHeight: 30, itemCount: 10, scrollTop: -100 })).toEqual({ start: 0, end: 10, count: 10 });
  });
});

describe('ICEVirtualList（组件）', () => {
  const makeList = (options: any = {}) =>
    new ICEVirtualList({
      width: 320,
      height: 300,
      itemHeight: 30,
      renderItem: (index: number) => ({ index }),
      ...options,
    });

  it('一万条数据只渲染可视区（节点数有上界）', () => {
    const list = makeList({ buffer: 2 });
    list.setItems(Array.from({ length: 10000 }, (_, i) => i));
    expect(list.getItemCount()).toBe(10000);
    const range = list.getRange();
    expect(range.start).toBe(0);
    // 顶部没有「上方缓冲」，所以是 10 条可视 + 2 条缓冲
    expect(range.count).toBe(12);
    expect(list.getRenderedCount()).toBe(12);
    expect(list.getContentHeight()).toBe(300000);
  });

  it('滚动只换窗口，不增长节点数', () => {
    const VISIBLE = 10; // 300 / 30
    const BOUND = VISIBLE + 2 * 2 + 1; // 可视区 + 上下缓冲 + 半露出的一条
    const list = makeList({ buffer: 2 });
    list.setItems(Array.from({ length: 10000 }, (_, i) => i));
    for (let y = 0; y <= 3000; y += 500) {
      list.setScrollTop(y);
      expect(list.getRenderedCount()).toBeGreaterThanOrEqual(VISIBLE);
      expect(list.getRenderedCount()).toBeLessThanOrEqual(BOUND);
    }
    list.setScrollTop(299985);
    expect(list.getRenderedCount()).toBeLessThanOrEqual(BOUND);
    expect(list.getRange().end).toBe(10000);
  });

  it('renderItem 拿到「数据下标 + 行矩形」（自己画，不再给节点）', () => {
    const painted: Array<{ index: number; y: number; width: number; height: number }> = [];
    const list = makeList({
      buffer: 0,
      renderItem: (context: any) =>
        painted.push({ index: context.index, y: context.y, width: context.width, height: context.height }),
    });
    list.setItems(Array.from({ length: 100 }, (_, i) => '第' + i + '条'));
    list.setScrollTop(300);
    painted.length = 0; // 只看这一次绘制
    list.paintItems({}, [0, 0]); // 单测直接调绘制；装配期不碰 ctx，只把行矩形交出去
    expect(painted.map((entry) => entry.index)).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
    expect(painted[0].y).toBe(10 * 30); // 位置按下标 × 行高（已含滚动偏移的坐标系）
    expect(painted[0].height).toBe(30);
    expect(painted[0].width).toBe(320);
  });

  it('行不再建节点：一万条数据也是 0 个行节点（内容盒永远是空的）', () => {
    const list = makeList({ buffer: 2 });
    list.setItems(Array.from({ length: 10000 }, (_, i) => i));
    expect(list.childNodes).toHaveLength(1); // 只有滚动视口
    expect((list.getScrollPane().getContent() as any).childNodes).toHaveLength(0);
    list.setScrollTop(3000);
    expect((list.getScrollPane().getContent() as any).childNodes).toHaveLength(0);
  });

  it('scrollToIndex 把目标滚进视口（贴顶），并夹在范围内', () => {
    const list = makeList({ buffer: 0 });
    list.setItems(Array.from({ length: 1000 }, (_, i) => i));
    list.scrollToIndex(500);
    expect(list.getScrollTop()).toBe(500 * 30);
    expect(list.getRange().start).toBe(500);
    list.scrollToIndex(9999);
    expect(list.getScrollTop()).toBe(1000 * 30 - 300);
    expect(list.getRange().end).toBe(1000);
    list.scrollToIndex(-3);
    expect(list.getScrollTop()).toBe(0);
  });

  it('数据变少 / 清空时窗口跟着收，不残留旧节点', () => {
    const list = makeList({ buffer: 0 });
    list.setItems(Array.from({ length: 1000 }, (_, i) => i));
    expect(list.getRenderedCount()).toBe(10);
    list.setItems([1, 2, 3]);
    expect(list.getItemCount()).toBe(3);
    expect(list.getRenderedCount()).toBe(3);
    list.setItems([]);
    expect(list.getRenderedCount()).toBe(0);
    expect(list.getContentHeight()).toBe(0);
  });

  it('容器高度变化会重算窗口（视口变大 = 多渲染几条）', () => {
    const list = makeList({ buffer: 0 });
    list.setItems(Array.from({ length: 100 }, (_, i) => i));
    expect(list.getRenderedCount()).toBe(10);
    list.setState({ height: 600 });
    expect(list.getRenderedCount()).toBe(20);
  });
});
