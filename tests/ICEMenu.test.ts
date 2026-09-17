/**
 * `ICEMenu.setItemLabel()`：**运行期改项文案**。
 *
 * 为什么单独立一条：菜单项的文案在运行期常常会变（当前主题是深色 ✓、未读数、按上下文变的标签）。
 * 没有这个入口，调用方只能 poke `getItemNode()` 拿到的行容器 —— 而**子项没展开时根本没有节点**，
 * poke 不到；展开后又按 `items` 里的旧文案重建。2026-09-17 做热切换时撞上的就是这个缺口。
 */
import { ICEMenu } from '../src/components/ICEMenu';

describe('setItemLabel：运行期改项文案', () => {
  it('改父项与子项的文案；子项展开时按新文案重建（poke 节点做不到的那一半）', () => {
    const menu = new ICEMenu({
      items: [{ key: 'theme', label: '界面主题', children: [{ key: 'theme:dark', label: '深色' }] }],
    });

    menu.setItemLabel('theme', '外观');
    menu.setItemLabel('theme:dark', '深色 ✓');
    expect((menu.getVisibleItems().find((item: any) => item.key === 'theme') as any).label).toBe('外观');

    // 先改文案、后展开：展开时读的是 `items`，所以拿到的是新文案
    menu.setExpandedKeys(['theme']);
    const childText = String(
      (menu.getItemNode('theme:dark').childNodes || [])
        .map((node: any) => (node.state && node.state.text) || '')
        .join(' ')
    );
    expect(childText).toContain('深色 ✓');
  });

  it('不认识的 key / 文案没变：幂等且不抛（调用方不必自己判断）', () => {
    const menu = new ICEMenu({ items: [{ key: 'a', label: 'A' }] });
    expect(() => menu.setItemLabel('nope', 'X')).not.toThrow();
    expect(menu.setItemLabel('a', 'A')).toBe(menu);
    expect(menu.setItemLabel('a', 'B')).toBe(menu);
    expect((menu.getVisibleItems()[0] as any).label).toBe('B');
  });
});
