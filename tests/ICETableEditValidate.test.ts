/**
 * 单元格编辑的提交前校验。
 *
 * 规格：
 * - 列上可以给 `validate(value, row)`：返回字符串 = 校验不通过（那条字符串就是错误文案）；
 * - 不通过时**留在编辑态**、输入框标红、`getEditError()` 给文案、**不写回数据也不回调**；
 * - 改对了再提交照常通过；
 * - 取消编辑会清掉错误态。
 */
import { ICETable } from '../src/components/ICETable';

const columns = [
  {
    key: 'name',
    title: '名称',
    width: 240,
    editable: true,
    validate: (value: string) => (String(value).trim() ? null : '名称不能为空'),
  },
  { key: 'count', title: '数量', width: 120, align: 'right' as const },
];

function setup() {
  const edits: any[] = [];
  const table = new ICETable({
    columns,
    data: [{ name: 'A', count: 1 }],
    width: 400,
    rowHeight: 40,
    rowSelection: 'none',
    onCellEdit: (_row: any, key: string, value: string) => edits.push([key, value]),
  });
  return { table, edits };
}

describe('单元格编辑校验', () => {
  it('校验不通过：留在编辑态、标红、给文案、不写回不回调', () => {
    const { table, edits } = setup();
    table.startEdit(0, 'name');
    table.getEditNode()!.setValue('   ');
    expect(table.commitEdit()).toBe(false);
    expect(table.isEditing()).toBe(true);
    expect(table.getEditError()).toBe('名称不能为空');
    expect(table.getEditNode()!.validateStatus).toBe('error');
    expect(table.getRows()[0].name).toBe('A');
    expect(edits).toEqual([]);
  });

  it('改对了再提交：通过、错误清掉、写回并回调', () => {
    const { table, edits } = setup();
    table.startEdit(0, 'name');
    table.getEditNode()!.setValue('   ');
    table.commitEdit();
    table.getEditNode()!.setValue('A2');
    expect(table.commitEdit()).toBe(true);
    expect(table.getRows()[0].name).toBe('A2');
    expect(edits).toEqual([['name', 'A2']]);
  });

  it('没有 validate 的列不受影响（老行为）', () => {
    const plain = new ICETable({
      columns: [{ key: 'note', title: '备注', width: 200, editable: true }],
      data: [{ note: 'x' }],
      width: 300,
      rowHeight: 40,
      rowSelection: 'none',
    });
    plain.startEdit(0, 'note');
    plain.getEditNode()!.setValue('');
    expect(plain.commitEdit()).toBe(true);
    expect(plain.getRows()[0].note).toBe('');
  });

  it('取消编辑会清掉错误态', () => {
    const { table } = setup();
    table.startEdit(0, 'name');
    table.getEditNode()!.setValue('');
    table.commitEdit();
    expect(table.getEditError()).toBe('名称不能为空');
    table.cancelEdit();
    expect(table.isEditing()).toBe(false);
    expect(table.getEditError()).toBe(null);
  });
});
