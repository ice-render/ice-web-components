/**
 * 表头的「已选 N 行」提示。
 *
 * 场景：树形表里勾一个父行会带上好几个子行，用户需要一眼看到「到底选了多少」。
 *
 * 规格：
 * - `selectionSummary: true` 时表头右侧出现提示，文案「已选 N 行」；N 含级联出来的子行；
 * - 没选任何行时不显示（不占视觉噪音）；
 * - 选择变化后文案立刻更新；
 * - 默认不显示（老行为）；非树形表也能用。
 */
import { ICETable } from '../src/components/ICETable';

const columns = [
  { key: 'name', title: '名称', width: 240 },
  { key: 'count', title: '数量', width: 120 },
];

function makeTree(props: any = {}) {
  return new ICETable({
    columns,
    data: [
      { id: 'a', name: 'A', children: [{ id: 'a1', name: 'A1' }, { id: 'a2', name: 'A2' }] },
      { id: 'b', name: 'B' },
    ],
    width: 400,
    rowHeight: 40,
    rowKey: 'id',
    rowSelection: 'multiple',
    selectionSummary: true,
    ...props,
  });
}

describe('表头已选提示', () => {
  it('默认不显示提示（老行为）', () => {
    const table = new ICETable({
      columns,
      data: [{ id: 'x', name: 'X' }],
      width: 300,
      rowHeight: 40,
      rowKey: 'id',
      rowSelection: 'multiple',
    });
    expect(table.getSelectionHintNode()).toBe(null);
    expect(table.getSelectionHintText()).toBe('');
  });

  it('没选行时不显示；选了才出现', () => {
    const table = makeTree();
    expect(table.getSelectionHintText()).toBe('');
    table.setTreeRowSelected('b', true);
    expect(table.getSelectionHintText()).toBe('已选 1 行');
    expect(table.getSelectionHintNode()).toBeTruthy();
  });

  it('级联选中的子行也算进数量', () => {
    const table = makeTree();
    table.setTreeRowSelected('a', true);
    expect(table.getSelectionHintText()).toBe('已选 3 行');
  });

  it('取消选择后提示消失', () => {
    const table = makeTree();
    table.setTreeRowSelected('a', true);
    table.setTreeRowSelected('a', false);
    expect(table.getSelectionHintText()).toBe('');
  });
});
