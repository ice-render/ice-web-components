/**
 * 列宽的用户偏好要存得下来、回得去。
 *
 * 场景：用户把「客户」列拖宽了，刷新页面又变回去 —— 这是后台最容易被投诉的一类小毛病。
 * 组件这侧要提供「导出当前版式 / 按版式还原」这对 API，存哪儿（localStorage / 后端）由业务决定。
 *
 * 规格：
 * - `getColumnState()`：给每列的宽度（拖过之后是拖后的值）与列顺序；
 * - `setColumnState(state)`：按 key 还原宽度；未知 key 忽略、缺的列保持原样；
 * - 能 JSON 往返（`JSON.parse(JSON.stringify(state))` 之后照样还原）；
 * - 还原之后渲染的列宽真的变了。
 */
import { ICETable } from '../src/components/ICETable';

const columns = [
  { key: 'name', title: '名称', width: 200, minWidth: 80 },
  { key: 'city', title: '城市', width: 160, minWidth: 80 },
  { key: 'amount', title: '金额', width: 140, minWidth: 80 },
];

function setup(props: any = {}) {
  const table = new ICETable({
    columns,
    data: [{ name: 'A', city: '上海', amount: 1 }],
    width: 600,
    rowHeight: 40,
    rowSelection: 'none',
    resizable: true,
    ...props,
  });
  return table;
}

describe('列宽版式导出 / 还原', () => {
  it('getColumnState 给每列宽度与顺序', () => {
    const table = setup();
    const state = table.getColumnState();
    expect(state.order).toEqual(['name', 'city', 'amount']);
    expect(state.widths.name).toBe(200);
  });

  it('拖过之后的宽度会被导出', () => {
    const table = setup();
    table.setColumnWidth('city', 260);
    expect(table.getColumnState().widths.city).toBe(260);
  });

  it('setColumnState 还原宽度；未知 key 忽略', () => {
    const table = setup();
    table.setColumnState({ widths: { city: 300, nope: 999 } });
    expect(table.getColumnWidths().city).toBe(300);
    expect(table.getColumnState().order).toEqual(['name', 'city', 'amount']);
  });

  it('JSON 往返可行（业务侧就这么存）', () => {
    const first = setup();
    first.setColumnWidth('name', 320);
    const saved = JSON.parse(JSON.stringify(first.getColumnState()));
    const second = setup();
    second.setColumnState(saved);
    expect(second.getColumnWidths().name).toBe(320);
  });

  it('还原会夹到最小宽度（存了脏数据也不会把列压没）', () => {
    const table = setup();
    table.setColumnState({ widths: { name: 10 } });
    expect(table.getColumnWidths().name).toBeGreaterThanOrEqual(80);
  });
});
