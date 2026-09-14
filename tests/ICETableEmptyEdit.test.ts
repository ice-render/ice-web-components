/**
 * 编辑态的空值策略。
 *
 * 有的列「清空」是合法操作（备注想删光），有的列清空等于误触（编码、单号）。
 * 默认 `'clear'`（写空，老行为）；`'keep'` 时空值**不算编辑**（保留原值、不回调）。
 *
 * 规格：
 * - 默认：清空即写入空串并回调；
 * - `emptyEditBehavior: 'keep'`：空值不写、不回调，直接退出编辑态；
 * - `'keep'` 下非空值照常写入；
 * - `'keep'` 与 `validate` 同时存在时：空值先被策略拦下（根本轮不到 validate 报错）。
 */
import { ICETable } from '../src/components/ICETable';

const columns = [
  {
    key: 'code',
    title: '编码',
    width: 200,
    editable: true,
    validate: (value: string) => (value ? null : '编码不能为空'),
  },
];

function setup(props: any = {}) {
  const edits: any[] = [];
  const table = new ICETable({
    columns,
    data: [{ code: 'A-1' }, { code: 'A-2' }],
    width: 300,
    rowHeight: 40,
    rowSelection: 'none',
    onCellEdit: (_row: any, key: string, value: string) => edits.push([key, value]),
    ...props,
  });
  return { table, edits };
}

describe('编辑态空值策略', () => {
  it("默认 'clear'：清空会写入空串（但有 validate 会被拦下）", () => {
    const { table, edits } = setup();
    table.startEdit(0, 'code');
    table.getEditNode()!.setValue('');
    expect(table.commitEdit()).toBe(false);
    expect(table.getEditError()).toBe('编码不能为空');
    expect(edits).toEqual([]);
  });

  it("'keep'：空值不算编辑（保留原值、不回调、直接退出）", () => {
    const { table, edits } = setup({ emptyEditBehavior: 'keep' });
    table.startEdit(0, 'code');
    table.getEditNode()!.setValue('');
    expect(table.commitEdit()).toBe(true);
    expect(table.getRows()[0].code).toBe('A-1');
    expect(edits).toEqual([]);
    expect(table.isEditing()).toBe(false);
    // 也不该冒出校验错误（空值在策略层就被拦下了）
    expect(table.getEditError()).toBe(null);
  });

  it("'keep' 下非空值照常写入", () => {
    const { table, edits } = setup({ emptyEditBehavior: 'keep' });
    table.startEdit(1, 'code');
    table.getEditNode()!.setValue('B-9');
    expect(table.commitEdit()).toBe(true);
    expect(table.getRows()[1].code).toBe('B-9');
    expect(edits).toEqual([['code', 'B-9']]);
  });

  it("'keep' 只挡「清空」：全是空白也算空", () => {
    const { table, edits } = setup({ emptyEditBehavior: 'keep' });
    table.startEdit(0, 'code');
    table.getEditNode()!.setValue('   ');
    expect(table.commitEdit()).toBe(true);
    expect(table.getRows()[0].code).toBe('A-1');
    expect(edits).toEqual([]);
  });
});
