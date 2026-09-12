/**
 * UIPagination 单测。
 *
 * 规格：
 * - 总页数 = ceil(total / pageSize)；current 越界自动夹取；首页的「上一页」、末页的「下一页」不可用；
 * - 页码按钮按窗口 + 省略号展示（默认最多 7 个页码位）；当前页高亮；
 * - 点击页码/上一页/下一页触发 onChange(page, pageSize)；
 * - setPageSize() 重算页数并夹取 current；showTotal 显示「共 N 条」；sizeChanger 循环切换每页条数；
 * - 页码按钮是 UIButton（可聚焦，键盘 Enter 激活）。
 */
import { UIPagination } from '../src/components/UIPagination';

function texts(node: any): string[] {
  const out: string[] = [];
  const walk = (current: any) => {
    const text = current.state && current.state.text;
    if (typeof text === 'string' && text && out.indexOf(text) === -1) out.push(text);
    (current.childNodes || []).forEach(walk);
  };
  walk(node);
  return out;
}

function buttonsOf(pagination: UIPagination): any[] {
  return (pagination.childNodes || []).filter((node: any) => typeof node.activate === 'function' && node.state.text !== undefined);
}

describe('UIPagination', () => {
  it('页数计算与 current 夹取', () => {
    const pagination = new UIPagination({ width: 420, total: 95, pageSize: 10 });
    expect(pagination.getPageCount()).toBe(10);
    expect(pagination.getCurrent()).toBe(1);

    pagination.setCurrent(99);
    expect(pagination.getCurrent()).toBe(10);
    pagination.setCurrent(0);
    expect(pagination.getCurrent()).toBe(1);
  });

  it('渲染：首页时上一页不可用、当前页高亮、含页码与共 N 条', () => {
    const pagination = new UIPagination({ width: 420, total: 95, pageSize: 10, showTotal: true });
    const textsRow = texts(pagination);
    expect(textsRow).toContain('‹');
    expect(textsRow).toContain('›');
    expect(textsRow).toContain('1');
    expect(textsRow.join(' ')).toContain('共 95 条');
    expect(pagination.getPrevButton()!.isEnabled()).toBe(false);
    expect(pagination.getNextButton()!.isEnabled()).toBe(true);
    expect(pagination.getPageButton(1)!.state.style.fillStyle).toBeTruthy();
  });

  it('点击页码 / 上一页 / 下一页触发 onChange', () => {
    const changes: Array<[number, number]> = [];
    const pagination = new UIPagination({
      width: 420,
      total: 95,
      pageSize: 10,
      onChange: (page, pageSize) => changes.push([page, pageSize]),
    });

    pagination.getNextButton()!.trigger('click', null, {});
    expect(pagination.getCurrent()).toBe(2);
    pagination.getPageButton(3)!.trigger('click', null, {}); // 3 在当前页码窗口内
    expect(pagination.getCurrent()).toBe(3);
    pagination.getPrevButton()!.trigger('click', null, {});
    expect(pagination.getCurrent()).toBe(2);
    expect(changes).toEqual([
      [2, 10],
      [3, 10],
      [2, 10],
    ]);
  });

  it('页数很多时用省略号收口（最多 7 个页码位）', () => {
    const pagination = new UIPagination({ width: 420, total: 500, pageSize: 10 });
    expect(pagination.getPageCount()).toBe(50);
    expect(texts(pagination)).toContain('...');

    pagination.setCurrent(25);
    const row = texts(pagination);
    expect(row).toContain('25');
    expect(row).toContain('...');
    expect(row).toContain('50'); // 末页始终可见
  });

  it('setPageSize 重算页数并夹取 current；sizeChanger 循环切换', () => {
    const changes: Array<[number, number]> = [];
    const pagination = new UIPagination({
      width: 420,
      total: 95,
      pageSize: 10,
      showSizeChanger: true,
      pageSizeOptions: [10, 20, 50],
      onChange: (page, pageSize) => changes.push([page, pageSize]),
    });
    pagination.setCurrent(10);
    pagination.setPageSize(20);
    expect(pagination.getPageSize()).toBe(20);
    expect(pagination.getPageCount()).toBe(5);
    expect(pagination.getCurrent()).toBe(5);

    const changer = pagination.getSizeChanger();
    expect(changer).toBeTruthy();
    changer!.trigger('click', null, {});
    expect(pagination.getPageSize()).toBe(50);
    expect(pagination.getPageCount()).toBe(2);
    expect(pagination.getCurrent()).toBe(2); // 夹取到新的末页
    expect(changes[changes.length - 1]).toEqual([2, 50]);
  });

  it('页码按钮可聚焦（键盘可操作）', () => {
    const pagination = new UIPagination({ width: 420, total: 95, pageSize: 10 });
    expect(pagination.getNextButton()!.isFocusable()).toBe(true);
    expect(pagination.getPageButton(2)!.isFocusable()).toBe(true);
  });
});
