/**
 * 树形行拖动：跨父级（把子行挪到另一个父行下 / 挪回根级）。
 *
 * 之前只验证了同级之间挪。真正难的是**改父级**：
 * - 从 A 的子行挪进 B：A 的 children 里要真的少一个，B 的 children 多一个；
 * - 挪回根级：从 children 里摘掉、插到顶层；
 * - 这两种都不许把子行自己的子树弄丢，也不许多出/少掉任何一行。
 */
import { ICETable } from '../src/components/ICETable';

const columns = [
  { key: 'name', title: '名称', width: 240 },
  { key: 'count', title: '数量', width: 120 },
];

const TREE = [
  { id: 'a', name: 'A', children: [
    { id: 'a1', name: 'A1', children: [{ id: 'a11', name: 'A11' }] },
    { id: 'a2', name: 'A2' },
  ] },
  { id: 'b', name: 'B', children: [{ id: 'b1', name: 'B1' }] },
];

function setup(props: any = {}) {
  return new ICETable({
    columns,
    data: JSON.parse(JSON.stringify(TREE)),
    width: 400,
    rowHeight: 40,
    rowKey: 'id',
    rowSelection: 'none',
    rowDraggable: true,
    ...props,
  });
}

const source = (table: ICETable) => (table as any).sourceData;
const childKeys = (node: any) => (node.children || []).map((child: any) => child.id);

describe('树形行跨父级拖动', () => {
  it('从 A 挪进 B：A 少一个、B 多一个，自己的子树还在', () => {
    const table = setup();
    expect(table.moveTreeRow('a1', 'b', 'inside')).toBe(true);
    const [a, b] = source(table);
    expect(childKeys(a)).toEqual(['a2']);
    expect(childKeys(b)).toEqual(['b1', 'a1']);
    expect(childKeys(b.children[b.children.length - 1])).toEqual(['a11']);
  });

  it('挪回根级：从 children 里摘掉、插到顶层', () => {
    const table = setup();
    expect(table.moveTreeRow('b1', 'a', 'before')).toBe(true);
    expect(source(table).map((node: any) => node.id)).toEqual(['b1', 'a', 'b']);
    expect(childKeys(source(table)[2])).toEqual([]);
  });

  it('挪进目标后目标自动展开（否则用户以为没生效）', () => {
    const table = setup();
    table.moveTreeRow('a2', 'b', 'inside');
    expect(table.isTreeRowExpanded('b')).toBe(true);
    expect(table.getRows().map((row) => row.id)).toContain('a2');
  });

  it('挪动前后总行数不变（一条不多一条不少）', () => {
    const table = setup();
    const count = (nodes: any[]): number =>
      nodes.reduce((sum, node) => sum + 1 + (Array.isArray(node.children) ? count(node.children) : 0), 0);
    const before = count(source(table));
    table.moveTreeRow('a1', 'b', 'inside');
    expect(count(source(table))).toBe(before);
  });
});
