/**
 * 列头拖拽时的落点指示线。
 *
 * 没有反馈的拖拽 = 用户不知道松手会落到哪（上一批只做了「拖完生效」）。
 *
 * 规格：
 * - 拖拽中在「落点列的边界」画一条竖线；`getColumnDropIndicatorBox()` 给位置；
 * - 拖回原列（等于没动）时指示线隐藏；
 * - 松手后指示线消失（无论换序成功与否）；
 * - 不传 `columnDraggable` 时压根没有指示线。
 */
import { ICETable } from '../src/components/ICETable';

const columns = [
  { key: 'name', title: '名称', width: 160, sorter: true },
  { key: 'city', title: '城市', width: 160 },
  { key: 'amount', title: '金额', width: 160 },
];

function setup(props: any = {}) {
  const table = new ICETable({
    columns,
    data: [{ name: 'A', city: '上海', amount: 1 }],
    width: 480,
    rowHeight: 40,
    rowSelection: 'none',
    columnDraggable: true,
    ...props,
  });
  (table as any).ice = {
    screenToWorld: (x: number, y: number) => [x, y],
    evtBus: { on() {}, off() {} },
    dirty: false,
  };
  (table as any).afterAddHandler();
  return table;
}

describe('列头拖拽落点指示线', () => {
  it('拖拽中显示指示线，位置落在落点列边界上', () => {
    const table = setup();
    expect(table.getColumnDropIndicatorBox()).toBe(null);
    (table as any).__onGlobalMouseDown({ offsetX: 10, offsetY: 12, target: null });
    (table as any).__onGlobalMouseMove({ offsetX: 200, offsetY: 12 });
    const box = table.getColumnDropIndicatorBox();
    expect(box).toBeTruthy();
    // 往后拖（第 1 列 → 第 2 列）：指示线落在目标列的**右边界**（表示「插到它后面」）
    expect(Number(box!.left)).toBeGreaterThanOrEqual(310);
    expect(Number(box!.left)).toBeLessThanOrEqual(325);
    expect(Number(box!.height)).toBeGreaterThan(0);
  });

  it('拖回原列：指示线隐藏（等于没动）', () => {
    const table = setup();
    (table as any).__onGlobalMouseDown({ offsetX: 10, offsetY: 12, target: null });
    (table as any).__onGlobalMouseMove({ offsetX: 200, offsetY: 12 });
    expect(table.getColumnDropIndicatorBox()).toBeTruthy();
    (table as any).__onGlobalMouseMove({ offsetX: 12, offsetY: 12 });
    expect(table.getColumnDropIndicatorBox()).toBe(null);
  });

  it('松手后指示线消失', () => {
    const table = setup();
    (table as any).__onGlobalMouseDown({ offsetX: 10, offsetY: 12, target: null });
    (table as any).__onGlobalMouseMove({ offsetX: 200, offsetY: 12 });
    (table as any).__onGlobalMouseUp();
    expect(table.getColumnDropIndicatorBox()).toBe(null);
  });

  it('不开 columnDraggable：没有指示线', () => {
    const table = setup({ columnDraggable: false });
    (table as any).__onGlobalMouseDown({ offsetX: 10, offsetY: 12, target: null });
    (table as any).__onGlobalMouseMove({ offsetX: 200, offsetY: 12 });
    expect(table.getColumnDropIndicatorBox()).toBe(null);
  });
});
