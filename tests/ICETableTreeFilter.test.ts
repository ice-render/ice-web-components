/**
 * 树形数据 + 列筛选的两种口径。
 *
 * 默认 `'flat'`（老行为）：对拍平后的行逐条筛 —— 子行命中就单独露出来，哪怕父行被筛掉。
 * `'ancestors'`：**保留命中行的祖先链** —— 层级路径不能丢，否则用户看到一行「上海」
 * 却不知道它在哪个大区下面（与 `ICETreeSelect` 的搜索口径一致）。
 */
import { ICETable } from '../src/components/ICETable';

const columns = [
  { key: 'name', title: '名称', width: 240 },
  { key: 'count', title: '数量', width: 120, filters: [{ text: '1', value: '1' }] },
];

const TREE = [
  { id: 'a', name: '华东', count: 3, children: [
    { id: 'a1', name: '上海', count: 1 },
    { id: 'a2', name: '杭州', count: 2 },
  ] },
  { id: 'b', name: '华南', count: 1, children: [{ id: 'b1', name: '深圳', count: 9 }] },
];

function setup(props: any = {}) {
  return new ICETable({
    columns,
    data: TREE.map((row) => ({ ...row })),
    width: 400,
    rowHeight: 40,
    rowKey: 'id',
    rowSelection: 'none',
    defaultExpandedKeys: ['a', 'b'],
    ...props,
  });
}

describe('树形筛选口径', () => {
  it("默认 'flat'：命中的行直接露出来，不补祖先", () => {
    const table = setup();
    table.setFilter('count', ['1']);
    expect(table.getRows().map((row) => row.id)).toEqual(['a1', 'b']);
  });

  it("'ancestors'：命中行的祖先链保留（能看出它在哪一支下）", () => {
    const table = setup({ treeFilterMode: 'ancestors' });
    table.setFilter('count', ['1']);
    expect(table.getRows().map((row) => row.id)).toEqual(['a', 'a1', 'b']);
  });

  it("'ancestors' 下祖先不参与排序/汇总的口径变化（只是被带着露出来）", () => {
    const table = setup({ treeFilterMode: 'ancestors' });
    table.setFilter('count', ['1']);
    // 华东（count=3）自己不命中，是被 a1 带上来的
    expect(table.getRows().map((row) => row.count)).toEqual([3, 1, 1]);
  });

  it("'ancestors' 下命中行藏在折叠的父行里时，路径也会被摊出来", () => {
    const table = setup({ treeFilterMode: 'ancestors', defaultExpandedKeys: [] });
    table.setFilter('count', ['9']);
    // b1（深圳）命中：华南（祖先链）与它一起露出来，用户才看得出这行在哪一支下面
    expect(table.getRows().map((row) => row.id)).toEqual(['b', 'b1']);
  });
});
