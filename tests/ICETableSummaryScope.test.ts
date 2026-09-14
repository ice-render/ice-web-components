/**
 * 汇总行的口径：整表 还是 当前页。
 *
 * 规格：
 * - `summaryScope: 'all'`（默认）：跟以前一样，按筛完之后的**全量**算；
 * - `summaryScope: 'page'`：只算**当前页**的行（翻页合计跟着变）；
 * - 与 `summaryRowsMode: 'leaves'` 组合时：`page` 口径下只算「当前页里在全树中是叶子的行」
 *   —— 父行的子行翻到下一页时不重复计（总额因此可能小于整表口径，这是口径本身的取舍，不是 bug）。
 */
import { ICETable } from '../src/components/ICETable';

const columns = [
  { key: 'name', title: '名称', width: 240 },
  { key: 'count', title: '数量', width: 120 },
];

const ROWS = [
  { id: 'r1', name: '一', count: 1 },
  { id: 'r2', name: '二', count: 2 },
  { id: 'r3', name: '三', count: 4 },
  { id: 'r4', name: '四', count: 8 },
];

function setup(props: any = {}) {
  return new ICETable({
    columns,
    data: ROWS.map((row) => ({ ...row })),
    width: 400,
    rowHeight: 40,
    rowKey: 'id',
    rowSelection: 'none',
    pagination: { pageSize: 2 },
    summary: (rows: any[]) => ({ count: rows.reduce((sum, row) => sum + row.count, 0) }),
    ...props,
  });
}

describe('汇总口径：整表 vs 当前页', () => {
  it("默认 'all'：翻页合计不变（全量口径）", () => {
    const table = setup();
    expect(table.getSummaryText('count')).toBe('15');
    table.setPage(2);
    expect(table.getSummaryText('count')).toBe('15');
  });

  it("summaryScope: 'page'：只算当前页", () => {
    const table = setup({ summaryScope: 'page' });
    expect(table.getSummaryText('count')).toBe('3'); // 1 + 2
    table.setPage(2);
    expect(table.getSummaryText('count')).toBe('12'); // 4 + 8
  });

  it("page + leaves：父行翻页时不重复计（只数当前页里的叶子）", () => {
    const tree = [
      { id: 'a', name: 'A', count: 3, children: [{ id: 'a1', name: 'A1', count: 1 }, { id: 'a2', name: 'A2', count: 2 }] },
      { id: 'b', name: 'B', count: 5 },
    ];
    const table = new ICETable({
      columns,
      data: tree.map((row) => ({ ...row })),
      width: 400,
      rowHeight: 40,
      rowKey: 'id',
      rowSelection: 'none',
      defaultExpandedKeys: ['a'],
      pagination: { pageSize: 2 },
      summaryRowsMode: 'leaves',
      summaryScope: 'page',
      summary: (rows: any[]) => ({ count: rows.reduce((sum, row) => sum + row.count, 0) }),
    });
    // 第 1 页 = [a(父), a1]：只把叶子 a1 算进去
    expect(table.getSummaryText('count')).toBe('1');
    table.setPage(2);
    // 第 2 页 = [a2, b]：都是叶子
    expect(table.getSummaryText('count')).toBe('7');
  });
});
