/**
 * 树形数据的行拖拽：拖父行时**整棵子树跟着走**。
 *
 * 规格：
 * - `moveTreeRow(dragKey, targetKey, position)`：把父行连同它的后代一起挪到目标位置；
 * - 子行的相对顺序保持不变；
 * - **不能把父行拖进自己的后代**（否则整棵子树会凭空消失）—— 数据不动、返回 false；
 * - 展开状态按 key 记，挪完还展开着；
 * - 非树形表格仍走原来的 `moveRow`（按可见行下标）。
 */
import { ICETable } from '../src/components/ICETable';

const columns = [
  { key: 'name', title: '名称', width: 240 },
  { key: 'count', title: '数量', width: 120 },
];

const TREE = [
  { id: 'a', name: '华东', count: 3, children: [
    { id: 'a1', name: '上海', count: 1 },
    { id: 'a2', name: '杭州', count: 2 },
  ] },
  { id: 'b', name: '华南', count: 1, children: [{ id: 'b1', name: '深圳', count: 1 }] },
  { id: 'c', name: '华北', count: 0 },
];

function setup(props: any = {}) {
  return new ICETable({
    columns,
    data: TREE.map((row) => ({ ...row })),
    width: 400,
    rowHeight: 40,
    rowKey: 'id',
    rowSelection: 'none',
    rowDraggable: true,
    ...props,
  });
}

const rootKeys = (table: ICETable) => (table as any).sourceData.map((row: any) => row.id);

describe('树形行拖拽', () => {
  it('拖父行到另一父行之后：整棵子树跟着走，子行顺序不变', () => {
    const table = setup();
    expect(table.moveTreeRow('a', 'b', 'after')).toBe(true);
    expect(rootKeys(table)).toEqual(['b', 'a', 'c']);
    const moved = (table as any).sourceData[1];
    expect(moved.children.map((child: any) => child.id)).toEqual(['a1', 'a2']);
  });

  it('不能拖进自己的后代：数据不动、返回 false', () => {
    const table = setup();
    expect(table.moveTreeRow('a', 'a1', 'inside')).toBe(false);
    expect(rootKeys(table)).toEqual(['a', 'b', 'c']);
  });

  it('挪完展开状态还在（按 key 记，不按行号）', () => {
    const table = setup({ defaultExpandedKeys: ['a'] });
    table.moveTreeRow('a', 'c', 'after');
    expect(table.isTreeRowExpanded('a')).toBe(true);
    expect(table.getRows().map((row) => row.id)).toEqual(['b', 'c', 'a', 'a1', 'a2']);
  });

  it('非树形表格不受影响：还是 moveRow（按可见行下标）', () => {
    const flat = new ICETable({
      columns,
      data: [{ id: 'x', name: 'X' }, { id: 'y', name: 'Y' }, { id: 'z', name: 'Z' }],
      width: 400,
      rowHeight: 40,
      rowKey: 'id',
      rowSelection: 'none',
      rowDraggable: true,
    });
    expect(flat.moveRow(0, { index: 2, position: 'after' })).toBe(true);
    expect(flat.getRows().map((row) => row.id)).toEqual(['y', 'z', 'x']);
  });
});
