/**
 * 列头拖拽换序。
 *
 * 与「列版式导出/还原」是一对：那一批解决了「存下来」，这一批解决「怎么改」。
 *
 * 规格：
 * - `columnDraggable: true` 时按住表头往左右拖，松手换列序；
 * - 换序后表头文案与数据列一起走（不是只挪表头）；
 * - `onColumnReorder(order, from, to)` 回调；位置没变**不回调**，并且仍然算「点表头排序」；
 * - 配套 `getColumnOrder()` / `setColumnOrder()` / `moveColumn()`；
 * - 不传 `columnDraggable` 时点表头照旧只排序（老行为）。
 */
import { ICETable } from '../src/components/ICETable';

const columns = [
  { key: 'name', title: '名称', width: 160, sorter: true },
  { key: 'city', title: '城市', width: 160 },
  { key: 'amount', title: '金额', width: 160, sorter: true },
];

const data = [{ name: 'A', city: '上海', amount: 30 }, { name: 'B', city: '北京', amount: 10 }];

function setup(props: any = {}) {
  const reorders: any[] = [];
  const table = new ICETable({
    columns,
    data: data.map((row) => ({ ...row })),
    width: 480,
    rowHeight: 40,
    rowSelection: 'none',
    columnDraggable: true,
    onColumnReorder: (order: string[], from: number, to: number) => reorders.push([order, from, to]),
    ...props,
  });
  (table as any).ice = {
    screenToWorld: (x: number, y: number) => [x, y],
    evtBus: { on() {}, off() {} },
    dirty: false,
  };
  (table as any).afterAddHandler();
  return { table, reorders };
}

const dragHeader = (table: ICETable, fromX: number, toX: number) => {
  (table as any).__onGlobalMouseDown({ offsetX: fromX, offsetY: 12, target: null });
  (table as any).__onGlobalMouseMove({ offsetX: toX, offsetY: 12 });
  (table as any).__onGlobalMouseUp();
};

describe('列头拖拽换序', () => {
  it('getColumnOrder / setColumnOrder / moveColumn 三个入口一致', () => {
    const { table } = setup();
    expect(table.getColumnOrder()).toEqual(['name', 'city', 'amount']);
    table.moveColumn(0, 2);
    expect(table.getColumnOrder()).toEqual(['city', 'amount', 'name']);
    table.setColumnOrder(['amount', 'name', 'city']);
    expect(table.getColumnOrder()).toEqual(['amount', 'name', 'city']);
  });

  it('拖表头换序：回调 + 列序跟着变', () => {
    const { table, reorders } = setup();
    dragHeader(table, 10, 200);
    expect(table.getColumnOrder()).toEqual(['city', 'name', 'amount']);
    expect(reorders[0][0]).toEqual(['city', 'name', 'amount']);
    expect(reorders[0][1]).toBe(0);
    expect(reorders[0][2]).toBe(1);
  });

  it('换序后宽度仍按列 key 对得上（不是按位置记的）', () => {
    const { table } = setup();
    table.moveColumn(0, 1);
    const widths = table.getColumnWidths();
    expect(table.getColumnOrder()[0]).toBe('city');
    expect(widths.city).toBe(160);
    expect(widths.name).toBe(160);
  });

  it('位置没变：不回调，而且仍算「点表头排序」', () => {
    const { table, reorders } = setup();
    dragHeader(table, 10, 12);
    expect(reorders).toEqual([]);
    expect(table.getSortState()).toEqual({ key: 'name', order: 'asc' });
  });

  it('不传 columnDraggable：点表头只排序（老行为）', () => {
    const { table, reorders } = setup({ columnDraggable: false });
    (table as any).__onGlobalMouseDown({ offsetX: 10, offsetY: 12, target: null });
    expect(table.getSortState()).toEqual({ key: 'name', order: 'asc' });
    expect(reorders).toEqual([]);
  });
});
