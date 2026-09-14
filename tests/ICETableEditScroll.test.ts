/**
 * 编辑态的 Tab 流转要能把目标行**滚进可视区**。
 *
 * 场景：虚拟滚动的长表格里，Tab 到下一行时那一行可能还在视口外 —— 用户看不见自己在改什么。
 *
 * 规格：
 * - Tab 到视口外的行时自动滚动，让目标行出现在可视窗口里；
 * - 滚动之后编辑框仍按**内容坐标**盖在那一行上（不是按屏幕坐标）。
 */
import { ICETable } from '../src/components/ICETable';

const columns = [
  { key: 'name', title: '名称', width: 200, editable: true },
  { key: 'note', title: '备注', width: 200, editable: true },
];

const bigData = Array.from({ length: 200 }, (_, index) => ({ id: 'r' + index, name: '名称 ' + index, note: '' }));

function setup(props: any = {}) {
  return new ICETable({
    columns,
    data: bigData.map((row) => ({ ...row })),
    width: 400,
    height: 200,
    rowHeight: 24,
    rowKey: 'id',
    rowSelection: 'none',
    virtual: true,
    ...props,
  });
}

describe('编辑 Tab 到视口外的行', () => {
  it('Tab 到下一行时把目标行滚进可视区', () => {
    const table = setup();
    // 从「最后一格」出发：Tab 才会跨行（view 里大约能放下 6~7 行）
    table.startEdit(6, 'note');
    table.getEditNode()!.trigger('keydown', { key: 'Tab' });
    expect(table.getEditingCell()).toEqual({ rowIndex: 7, key: 'name' });
    const range = table.getRowRange();
    expect(range.start).toBeLessThanOrEqual(7);
    expect(range.end).toBeGreaterThan(7);
  });

  it('编辑框按内容坐标定位：加过滚动量之后仍然盖在那一行', () => {
    const table = setup();
    table.startEdit(6, 'note');
    table.getEditNode()!.trigger('keydown', { key: 'Tab' });
    const node = table.getEditNode()!;
    // 可滚动模式里编辑框和行一起挂在 bodyContent 上：top 是内容坐标（不含表头、不含滚动量）
    expect(Number(node.state.top)).toBe(7 * 24 + 4);
    expect(node.parentNode).toBe((table as any).bodyContent);
  });

  it('分页表格里 Tab 到最后一行：停在原地，不擅自翻页', () => {
    const table = setup({ virtual: false, height: undefined, pagination: { pageSize: 3 } });
    table.startEdit(2, 'note');
    table.getEditNode()!.trigger('keydown', { key: 'Tab' });
    expect(table.getPage()).toBe(1);
    expect(table.isEditing()).toBe(false);
  });
});
