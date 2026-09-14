/**
 * ICETable 的单元格编辑。
 *
 * 规格：
 * - 列上声明 `editable: true` 的单元格可以点进去编辑（其它列点了照旧选行）；
 * - 编辑态是**一个输入框盖在格子上**（不是把表格改成另一套渲染）：`getEditingCell()` 报位置；
 * - Enter / 失焦 → 提交（写回行数据 + 回调 `onCellEdit(row, key, value, previous)`）；
 * - Esc → 取消（数据不变、不回调）；
 * - 提交空值 / 点别的地方也走同一条提交路径；
 * - 不可编辑的列、越界的行列都不进编辑态。
 */
import { ICETable } from '../src/components/ICETable';

const columns = [
  { key: 'name', title: '名称', width: 200, editable: true },
  { key: 'amount', title: '金额', width: 160, align: 'right' as const },
  { key: 'note', title: '备注', width: 240, editable: true },
];

const data = [
  { name: 'A', amount: 100, note: '第一行' },
  { name: 'B', amount: 200, note: '第二行' },
];

function setup(props: any = {}) {
  const edits: any[] = [];
  const table = new ICETable({
    columns,
    // 每个用例一份自己的数据：编辑会写回行对象，共享常量会串味
    data: data.map((row) => ({ ...row })),
    width: 600,
    rowHeight: 40,
    rowSelection: 'none',
    onCellEdit: (row: any, key: string, value: string, previous: any) => edits.push([row.name, key, value, previous]),
    ...props,
  });
  return { table, edits };
}

describe('ICETable 单元格编辑', () => {
  it('startEdit：进编辑态并给出位置；输入框盖在该格子上', () => {
    const { table } = setup();
    expect(table.getEditingCell()).toBe(null);
    table.startEdit(1, 'name');
    expect(table.getEditingCell()).toEqual({ rowIndex: 1, key: 'name' });
    expect(table.isEditing()).toBe(true);
    const node = table.getEditNode()!;
    expect(node).toBeTruthy();
    // 第二行、第一列：left 落在第一列里、top 落在第二行上
    expect(Number(node.state.left)).toBe(0);
    // 表头 36 + 第二行 40 + 4 内边距
    expect(Number(node.state.top)).toBe(36 + 40 + 4);
    // 比格子窄 8px：留一点边距，看着才像「盖在格子里」而不是把格子撑满
    expect(Number(node.state.width)).toBe(192);
  });

  it('提交：写回行数据 + 回调（带旧值）', () => {
    const { table, edits } = setup();
    table.startEdit(0, 'name');
    table.getEditNode()!.setValue('A2');
    expect(table.commitEdit()).toBe(true);
    expect(table.getRows()[0].name).toBe('A2');
    expect(edits).toEqual([['A2', 'name', 'A2', 'A']]);
    expect(table.isEditing()).toBe(false);
  });

  it('取消：数据不变、不回调', () => {
    const { table, edits } = setup();
    table.startEdit(0, 'name');
    table.getEditNode()!.setValue('废稿');
    expect(table.cancelEdit()).toBe(true);
    expect(table.getRows()[0].name).toBe('A');
    expect(edits).toEqual([]);
    expect(table.isEditing()).toBe(false);
  });

  it('输入框回车提交（走同一条路径）', () => {
    const { table, edits } = setup();
    table.startEdit(1, 'note');
    const node = table.getEditNode()!;
    node.setValue('改过了');
    node.trigger('keydown', { key: 'Enter' });
    expect(table.getRows()[1].note).toBe('改过了');
    expect(edits[0][2]).toBe('改过了');
  });

  it('Esc 取消（输入框里的 Esc 与 API 同义）', () => {
    const { table } = setup();
    table.startEdit(0, 'note');
    table.getEditNode()!.setValue('不要这个');
    table.getEditNode()!.trigger('keydown', { key: 'Escape' });
    expect(table.getRows()[0].note).toBe('第一行');
    expect(table.isEditing()).toBe(false);
  });

  it('不可编辑的列 / 越界行列进不去编辑态', () => {
    const { table } = setup();
    table.startEdit(0, 'amount');
    expect(table.isEditing()).toBe(false);
    table.startEdit(0, 'nope');
    expect(table.isEditing()).toBe(false);
    table.startEdit(9, 'name');
    expect(table.isEditing()).toBe(false);
  });

  it('值没变时不回调（点进去又原样出来不算编辑）', () => {
    const { table, edits } = setup();
    table.startEdit(0, 'name');
    table.commitEdit();
    expect(edits).toEqual([]);
    expect(table.isEditing()).toBe(false);
  });
});
