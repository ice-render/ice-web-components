/**
 * 单元格编辑的**自定义编辑器**。
 *
 * 文本输入框只覆盖一半场景：状态列要下拉、日期列要日历、金额列要数字框。
 *
 * 规格：
 * - 列上给 `editor(value, row, meta)`：返回任意组件（要能 `getValue`/`setValue`）；
 * - 进编辑态时用它替代默认输入框，尺寸与位置仍由表格按格子算；
 * - 提交读 `getFormValue()`（没有就退回 `getValue()`），校验与回调照旧；
 * - 返回 null 表示退回默认文本输入框。
 */
import { ICETable } from '../src/components/ICETable';
import { ICESelect } from '../src/components/ICESelect';

const columns = [
  {
    key: 'status',
    title: '状态',
    width: 200,
    editable: true,
    editor: (value: string) =>
      new ICESelect({
        width: 180,
        height: 28,
        value,
        options: [
          { value: 'Paid', label: '已支付' },
          { value: 'Pending', label: '待处理' },
        ],
      }),
  },
  { key: 'name', title: '名称', width: 200, editable: true },
];

function setup() {
  const edits: any[] = [];
  const table = new ICETable({
    columns,
    data: [{ status: 'Paid', name: 'A' }, { status: 'Pending', name: 'B' }],
    width: 400,
    rowHeight: 40,
    rowSelection: 'none',
    onCellEdit: (row: any, key: string, value: any) => edits.push([row.name, key, value]),
  });
  return { table, edits };
}

describe('单元格自定义编辑器', () => {
  it('进编辑态用的是列上的编辑器（不是默认输入框）', () => {
    const { table } = setup();
    table.startEdit(0, 'status');
    const node = table.getEditNode()!;
    expect(node instanceof ICESelect).toBe(true);
    expect(node.getValue()).toBe('Paid');
  });

  it('提交读 getFormValue：改了下拉值就写回并回调', () => {
    const { table, edits } = setup();
    table.startEdit(1, 'status');
    table.getEditNode()!.setValue('Paid');
    expect(table.commitEdit()).toBe(true);
    expect(table.getRows()[1].status).toBe('Paid');
    expect(edits).toEqual([['B', 'status', 'Paid']]);
  });

  it('编辑器返回 null 时退回默认文本输入框', () => {
    const table = new ICETable({
      columns: [
        { key: 'name', title: '名称', width: 200, editable: true, editor: () => null },
      ],
      data: [{ name: 'A' }],
      width: 300,
      rowHeight: 40,
      rowSelection: 'none',
    });
    table.startEdit(0, 'name');
    const node = table.getEditNode()!;
    expect(node instanceof ICESelect).toBe(false);
    expect(typeof node.setValue).toBe('function');
    node.setValue('A2');
    expect(table.commitEdit()).toBe(true);
    expect(table.getRows()[0].name).toBe('A2');
  });

  it('编辑器也走校验：不通过就留在编辑态', () => {
    const table = new ICETable({
      columns: [
        {
          key: 'status',
          title: '状态',
          width: 200,
          editable: true,
          validate: (value: string) => (value === 'Paid' ? null : '只有已支付能通过'),
          editor: (value: string) => new ICESelect({ width: 180, height: 28, value, options: [{ value: 'Paid', label: '已支付' }] }),
        },
      ],
      data: [{ status: 'Paid' }],
      width: 300,
      rowHeight: 40,
      rowSelection: 'none',
    });
    table.startEdit(0, 'status');
    table.getEditNode()!.setValue('Pending');
    expect(table.commitEdit()).toBe(false);
    expect(table.isEditing()).toBe(true);
    expect(table.getEditError()).toBe('只有已支付能通过');
  });
});
