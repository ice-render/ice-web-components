/**
 * 编辑态的回车行为可配。
 *
 * 默认 `'commit'`（老行为）：回车 = 提交。`'next'` 时像表格软件那样：提交并**往下走一格**
 * （同一列的下一行），最后一行则提交并退出。
 *
 * 规格：
 * - `editEnterBehavior: 'next'`：Enter 提交并进下一行同一列；
 * - 已经在最后一行：提交并退出（不绕回第一行）；
 * - 默认仍是提交后退出（老行为）；
 * - Tab 流转不受这个开关影响。
 */
import { ICETable } from '../src/components/ICETable';

const columns = [
  { key: 'name', title: '名称', width: 200, editable: true },
  { key: 'note', title: '备注', width: 200, editable: true },
];

const data = [
  { name: 'A', note: 'a' },
  { name: 'B', note: 'b' },
];

function setup(props: any = {}) {
  return new ICETable({
    columns,
    data: data.map((row) => ({ ...row })),
    width: 400,
    rowHeight: 40,
    rowSelection: 'none',
    ...props,
  });
}

const pressEnter = (table: ICETable) => table.getEditNode()!.trigger('keydown', { key: 'Enter' });

describe('编辑态回车行为', () => {
  it("默认 'commit'：提交并退出（老行为）", () => {
    const table = setup();
    table.startEdit(0, 'name');
    table.getEditNode()!.setValue('A2');
    pressEnter(table);
    expect(table.getRows()[0].name).toBe('A2');
    expect(table.isEditing()).toBe(false);
  });

  it("'next'：提交并往下走同一列", () => {
    const table = setup({ editEnterBehavior: 'next' });
    table.startEdit(0, 'name');
    table.getEditNode()!.setValue('A2');
    pressEnter(table);
    expect(table.getRows()[0].name).toBe('A2');
    expect(table.getEditingCell()).toEqual({ rowIndex: 1, key: 'name' });
    expect(table.getEditNode()!.getValue()).toBe('B');
  });

  it("'next' 到最后一行：提交并退出（不绕回）", () => {
    const table = setup({ editEnterBehavior: 'next' });
    table.startEdit(1, 'name');
    table.getEditNode()!.setValue('B2');
    pressEnter(table);
    expect(table.getRows()[1].name).toBe('B2');
    expect(table.isEditing()).toBe(false);
  });

  it("'next' 时校验不通过仍停在原地", () => {
    const table = new ICETable({
      columns: [
        { key: 'name', title: '名称', width: 200, editable: true, validate: (value: string) => (value ? null : '不能为空') },
      ],
      data: [{ name: 'A' }, { name: 'B' }],
      width: 300,
      rowHeight: 40,
      rowSelection: 'none',
      editEnterBehavior: 'next',
    });
    table.startEdit(0, 'name');
    table.getEditNode()!.setValue('');
    pressEnter(table);
    expect(table.isEditing()).toBe(true);
    expect(table.getEditingCell()).toEqual({ rowIndex: 0, key: 'name' });
    expect(table.getEditError()).toBe('不能为空');
  });

  it('Tab 流转不受回车开关影响', () => {
    const table = setup({ editEnterBehavior: 'next' });
    table.startEdit(0, 'name');
    table.getEditNode()!.trigger('keydown', { key: 'Tab' });
    expect(table.getEditingCell()).toEqual({ rowIndex: 0, key: 'note' });
  });
});
