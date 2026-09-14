/**
 * ICETree 的虚拟滚动：只渲染可视窗口。
 *
 * 背景：组织架构 / 文件树动辄几千个节点，全画出来既慢又占内存；树本来就有滚动视口，
 * 缺的只是「按滚动位置只建窗口内的行」这一步（表格的虚拟行是同一套算法）。
 *
 * 规格：
 * - 节点少时不虚拟（老行为：全部渲染）；
 * - 节点多（默认 ≥ 200）时只渲染可视窗口 + 上下缓冲，节点数有上界；
 * - 滚动只换窗口，节点数不增长；滚到底能看到最后一条；
 * - 展开 / 收起之后窗口重算，节点数仍有上界；
 * - 窗口外的行没有节点（`getRowNode` 返回 null），窗口内的照常可点、可选。
 */
import { ICETree } from '../src/components/ICETree';

const wideTree = (count: number) =>
  Array.from({ length: count }, (_, index) => ({ key: 'n' + index, label: '节点 ' + index }));

function setup(props: any = {}) {
  return new ICETree({ left: 0, top: 0, width: 240, height: 200, itemHeight: 30, ...props });
}

describe('ICETree 虚拟滚动', () => {
  it('节点少时不虚拟：全部渲染（老行为）', () => {
    const tree = setup({ nodes: wideTree(5) });
    expect(tree.isVirtual()).toBe(false);
    expect(tree.getRenderedRowKeys().length).toBe(5);
  });

  it('节点多时只渲染可视窗口 + 缓冲，节点数有上界', () => {
    const tree = setup({ nodes: wideTree(1000) });
    expect(tree.isVirtual()).toBe(true);
    expect(tree.getVisibleNodes().length).toBe(1000);
    expect(tree.getRenderedRowKeys().length).toBeLessThan(20);
  });

  it('滚动只换窗口：节点数不增长，滚到底看得到最后一条', () => {
    const tree = setup({ nodes: wideTree(1000) });
    const before = tree.getRenderedRowKeys().length;
    tree.setScrollTop(1e9);
    const after = tree.getRenderedRowKeys();
    expect(after.length).toBeLessThanOrEqual(before + 3);
    expect(after[after.length - 1]).toBe('n999');
  });

  it('窗口外的行没有节点，窗口内的照常可选', () => {
    const tree = setup({ nodes: wideTree(1000) });
    expect(tree.getRowNode('n0')).toBeTruthy();
    expect(tree.getRowNode('n900')).toBe(null);
    tree.setScrollTop(900 * 30);
    expect(tree.getRowNode('n900')).toBeTruthy();
    expect(tree.getRowNode('n0')).toBe(null);
    tree.getRowNode('n900')!.trigger('click', null, {});
    expect(tree.getSelectedKeys()).toEqual(['n900']);
  });

  it('展开 / 收起之后窗口重算，节点数仍有上界', () => {
    const nodes = Array.from({ length: 300 }, (_, index) => ({
      key: 'p' + index,
      label: '父 ' + index,
      children: [{ key: 'c' + index, label: '子 ' + index }],
    }));
    const tree = setup({ nodes });
    expect(tree.getRenderedRowKeys().length).toBeLessThan(20);
    tree.expandAll();
    expect(tree.getVisibleNodes().length).toBe(600);
    expect(tree.getRenderedRowKeys().length).toBeLessThan(20);
    tree.collapseAll();
    expect(tree.getVisibleNodes().length).toBe(300);
    expect(tree.getRenderedRowKeys().length).toBeLessThan(20);
  });

  it('setScrollTop 会夹到可滚动范围里', () => {
    const tree = setup({ nodes: wideTree(100) });
    tree.setScrollTop(1e9);
    expect(tree.getScrollTop()).toBe(100 * 30 - 198);
    tree.setScrollTop(-50);
    expect(tree.getScrollTop()).toBe(0);
  });
});
