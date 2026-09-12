/**
 * 拖拽排序的纯逻辑规格（`ICEDragReorder`）。
 *
 * 为什么先做纯函数：拖拽这种交互，「手指落在哪 → 放到哪一行」和「移动之后数组长什么样」
 * 是两件最容易写错、又最难靠肉眼验的事（差一位、往回拖错位）。把它们抽出来单测，
 * 交互层（表格行 / 树节点 / 看板卡）就只剩「读指针、画指示线、松手调 moveItem」。
 *
 * 语义：
 * - `computeDropTarget`：指针纵坐标 → `{ index, position: 'before' | 'after' }`；
 *   上半格 = 插到该行之前，下半格 = 之后；越界夹到首尾；空列表返回 null。
 * - `moveItem`：把第 `from` 项移到落点处，返回**新数组**与移动后的下标；
 *   拖到自己身上（或相邻的等价位置）视为没动，返回 `moved: false`。
 */
import { computeDropTarget, moveItem } from '../src/util/ICEDragReorder';

describe('computeDropTarget（落点）', () => {
  const base = { itemHeight: 40, itemCount: 5 };

  it('上半格插到该行之前，下半格插到之后', () => {
    expect(computeDropTarget({ ...base, pointerY: 10 })).toEqual({ index: 0, position: 'before' });
    expect(computeDropTarget({ ...base, pointerY: 30 })).toEqual({ index: 0, position: 'after' });
    expect(computeDropTarget({ ...base, pointerY: 90 })).toEqual({ index: 2, position: 'before' });
    expect(computeDropTarget({ ...base, pointerY: 100 })).toEqual({ index: 2, position: 'after' });
  });

  it('正好落在分界线上算「之后」边界值稳定', () => {
    expect(computeDropTarget({ ...base, pointerY: 0 })).toEqual({ index: 0, position: 'before' });
    expect(computeDropTarget({ ...base, pointerY: 20 })).toEqual({ index: 0, position: 'after' });
    expect(computeDropTarget({ ...base, pointerY: 40 })).toEqual({ index: 1, position: 'before' });
  });

  it('越界夹到首尾（拖到列表上方 / 下方）', () => {
    expect(computeDropTarget({ ...base, pointerY: -100 })).toEqual({ index: 0, position: 'before' });
    expect(computeDropTarget({ ...base, pointerY: 9999 })).toEqual({ index: 4, position: 'after' });
  });

  it('空列表 / 非法行高返回 null', () => {
    expect(computeDropTarget({ ...base, itemCount: 0, pointerY: 10 })).toBeNull();
    expect(computeDropTarget({ ...base, itemHeight: 0, pointerY: 10 })).toBeNull();
  });
});

describe('moveItem（移动语义）', () => {
  const items = ['a', 'b', 'c', 'd', 'e'];

  it('往下拖：插到目标行之后', () => {
    // 把 a 拖到 c 的下面 → b, c, a, d, e
    expect(moveItem(items, 0, { index: 2, position: 'after' })).toEqual({ items: ['b', 'c', 'a', 'd', 'e'], to: 2, moved: true });
  });

  it('往上拖：插到目标行之前', () => {
    // 把 e 拖到 b 的上面 → a, e, b, c, d
    expect(moveItem(items, 4, { index: 1, position: 'before' })).toEqual({ items: ['a', 'e', 'b', 'c', 'd'], to: 1, moved: true });
  });

  it('原地不动：拖到自己上方/下方都不算移动', () => {
    expect(moveItem(items, 2, { index: 2, position: 'before' }).moved).toBe(false);
    expect(moveItem(items, 2, { index: 2, position: 'after' }).moved).toBe(false);
    // 相邻等价位置：把 b 插到 a 之后，等于没动
    expect(moveItem(items, 1, { index: 0, position: 'after' }).moved).toBe(false);
  });

  it('拖到首尾的两个极端', () => {
    expect(moveItem(items, 2, { index: 0, position: 'before' }).items).toEqual(['c', 'a', 'b', 'd', 'e']);
    expect(moveItem(items, 2, { index: 4, position: 'after' }).items).toEqual(['a', 'b', 'd', 'e', 'c']);
  });

  it('返回的是新数组（原数组不动），下标越界当作没动', () => {
    const source = items.slice();
    const result = moveItem(source, 0, { index: 2, position: 'before' });
    expect(source).toEqual(items);
    expect(result.items).not.toBe(source);
    expect(moveItem(source, 99, { index: 0, position: 'before' }).moved).toBe(false);
    expect(moveItem(source, 0, { index: 99, position: 'before' }).moved).toBe(false);
  });
});
