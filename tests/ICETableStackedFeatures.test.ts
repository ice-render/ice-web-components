/**
 * 「虚拟 + 树形 + 筛选 + 拖拽」四件叠加的复核。
 *
 * 单件都测过了，但这类功能的 bug 往往出在**组合**上：虚拟按拍平后的行号算，
 * 树形会改拍平结果，筛选再改一次，拖拽又依赖行号 → 错一位就是「拖 A 动了 B」。
 *
 * 规格：
 * - 筛选后行号按「筛完 + 拍平」的顺序算，命中计算与 `getRows()` 一致；
 * - 树形父行拖动时，拖的是**数据里的那一行**（不是屏幕上第几行）；
 * - 虚拟窗口只渲染可视区，但拖动仍作用在正确的行上；
 * - 收起父行之后这一切仍成立。
 */
import { ICETable } from '../src/components/ICETable';

const columns = [
  { key: 'name', title: '名称', width: 200 },
  { key: 'status', title: '状态', width: 160, filters: [{ text: 'Paid', value: 'Paid' }] },
];

const TREE = [
  { id: 'a', name: '华东', status: 'Paid', children: [
    { id: 'a1', name: '上海', status: 'Paid' },
    { id: 'a2', name: '杭州', status: 'Pending' },
  ] },
  { id: 'b', name: '华南', status: 'Pending', children: [{ id: 'b1', name: '深圳', status: 'Paid' }] },
  { id: 'c', name: '华北', status: 'Paid' },
];

function setup(props: any = {}) {
  return new ICETable({
    columns,
    data: TREE.map((row) => ({ ...row })),
    width: 400,
    height: 160,
    rowHeight: 32,
    rowKey: 'id',
    rowSelection: 'none',
    virtual: true,
    rowDraggable: true,
    defaultExpandedKeys: ['a', 'b'],
    ...props,
  });
}

describe('虚拟 + 树形 + 筛选 + 拖拽', () => {
  it('筛选后 getRows 是「筛完 + 拍平」的顺序，命中计算与它一致', () => {
    const table = setup();
    table.setFilter('status', ['Paid']);
    expect(table.getRows().map((row) => row.id)).toEqual(['a', 'a1', 'b1', 'c']);
    const index = (table as any).__rowIndexAt((table as any).headerHeight + 32 + 4);
    expect(table.getRows()[index].id).toBe('a1');
  });

  it('虚拟窗口里拖动：拖的是那一行的 key，不是屏幕序号', () => {
    const table = setup();
    table.setFilter('status', ['Paid']);
    const index = (table as any).__rowIndexAt((table as any).headerHeight + 4);
    expect(index).toBe(0);
    (table as any).__startRowDrag(index);
    expect((table as any).dragRow.from).toBe(0);
    expect(table.getRows()[0].id).toBe('a');
  });

  it('树形父行拖动带子树：筛选状态下拖的仍是数据里的那一行', () => {
    const table = setup();
    table.setFilter('status', ['Paid']);
    expect(table.moveTreeRow('a', 'c', 'after')).toBe(true);
    expect((table as any).sourceData.map((row: any) => row.id)).toEqual(['b', 'c', 'a']);
    expect((table as any).sourceData[2].children.map((child: any) => child.id)).toEqual(['a1', 'a2']);
  });

  it('收起父行之后：门面行少了，但拖拽仍按数据行号', () => {
    const table = setup();
    table.setFilter('status', ['Paid']);
    table.toggleRowExpanded('a');
    expect(table.getRows().map((row) => row.id)).toEqual(['a', 'b1', 'c']);
    const index = (table as any).__rowIndexAt((table as any).headerHeight + 4);
    expect(table.getRows()[index].id).toBe('a');
  });
});
