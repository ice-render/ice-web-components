/**
 * 树形数据的汇总行：父行本身就是子行的合计，算总额时不能把父子都加一遍。
 *
 * 规格：
 * - `summaryRowsMode: 'leaves'` 时只把**叶子行**喂给 summary 函数；
 * - 默认 `'all'`（老行为：拿到当前可见的所有行）；
 * - 非树形表格两种口径一样。
 */
import { ICETable } from '../src/components/ICETable';

const columns = [
  { key: 'name', title: '名称', width: 240 },
  { key: 'count', title: '数量', width: 120, align: 'right' as const },
];

const TREE = [
  { id: 'a', name: '华东', count: 3, children: [
    { id: 'a1', name: '上海', count: 1 },
    { id: 'a2', name: '杭州', count: 2 },
  ] },
  { id: 'b', name: '华南', count: 5 },
];

function setup(props: any = {}) {
  return new ICETable({
    columns,
    data: TREE.map((row) => ({ ...row })),
    width: 400,
    rowHeight: 40,
    rowKey: 'id',
    rowSelection: 'none',
    defaultExpandedKeys: ['a'],
    summary: (rows: any[]) => ({ name: `${rows.length} 行`, count: rows.reduce((sum, row) => sum + row.count, 0) }),
    ...props,
  });
}

describe('树形数据的汇总行', () => {
  it("summaryRowsMode: 'all'（默认）：把当前可见行都喂进去", () => {
    const table = setup();
    expect(table.getSummaryText('name')).toBe('4 行');
    expect(table.getSummaryText('count')).toBe('11');
  });

  it("summaryRowsMode: 'leaves'：只算叶子，合计不重复", () => {
    const table = setup({ summaryRowsMode: 'leaves' });
    expect(table.getSummaryText('name')).toBe('3 行');
    expect(table.getSummaryText('count')).toBe('8');
  });

  it('收起父行时叶子口径不变（合计跟展开状态无关）', () => {
    const table = setup({ summaryRowsMode: 'leaves' });
    table.toggleRowExpanded('a');
    expect(table.getSummaryText('count')).toBe('8');
  });

  it('非树形表格两种口径一样', () => {
    const flat = new ICETable({
      columns,
      data: [{ id: 'x', name: 'X', count: 2 }, { id: 'y', name: 'Y', count: 3 }],
      width: 400,
      rowHeight: 40,
      rowKey: 'id',
      rowSelection: 'none',
      summaryRowsMode: 'leaves',
      summary: (rows: any[]) => ({ count: rows.reduce((sum, row) => sum + row.count, 0) }),
    });
    expect(flat.getSummaryText('count')).toBe('5');
  });
});
