/**
 * ICEMenu 的两个形态：横向（顶栏菜单）与收起态（侧栏只留图标）。
 *
 * 规格：
 * - `collapsed`：宽度缩到 56，只画图标（不画文字），子菜单不内联展开；
 * - `mode: 'horizontal'`：顶层项横排，高度 = 单行高；
 * - 横向模式下带子菜单的项点开是**浮层**（不撑高菜单），点里面的子项会选中并关闭；
 * - 叶子项直接选中，不开浮层；
 * - 浮层可 `closeSubmenu()` / 点别处关闭。
 */
import { ICEMenu } from '../src/components/ICEMenu';

const ITEMS = [
  { key: 'home', label: '首页', icon: '⌂' },
  { key: 'orders', label: '订单', icon: '▤', children: [{ key: 'all', label: '全部订单' }, { key: 'pending', label: '待处理' }] },
  { key: 'settings', label: '设置', icon: '⚙' },
];

function setup(props: any = {}) {
  const picked: string[] = [];
  const menu = new ICEMenu({
    left: 0,
    top: 0,
    width: 240,
    itemHeight: 40,
    items: ITEMS,
    onSelect: (item: any) => picked.push(item.key),
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
    screenToWorld: (x: number, y: number) => [x, y],
    getRenderViewport: () => ({ scale: 1, tx: 0, ty: 0 }),
    setFocusedComponent: () => {},
    getFocusedComponent: () => null,
  };
  (menu as any).ice = ice;
  if (typeof (menu as any).afterAddHandler === 'function') {
    (menu as any).afterAddHandler();
  }
  return { menu, picked };
}

describe('ICEMenu 收起态', () => {
  it('collapsed：宽度缩到 56，只画图标', () => {
    const { menu } = setup({ collapsed: true });
    expect(menu.isCollapsed()).toBe(true);
    expect(menu.state.width).toBe(56);
    expect(menu.isLabelVisible('home')).toBe(false);
    expect(menu.hasIcon('home')).toBe(true);
  });

  it('展开回来：宽度与文字都复原', () => {
    const { menu } = setup({ collapsed: true });
    menu.setCollapsed(false);
    expect(menu.isCollapsed()).toBe(false);
    expect(menu.state.width).toBe(240);
    expect(menu.isLabelVisible('home')).toBe(true);
  });

  it('收起态下子菜单不内联展开（一行只有图标，不适合再缩进）', () => {
    const { menu } = setup({ collapsed: true });
    expect(menu.getVisibleItems().map((item) => item.key)).toEqual(['home', 'orders', 'settings']);
    menu.toggleExpand('orders');
    expect(menu.getVisibleItems().map((item) => item.key)).toEqual(['home', 'orders', 'settings']);
  });
});

describe('ICEMenu 横向形态', () => {
  it('顶层项横排，高度等于单行高', () => {
    const { menu } = setup({ mode: 'horizontal', width: 420 });
    expect(menu.getMode()).toBe('horizontal');
    const boxes = menu.getItemBoxes();
    expect(boxes.length).toBe(3);
    expect(boxes.every((box) => box.top === 2)).toBe(true);
    expect(boxes[1].left).toBeGreaterThan(boxes[0].left);
    expect(menu.state.height).toBe(40);
  });

  it('叶子项直接选中，不开浮层', () => {
    const { menu, picked } = setup({ mode: 'horizontal' });
    menu.getItemNode('home')!.trigger('click', null, {});
    expect(picked).toEqual(['home']);
    expect(menu.isSubmenuOpen()).toBe(false);
  });

  it('带子菜单的项点开是浮层：列出子项，选中后关闭', () => {
    const { menu, picked } = setup({ mode: 'horizontal' });
    menu.getItemNode('orders')!.trigger('click', null, {});
    expect(menu.isSubmenuOpen()).toBe(true);
    expect(menu.getSubmenuKey()).toBe('orders');
    const child = menu.getSubmenuItemNode('all');
    expect(child).toBeTruthy();
    child!.trigger('click', null, {});
    expect(picked).toEqual(['all']);
    expect(menu.isSubmenuOpen()).toBe(false);
  });

  it('浮层可以手动关掉（点别处 / Esc 由浮层管理器负责）', () => {
    const { menu } = setup({ mode: 'horizontal' });
    menu.openSubmenu('orders');
    expect(menu.isSubmenuOpen()).toBe(true);
    menu.closeSubmenu();
    expect(menu.isSubmenuOpen()).toBe(false);
    expect(menu.getSubmenuKey()).toBe(null);
  });

  it('纵向模式不受影响（默认行为不变）', () => {
    const { menu } = setup();
    expect(menu.getMode()).toBe('vertical');
    const boxes = menu.getItemBoxes();
    expect(boxes[1].top).toBeGreaterThan(boxes[0].top);
  });
});
