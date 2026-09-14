/**
 * ICETable 的树形数据（`children` 列 + 展开）。
 *
 * 规格：
 * - 行里有 `children` 数组的是父行；默认只显示顶层，展开才显示子行（父 → 子，深度优先）；
 * - `rowKey` 决定「哪一行是谁」（缺省用下标）；`toggleRowExpanded` / `defaultExpandedKeys` /
 *   `getExpandedRowKeys()` / `isRowExpanded()` / `getRowDepth()` 配套；
 * - 首列按深度缩进，父行有 ▸/▾ 三角，点子行不触发展开；
 * - 与筛选 / 排序 / 分页同一条管线：**先按展开口径拍平，再筛、再排、再分页**；
 * - 与虚拟化交叉：拍平后行数上万也只渲染可视窗口。
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
  { id: 'b', name: '华南', count: 1, children: [{ id: 'b1', name: '深圳', count: 1 }] },
  { id: 'c', name: '华北', count: 0 },
];

function setup(props: any = {}) {
  const table = new ICETable({
    columns,
    data: TREE.map((row) => ({ ...row })),
    width: 400,
    rowHeight: 40,
    rowKey: 'id',
    rowSelection: 'none',
    ...props,
  });
  return { table };
}

describe('ICETable 树形数据', () => {
  it('默认只显示顶层行', () => {
    const { table } = setup();
    expect(table.getRows().map((row) => row.id)).toEqual(['a', 'b', 'c']);
    expect(table.getTreeExpandedKeys()).toEqual([]);
  });

  it('defaultExpandedKeys 展开：父行后面紧跟它的子行（深度优先）', () => {
    const { table } = setup({ defaultExpandedKeys: ['a'] });
    expect(table.getRows().map((row) => row.id)).toEqual(['a', 'a1', 'a2', 'b', 'c']);
    expect(table.getRowDepth('a1')).toBe(1);
    expect(table.getRowDepth('a')).toBe(0);
  });

  it('toggleRowExpanded 展开 / 收起，三角节点同义', () => {
    const { table } = setup();
    table.toggleRowExpanded('b');
    expect(table.isTreeRowExpanded('b')).toBe(true);
    expect(table.getRows().map((row) => row.id)).toEqual(['a', 'b', 'b1', 'c']);
    table.getRowTreeToggle('b')!.trigger('click', null, {});
    expect(table.isTreeRowExpanded('b')).toBe(false);
    expect(table.getRows().map((row) => row.id)).toEqual(['a', 'b', 'c']);
  });

  it('叶子行没有三角；子行首列缩进', () => {
    const { table } = setup({ defaultExpandedKeys: ['a'] });
    expect(table.getRowTreeToggle('a')).toBeTruthy();
    expect(table.getRowTreeToggle('a1')).toBe(null);
    const parentIndent = table.getRowIndent('a');
    const childIndent = table.getRowIndent('a1');
    expect(childIndent).toBeGreaterThan(parentIndent);
  });

  it('与筛选同管线：先按展开口径拍平，再对拍平后的行逐条筛', () => {
    const { table } = setup({
      defaultExpandedKeys: ['a', 'b'],
      columns: [
        { key: 'name', title: '名称', width: 240 },
        { key: 'count', title: '数量', width: 120, filters: [{ text: '有', value: '1' }] },
      ],
    });
    table.setFilter('count', ['1']);
    // 逐条筛（不做「父行没了子行也藏起来」那套隐式规则）：命中 count=1 的 a1 / b / b1 都在
    expect(table.getRows().map((row) => row.id)).toEqual(['a1', 'b', 'b1']);
  });

  it('与分页交叉：口径是「展开后、筛选后的可见行」', () => {
    const { table } = setup({ defaultExpandedKeys: ['a'], pagination: { pageSize: 2 } });
    expect(table.getTotalRows()).toBe(5);
    expect(table.getPageCount()).toBe(3);
    expect(table.getRows().map((row) => row.id)).toEqual(['a', 'a1']);
  });

  it('与虚拟化交叉：拍平后上万行也只渲染窗口', () => {
    const wide = Array.from({ length: 2000 }, (_, index) => ({
      id: 'p' + index,
      name: '分组 ' + index,
      children: [{ id: 'c' + index, name: '子 ' + index }],
    }));
    const table = new ICETable({
      columns,
      data: wide,
      width: 400,
      height: 200,
      rowHeight: 30,
      rowKey: 'id',
      virtual: true,
      rowSelection: 'none',
      defaultExpandedKeys: ['p0', 'p1', 'p2'],
    });
    expect(table.isVirtual()).toBe(true);
    expect(table.getTotalRows()).toBe(2003); // 2000 顶层 + 展开的 3 个子行（p0/p1/p2）
    // 虚拟路径下 `getRows()` 给的是全量数据，真正「画出来几行」看窗口
    expect(table.getRenderedRowCount()).toBeLessThan(30);
  });
});
