/**
 * ICETable 列排序。
 *
 * 规格：
 * - 列上开 `sorter: true`（或自定义比较函数）后表头可点；
 * - 点击循环：升序 → 降序 → 恢复原始顺序；
 * - 非排序列点击无效果；`sortBy` 可编程设置；`setData` 重置排序；
 * - 表头文案带 ▲/▼ 指示；数值列按数值比大小（不按字典序）。
 */
import { ICETable } from '../src/components/ICETable';

const columns = [
  { key: 'name', title: 'Name' },
  { key: 'amount', title: 'Amount', align: 'right' as const, sorter: true },
  { key: 'city', title: 'City', sorter: (a: any, b: any) => String(b.city).localeCompare(String(a.city)) },
];

const data = [
  { name: 'C', amount: 30, city: 'alpha' },
  { name: 'A', amount: 10, city: 'charlie' },
  { name: 'B', amount: 20, city: 'bravo' },
];

function setup() {
  return new ICETable({ columns, data, width: 600, rowHeight: 40 });
}

describe('ICETable 排序', () => {
  it('默认保持原始顺序，未排序时表头没有箭头', () => {
    const table = setup();
    expect(table.getRows().map((row) => row.name)).toEqual(['C', 'A', 'B']);
    expect(table.getSortState()).toBeNull();
    expect(table.getHeaderLabel('amount')).toBe('Amount');
  });

  it('点击表头循环：升序 → 降序 → 恢复原始顺序', () => {
    const table = setup();
    table.toggleSort('amount');
    expect(table.getSortState()).toEqual({ key: 'amount', order: 'asc' });
    expect(table.getRows().map((row) => row.amount)).toEqual([10, 20, 30]);
    expect(table.getHeaderLabel('amount')).toContain('▲');

    table.toggleSort('amount');
    expect(table.getSortState()).toEqual({ key: 'amount', order: 'desc' });
    expect(table.getRows().map((row) => row.amount)).toEqual([30, 20, 10]);
    expect(table.getHeaderLabel('amount')).toContain('▼');

    table.toggleSort('amount');
    expect(table.getSortState()).toBeNull();
    expect(table.getRows().map((row) => row.name)).toEqual(['C', 'A', 'B']);
    expect(table.getHeaderLabel('amount')).toBe('Amount');
  });

  it('数值列按数值比较，不按字典序', () => {
    const table = new ICETable({
      columns,
      data: [{ amount: 9 }, { amount: 100 }, { amount: 20 }],
      width: 600,
    });
    table.toggleSort('amount');
    expect(table.getRows().map((row) => row.amount)).toEqual([9, 20, 100]);
  });

  it('带货币符号/千分位的数值列也按数值排序', () => {
    const table = new ICETable({
      columns,
      data: [{ amount: '$1,240.00' }, { amount: '$540.20' }, { amount: '$3,120.00' }],
      width: 600,
    });
    table.toggleSort('amount');
    expect(table.getRows().map((row) => row.amount)).toEqual(['$540.20', '$1,240.00', '$3,120.00']);
  });

  it('非排序列点击无效果；自定义 sorter 生效', () => {
    const table = setup();
    table.toggleSort('name');
    expect(table.getSortState()).toBeNull();
    expect(table.getRows().map((row) => row.name)).toEqual(['C', 'A', 'B']);

    table.toggleSort('city');
    expect(table.getRows().map((row) => row.city)).toEqual(['charlie', 'bravo', 'alpha']);
  });

  it('sortBy 可编程设置；setData 重置排序', () => {
    const table = setup();
    table.sortBy('amount', 'desc');
    expect(table.getRows().map((row) => row.amount)).toEqual([30, 20, 10]);
    table.sortBy('amount', null);
    expect(table.getSortState()).toBeNull();

    table.sortBy('amount', 'asc');
    table.setData([{ name: 'Z', amount: 5, city: 'z' }]);
    expect(table.getSortState()).toBeNull();
    expect(table.getRows().length).toBe(1);
  });

  it('排序后高度按行数保持', () => {
    const table = setup();
    const before = table.state.height;
    table.toggleSort('amount');
    expect(table.state.height).toBe(before);
    expect(table.getRows().length).toBe(3);
  });
});
