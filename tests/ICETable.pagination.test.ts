/**
 * ICETable 分页 / 空态（业界组件库 Table 的 pagination）。
 *
 * 规格：
 * - `pagination: { pageSize }` 时只渲染当前页的行，底部出现分页器；
 * - `getRows()` 返回当前页（排序后再分页）；
 * - setPage 夹取到 [1, pageCount]；setData 回到第 1 页；
 * - 空数据渲染空态（ICEEmpty）而不是空白，且不显示分页器；
 * - 不传 pagination 时行为与以前一致（全量渲染、无分页器）。
 */
import { ICEEmpty } from '../src/components/ICEEmpty';
import { ICEPagination } from '../src/components/ICEPagination';
import { ICETable } from '../src/components/ICETable';

const columns = [
  { key: 'name', title: 'Name' },
  { key: 'amount', title: 'Amount', sorter: true },
];

const data = [
  { name: 'A', amount: 30 },
  { name: 'B', amount: 10 },
  { name: 'C', amount: 40 },
  { name: 'D', amount: 20 },
  { name: 'E', amount: 50 },
];

describe('ICETable 分页', () => {
  it('只渲染当前页的行，并挂出分页器', () => {
    const table = new ICETable({ columns, data, width: 600, rowHeight: 40, pagination: { pageSize: 2 } });
    expect(table.getRows().map((row) => row.name)).toEqual(['A', 'B']);
    expect(table.getTotalRows()).toBe(5);
    expect(table.getPageCount()).toBe(3);
    expect(table.getPage()).toBe(1);
    expect(table.childNodes.some((node: any) => node instanceof ICEPagination)).toBe(true);
  });

  it('setPage 换页；越界自动夹取', () => {
    const table = new ICETable({ columns, data, width: 600, rowHeight: 40, pagination: { pageSize: 2 } });
    table.setPage(2);
    expect(table.getRows().map((row) => row.name)).toEqual(['C', 'D']);
    table.setPage(99);
    expect(table.getPage()).toBe(3);
    expect(table.getRows().map((row) => row.name)).toEqual(['E']);
    table.setPage(0);
    expect(table.getPage()).toBe(1);
  });

  it('排序后再分页：第 1 页是排序结果的头部', () => {
    const table = new ICETable({ columns, data, width: 600, rowHeight: 40, pagination: { pageSize: 2 } });
    table.toggleSort('amount');
    expect(table.getRows().map((row) => row.amount)).toEqual([10, 20]);
    table.setPage(2);
    expect(table.getRows().map((row) => row.amount)).toEqual([30, 40]);
  });

  it('setData 回到第 1 页并重算页数', () => {
    const table = new ICETable({ columns, data, width: 600, rowHeight: 40, pagination: { pageSize: 2 } });
    table.setPage(3);
    table.setData(data.slice(0, 3));
    expect(table.getPage()).toBe(1);
    expect(table.getPageCount()).toBe(2);
    expect(table.getRows()).toHaveLength(2);
  });

  it('空数据渲染空态，且没有分页器', () => {
    const table = new ICETable({ columns, data: [], width: 600, rowHeight: 40, pagination: { pageSize: 2 } });
    expect(table.getRows()).toEqual([]);
    expect(table.childNodes.some((node: any) => node instanceof ICEEmpty)).toBe(true);
    expect(table.childNodes.some((node: any) => node instanceof ICEPagination)).toBe(false);
  });

  it('不传 pagination 时保持原行为', () => {
    const table = new ICETable({ columns, data, width: 600, rowHeight: 40 });
    expect(table.getRows()).toHaveLength(5);
    expect(table.getPageCount()).toBe(1);
    expect(table.childNodes.some((node: any) => node instanceof ICEPagination)).toBe(false);
  });
});
