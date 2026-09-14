/**
 * ICETreeSelect 的搜索与多选。
 *
 * 规格：
 * - 多选：点一行切换（面板不关），值是 `string[]`，字段显示标签列表；
 * - `maxTagCount` 超出折叠成 `+N`（只影响显示，取值全量）；
 * - 搜索：按 label 过滤，但**保留命中节点的祖先链**（层级路径不能丢，否则用户不知道选的是哪一支），
 *   并把命中路径自动展开；大小写不敏感；清空查询恢复整棵树；
 * - 搜索无结果时树是空的（不留一棵看着能点、其实没命中的树）。
 */
import { ICETreeSelect } from '../src/components/ICETreeSelect';

const NODES = [
  {
    key: 'tech',
    label: '技术中心',
    children: [
      { key: 'fe', label: '前端组' },
      { key: 'be', label: '后端组' },
    ],
  },
  {
    key: 'design',
    label: '设计中心',
    children: [
      { key: 'ui', label: 'UI Design' },
      { key: 'ux', label: 'Interaction' },
    ],
  },
];

function setup(props: any = {}) {
  const changes: any[] = [];
  const select = new ICETreeSelect({
    left: 0,
    top: 0,
    width: 240,
    height: 32,
    nodes: NODES,
    treeHeight: 200,
    placeholder: '请选择部门',
    onChange: (value: any) => changes.push(value),
    ...props,
  });
  const ice: any = {
    canvasWidth: 900,
    canvasHeight: 600,
    toolNodes: [],
    dirty: false,
    evtBus: { on() {}, off() {}, trigger() {} },
    addTool: (tool: any) => ice.toolNodes.push(tool),
    removeTool: (tool: any) => {
      const index = ice.toolNodes.indexOf(tool);
      if (index !== -1) ice.toolNodes.splice(index, 1);
    },
    setFocusedComponent: () => {},
    getFocusedComponent: () => null,
    screenToWorld: (x: number, y: number) => [x, y],
    getRenderViewport: () => ({ scale: 1, tx: 0, ty: 0 }),
  };
  (select as any).ice = ice;
  (select as any).afterAddHandler();
  return { select, changes };
}

const clickRow = (select: ICETreeSelect, key: string) => {
  const tree = select.getTree()!;
  tree.expandAll(); // 默认只展开顶层，先全展开再点（真实用户也是这么点的）
  tree.getRowNode(key)!.trigger('click', null, {});
};

describe('ICETreeSelect 多选', () => {
  it('单选照旧：点一行 → 回写 + 关面板 + 回调', () => {
    const { select, changes } = setup();
    select.open();
    clickRow(select, 'fe');
    expect(select.getValue()).toBe('fe');
    expect(select.getFieldLabel()).toBe('前端组');
    expect(select.isOpen()).toBe(false);
    expect(changes).toEqual(['fe']);
  });

  it('多选：点两行都留下（面板不关），再点一次取消', () => {
    const { select, changes } = setup({ mode: 'multiple' });
    select.open();
    clickRow(select, 'fe');
    clickRow(select, 'ui');
    expect(select.getValue()).toEqual(['fe', 'ui']);
    expect(select.getFieldLabel()).toBe('前端组、UI Design');
    expect(select.isOpen()).toBe(true);
    clickRow(select, 'fe');
    expect(select.getValue()).toEqual(['ui']);
    expect(changes).toEqual([['fe'], ['fe', 'ui'], ['ui']]);
  });

  it('maxTagCount 只影响显示：超出折叠成 +N，取值全量', () => {
    const { select } = setup({ mode: 'multiple', maxTagCount: 2, value: ['fe', 'be', 'ui', 'ux'] });
    expect(select.getFieldLabel()).toBe('前端组、后端组 +2');
    expect(select.getValue()).toEqual(['fe', 'be', 'ui', 'ux']);
  });

  it('clear() 清空多选值并回到占位', () => {
    const { select } = setup({ mode: 'multiple', value: ['fe', 'be'] });
    select.clear();
    expect(select.getValue()).toEqual([]);
    expect(select.getFieldLabel()).toBe('请选择部门');
  });
});

describe('ICETreeSelect 搜索', () => {
  it('按 label 过滤，但保留命中节点的祖先链', () => {
    const { select } = setup({ showSearch: true });
    select.open();
    select.setQuery('前端');
    expect(select.getMatchedKeys()).toEqual(['fe']);
    // 祖先（技术中心）还在，才能看出这是哪一支
    expect(select.getTree()!.getVisibleNodes().map((node) => node.key)).toEqual(['tech', 'fe']);
  });

  it('命中路径自动展开（不用用户再点开一层层找）', () => {
    const { select } = setup({ showSearch: true });
    select.open();
    select.setQuery('前端');
    expect(select.getTree()!.getVisibleNodes().some((node) => node.key === 'fe')).toBe(true);
  });

  it('大小写不敏感；清空查询恢复整棵树', () => {
    const { select } = setup({ showSearch: true });
    select.open();
    select.setQuery('ui');
    expect(select.getMatchedKeys()).toEqual(['ui']);
    select.setQuery('DESIGN');
    expect(select.getMatchedKeys()).toEqual(['design', 'ui']);
    select.setQuery('');
    // 前序：父在前、兄弟按声明顺序
    expect(select.getMatchedKeys()).toEqual(['tech', 'fe', 'be', 'design', 'ui', 'ux']);
    expect(select.getTree()!.getVisibleNodes().length).toBe(2); // 恢复默认（只展开顶层）
  });

  it('搜不到时树是空的（不留一棵「看着能点」的树）', () => {
    const { select } = setup({ showSearch: true });
    select.open();
    select.setQuery('不存在的部门');
    expect(select.getMatchedKeys()).toEqual([]);
    expect(select.getTree()!.getVisibleNodes().length).toBe(0);
  });

  it('搜索状态下也能选：选中后字段用真实标签', () => {
    const { select, changes } = setup({ showSearch: true, mode: 'multiple' });
    select.open();
    select.setQuery('intera');
    clickRow(select, 'ux');
    expect(select.getValue()).toEqual(['ux']);
    expect(select.getFieldLabel()).toBe('Interaction');
    expect(changes).toEqual([['ux']]);
  });
});
