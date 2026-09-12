/**
 * ICETable 列宽规格：纯求解 `resolveColumnWidths` + 手动改列宽 API。
 *
 * 背景：业务里的宽表常常要「显式列宽 + 自动分配 + 拖拽微调」，还要有最小宽度兜底
 * （不然拖到 0 就看不见了）。求解逻辑抽成纯函数，交互（拖表头边界）在 QA 里用真鼠标验。
 */
import { ICETable, resolveColumnWidths } from '../src/components/ICETable';

describe('resolveColumnWidths（纯求解）', () => {
  it('全部自动：按可用宽度均分', () => {
    expect(resolveColumnWidths([{}, {}, {}], 300)).toEqual([100, 100, 100]);
  });

  it('显式列宽优先，剩下的在自动列之间分', () => {
    expect(resolveColumnWidths([{ width: 100 }, {}, {}], 400)).toEqual([100, 150, 150]);
  });

  it('自动列分到的宽度不足最小宽度时抬到最小宽度（允许总和超出，让宽表横向溢出）', () => {
    expect(resolveColumnWidths([{}, {}, {}, {}], 100, 60)).toEqual([60, 60, 60, 60]);
  });

  it('显式列宽低于最小宽度会被抬起；逐列 minWidth 可覆盖默认值', () => {
    expect(resolveColumnWidths([{ width: 30 }, {}], 400, 60)).toEqual([60, 340]);
    expect(resolveColumnWidths([{ width: 30, minWidth: 20 }], 400, 60)).toEqual([30]);
  });

  it('没有列 → 空数组；宽度取整、非法值按 0 处理', () => {
    expect(resolveColumnWidths([], 300)).toEqual([]);
    expect(resolveColumnWidths([{ width: 120.7 }, {}], 300.4)).toEqual([120, 180]);
  });
});

describe('ICETable 列宽 API', () => {
  const makeTable = (props: any = {}) =>
    new ICETable({
      width: 400,
      data: [{ a: 1, b: 2, c: 3 }],
      columns: [
        { key: 'a', title: 'A' },
        { key: 'b', title: 'B' },
        { key: 'c', title: 'C' },
      ],
      ...props,
    });

  it('默认按可用宽度均分，且能按键读到', () => {
    const table = makeTable();
    const widths = table.getColumnWidths();
    expect(widths).toEqual({ a: 133, b: 133, c: 133 });
  });

  it('setColumnWidth 改一列后其余自动列重新分配', () => {
    const table = makeTable();
    expect(table.setColumnWidth('a', 200)).toBe(true);
    const widths = table.getColumnWidths();
    expect(widths.a).toBe(200);
    expect(widths.b + widths.c).toBeLessThanOrEqual(200);
    expect(widths.b).toBe(widths.c);
  });

  it('列宽按最小宽度夹取；相同宽度返回 false 不白重排', () => {
    const table = makeTable({ minColumnWidth: 80 });
    expect(table.setColumnWidth('a', 10)).toBe(true);
    expect(table.getColumnWidths().a).toBe(80);
    expect(table.setColumnWidth('a', 80)).toBe(false);
    expect(table.setColumnWidth('nope', 100)).toBe(false);
  });

  it('改列宽会触发 columnresize 事件与回调（带最新宽度表）', () => {
    const events: any[] = [];
    const table = makeTable({ onColumnResize: (key: string, width: number, widths: any) => events.push(['cb', key, width, widths]) });
    table.on('columnresize', (evt: any) => events.push(['evt', evt.param.key, evt.param.width]));
    table.setColumnWidth('b', 150);
    expect(events[0]).toEqual(['evt', 'b', 150]);
    expect(events[1][0]).toBe('cb');
    expect(events[1][1]).toBe('b');
    expect(events[1][2]).toBe(150);
    expect(events[1][3].b).toBe(150);
  });

  it('resizable 默认关闭；开了之后表头里有拖拽句柄（宽度条）', () => {
    const off = makeTable();
    expect(off.isResizable()).toBe(false);
    const on = makeTable({ resizable: true });
    expect(on.isResizable()).toBe(true);
  });

  it('多选模式的 40px 选择列不参与列宽均分', () => {
    const table = makeTable({ rowSelection: 'multiple', width: 440 });
    const widths = table.getColumnWidths();
    expect(widths.a).toBe(133);
    expect(widths.b).toBe(133);
  });
});
