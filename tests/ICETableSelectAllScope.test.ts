/**
 * 表头全选的范围：只选可见行，还是整棵树都选。
 *
 * 默认 `'visible'`（老行为）：勾上的就是眼前这些行（含展开出来的子行）。
 * `'all'`：连**折叠起来没显示**的后代也一起选 —— 树形表里「全选这个大区」通常要的是这个。
 */
import { ICETable } from '../src/components/ICETable';

const columns = [
  { key: 'name', title: '名称', width: 240 },
  { key: 'count', title: '数量', width: 120 },
];

const TREE = [
  { id: 'a', name: '华东', children: [{ id: 'a1', name: '上海' }, { id: 'a2', name: '杭州' }] },
  { id: 'b', name: '华南' },
];

function setup(props: any = {}) {
  const table = new ICETable({
    columns,
    data: TREE.map((row) => ({ ...row })),
    width: 400,
    rowHeight: 40,
    rowKey: 'id',
    rowSelection: 'multiple',
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

describe('表头全选范围', () => {
  it("默认 'visible'：只选眼前这些行（折叠的后代不算）", () => {
    const table = setup();
    table.getHeaderCheckbox()!.trigger('mousedown', null, {});
    expect(sorted(table.getSelectedRowKeys())).toEqual(['a', 'b']);
  });

  it("'all'：折叠起来没显示的后代也一起选", () => {
    const table = setup({ selectAllScope: 'all' });
    table.getHeaderCheckbox()!.trigger('mousedown', null, {});
    expect(sorted(table.getSelectedRowKeys())).toEqual(['a', 'a1', 'a2', 'b']);
    expect(sorted(table.getSelectedRows().map((row) => row.id))).toEqual(['a', 'a1', 'a2', 'b']);
  });

  it("'all' 再点一次全取消", () => {
    const table = setup({ selectAllScope: 'all' });
    table.getHeaderCheckbox()!.trigger('mousedown', null, {});
    table.getHeaderCheckbox()!.trigger('mousedown', null, {});
    expect(table.getSelectedRowKeys()).toEqual([]);
  });
});
