/**
 * ICETable 行选择：单选（默认，行为不变）+ 多选（rowSelection: 'multiple'）。
 *
 * 规格：
 * - 默认单选：点行选中，`getSelectedIndex()` / `setSelectedRow()` 老 API 不变，不渲染选择列；
 * - 多选：最左边多出 40px 选择列（表头全选 + 每行一个复选框），内容列整体右移；
 * - 点子复选框切换该行；`selectAll()` / `clearSelection()`；`getSelectedRows()` 按行序返回；
 * - 选择变化触发 `selectionchange` 事件与 `onSelectionChange` 回调；
 * - 多选模式下点「行」本身也切换该行（不再走 onSelect）。
 */
import { ICECheckBox } from '../src/components/ICECheckBox';
import { ICETable } from '../src/components/ICETable';

const columns = [
  { key: 'name', title: 'Name', width: 200 },
  { key: 'amount', title: 'Amount', width: 200 },
];

const data = [
  { name: 'A', amount: 30 },
  { name: 'B', amount: 10 },
  { name: 'C', amount: 40 },
];

const makeTable = (extra: any = {}) => new ICETable({ columns, data, width: 600, rowHeight: 40, ...extra });

/** 取第 index 行的复选框（行的第一个子节点）。 */
const rowCheckbox = (table: any, index: number) => table.childNodes[index + 1].childNodes[0] as ICECheckBox;

describe('ICETable 单选（默认行为不变）', () => {
  it('不渲染选择列；点行选中', () => {
    const table = makeTable();
    expect(table.getSelectionMode()).toBe('single');
    expect(table.childNodes.some((node: any) => node instanceof ICECheckBox)).toBe(false);
    table.setSelectedRow(1);
    expect(table.getSelectedIndex()).toBe(1);
    expect(table.getSelectedRows().map((row) => row.name)).toEqual(['B']);
  });
});

describe('ICETable 多选', () => {
  it('渲染表头全选 + 每行复选框，内容列右移 40px', () => {
    const table = makeTable({ rowSelection: 'multiple' });
    expect(table.getSelectionMode()).toBe('multiple');
    const header = table.childNodes[0];
    expect(header.childNodes[0] instanceof ICECheckBox).toBe(true);
    expect(rowCheckbox(table, 0) instanceof ICECheckBox).toBe(true);
    // 第一列文本（header 里除复选框外的第一个文本节点）在 40 之后
    const headerText = header.childNodes.find((node: any) => node.state && node.state.text === 'Name');
    expect(headerText.state.left).toBeGreaterThanOrEqual(40);
  });

  it('点子复选框勾选/取消，getSelectedRows 按行序返回', () => {
    const table = makeTable({ rowSelection: 'multiple' });
    rowCheckbox(table, 0).trigger('mousedown', null, {});
    expect(table.getSelectedRows().map((row) => row.name)).toEqual(['A']);
    rowCheckbox(table, 2).trigger('mousedown', null, {});
    expect(table.getSelectedRows().map((row) => row.name)).toEqual(['A', 'C']);
    expect(table.getSelectedIndexes()).toEqual([0, 2]);
    rowCheckbox(table, 0).trigger('mousedown', null, {});
    expect(table.getSelectedRows().map((row) => row.name)).toEqual(['C']);
  });

  it('selectAll / clearSelection；表头复选框全选与取消', () => {
    const table = makeTable({ rowSelection: 'multiple' });
    const headerCheckbox = table.childNodes[0].childNodes[0] as ICECheckBox;
    headerCheckbox.trigger('mousedown', null, {});
    expect(table.getSelectedRows()).toHaveLength(3);
    headerCheckbox.trigger('mousedown', null, {});
    expect(table.getSelectedRows()).toHaveLength(0);
    table.selectAll();
    expect(table.getSelectedIndexes()).toEqual([0, 1, 2]);
    table.clearSelection();
    expect(table.getSelectedRows()).toEqual([]);
  });

  it('选择变化触发 selectionchange 事件与 onSelectionChange 回调', () => {
    const events: Array<{ indexes: number[] }> = [];
    const picked: string[][] = [];
    const table = makeTable({
      rowSelection: 'multiple',
      onSelectionChange: (rows: any[]) => picked.push(rows.map((row) => row.name)),
    });
    table.on('selectionchange', (evt: any) => events.push({ indexes: evt.param.indexes }));
    rowCheckbox(table, 1).trigger('mousedown', null, {});
    expect(events).toEqual([{ indexes: [1] }]);
    expect(picked).toEqual([['B']]);
  });

  it('多选模式下点行本身切换选中，不走 onSelect', () => {
    let selects = 0;
    const table = makeTable({ rowSelection: 'multiple', onSelect: () => (selects += 1) });
    // 命中检测需要 ice.screenToWorld（这里用恒等映射）
    (table as any).ice = { screenToWorld: (x: number, y: number) => [x, y], evtBus: { on() {}, off() {} } };
    const row = table.childNodes[1];
    (table as any).__onGlobalMouseDown({ offsetX: 300, offsetY: 60, target: row });
    expect(table.getSelectedRows().map((row) => row.name)).toEqual(['A']);
    expect(selects).toBe(0);
    (table as any).__onGlobalMouseDown({ offsetX: 300, offsetY: 60, target: row });
    expect(table.getSelectedRows()).toEqual([]);
  });

  it('setData 后清空选择', () => {
    const table = makeTable({ rowSelection: 'multiple' });
    table.selectAll();
    table.setData(data.slice(0, 2));
    expect(table.getSelectedRows()).toEqual([]);
  });
});
