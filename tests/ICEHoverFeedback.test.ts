/**
 * 交互细节回归：悬停反馈（表格行 / 菜单项 / 树行 / 折叠标题）+ 表格行内控件不触发行选中。
 *
 * 背景：引擎的 `trigger(name, evt, param)` 把载荷放进 `event.param`，只读 `evt.hovered`
 * 会永远拿到 undefined —— 表现为「hover 状态确实变了（isHovered() === true），
 * 但底色一点没动」，属于静默失效。这里直接断言 `setHovered(true)` 后底色必须变化。
 */
import { ICETable } from '../src/components/ICETable';
import { ICEMenu, ICEMenuItem } from '../src/components/ICEMenu';
import { ICETree } from '../src/components/ICETree';
import { ICECollapse } from '../src/components/ICECollapse';
import { iceUIManager } from '../src/core/ICEManager';
import { readHovered } from '../src/util/ICEStyle';

const theme = iceUIManager.getTheme();

describe('readHovered', () => {
  it('兼容引擎的 param 形态与手写的平铺形态', () => {
    expect(readHovered({ param: { hovered: true } })).toBe(true);
    expect(readHovered({ hovered: true })).toBe(true);
    expect(readHovered({ param: { hovered: false } })).toBe(false);
    expect(readHovered(null)).toBe(false);
    expect(readHovered({})).toBe(false);
  });
});

describe('悬停反馈', () => {
  it('表格行：悬停换底色，移开恢复', () => {
    const table = new ICETable({
      width: 600,
      columns: [{ key: 'a', title: 'A' }],
      data: [{ a: '1' }, { a: '2' }],
    });
    const row = table.childNodes[1] as any; // [0] 是表头
    const before = row.state.style.fillStyle;
    row.setHovered(true);
    const hovered = row.state.style.fillStyle;
    expect(hovered).not.toBe(before);
    expect(hovered).toBe(theme.colors.disabled);
    row.setHovered(false);
    expect(row.state.style.fillStyle).toBe(before);
  });

  it('菜单项：悬停换底色（选中项保持选中底色）', () => {
    const items: ICEMenuItem[] = [
      { key: 'a', label: 'A' },
      { key: 'b', label: 'B' },
    ];
    const menu = new ICEMenu({ items, width: 200, selectedKey: 'a' });
    const panelB = menu.getItemNode('b') as any;
    expect(panelB.state.style.fillStyle).toBe('rgba(0,0,0,0)');
    panelB.setHovered(true);
    expect(panelB.state.style.fillStyle).toBe(theme.colors.background);
    panelB.setHovered(false);
    expect(panelB.state.style.fillStyle).toBe('rgba(0,0,0,0)');
  });

  it('树行：悬停换底色', () => {
    const tree = new ICETree({ width: 220, nodes: [{ key: 'a', label: 'A' }] });
    const row = tree.getRowNode('a') as any;
    const before = row.state.style.fillStyle;
    row.setHovered(true);
    expect(row.state.style.fillStyle).toBe(theme.colors.background);
    row.setHovered(false);
    expect(row.state.style.fillStyle).toBe(before);
  });

  it('折叠标题：悬停换底色；展开时箭头是 ▾', () => {
    const collapse = new ICECollapse({ width: 400, items: [{ key: 'a', title: 'A', content: 'x' }] });
    expect(collapse.getHeaderNode('a')).not.toBeNull();
    const header = collapse.childNodes[0] as any;
    header.setHovered(true);
    expect(header.state.style.fillStyle).toBe(theme.colors.disabled);
    header.setHovered(false);
    expect(header.state.style.fillStyle).toBe(theme.colors.background);

    // 展开后重绘：标题行的第一个子节点是方向箭头
    collapse.setActiveKeys(['a']);
    const expandedHeader = collapse.getHeaderNode('a') as any;
    const arrow = expandedHeader.childNodes[0] as any;
    expect(arrow.state.text).toBe('▾');
  });
});

describe('表格行内控件不触发行选中', () => {
  const makeTable = () => {
    const picked: Array<{ row: any; index: number }> = [];
    const table = new ICETable({
      width: 600,
      rowHeight: 40,
      headerHeight: 36,
      columns: [{ key: 'a', title: 'A' }],
      data: [{ a: '1' }, { a: '2' }],
      onSelect: (row: any, index: number) => picked.push({ row, index }),
    });
    (table as any).ice = { screenToWorld: (x: number, y: number) => [x, y] };
    (table as any).getMinBoundingBox = () => ({ tl: [0, 0], br: [600, 200] });
    return { table, picked };
  };

  it('点在行内交互控件（如「详情/删除」按钮）上：不做整行选中', () => {
    const { table, picked } = makeTable();
    const row = table.childNodes[1] as any;
    const cellChild = row.childNodes[0] as any; // 模拟行内按钮
    (table as any).__onGlobalMouseDown({ offsetX: 20, offsetY: 50, target: cellChild });
    expect(picked).toEqual([]);
    expect(table.getSelectedIndex()).toBe(-1);
  });

  it('点在行本体上：正常选中并回调', () => {
    const { table, picked } = makeTable();
    const row = table.childNodes[1] as any;
    (table as any).__onGlobalMouseDown({ offsetX: 20, offsetY: 50, target: row });
    expect(picked.length).toBe(1);
    expect(picked[0].index).toBe(0);
    expect(table.getSelectedIndex()).toBe(0);
  });
});
