/**
 * 树形选择的行集合：级联出来的行、翻页走的行，都要能被 `getSelectedRows()` 拿到。
 *
 * 背景：批量操作（导出、发货）拿的是 `getSelectedRows()`，如果它只认「当前页里被勾的下标」，
 * 那级联选中的子行和别的页选中的行就会漏掉 —— 这是会真出事的漏。
 *
 * 规格：
 * - `getSelectedRows()` 含级联选中的后代（哪怕它没展开、不在当前页）；
 * - 翻页后仍能拿到上一页选的；
 * - 顺序稳定（按树的前序，父在子前）；
 * - 表头「已选 N 行」跨页累计。
 */
import { ICETable } from '../src/components/ICETable';

const columns = [
  { key: 'name', title: '名称', width: 240 },
  { key: 'count', title: '数量', width: 120 },
];

const TREE = [
  { id: 'a', name: '华东', children: [{ id: 'a1', name: '上海' }, { id: 'a2', name: '杭州' }] },
  { id: 'b', name: '华南' },
  { id: 'c', name: '华北' },
];

function setup(props: any = {}) {
  return new ICETable({
    columns,
    data: TREE.map((row) => ({ ...row })),
    width: 400,
    rowHeight: 40,
    rowKey: 'id',
    rowSelection: 'multiple',
    selectionSummary: true,
    ...props,
  });
}

describe('树形选择的行集合', () => {
  it('getSelectedRows 含级联选中的子行（即使没展开）', () => {
    const table = setup();
    table.setTreeRowSelected('a', true);
    expect(table.getSelectedRows().map((row) => row.id)).toEqual(['a', 'a1', 'a2']);
  });

  it('翻页也拿得到：选完第一页，翻到第二页仍在集合里', () => {
    const table = setup({ pagination: { pageSize: 2 } });
    table.setTreeRowSelected('b', true);
    expect(table.getSelectedRows().map((row) => row.id)).toEqual(['b']);
    table.setPage(2);
    expect(table.getRows().map((row) => row.id)).toEqual(['c']);
    expect(table.getSelectedRows().map((row) => row.id)).toEqual(['b']);
  });

  it('顺序按树的前序（父在子前），不随点击顺序漂', () => {
    const table = setup();
    table.setTreeRowSelected('c', true);
    table.setTreeRowSelected('a', true);
    expect(table.getSelectedRows().map((row) => row.id)).toEqual(['a', 'a1', 'a2', 'c']);
  });

  it('表头已选提示跨页累计', () => {
    const table = setup({ pagination: { pageSize: 2 } });
    table.setTreeRowSelected('a', true);
    expect(table.getSelectionHintText()).toBe('已选 3 行');
    table.setPage(2);
    expect(table.getSelectionHintText()).toBe('已选 3 行');
  });
});
