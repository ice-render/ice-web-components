/**
 * 树节点拖拽的纯逻辑规格（`computeTreeDropTarget` + `moveTreeNode`）。
 *
 * 树拖拽比列表多了两种落点：`inside`（放进节点里当子节点）与 `before/after`（插到同级）。
 * 这里守住三件最容易错的事：
 * - 行内「三分法」：上 1/3 → before、中 1/3 → inside、下 1/3 → after；
 * - **不能把节点拖进自己的后代**（否则整棵子树会凭空消失）；
 * - 移动返回**新树**，原树不动；位置没变时 `moved: false`。
 */
import { computeTreeDropTarget, moveTreeNode } from '../src/util/ICEDragReorder';

describe('computeTreeDropTarget（行内三分法）', () => {
  const base = { itemHeight: 30, itemCount: 5 };

  it('上 1/3 before、中 1/3 inside、下 1/3 after', () => {
    expect(computeTreeDropTarget({ ...base, pointerY: 5 })).toEqual({ index: 0, position: 'before' });
    expect(computeTreeDropTarget({ ...base, pointerY: 15 })).toEqual({ index: 0, position: 'inside' });
    expect(computeTreeDropTarget({ ...base, pointerY: 27 })).toEqual({ index: 0, position: 'after' });
  });

  it('越界夹到首尾；空列表 null', () => {
    expect(computeTreeDropTarget({ ...base, pointerY: -50 })).toEqual({ index: 0, position: 'before' });
    expect(computeTreeDropTarget({ ...base, pointerY: 999 })).toEqual({ index: 4, position: 'after' });
    expect(computeTreeDropTarget({ ...base, itemCount: 0, pointerY: 10 })).toBeNull();
  });
});

describe('moveTreeNode（跨层级移动）', () => {
  const tree = () => [
    { key: 'a', label: 'A', children: [{ key: 'a1', label: 'A1' }, { key: 'a2', label: 'A2' }] },
    { key: 'b', label: 'B', children: [{ key: 'b1', label: 'B1' }] },
    { key: 'c', label: 'C' },
  ];
  const keysOf = (nodes: any[]): string[] => nodes.map((node) => node.key);
  const findNode = (nodes: any[], key: string): any => {
    for (const node of nodes) {
      if (node.key === key) return node;
      const found = node.children ? findNode(node.children, key) : null;
      if (found) return found;
    }
    return null;
  };

  it('before / after：插到目标的同级位置', () => {
    const before = moveTreeNode(tree(), 'c', 'a', 'before');
    expect(before.moved).toBe(true);
    expect(keysOf(before.nodes)).toEqual(['c', 'a', 'b']);
    const after = moveTreeNode(tree(), 'a', 'b', 'after');
    expect(keysOf(after.nodes)).toEqual(['b', 'a', 'c']);
  });

  it('inside：放进目标节点当最后一个子节点', () => {
    const result = moveTreeNode(tree(), 'c', 'b', 'inside');
    expect(result.moved).toBe(true);
    expect(keysOf(result.nodes)).toEqual(['a', 'b']);
    expect(keysOf(result.nodes[1].children || [])).toEqual(['b1', 'c']);
    expect(result.parentKey).toBe('b');
  });

  it('跨层级：从子级拖回根级、从根级拖进别的子树', () => {
    const out = moveTreeNode(tree(), 'a1', 'c', 'after');
    expect(keysOf(out.nodes)).toEqual(['a', 'b', 'c', 'a1']);
    expect(keysOf(out.nodes[0].children || [])).toEqual(['a2']);

    const into = moveTreeNode(tree(), 'b', 'a', 'inside');
    expect(keysOf(into.nodes)).toEqual(['a', 'c']);
    expect(keysOf(into.nodes[0].children || [])).toEqual(['a1', 'a2', 'b']);
  });

  it('不能拖进自己的后代（否则子树会消失）', () => {
    const result = moveTreeNode(tree(), 'a', 'a1', 'inside');
    expect(result.moved).toBe(false);
    expect(keysOf(result.nodes)).toEqual(['a', 'b', 'c']);
  });

  it('未知 key / 原地不动都算没动', () => {
    expect(moveTreeNode(tree(), 'nope', 'a', 'after').moved).toBe(false);
    expect(moveTreeNode(tree(), 'a', 'nope', 'after').moved).toBe(false);
    // a 已经在 b 之前，再插一次 before 等于没动
    expect(moveTreeNode(tree(), 'a', 'b', 'before').moved).toBe(false);
  });

  it('返回新树，原树不受影响', () => {
    const source = tree();
    const result = moveTreeNode(source, 'c', 'a', 'before');
    expect(keysOf(source)).toEqual(['a', 'b', 'c']);
    expect(keysOf(result.nodes)).toEqual(['c', 'a', 'b']);
    expect(findNode(source, 'c')!.label).toBe('C');
  });
});
