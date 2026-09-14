/**
 * ICETree 的跨父级移动（组件层）。
 *
 * 纯逻辑（`moveTreeNode`）测过，但组件层要确认：树数据真的换了、事件抛了、可见行也跟着变。
 */
import { ICETree } from '../src/components/ICETree';

const NODES = [
  { key: 'a', label: 'A', children: [{ key: 'a1', label: 'A1' }, { key: 'a2', label: 'A2' }] },
  { key: 'b', label: 'B', children: [{ key: 'b1', label: 'B1' }] },
];

function setup(props: any = {}) {
  const drops: any[] = [];
  const tree = new ICETree({
    left: 0,
    top: 0,
    width: 240,
    height: 300,
    itemHeight: 30,
    nodes: JSON.parse(JSON.stringify(NODES)),
    defaultExpandAll: true,
    draggable: true,
    onDrop: (info: any) => drops.push(info),
    ...props,
  });
  (tree as any).ice = {
    screenToWorld: (x: number, y: number) => [x, y],
    evtBus: { on() {}, off() {} },
    dirty: false,
  };
  (tree as any).afterAddHandler();
  return { tree, drops };
}

const childKeys = (node: any) => (node.children || []).map((child: any) => child.key);

describe('ICETree 跨父级移动', () => {
  it('把 a1 挪进 b：数据真的换了父级，事件也抛了', () => {
    const { tree, drops } = setup();
    expect(tree.moveNode('a1', 'b', 'inside')).toBe(true);
    const nodes = tree.getNodes();
    expect(childKeys(nodes[0])).toEqual(['a2']);
    expect(childKeys(nodes[1])).toEqual(['b1', 'a1']);
    expect(drops.length).toBe(1);
    expect(drops[0].key).toBe('a1');
    expect(drops[0].targetKey).toBe('b');
  });

  it('挪回根级：从 children 里摘掉、插到顶层', () => {
    const { tree } = setup();
    expect(tree.moveNode('b1', 'a', 'before')).toBe(true);
    expect(tree.getNodes().map((node: any) => node.key)).toEqual(['b1', 'a', 'b']);
  });

  it('不能挪进自己的后代（数据不变、返回 false）', () => {
    const { tree, drops } = setup();
    expect(tree.moveNode('a', 'a1', 'inside')).toBe(false);
    expect(tree.getNodes().map((node: any) => node.key)).toEqual(['a', 'b']);
    expect(drops).toEqual([]);
  });

  it('挪动后可见行按新结构来（展开状态还在）', () => {
    const { tree } = setup();
    tree.moveNode('a1', 'b', 'inside');
    expect(tree.getVisibleNodes().map((node) => node.key)).toEqual(['a', 'a2', 'b', 'b1', 'a1']);
  });
});
