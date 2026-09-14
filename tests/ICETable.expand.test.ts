/**
 * ICETable 的「分析半边」之二：行展开。
 *
 * 规格：
 * - `expandable.render(row, ctx)` 给一个组件，画在该行**下面**（不是弹层），
 *   高度取 `expandedRowHeight`（默认 2 行高）；
 * - 第一列左侧出现 ▸ / ▾ 展开三角；`rowExpandable(row) === false` 的行没有三角、也展不开；
 * - 展开状态按 `rowKey`（默认行下标）记，翻页回来还在；
 * - 展开会把**后面的行整体推下去**（表格高度、分页器位置同步变），不是浮在上面；
 * - 点三角不会触发行选中（三角是行内的交互控件）。
 *
 * 范围说明：展开行只在**普通渲染路径**（不传 `virtual`）生效 —— 虚拟滚动按「等高的行」
 * 算可视窗口，混入不等高的展开区就得改虚拟化内核，那是另一件事。
 */
import { ICETable } from '../src/components/ICETable';
import { ICEWidget } from '../src/core/ICEWidget';

const columns = [
  { key: 'name', title: 'Name' },
  { key: 'amount', title: 'Amount', align: 'right' as const },
];

const data = [
  { id: 'r1', name: 'A', amount: 100 },
  { id: 'r2', name: 'B', amount: 200 },
  { id: 'r3', name: 'C', amount: 300 },
  { id: 'r4', name: 'D', amount: 400 },
];

function setup(props: any = {}) {
  const opened: Array<[boolean, string]> = [];
  const selected: string[] = [];
  const table = new ICETable({
    columns,
    data,
    width: 600,
    rowHeight: 40,
    rowKey: 'id',
    rowSelection: 'none',
    onSelect: (row: any) => row && selected.push(row.id),
    expandable: {
      render: (row: any) => new ICEWidget({ left: 12, top: 8, width: 200, height: 24 }),
      onExpand: (expanded: boolean, row: any) => opened.push([expanded, row.id]),
    },
    ...props,
  });
  return { table, opened, selected };
}

describe('行展开：状态', () => {
  it('默认全部收起，每行都有展开三角', () => {
    const { table } = setup();
    expect(table.getExpandedRowKeys()).toEqual([]);
    expect(table.isRowExpanded('r1')).toBe(false);
    expect(table.getExpandToggleNode('r1')).toBeTruthy();
    expect(table.getExpandToggleNode('r4')).toBeTruthy();
  });

  it('expandRow / collapseRow / toggleExpand 与 onExpand 回调', () => {
    const { table, opened } = setup();
    table.expandRow('r2');
    expect(table.getExpandedRowKeys()).toEqual(['r2']);
    expect(table.isRowExpanded('r2')).toBe(true);
    expect(opened).toEqual([[true, 'r2']]);

    table.toggleExpand('r2');
    expect(table.isRowExpanded('r2')).toBe(false);
    expect(opened).toEqual([
      [true, 'r2'],
      [false, 'r2'],
    ]);
  });

  it('rowExpandable 为假的行展不开，也不给三角', () => {
    const { table } = setup({
      expandable: {
        render: () => new ICEWidget({ left: 0, top: 0, width: 100, height: 20 }),
        rowExpandable: (row: any) => row.amount < 300,
      },
    });
    expect(table.getExpandToggleNode('r3')).toBe(null);
    table.expandRow('r3');
    expect(table.isRowExpanded('r3')).toBe(false);
    expect(table.getExpandedRowNode('r3')).toBe(null);
  });

  it('点三角等价于 toggleExpand', () => {
    const { table } = setup();
    table.getExpandToggleNode('r1')!.trigger('click', null, {});
    expect(table.isRowExpanded('r1')).toBe(true);
    table.getExpandToggleNode('r1')!.trigger('click', null, {});
    expect(table.isRowExpanded('r1')).toBe(false);
  });

  it('三角是行内的交互控件：点它不会走「整行选中」那条路', () => {
    const { table } = setup();
    const row = table.getRowNode(0)!;
    const toggle = table.getExpandToggleNode('r1')!;
    let current = toggle;
    let inside = false;
    while (current) {
      if (current === row) inside = true;
      current = current.parentNode;
    }
    expect(inside).toBe(true);
  });
});

describe('行展开：版式', () => {
  it('展开区画在行下面，后面的行被整体推下去', () => {
    const { table } = setup();
    const before = table.getRowNode(2)!.state.top;
    table.expandRow('r1');
    expect(table.getExpandedRowNode('r1')).toBeTruthy();
    expect(table.getRowNode(2)!.state.top).toBe(before + 80);
    // 展开区正好落在第一行与第二行之间
    const row0 = table.getRowNode(0)!;
    const expanded = table.getExpandedRowNode('r1')!;
    expect(expanded.state.top).toBe(row0.state.top + 40);
    expect(expanded.state.height).toBe(80);
  });

  it('展开区高度可配，且表格高度跟着长', () => {
    const { table } = setup({ expandable: { render: () => new ICEWidget({ left: 0, top: 0, width: 10, height: 10 }), expandedRowHeight: 56 } });
    const before = table.state.height;
    table.expandRow('r1');
    table.expandRow('r2');
    expect(table.state.height).toBe(before + 112);
    expect(table.getExpandedRowNode('r2')!.state.top).toBe(table.getRowNode(1)!.state.top + 40);
  });

  it('render 拿到表格宽度、列定义与列宽', () => {
    let seen: any = null;
    const { table } = setup({
      expandable: {
        render: (row: any, ctx: any) => {
          seen = { row: row.id, ...ctx };
          return new ICEWidget({ left: 0, top: 0, width: 10, height: 10 });
        },
      },
    });
    table.expandRow('r1');
    expect(seen.row).toBe('r1');
    expect(seen.width).toBe(600);
    expect(seen.columns.map((column: any) => column.key)).toEqual(['name', 'amount']);
    expect(seen.widths.name + seen.widths.amount).toBe(600);
  });
});

describe('行展开：与分页共存', () => {
  it('展开状态按 key 记，翻页回来还在', () => {
    const { table } = setup({ pagination: { pageSize: 2 } });
    table.expandRow('r1');
    expect(table.getExpandedRowNode('r1')).toBeTruthy();
    table.setPage(2);
    expect(table.isRowExpanded('r1')).toBe(true);
    expect(table.getExpandedRowNode('r1')).toBe(null);
    expect(table.isRowExpanded('r3')).toBe(false);
    table.setPage(1);
    expect(table.getExpandedRowNode('r1')).toBeTruthy();
  });
});
