/**
 * 树形数据 + 列宽拖拽：列宽是全表共享的，父子行必须对齐。
 *
 * 规格：
 * - 拖宽某列后，父行与子行的同一列都跟着变（不是只改父行）；
 * - 收 / 展不改变列宽；
 * - 换序之后列宽按 key 跟着走（不是按位置）。
 */
import { ICETable } from '../src/components/ICETable';

const columns = [
  { key: 'name', title: '名称', width: 200, minWidth: 80 },
  { key: 'count', title: '数量', width: 160, minWidth: 80 },
];

const TREE = [
  { id: 'a', name: 'A', count: 1, children: [{ id: 'a1', name: 'A1', count: 2 }] },
  { id: 'b', name: 'B', count: 3 },
];

function setup(props: any = {}) {
  return new ICETable({
    columns,
    data: TREE.map((row) => ({ ...row })),
    width: 400,
    rowHeight: 40,
    rowKey: 'id',
    rowSelection: 'none',
    resizable: true,
    defaultExpandedKeys: ['a'],
    ...props,
  });
}

describe('树形 + 列宽', () => {
  it('拖宽某列：宽度按全表算，父子行同列一致', () => {
    const table = setup();
    table.setColumnWidth('name', 300);
    const widths = table.getColumnWidths();
    expect(widths.name).toBe(300);
    // 其它列是显式宽度，不会被「重新分配」（宽表本就允许总宽溢出，横向滚动兜底）
    expect(widths.count).toBe(160);
  });

  it('列宽与层级无关：收起 / 展开不改变列宽', () => {
    const table = setup();
    table.setColumnWidth('name', 260);
    table.toggleRowExpanded('a');
    expect(table.getColumnWidths().name).toBe(260);
    table.toggleRowExpanded('a');
    expect(table.getColumnWidths().name).toBe(260);
  });

  it('换序之后列宽按 key 跟着走（不是按位置）', () => {
    const table = setup({ columnDraggable: true });
    table.setColumnWidth('name', 300);
    table.moveColumn(0, 1);
    expect(table.getColumnOrder()).toEqual(['count', 'name']);
    expect(table.getColumnWidths().name).toBe(300);
  });
});
