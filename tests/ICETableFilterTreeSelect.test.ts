/**
 * 列头筛选 × 树形选择级联的组合。
 *
 * 问题：`treeFilterMode: 'ancestors'` 会把「被带出来」的祖先行画在屏幕上 ——
 * 它到底能不能勾？勾了会不会连带把看不见的后代也选上？
 *
 * 规格（这批把口径定死）：
 * - 被带出来的祖先行**可以正常勾选**（它就是那一行，不区分「为什么出现」）；
 * - 级联照旧作用在**整棵子树**上（含被筛掉、看不见的后代）—— 选择是数据层的；
 * - 切换筛选口径 / 清空筛选，选择都不丢；
 * - 已选提示与 `getSelectedRows()` 与筛选无关。
 */
import { ICETable } from '../src/components/ICETable';

const columns = [
  { key: 'name', title: '名称', width: 200 },
  { key: 'count', title: '数量', width: 160, filters: [{ text: '1', value: '1' }] },
];

const TREE = [
  { id: 'a', name: '华东', count: 3, children: [
    { id: 'a1', name: '上海', count: 1 },
    { id: 'a2', name: '杭州', count: 2 },
  ] },
  { id: 'b', name: '华南', count: 1 },
];

function setup(props: any = {}) {
  const table = new ICETable({
    columns,
    data: JSON.parse(JSON.stringify(TREE)),
    width: 400,
    rowHeight: 40,
    rowKey: 'id',
    rowSelection: 'multiple',
    selectionSummary: true,
    treeFilterMode: 'ancestors',
    defaultExpandedKeys: ['a'],
    ...props,
  });
  (table as any).ice = {
    screenToWorld: (x: number, y: number) => [x, y],
    evtBus: { on() {}, off() {} },
    dirty: false,
  };
  (table as any).afterAddHandler();
  return table;
}

const sorted = (keys: string[]) => keys.slice().sort();

describe('筛选 × 树形选择', () => {
  it('被带出来的祖先行可以勾，级联照旧作用于整棵子树', () => {
    const table = setup();
    table.setFilter('count', ['1']);
    // 华东（count=3）自己不命中，是被 a1 带上来的
    expect(table.getRows().map((row) => row.id)).toEqual(['a', 'a1', 'b']);
    table.setTreeRowSelected('a', true);
    expect(sorted(table.getSelectedRowKeys())).toEqual(['a', 'a1', 'a2']);
  });

  it('切换筛选口径 / 清空筛选：选择都不丢', () => {
    const table = setup();
    table.setFilter('count', ['1']);
    table.setTreeRowSelected('a', true);
    table.clearFilters();
    expect(sorted(table.getSelectedRowKeys())).toEqual(['a', 'a1', 'a2']);
    table.setFilter('count', ['1']);
    expect(sorted(table.getSelectedRowKeys())).toEqual(['a', 'a1', 'a2']);
  });

  it('已选提示与 getSelectedRows 与筛选无关', () => {
    const table = setup();
    table.setFilter('count', ['1']);
    table.setTreeRowSelected('a', true);
    expect(table.getSelectionHintText()).toBe('已选 3 行');
    expect(table.getSelectedRows().map((row) => row.id)).toEqual(['a', 'a1', 'a2']);
  });

  it('表头全选：选的是当前可见行（带出来的祖先也在内）', () => {
    const table = setup({ selectAllScope: 'visible' });
    table.setFilter('count', ['1']);
    table.getHeaderCheckbox()!.trigger('mousedown', null, {});
    expect(sorted(table.getSelectedRowKeys())).toEqual(['a', 'a1', 'b']);
  });
});
