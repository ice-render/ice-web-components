/**
 * ICEFormList：可增删的重复表单项（多联系人 / 多地址 / 明细行）。
 *
 * 规格：
 * - 初始 N 行；每行右侧一个「删除」、底部一个「添加」；
 * - `minRows` / `maxRows` 到了就禁用对应按钮（不是点了没反应，而是按钮真的变成禁用态）；
 * - 增删立刻重排（行不交叠、后一行按行高往下走），并回调 `onChange(rows)`；
 * - 每行有自己的稳定 key（增删后不串行 —— 这是重复行最经典的 bug）；
 * - `updateRow(index, patch)` 改一行；`getRows()` 给的是最新数据。
 */
import { ICEFormList } from '../src/components/ICEFormList';
import { ICELabel } from '../src/components/ICELabel';

function setup(props: any = {}) {
  const changes: any[][] = [];
  const list = new ICEFormList({
    left: 0,
    top: 0,
    width: 320,
    rowHeight: 36,
    gap: 8,
    initialRows: [{ name: 'A' }, { name: 'B' }],
    renderRow: (row: any) => new ICELabel({ text: String(row.name), height: 36 }),
    onChange: (rows: any[]) => changes.push(rows),
    ...props,
  });
  return { list, changes };
}

describe('ICEFormList：增删', () => {
  it('初始行数、每行节点与按钮都在', () => {
    const { list } = setup();
    expect(list.getRowCount()).toBe(2);
    expect(list.getRows().map((row) => row.name)).toEqual(['A', 'B']);
    expect(list.getRowNode(0)).toBeTruthy();
    expect(list.getRemoveButton(0)).toBeTruthy();
    expect(list.getAddButton()).toBeTruthy();
  });

  it('点「添加」加一行（带新 key）并回调', () => {
    const { list, changes } = setup();
    const firstKey = list.getRowKeys()[0];
    list.getAddButton()!.trigger('click', null, {});
    expect(list.getRowCount()).toBe(3);
    expect(list.getRowKeys()[2]).not.toBe(firstKey);
    expect(changes.length).toBe(1);
    expect(changes[0].length).toBe(3);
  });

  it('点某行的「删除」只删那一行，其它行的数据不串位', () => {
    const { list, changes } = setup();
    const keys = list.getRowKeys();
    list.getRemoveButton(0)!.trigger('click', null, {});
    expect(list.getRows().map((row) => row.name)).toEqual(['B']);
    expect(list.getRowKeys()).toEqual([keys[1]]);
    expect(changes[0].map((row: any) => row.name)).toEqual(['B']);
  });

  it('minRows / maxRows 到了按钮就禁用（不是点了没反应）', () => {
    const { list } = setup({ minRows: 2, maxRows: 3 });
    expect(list.isRemoveDisabled(0)).toBe(true);
    expect(list.isAddDisabled()).toBe(false);
    list.addRow();
    expect(list.isAddDisabled()).toBe(true);
    expect(list.isRemoveDisabled(0)).toBe(false);
  });

  it('removeRow / addRow 越界与超限都不动数据', () => {
    const { list } = setup({ minRows: 2 });
    list.removeRow(0);
    expect(list.getRowCount()).toBe(2);
    list.removeRow(99);
    expect(list.getRowCount()).toBe(2);
    expect(list.addRow({ name: 'C' }).getRows().map((row) => row.name)).toEqual(['A', 'B', 'C']);
  });
});

describe('ICEFormList：数据与版式', () => {
  it('updateRow 改一行并回调；getRows 是最新的', () => {
    const { list, changes } = setup();
    list.updateRow(1, { name: 'B2', phone: '123' });
    expect(list.getRows()[1]).toMatchObject({ name: 'B2', phone: '123' });
    expect(changes[0][1].name).toBe('B2');
  });

  it('行按行高逐条往下排，互不交叠', () => {
    const { list } = setup();
    const first = list.getRowNode(0)!;
    const second = list.getRowNode(1)!;
    expect(second.state.top).toBe(first.state.top + 36 + 8);
    expect(list.getAddButton()!.state.top).toBe(second.state.top + 36 + 8);
    expect(list.getContentHeight()).toBe(2 * 36 + 1 * 8 + 8 + 32);
  });

  it('setRows 整体替换（用于表单回填）', () => {
    const { list } = setup();
    list.setRows([{ name: 'X' }]);
    expect(list.getRows().map((row) => row.name)).toEqual(['X']);
    expect(list.getRowCount()).toBe(1);
  });

  it('renderRow 拿得到行下标与稳定 key', () => {
    const seen: any[] = [];
    const { list } = setup({
      renderRow: (row: any, ctx: any) => {
        seen.push({ name: row.name, index: ctx.index, key: ctx.rowKey });
        return new ICELabel({ text: String(row.name), height: 36 });
      },
    });
    expect(seen).toEqual([
      { name: 'A', index: 0, key: list.getRowKeys()[0] },
      { name: 'B', index: 1, key: list.getRowKeys()[1] },
    ]);
  });
});
