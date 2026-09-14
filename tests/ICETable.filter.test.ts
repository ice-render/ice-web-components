/**
 * ICETable 的「分析半边」之一：列筛选 + 汇总行。
 *
 * 规格（不动虚拟化内核：筛选只改「喂给渲染的行」，汇总只是表格底部多一行）：
 * - 列上声明 `filters: [{ text, value }]` 后表头出现漏斗标记（未激活 ▾ / 已激活 ●）；
 * - 同一列多个值 = **或**，跨列 = **与**；空数组 = 该列不筛；
 * - 筛选发生在排序与分页**之前**：`getTotalRows()` / 分页器口径都是筛选后的数量；
 *   过滤条件一变就回到第 1 页（否则用户会停在一个已经不存在的页码上）；
 * - 点表头漏斗打开候选面板（选项逐条开关、立即生效），点外 / Esc 关闭；
 * - `summary(rows, columns)` 返回一行文案，渲染在表格底部，**按筛选后的全量行**算
 *   （不是当前页 —— 分页时的合计必须是全量的，不然翻页就变了）；
 * - 筛选后 0 行时不渲染汇总行（没东西可汇总，留着反而是空一行）。
 */
import { ICETable } from '../src/components/ICETable';

const columns = [
  { key: 'name', title: 'Name' },
  {
    key: 'status',
    title: 'Status',
    filters: [
      { text: '已支付', value: 'Paid' },
      { text: '待处理', value: 'Pending' },
      { text: '已发货', value: 'Shipped' },
    ],
  },
  { key: 'city', title: 'City', filters: [{ text: '华东', value: '华东' }, { text: '华南', value: '华南' }] },
  { key: 'amount', title: 'Amount', align: 'right' as const, sorter: true },
];

const data = [
  { name: 'A', status: 'Paid', city: '华东', amount: 100 },
  { name: 'B', status: 'Pending', city: '华南', amount: 200 },
  { name: 'C', status: 'Paid', city: '华南', amount: 300 },
  { name: 'D', status: 'Shipped', city: '华东', amount: 400 },
  { name: 'E', status: 'Pending', city: '华东', amount: 500 },
];

/** 表格的浮层（筛选候选面板）需要 ICE 场景：给一个最小替身。 */
function setup(props: any = {}) {
  const handlers: Record<string, Array<{ handler: any; ctx: any }>> = {};
  const ice: any = {
    canvasWidth: 900,
    canvasHeight: 600,
    toolNodes: [],
    dirty: false,
    evtBus: {
      on(name: string, handler: any, ctx: any) {
        (handlers[name] = handlers[name] || []).push({ handler, ctx });
      },
      off(name: string, handler: any) {
        handlers[name] = (handlers[name] || []).filter((entry) => entry.handler !== handler);
      },
      trigger(name: string, evt: any) {
        (handlers[name] || []).forEach((entry) => entry.handler.call(entry.ctx, evt));
      },
    },
    addTool: (tool: any) => ice.toolNodes.push(tool),
    removeTool: (tool: any) => {
      const index = ice.toolNodes.indexOf(tool);
      if (index !== -1) ice.toolNodes.splice(index, 1);
    },
    setFocusedComponent: () => {},
    getFocusedComponent: () => null,
    screenToWorld: (x: number, y: number) => [x, y],
    getRenderViewport: () => ({ scale: 1, tx: 0, ty: 0 }),
  };
  const table = new ICETable({ columns, data, width: 600, rowHeight: 40, ...props });
  (table as any).ice = ice;
  (table as any).afterAddHandler();
  return { ice, table };
}

describe('列筛选：取值与语义', () => {
  it('没设过筛选时状态为空，行数 = 全部', () => {
    const { table } = setup();
    expect(table.getFilterState()).toEqual({});
    expect(table.getFilteredRows().length).toBe(5);
    expect(table.getTotalRows()).toBe(5);
  });

  it('单列多值 = 或：勾「已支付」+「待处理」剩下这两类', () => {
    const { table } = setup();
    table.setFilter('status', ['Paid', 'Pending']);
    expect(table.getFilteredRows().map((row) => row.name)).toEqual(['A', 'B', 'C', 'E']);
    expect(table.getTotalRows()).toBe(4);
    expect(table.getFilterState()).toEqual({ status: ['Paid', 'Pending'] });
  });

  it('跨列 = 与：状态与城市同时命中才算', () => {
    const { table } = setup();
    table.setFilter('status', ['Paid']);
    table.setFilter('city', ['华南']);
    expect(table.getFilteredRows().map((row) => row.name)).toEqual(['C']);
  });

  it('空数组 = 该列不筛；clearFilters() 一次清干净', () => {
    const { table } = setup();
    table.setFilter('status', ['Paid']);
    table.setFilter('city', ['华东']);
    table.setFilter('status', []);
    expect(table.getFilteredRows().map((row) => row.name)).toEqual(['A', 'D', 'E']);
    table.clearFilters();
    expect(table.getFilterState()).toEqual({});
    expect(table.getFilteredRows().length).toBe(5);
  });

  it('筛选发生在排序与分页之前：口径是「筛选后」的全量', () => {
    const { table } = setup({ pagination: { pageSize: 2 } });
    table.setFilter('status', ['Paid', 'Pending']);
    expect(table.getTotalRows()).toBe(4);
    expect(table.getPageCount()).toBe(2);
    expect(table.getRows().map((row) => row.name)).toEqual(['A', 'B']);
    table.sortBy('amount', 'desc');
    expect(table.getRows().map((row) => row.amount)).toEqual([500, 300]);
  });

  it('过滤条件一变就回到第 1 页（别停在已经不存在的页码上）', () => {
    const { table } = setup({ pagination: { pageSize: 2 } });
    table.setPage(3);
    expect(table.getPage()).toBe(3);
    table.setFilter('status', ['Pending']);
    expect(table.getPage()).toBe(1);
    expect(table.getRows().map((row) => row.name)).toEqual(['B', 'E']);
  });

  it('onFilterChange 收到列 key 与当前取值', () => {
    const seen: Array<[string, string[]]> = [];
    const { table } = setup({ onFilterChange: (key: string, values: string[]) => seen.push([key, values]) });
    table.setFilter('status', ['Paid']);
    table.setFilter('status', []);
    expect(seen).toEqual([
      ['status', ['Paid']],
      ['status', []],
    ]);
  });
});

describe('列筛选：表头与候选面板', () => {
  it('表头标记：有候选未激活是 ▾，激活后是 ●；普通列不带标记', () => {
    const { table } = setup();
    expect(table.getHeaderLabel('name')).toBe('Name');
    expect(table.getHeaderLabel('status')).toBe('Status ▾');
    table.setFilter('status', ['Paid']);
    expect(table.getHeaderLabel('status')).toBe('Status ●');
    expect(table.getHeaderLabel('name')).toBe('Name');
  });

  it('表头标记与排序箭头可以共存', () => {
    const { table } = setup({
      columns: [{ key: 'amount', title: 'Amount', sorter: true, filters: [{ text: '高额', value: 'high' }] }],
      data: [{ amount: 100 }, { amount: 400 }],
    });
    table.toggleSort('amount');
    expect(table.getHeaderLabel('amount')).toBe('Amount ▲ ▾');
    table.setFilter('amount', ['high']);
    expect(table.getHeaderLabel('amount')).toBe('Amount ▲ ●');
  });

  it('点表头漏斗开候选面板：每个候选一个节点，点了立即生效且面板不关', () => {
    const { table } = setup();
    const filterNode = table.getFilterNode('status');
    expect(filterNode).toBeTruthy();
    filterNode!.trigger('click', null, {});
    expect(table.isFilterOpen()).toBe(true);
    expect(table.getFilterOptionNode('status', 'Paid')).toBeTruthy();

    table.getFilterOptionNode('status', 'Paid')!.trigger('click', null, {});
    expect(table.getFilterState().status).toEqual(['Paid']);
    expect(table.isFilterOpen()).toBe(true);

    // 再点一次取消勾选 → 回到不筛
    table.getFilterOptionNode('status', 'Paid')!.trigger('click', null, {});
    expect(table.getFilterState().status).toBeUndefined();
    expect(table.getFilteredRows().length).toBe(5);
  });

  it('候选面板贴着表头列；Esc 关闭', () => {
    const { ice, table } = setup();
    table.getFilterNode('status')!.trigger('click', null, {});
    const layout = table.getFilterPanelLayout()!;
    expect(layout.anchorLeft).toBeGreaterThan(0);
    expect(layout.panel.width).toBeGreaterThan(0);
    ice.evtBus.trigger('keydown', { key: 'Escape' });
    expect(table.isFilterOpen()).toBe(false);
  });
});

describe('汇总行', () => {
  const summary = (rows: any[]) => ({
    name: `合计 ${rows.length} 笔`,
    amount: rows.reduce((sum, row) => sum + row.amount, 0),
  });

  it('按筛选后的全量行算（不是当前页），渲染在表格底部', () => {
    const { table } = setup({ pagination: { pageSize: 2 }, summary });
    expect(table.getSummaryText('name')).toBe('合计 5 笔');
    expect(table.getSummaryText('amount')).toBe('1500');
    table.setFilter('status', ['Paid']);
    expect(table.getSummaryText('name')).toBe('合计 2 笔');
    expect(table.getSummaryText('amount')).toBe('400');
  });

  it('表格高度把汇总行算进去', () => {
    const plain = setup();
    const withSummary = setup({ summary });
    expect(withSummary.table.state.height).toBe(plain.table.state.height + 40);
    expect(withSummary.table.getSummaryNode()).toBeTruthy();
    expect(plain.table.getSummaryNode()).toBe(null);
  });

  it('筛选后 0 行时不渲染汇总行（没有东西可汇总）', () => {
    const { table } = setup({ summary });
    expect(table.getSummaryNode()).toBeTruthy();
    table.setFilter('city', ['华南']);
    table.setFilter('status', ['Shipped']);
    expect(table.getFilteredRows().length).toBe(0);
    expect(table.getSummaryNode()).toBe(null);
  });
});
