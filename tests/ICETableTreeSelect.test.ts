/**
 * 树形数据的选择级联。
 *
 * 规格：
 * - 勾父行 → 它的整棵子树都选上（含没展开、看不见的后代）；
 * - 取消父行 → 整棵子树取消；
 * - 勾满一个父行的所有子行 → 父行自动选上（自下而上的回填）；
 * - 取走任一子行 → 父行跟着取消；
 * - 选择是「数据层」的：子行没展开也算选中。
 */
import { ICETable } from '../src/components/ICETable';

const columns = [
  { key: 'name', title: '名称', width: 240 },
  { key: 'count', title: '数量', width: 120, align: 'right' as const },
];

const TREE = [
  { id: 'a', name: '华东', count: 3, children: [
    { id: 'a1', name: '上海', count: 1, children: [{ id: 'a11', name: '浦东', count: 1 }] },
    { id: 'a2', name: '杭州', count: 2 },
  ] },
  { id: 'b', name: '华南', count: 1, children: [{ id: 'b1', name: '深圳', count: 1 }] },
];

function setup(props: any = {}) {
  return new ICETable({
    columns,
    data: TREE.map((row) => ({ ...row })),
    width: 400,
    rowHeight: 40,
    rowKey: 'id',
    rowSelection: 'multiple',
    ...props,
  });
}

const sorted = (keys: string[]) => keys.slice().sort();

describe('ICETable 树形选择级联', () => {
  it('勾父行：整棵子树都选上（含没展开的后代）', () => {
    const table = setup();
    table.setTreeRowSelected('a', true);
    expect(sorted(table.getSelectedRowKeys())).toEqual(['a', 'a1', 'a11', 'a2']);
    expect(table.isTreeRowSelected('a11')).toBe(true);
  });

  it('取消父行：整棵子树一起取消', () => {
    const table = setup();
    table.setTreeRowSelected('a', true);
    table.setTreeRowSelected('a', false);
    expect(table.getSelectedRowKeys()).toEqual([]);
  });

  it('勾满所有子行：父行自动选上', () => {
    const table = setup();
    table.setTreeRowSelected('a1', true);
    expect(table.isTreeRowSelected('a')).toBe(false);
    table.setTreeRowSelected('a2', true);
    expect(table.isTreeRowSelected('a')).toBe(true);
    expect(sorted(table.getSelectedRowKeys())).toEqual(['a', 'a1', 'a11', 'a2']);
  });

  it('取走一个子行：父行跟着取消', () => {
    const table = setup();
    table.setTreeRowSelected('a', true);
    table.setTreeRowSelected('a2', false);
    expect(table.isTreeRowSelected('a')).toBe(false);
    expect(sorted(table.getSelectedRowKeys())).toEqual(['a1', 'a11']);
  });

  it('叶子行的勾选不影响别的分支', () => {
    const table = setup();
    table.setTreeRowSelected('b1', true);
    expect(sorted(table.getSelectedRowKeys())).toEqual(['b', 'b1']);
    expect(table.isTreeRowSelected('a')).toBe(false);
  });
});
