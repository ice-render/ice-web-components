/**
 * 宽表（横向可滚动）里，编辑态的 Tab 流转要把目标**列**也滚进视野。
 *
 * 上一批解决了「Tab 到视口外的行自动纵向滚」，这一批补横向那一半：
 * 十几列的宽表里 Tab 到远处的列，如果还在视野外，用户同样看不见自己在改什么。
 *
 * 规格：
 * - Tab 到视野外的列时横向滚动，让该列落进可视区；
 * - 已经在视野内则不要乱滚（滚动位置不变）。
 */
import { ICETable } from '../src/components/ICETable';

const columns = Array.from({ length: 12 }, (_, index) => ({
  key: 'c' + index,
  title: '列 ' + index,
  width: 120,
  editable: true,
}));

function setup(props: any = {}) {
  return new ICETable({
    columns,
    data: [{ id: 'r1', ...Object.fromEntries(columns.map((column) => [column.key, column.key])) }],
    width: 400,
    height: 200,
    rowHeight: 40,
    rowKey: 'id',
    rowSelection: 'none',
    virtual: true,
    ...props,
  });
}

const pressTab = (table: ICETable) => table.getEditNode()!.trigger('keydown', { key: 'Tab' });

describe('宽表编辑 Tab 横向滚动', () => {
  it('Tab 到视野外的列时横向滚动过去', () => {
    const table = setup();
    table.startEdit(0, 'c1');
    const before = table.getScroll().x;
    for (let i = 0; i < 6; i += 1) {
      pressTab(table);
    }
    expect(table.getEditingCell()!.key).toBe('c7');
    expect(table.getScroll().x).toBeGreaterThan(before);
  });

  it('已经在视野内就不乱滚', () => {
    const table = setup();
    table.startEdit(0, 'c1');
    pressTab(table);
    expect(table.getEditingCell()!.key).toBe('c2');
    expect(table.getScroll().x).toBe(0);
  });
});
