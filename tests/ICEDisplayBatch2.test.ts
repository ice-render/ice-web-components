/**
 * 展示类组件批次二：ICECollapse / ICEDescriptions / ICETimeline。
 */
import { ICECollapse } from '../src/components/ICECollapse';
import { ICEDescriptions } from '../src/components/ICEDescriptions';
import { ICETimeline } from '../src/components/ICETimeline';

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

const collapseItems = [
  { key: 'a', title: '面板 A', content: 'A 的内容' },
  { key: 'b', title: '面板 B', content: 'B 的内容' },
];

describe('ICECollapse', () => {
  it('默认全部折叠：只有标题，内容不渲染', () => {
    const collapse = new ICECollapse({ width: 280, items: collapseItems });
    // textsOf 会去重（两个折叠箭头相同）
    expect(textsOf(collapse).slice().sort()).toEqual(['▸', '面板 A', '面板 B'].sort());
    expect(collapse.getActiveKeys()).toEqual([]);
    expect(collapse.getContentNode('a')).toBeNull();
  });

  it('点标题展开/收起，高度随之变化，onExpand 回调', () => {
    const expanded: string[][] = [];
    const collapse = new ICECollapse({
      width: 280,
      items: collapseItems,
      onExpand: (keys) => expanded.push(keys),
    });
    const collapsedHeight = collapse.state.height;

    collapse.getHeaderNode('a')!.trigger('click', null, {});
    expect(collapse.getActiveKeys()).toEqual(['a']);
    expect(textsOf(collapse)).toContain('A 的内容');
    expect(collapse.state.height).toBeGreaterThan(collapsedHeight);
    expect(collapse.getContentNode('a')).toBeTruthy();

    collapse.getHeaderNode('a')!.trigger('click', null, {});
    expect(collapse.getActiveKeys()).toEqual([]);
    expect(collapse.state.height).toBe(collapsedHeight);
    expect(expanded).toEqual([['a'], []]);
  });

  it('accordion：同时只展开一个', () => {
    const collapse = new ICECollapse({ width: 280, items: collapseItems, accordion: true, activeKeys: ['a'] });
    expect(collapse.getActiveKeys()).toEqual(['a']);
    collapse.getHeaderNode('b')!.trigger('click', null, {});
    expect(collapse.getActiveKeys()).toEqual(['b']);
    expect(textsOf(collapse)).not.toContain('A 的内容');
    expect(textsOf(collapse)).toContain('B 的内容');
  });
});

describe('ICEDescriptions', () => {
  const items = [
    { label: '姓名', value: '张三' },
    { label: '角色', value: '管理员' },
    { label: '城市', value: '杭州' },
    { label: '状态', value: '启用' },
  ];

  it('column=1：逐行渲染 label/value', () => {
    const descriptions = new ICEDescriptions({ width: 300, items });
    const texts = textsOf(descriptions);
    ['姓名', '张三', '角色', '管理员', '城市', '杭州', '状态', '启用'].forEach((text) => {
      expect(texts).toContain(text);
    });
  });

  it('column=2：两列排布（第二列在右侧）', () => {
    const descriptions = new ICEDescriptions({ width: 400, column: 2, items });
    const first = descriptions.getRowNodes()[0];
    const second = descriptions.getRowNodes()[1];
    expect(second.state.left).toBeGreaterThan(first.state.left);
    expect(descriptions.getRowNodes()[2].state.top).toBeGreaterThanOrEqual(first.state.top + 1);
  });
});

describe('ICETimeline', () => {
  const items = [
    { title: '创建订单', description: '用户下单', time: '09:01' },
    { title: '支付完成', description: '微信支付', time: '09:03' },
    { title: '已发货', time: '10:20' },
  ];

  it('渲染标题/描述/时间，且按顺序自上而下排布', () => {
    const timeline = new ICETimeline({ width: 320, items });
    const texts = textsOf(timeline);
    ['创建订单', '用户下单', '09:01', '支付完成', '微信支付', '09:03', '已发货', '10:20'].forEach((text) => {
      expect(texts).toContain(text);
    });
    const nodes = timeline.getItemNodes();
    expect(nodes.length).toBe(3);
    expect(nodes[1].state.top).toBeGreaterThan(nodes[0].state.top);
    expect(nodes[2].state.top).toBeGreaterThan(nodes[1].state.top);
  });

  it('自定义节点颜色与高度', () => {
    const timeline = new ICETimeline({ width: 320, items: [{ title: 'A', color: '#ff4d4f' }], itemHeight: 48 });
    expect(timeline.getItemNodes()[0].state.height).toBe(48);
    expect(timeline.getDotColor(0)).toBe('#ff4d4f');
  });
});
