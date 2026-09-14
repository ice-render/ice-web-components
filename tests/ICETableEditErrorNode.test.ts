/**
 * 编辑校验失败时的**可见**错误提示。
 *
 * 之前只标红 + `getEditError()`：标红说明「有问题」，但不说明「有什么问题」。
 * 这一批把错误文案画在那一格下面。
 *
 * 规格：
 * - `validate` 返回文案时，单元格下方出现错误提示节点（文案就是那句话）；
 * - 改对再提交 / 取消编辑后提示消失；
 * - 没有 validate 的列不会出现提示节点。
 */
import { ICETable } from '../src/components/ICETable';

const columns = [
  {
    key: 'name',
    title: '名称',
    width: 200,
    editable: true,
    validate: (value: string) => (String(value).trim() ? null : '名称不能为空'),
  },
];

function setup() {
  return new ICETable({
    columns,
    data: [{ name: 'A' }],
    width: 300,
    rowHeight: 48,
    rowSelection: 'none',
  });
}

describe('编辑校验的可见提示', () => {
  it('校验失败：格子下方出现错误提示节点', () => {
    const table = setup();
    table.startEdit(0, 'name');
    table.getEditNode()!.setValue('  ');
    table.commitEdit();
    const node = table.getEditErrorNode()!;
    expect(node).toBeTruthy();
    expect(node.getText()).toBe('名称不能为空');
    expect(Number(node.state.top)).toBeGreaterThan((table as any).headerHeight);
  });

  it('改对再提交：提示消失', () => {
    const table = setup();
    table.startEdit(0, 'name');
    table.getEditNode()!.setValue('');
    table.commitEdit();
    expect(table.getEditErrorNode()).toBeTruthy();
    table.getEditNode()!.setValue('A2');
    table.commitEdit();
    expect(table.getEditErrorNode()).toBe(null);
  });

  it('取消编辑：提示消失', () => {
    const table = setup();
    table.startEdit(0, 'name');
    table.getEditNode()!.setValue('');
    table.commitEdit();
    table.cancelEdit();
    expect(table.getEditErrorNode()).toBe(null);
  });

  it('没有 validate 的列：不会出现提示节点', () => {
    const table = new ICETable({
      columns: [{ key: 'note', title: '备注', width: 200, editable: true }],
      data: [{ note: 'x' }],
      width: 300,
      rowHeight: 48,
      rowSelection: 'none',
    });
    table.startEdit(0, 'note');
    table.getEditNode()!.setValue('');
    table.commitEdit();
    expect(table.getEditErrorNode()).toBe(null);
  });
});
