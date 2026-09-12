/**
 * ICETable 行拖拽排序规格（`rowDraggable` + `moveRow`）。
 *
 * 落点计算与数组移动是纯函数（见 ICEDragReorder 单测），这里测表格这一层：
 * - `moveRow` 真的改顺序、同步 `sourceData`（无排序时）、触发事件与回调；
 * - 拖回原位 / 越界不算移动；
 * - 分页表格里移动的是当前页的数据顺序；
 * - 默认关闭（不开 `rowDraggable` 就完全没有拖拽这套东西）。
 */
import { ICETable } from '../src/components/ICETable';

const makeRows = () => [
  { name: 'A', city: '杭州' },
  { name: 'B', city: '上海' },
  { name: 'C', city: '北京' },
  { name: 'D', city: '深圳' },
];

const COLUMNS = [
  { key: 'name', title: '姓名', sorter: true },
  { key: 'city', title: '城市' },
];

const makeTable = (props: any = {}) => new ICETable({ width: 320, columns: COLUMNS, data: makeRows(), ...props });
const names = (table: ICETable) => table.getRows().map((row: any) => row.name);

describe('行拖拽排序', () => {
  it('默认关闭；开了之后 isRowDraggable 为真，且一开始没有落点', () => {
    expect(makeTable().isRowDraggable()).toBe(false);
    const table = makeTable({ rowDraggable: true });
    expect(table.isRowDraggable()).toBe(true);
    expect(table.getDropTarget()).toBeNull();
    expect(table.isRowDragging()).toBe(false);
  });

  it('moveRow：把第 0 行拖到第 2 行之后', () => {
    const table = makeTable({ rowDraggable: true });
    expect(table.moveRow(0, { index: 2, position: 'after' })).toBe(true);
    expect(names(table)).toEqual(['B', 'C', 'A', 'D']);
  });

  it('moveRow：往上拖 插到目标行之前', () => {
    const table = makeTable({ rowDraggable: true });
    expect(table.moveRow(3, { index: 1, position: 'before' })).toBe(true);
    expect(names(table)).toEqual(['A', 'D', 'B', 'C']);
  });

  it('拖回原位 / 越界不算移动（返回 false，顺序不变）', () => {
    const table = makeTable({ rowDraggable: true });
    expect(table.moveRow(1, { index: 1, position: 'before' })).toBe(false);
    expect(table.moveRow(1, { index: 0, position: 'after' })).toBe(false);
    expect(table.moveRow(9, { index: 0, position: 'before' })).toBe(false);
    expect(names(table)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('触发 rowreorder 事件与 onRowReorder 回调（带新顺序）', () => {
    const events: any[] = [];
    const table = makeTable({
      rowDraggable: true,
      onRowReorder: (from: number, to: number, rows: any[]) => events.push(['cb', from, to, rows.map((r) => r.name)]),
    });
    table.on('rowreorder', (evt: any) => events.push(['evt', evt.param.from, evt.param.to]));
    table.moveRow(0, { index: 1, position: 'after' });
    expect(events[0]).toEqual(['evt', 0, 1]);
    expect(events[1]).toEqual(['cb', 0, 1, ['B', 'A', 'C', 'D']]);
  });

  it('排序被点过之后，拖拽只动当前顺序，不会把原序冲掉', () => {
    const table = makeTable({ rowDraggable: true });
    table.toggleSort('name'); // 升序
    expect(names(table)).toEqual(['A', 'B', 'C', 'D']);
    table.moveRow(0, { index: 2, position: 'after' });
    expect(names(table)).toEqual(['B', 'C', 'A', 'D']);
    // 再点两次表头：降序 → 恢复原序（原序仍是 A,B,C,D，因为排序激活时不同步 sourceData）
    table.toggleSort('name');
    table.toggleSort('name');
    expect(names(table)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('分页表：拖的是「当前页内的行」，只影响这一页（下标要换算成绝对下标）', () => {
    const table = makeTable({ rowDraggable: true, pagination: { pageSize: 2 } });
    expect(names(table)).toEqual(['A', 'B']); // 第 1 页
    table.setPage(2);
    expect(names(table)).toEqual(['C', 'D']);
    // 把本页第 0 行（C）拖到第 1 行（D）之后 → 本页变 D, C；第 1 页仍是 A, B
    expect(table.moveRow(0, { index: 1, position: 'after' })).toBe(true);
    expect(names(table)).toEqual(['D', 'C']);
    table.setPage(1);
    expect(names(table)).toEqual(['A', 'B']);
  });
});
