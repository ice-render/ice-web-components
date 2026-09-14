/**
 * 编辑态的「点别处自动提交」。
 *
 * 规格：
 * - 正在编辑时点到编辑框以外（别的单元格 / 行 / 表格外）→ 先把这一格提交，再走原来的点击逻辑；
 * - 点到编辑框里面不提交（那是正常编辑操作）。
 */
import { ICETable } from '../src/components/ICETable';

const columns = [
  { key: 'name', title: '名称', width: 240, editable: true },
  { key: 'count', title: '数量', width: 120, align: 'right' as const },
];

const data = [{ name: 'A', count: 1 }, { name: 'B', count: 2 }];

function setup(props: any = {}) {
  const edits: any[] = [];
  const ice: any = {
    canvasWidth: 800,
    canvasHeight: 600,
    toolNodes: [],
    dirty: false,
    evtBus: { on() {}, off() {}, trigger() {} },
    addTool: () => {},
    removeTool: () => {},
    screenToWorld: (x: number, y: number) => [x, y],
    getRenderViewport: () => ({ scale: 1, tx: 0, ty: 0 }),
    setFocusedComponent: () => {},
    getFocusedComponent: () => null,
  };
  const table = new ICETable({
    columns,
    data: data.map((row) => ({ ...row })),
    width: 400,
    rowHeight: 40,
    rowSelection: 'none',
    onCellEdit: (row: any, key: string, value: string) => edits.push([key, value]),
    ...props,
  });
  (table as any).ice = ice;
  (table as any).afterAddHandler();
  return { table, edits };
}

describe('编辑态失焦提交', () => {
  it('点到别的格子：先提交这一格，再进新格子的编辑态', () => {
    const { table, edits } = setup();
    table.startEdit(0, 'name');
    table.getEditNode()!.setValue('A改');
    // 模拟点到第二行的可编辑格子（第二行第 0 列：x≈10, y≈36+40+10）
    (table as any).__onGlobalMouseDown({ offsetX: 10, offsetY: 86, target: null, stopPropagation() {} });
    expect(edits).toEqual([['name', 'A改']]);
    expect(table.getEditingCell()).toEqual({ rowIndex: 1, key: 'name' });
  });

  it('点到非编辑列：提交后不再进编辑态', () => {
    const { table, edits } = setup();
    table.startEdit(0, 'name');
    table.getEditNode()!.setValue('A改');
    // 第二列（数量）：x≈300
    (table as any).__onGlobalMouseDown({ offsetX: 300, offsetY: 56, target: null, stopPropagation() {} });
    expect(edits).toEqual([['name', 'A改']]);
    expect(table.isEditing()).toBe(false);
  });

  it('点在编辑框里面不提交', () => {
    const { table, edits } = setup();
    table.startEdit(0, 'name');
    const node = table.getEditNode()!;
    node.setValue('编辑中');
    (table as any).__onGlobalMouseDown({ offsetX: 10, offsetY: 46, target: node, stopPropagation() {} });
    expect(edits).toEqual([]);
    expect(table.isEditing()).toBe(true);
  });
});
