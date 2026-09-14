/**
 * 虚拟滚动 + 筛选下的行命中复核。
 *
 * 两种「第几行」很容易混淆：**数据的行号**（筛完、拍平之后的顺序）与**屏幕上的行号**（可视窗口里第几行）。
 * 拖拽、点选、命中检测都吃这条映射，错一位就会「拖 A 结果动了 B」。
 */
import { ICETable } from '../src/components/ICETable';

const columns = [
  { key: 'name', title: '名称', width: 200 },
  { key: 'status', title: '状态', width: 160, filters: [{ text: 'Paid', value: 'Paid' }] },
];

const ROWS = Array.from({ length: 500 }, (_, index) => ({
  id: 'r' + index,
  name: '名称 ' + index,
  status: index % 2 === 0 ? 'Paid' : 'Pending',
}));

function setup(props: any = {}) {
  const table = new ICETable({
    columns,
    data: ROWS.map((row) => ({ ...row })),
    width: 400,
    height: 200,
    rowHeight: 30,
    rowKey: 'id',
    rowSelection: 'none',
    virtual: true,
    ...props,
  });
  return table;
}

describe('虚拟 + 筛选下的行命中', () => {
  it('筛选后行号按「筛完的顺序」算（不是原始下标）', () => {
    const table = setup();
    table.setFilter('status', ['Paid']);
    expect(table.getTotalRows()).toBe(250);
    // 第 3 行（下标 2）对应原始数据的 r4（偶数才是 Paid）
    expect(table.getRows()[2].id).toBe('r4');
  });

  it('滚过之后命中计算把滚动量加回来', () => {
    const table = setup();
    table.setFilter('status', ['Paid']);
    table.setScrollTop(100 * 30);
    // 视口内第一行的局部 y ≈ headerHeight + 5 → 命中第 100 行
    const index = (table as any).__rowIndexAt((table as any).headerHeight + 5);
    expect(index).toBe(100);
    expect(table.getRows()[index].id).toBe('r200');
  });

  it('命中结果夹在有效范围内（滚到底再往下点不会越界）', () => {
    const table = setup();
    table.setFilter('status', ['Paid']);
    table.setScrollTop(1e9);
    const index = (table as any).__rowIndexAt((table as any).headerHeight + 9999);
    expect(index).toBe(table.getTotalRows() - 1);
    expect(table.getRows()[index].id).toBe('r498');
  });
});
