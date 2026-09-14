/**
 * 编辑器里的 Tab 流转。
 *
 * 键盘用户填表格的节奏是「改完一格按 Tab 去下一格」，不接这条就得每次都摸鼠标。
 *
 * 规格：
 * - Tab → 提交当前格，进**同行下一个可编辑列**的编辑态；
 * - 跳过不可编辑的列；行末的下一个可编辑格在下**一行**第一列；
 * - 最后一格 Tab：提交并退出编辑态（不绕回第一格）；
 * - Shift + Tab 反向；到头就退出。
 */
import { ICETable } from '../src/components/ICETable';

const columns = [
  { key: 'name', title: '名称', width: 160, editable: true },
  { key: 'city', title: '城市', width: 160 },
  { key: 'note', title: '备注', width: 160, editable: true },
];

const data = [
  { name: 'A', city: '上海', note: 'a' },
  { name: 'B', city: '北京', note: 'b' },
];

function setup(props: any = {}) {
  return new ICETable({
    columns,
    data: data.map((row) => ({ ...row })),
    width: 480,
    rowHeight: 40,
    rowSelection: 'none',
    ...props,
  });
}

const pressTab = (table: ICETable, shift = false) => {
  table.getEditNode()!.trigger('keydown', { key: 'Tab', shiftKey: shift });
};

describe('编辑器 Tab 流转', () => {
  it('Tab：提交当前格并进同行下一个可编辑列', () => {
    const table = setup();
    table.startEdit(0, 'name');
    table.getEditNode()!.setValue('A2');
    pressTab(table);
    expect(table.getRows()[0].name).toBe('A2');
    expect(table.getEditingCell()).toEqual({ rowIndex: 0, key: 'note' });
    expect(table.getEditNode()!.getValue()).toBe('a');
  });

  it('行末 Tab 落到下一行第一个可编辑列', () => {
    const table = setup();
    table.startEdit(0, 'note');
    table.getEditNode()!.setValue('a2');
    pressTab(table);
    expect(table.getRows()[0].note).toBe('a2');
    expect(table.getEditingCell()).toEqual({ rowIndex: 1, key: 'name' });
  });

  it('最后一格 Tab：提交并退出（不绕回第一格）', () => {
    const table = setup();
    table.startEdit(1, 'note');
    table.getEditNode()!.setValue('b2');
    pressTab(table);
    expect(table.getRows()[1].note).toBe('b2');
    expect(table.isEditing()).toBe(false);
  });

  it('Shift + Tab 反向流转', () => {
    const table = setup();
    table.startEdit(1, 'name');
    pressTab(table, true);
    expect(table.getEditingCell()).toEqual({ rowIndex: 0, key: 'note' });
  });

  it('第一格 Shift + Tab：提交并退出', () => {
    const table = setup();
    table.startEdit(0, 'name');
    table.getEditNode()!.setValue('A3');
    pressTab(table, true);
    expect(table.getRows()[0].name).toBe('A3');
    expect(table.isEditing()).toBe(false);
  });
});
