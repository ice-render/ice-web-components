/**
 * ICEMenu 子菜单（内联展开）。
 *
 * 规格：
 * - 带 `children` 的项是父节点，渲染成可展开行（右侧 › / ⌄ 指示）；
 * - 点父节点只展开/收起，不触发 onSelect；点子项才选中并回调；
 * - 可见行 = 扁平化（展开的父节点后紧跟其子项），高度按可见行数算；
 * - 支持多级嵌套；空 children 视为叶子。
 */
import { ICEMenu, ICEMenuItem } from '../src/components/ICEMenu';
import { iceUIManager } from '../src/core/ICEManager';
import { resolvedStyleColor } from '../src/util/ICEStyle';

const items: ICEMenuItem[] = [
  { key: 'new', label: 'New' },
  {
    key: 'export',
    label: 'Export',
    children: [
      { key: 'pdf', label: 'PDF' },
      { key: 'png', label: 'PNG' },
    ],
  },
  {
    key: 'settings',
    label: 'Settings',
    children: [{ key: 'theme', label: 'Theme', children: [{ key: 'dark', label: 'Dark' }] }],
  },
  { key: 'empty', label: 'Empty', children: [] },
];

function setup() {
  const selected: string[] = [];
  const expandedLog: Array<[string, boolean]> = [];
  const menu = new ICEMenu({
    items,
    width: 240,
    itemHeight: 40,
    onSelect: (item: ICEMenuItem) => selected.push(item.key),
    onExpand: (key: string, expanded: boolean) => expandedLog.push([key, expanded]),
  });
  return { menu, selected, expandedLog };
}

describe('ICEMenu 子菜单', () => {
  it('默认全部折叠：只显示顶层项，高度按可见行数', () => {
    const { menu } = setup();
    expect(menu.getVisibleItems().map((item) => item.key)).toEqual(['new', 'export', 'settings', 'empty']);
    expect(menu.state.height).toBe(4 * 40);
    expect(menu.isExpanded('export')).toBe(false);
  });

  it('展开父节点：子项紧跟其后出现，高度随之变化', () => {
    const { menu } = setup();
    menu.toggleExpand('export');
    expect(menu.isExpanded('export')).toBe(true);
    expect(menu.getVisibleItems().map((item) => item.key)).toEqual(['new', 'export', 'pdf', 'png', 'settings', 'empty']);
    expect(menu.state.height).toBe(6 * 40);

    menu.toggleExpand('export');
    expect(menu.getVisibleItems().map((item) => item.key)).toEqual(['new', 'export', 'settings', 'empty']);
  });

  it('父项展开 / 收起触发 onExpand：点父项只展开，但应用层能拿到这个时机', () => {
    const { menu, selected, expandedLog } = setup();
    menu.activateItem('export');
    expect(expandedLog).toEqual([['export', true]]);
    expect(selected).toEqual([]); // 仍然不触发 onSelect
    menu.toggleExpand('export');
    expect(expandedLog).toEqual([
      ['export', true],
      ['export', false],
    ]);
    // 子项的选中不影响 onExpand
    menu.activateItem('new');
    expect(expandedLog.length).toBe(2);
    expect(selected).toEqual(['new']);
  });

  it('点父节点不回调，点子项才选中并回调', () => {
    const { menu, selected } = setup();
    menu.activateItem('export');
    expect(selected).toEqual([]);
    expect(menu.isExpanded('export')).toBe(true);

    menu.activateItem('pdf');
    expect(selected).toEqual(['pdf']);
    expect(menu.getSelectedKey()).toBe('pdf');
  });

  it('多级嵌套：逐层展开；空 children 视为叶子', () => {
    const { menu, selected } = setup();
    menu.activateItem('settings');
    menu.activateItem('theme');
    expect(menu.getVisibleItems().map((item) => item.key)).toContain('dark');
    menu.activateItem('dark');
    expect(selected).toEqual(['dark']);

    menu.activateItem('empty');
    expect(selected).toEqual(['dark', 'empty']);
  });

  it('行节点可查；子行有缩进', () => {
    const { menu } = setup();
    menu.toggleExpand('export');
    const parent = menu.getItemNode('export');
    const child = menu.getItemNode('pdf');
    expect(parent).not.toBeNull();
    expect(child).not.toBeNull();
    expect(Number(child!.state.left)).toBeGreaterThan(Number(parent!.state.left));
  });

  it('setExpandedKeys 可批量设置', () => {
    const { menu } = setup();
    menu.setExpandedKeys(['export', 'settings']);
    expect(menu.getVisibleItems().map((item) => item.key)).toEqual([
      'new',
      'export',
      'pdf',
      'png',
      'settings',
      'theme',
      'empty',
    ]);
    menu.setExpandedKeys([]);
    expect(menu.getVisibleItems().length).toBe(4);
  });

  it('选中子项：子项高亮，父项只做「当前分组」文字高亮（不加底色）', () => {
    const { menu } = setup();
    menu.activateItem('export');
    menu.activateItem('pdf');
    expect(menu.getSelectedKey()).toBe('pdf');

    const theme = iceUIManager.getTheme();
    const child = menu.getItemNode('pdf')!;
    const childLabel = child.childNodes[0] as any;
    // 样式槽里存的是主题引用 → 用"读画出来的颜色"的口径比对
    expect(resolvedStyleColor(child, 'fillStyle')).toBe(theme.colors.primaryBg);
    expect(resolvedStyleColor(childLabel, 'fillStyle')).toBe(theme.colors.primary);

    const parent = menu.getItemNode('export')!;
    const parentLabel = parent.childNodes[0] as any;
    expect(resolvedStyleColor(parentLabel, 'fillStyle')).toBe(theme.colors.primary);
    expect(parent.state.style.fillStyle).not.toBe(theme.colors.primaryBg);
  });
});
