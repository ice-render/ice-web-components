/**
 * 树形级联接上多选列的 UI 勾选。
 *
 * 上一批把级联做在了 API 上，但多选列的复选框还走「只勾这一行」的老路径，
 * 用户点父行的框并不会带上子行。这批把两条路并成一条。
 *
 * 规格：
 * - 勾父行的复选框 → 子行（含未展开的）一起选中；
 * - 级联选中的子行，重新渲染后复选框也是勾上的；
 * - 再点一次父行 → 整棵子树取消；
 * - 表头全选 → 所有可见行都选上。
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
  { id: 'b', name: '华南', count: 1 },
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
  // 复选框自己绑的是 afterAddHandler 里的 mousedown：挂上场景替身它才响应事件
  (table as any).ice = {
    screenToWorld: (x: number, y: number) => [x, y],
    evtBus: { on() {}, off() {} },
    dirty: false,
  };
  (table as any).afterAddHandler();
  return table;
}

const sorted = (keys: string[]) => keys.slice().sort();

describe('树形数据的复选框级联', () => {
  it('勾父行的复选框：子行跟着选（含未展开的）', () => {
    const table = setup();
    // 与既有选择用例同一套驱动方式：点击复选框（它会自己切换并抛 change）
    table.getSelectionNode(0)!.trigger('mousedown', null, {});
    expect(sorted(table.getSelectedRowKeys())).toEqual(['a', 'a1', 'a2']);
  });

  it('级联选中的子行：展开后它们的复选框也是勾上的', () => {
    const table = setup();
    table.setTreeRowSelected('a', true);
    table.toggleRowExpanded('a');
    expect(table.getSelectionNode(1)!.isSelected()).toBe(true);
    expect(table.getSelectionNode(2)!.isSelected()).toBe(true);
  });

  it('再点一次父行：整棵子树取消', () => {
    const table = setup();
    table.getSelectionNode(0)!.trigger('mousedown', null, {});
    table.getSelectionNode(0)!.trigger('mousedown', null, {});
    expect(table.getSelectedRowKeys()).toEqual([]);
  });

  it('表头全选：所有可见行都选上', () => {
    const table = setup({ defaultExpandedKeys: ['a'] });
    table.getHeaderCheckbox()!.trigger('mousedown', null, {});
    expect(sorted(table.getSelectedRowKeys())).toEqual(['a', 'a1', 'a2', 'b']);
  });
});
