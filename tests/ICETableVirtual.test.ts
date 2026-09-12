/**
 * ICETable 的可滚动模式规格：**虚拟行**（万行表格）与**固定列**（宽表横向滚动时左侧冻结）。
 *
 * 设计取舍：老路径（分页 / 小表）原样保留，只有 `virtual: true` 或有 `fixed` 列时才走
 * 「表头与表体各自一个滚动视口 + 只渲染可视行」的新路径 —— 这样既拿到大数据量能力，
 * 又不会把现有几十处表格用法搅进去。
 */
import { ICETable } from '../src/components/ICETable';

const makeRows = (count: number) => Array.from({ length: count }, (_, i) => ({ id: i + 1, name: '行 ' + i, amount: i * 10 }));

const COLUMNS = [
  { key: 'id', title: 'ID', width: 80, fixed: true },
  { key: 'name', title: '名称' },
  { key: 'amount', title: '金额', align: 'right' as const },
];

const makeVirtual = (props: any = {}) =>
  new ICETable({
    width: 600,
    height: 300,
    headerHeight: 36,
    rowHeight: 34,
    virtual: true,
    columns: COLUMNS,
    data: makeRows(10000),
    ...props,
  });

describe('虚拟行', () => {
  it('一万行只渲染可视区（节点数有上界），内容高度按总行数算', () => {
    const table = makeVirtual();
    expect(table.isVirtual()).toBe(true);
    expect(table.isScrollable()).toBe(true);
    expect(table.getContentHeight()).toBe(340000);
    expect(table.getRenderedRowCount()).toBeLessThanOrEqual(12);
    expect(table.getRowRange().start).toBe(0);
  });

  it('滚动只换窗口，不增长行节点；贴底能看到最后一行', () => {
    // 视口 300-36=264 高、行高 34 → 可视 8 行 + 上下缓冲各 2 + 半露出 1 = 13 行上界
    const BOUND = 13;
    const table = makeVirtual();
    for (let y = 0; y <= 3000; y += 700) {
      table.setScrollTop(y);
      expect(table.getRenderedRowCount()).toBeLessThanOrEqual(BOUND);
    }
    table.scrollToRow(9999);
    expect(table.getRowRange().end).toBe(10000);
    expect(table.getRenderedRowCount()).toBeLessThanOrEqual(BOUND);
    expect(table.getRowRange().start).toBeGreaterThan(9980);
  });

  it('setScrollTop 夹在范围内；setScrollLeft 不受行数影响', () => {
    const table = makeVirtual();
    table.setScrollTop(-100);
    expect(table.getScroll().y).toBe(0);
    table.setScrollTop(999999);
    expect(table.getScroll().y).toBe(340000 - (300 - 36));
    table.setScrollLeft(120);
    expect(table.getScroll().x).toBe(120);
  });

  it('普通表格（不开 virtual）不受影响：整表渲染、没有滚动视口', () => {
    // 注意用「没有 fixed 列」的定义：有 fixed 列本身就会进可滚动模式（那是固定列的能力）
    const plainColumns = [
      { key: 'id', title: 'ID', width: 80 },
      { key: 'name', title: '名称' },
      { key: 'amount', title: '金额', align: 'right' as const },
    ];
    const table = new ICETable({ width: 600, columns: plainColumns, data: makeRows(20) });
    expect(table.isVirtual()).toBe(false);
    expect(table.isScrollable()).toBe(false);
    expect(table.getRenderedRowCount()).toBe(20);
  });
});

describe('固定列', () => {
  it('有 fixed 列时自动进入可滚动模式，冻结宽度 = 固定列宽度之和', () => {
    const table = makeVirtual();
    expect(table.getFrozenWidth()).toBe(80);
  });

  it('列多到装不下时内容宽度超过视口（宽表横向滚动的前提）', () => {
    const manyColumns = Array.from({ length: 20 }, (_, i) => ({ key: 'c' + i, title: '列' + i, fixed: i === 0 }));
    const table = new ICETable({
      width: 600,
      height: 300,
      columns: manyColumns,
      data: makeRows(50),
      minColumnWidth: 60,
      virtual: true,
    });
    const widths = table.getColumnWidths();
    const total = Object.keys(widths).reduce((sum, key) => sum + widths[key], 0);
    expect(total).toBeGreaterThanOrEqual(20 * 60);
    expect(table.getFrozenWidth()).toBe(widths.c0);
  });
});
