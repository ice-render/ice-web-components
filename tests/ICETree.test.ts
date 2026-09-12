/**
 * ICETree 单测。
 *
 * 规格：
 * - 展开态决定可见行：默认只显示根层，`defaultExpandAll` 或 setExpandedKeys 展开；
 * - 行按层级缩进（每层 16px），有子节点的行带展开箭头（▸/▾）；
 * - 点击行选中（走 ICESelectionModel）、点击箭头只切换展开不改变选择；
 * - 键盘：↑/↓ 移动激活行、→ 展开/进入子节点、← 折叠/回父节点、Enter/Space 选中；
 * - 内容超出可视高度时套 ICEScrollPane；onExpand / onSelect 回调。
 */
import { ICETree } from '../src/components/ICETree';

const nodes = [
  {
    key: 'root',
    label: '根节点',
    children: [
      { key: 'child-a', label: '子节点 A' },
      { key: 'child-b', label: '子节点 B', children: [{ key: 'grand', label: '孙节点' }] },
    ],
  },
  { key: 'other', label: '另一个根', disabled: false },
];

function textsOf(node: any): string[] {
  const out: string[] = [];
  const walk = (current: any) => {
    const text = current.state && current.state.text;
    if (typeof text === 'string' && text && out.indexOf(text) === -1) out.push(text);
    (current.childNodes || []).forEach(walk);
  };
  walk(node);
  return out;
}

describe('ICETree', () => {
  it('默认只显示根层；展开后子节点出现并缩进', () => {
    const tree = new ICETree({ width: 240, height: 200, nodes });
    expect(tree.getVisibleNodes().map((node: any) => node.key)).toEqual(['root', 'other']);

    tree.getRowNode('root')!.trigger('expand-click', null, {});
    expect(tree.getExpandedKeys()).toEqual(['root']);
    expect(tree.getVisibleNodes().map((node: any) => node.key)).toEqual(['root', 'child-a', 'child-b', 'other']);

    // 缩进体现在行内标签上（行本身都从 4 开始）
    expect(tree.getRowDepth('child-a')).toBe(1);
    expect(tree.getRowDepth('root')).toBe(0);
    const childLabel = tree.getRowNode('child-a')!.childNodes.find((n: any) => n.state.text === '子节点 A');
    const parentLabel = tree.getRowNode('root')!.childNodes.find((n: any) => n.state.text === '根节点');
    expect(childLabel.state.left).toBeGreaterThan(parentLabel.state.left);
  });

  it('defaultExpandAll 全展开；箭头只切换展开、不改变选择', () => {
    const tree = new ICETree({ width: 240, height: 240, nodes, defaultExpandAll: true, mode: 'single' });
    expect(tree.getVisibleNodes().length).toBe(5);
    expect(textsOf(tree.getRowNode('root')!)).toContain('▾');

    tree.getRowNode('root')!.trigger('expand-click', null, {});
    expect(tree.getExpandedKeys()).toEqual(['child-b']); // 子节点的展开态保留
    expect(tree.getSelectedKeys()).toEqual([]); // 展开箭头不影响选择
    expect(tree.getVisibleNodes().length).toBe(2);
    expect(textsOf(tree.getRowNode('root')!)).toContain('▸');
  });

  it('点击行选中（单选替换 / 多选切换），onSelect 回调', () => {
    const selected: string[][] = [];
    const single = new ICETree({
      width: 240,
      height: 200,
      nodes,
      defaultExpandAll: true,
      onSelect: (keys) => selected.push(keys),
    });
    single.getRowNode('child-a')!.trigger('click', null, {});
    single.getRowNode('grand')!.trigger('click', null, {});
    expect(single.getSelectedKeys()).toEqual(['grand']);
    expect(selected).toEqual([['child-a'], ['grand']]);

    const multiple = new ICETree({ width: 240, height: 200, nodes, defaultExpandAll: true, mode: 'multiple' });
    multiple.getRowNode('child-a')!.trigger('click', null, {});
    multiple.getRowNode('grand')!.trigger('click', null, {});
    expect(multiple.getSelectedKeys()).toEqual(['child-a', 'grand']);
    multiple.getRowNode('child-a')!.trigger('click', null, {});
    expect(multiple.getSelectedKeys()).toEqual(['grand']);
  });

  it('键盘：↓/↑ 移动激活行、→ 展开、← 折叠、Enter 选中', () => {
    const tree = new ICETree({ width: 240, height: 200, nodes });
    (tree as any).ice = { evtBus: { on() {}, off() {}, trigger() {} }, dirty: false };
    tree.setFocused(true);
    const press = (key: string) => (tree as any).__onKeyDown({ key });

    press('ArrowDown');
    expect(tree.getActiveKey()).toBe('root');
    press('ArrowRight'); // 展开
    expect(tree.getExpandedKeys()).toEqual(['root']);
    press('ArrowDown');
    expect(tree.getActiveKey()).toBe('child-a');
    press('ArrowDown'); // child-b
    press('ArrowRight'); // 尚未展开 → 先展开（激活行不变）
    expect(tree.getActiveKey()).toBe('child-b');
    press('ArrowRight'); // 已展开 → 进入第一个子节点
    expect(tree.getActiveKey()).toBe('grand');
    press('ArrowLeft'); // 叶子 → 回到父节点
    expect(tree.getActiveKey()).toBe('child-b');
    press('ArrowLeft'); // 已折叠的父节点 → 折叠
    expect(tree.getExpandedKeys()).toEqual(['root']);
    press('Enter');
    expect(tree.getSelectedKeys()).toEqual(['child-b']);
  });

  it('内容超出高度时套 ICEScrollPane；expandAll / collapseAll', () => {
    const tall = new ICETree({ width: 240, height: 60, nodes, itemHeight: 30, defaultExpandAll: true });
    expect(tall.getScrollPane()).toBeTruthy();
    expect(tall.getScrollPane()!.getContentSize()[1]).toBe(5 * 30);

    tall.collapseAll();
    expect(tall.getExpandedKeys()).toEqual([]);
    tall.expandAll();
    expect(tall.getExpandedKeys().sort()).toEqual(['child-b', 'root']);
  });
});
