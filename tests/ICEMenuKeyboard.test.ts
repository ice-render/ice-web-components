/**
 * ICEMenu 的键盘导航（侧栏菜单不能只能用鼠标点）。
 *
 * 规格（与 ICETree 同一套约定：只在获得焦点时响应全局 keydown）：
 * - ↓/↑ 移动激活项（跳过 disabled，到头回绕；还没激活时 ↓ 落到第一项、↑ 落到最后一项）；
 * - → 展开父项（已展开则落到第一个子项），← 收起父项（已收起则回到父项）；
 * - Enter / Space 激活：父项展开收起、叶子项选中并回调；
 * - Esc 关闭子菜单浮层；Home / End 跳到首尾。
 */
import { ICEMenu } from '../src/components/ICEMenu';

const ITEMS = [
  { key: 'home', label: '首页' },
  { key: 'orders', label: '订单', children: [{ key: 'all', label: '全部订单' }, { key: 'pending', label: '待处理' }] },
  { key: 'blocked', label: '禁用项', disabled: true },
  { key: 'settings', label: '设置' },
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
    removeTool: () => {},
    screenToWorld: (x: number, y: number) => [x, y],
    getRenderViewport: () => ({ scale: 1, tx: 0, ty: 0 }),
    setFocusedComponent: () => {},
    getFocusedComponent: () => null,
  };
  (menu as any).ice = ice;
  menu.setFocused(true);
  return { menu, picked, ice };
}

const press = (menu: ICEMenu, key: string) => (menu as any).__onKeyDown({ key });

describe('ICEMenu 键盘导航', () => {
  it('↓ / ↑ 移动激活项并跳过禁用项，到头回绕', () => {
    const { menu } = setup();
    expect(menu.getActiveKey()).toBe(null);
    press(menu, 'ArrowDown');
    expect(menu.getActiveKey()).toBe('home');
    press(menu, 'ArrowDown');
    expect(menu.getActiveKey()).toBe('orders');
    press(menu, 'ArrowDown'); // 跳过 blocked
    expect(menu.getActiveKey()).toBe('settings');
    press(menu, 'ArrowDown');
    expect(menu.getActiveKey()).toBe('home');
    press(menu, 'ArrowUp');
    expect(menu.getActiveKey()).toBe('settings');
  });

  it('Home / End 跳到首尾（同样跳过禁用项）', () => {
    const { menu } = setup();
    press(menu, 'End');
    expect(menu.getActiveKey()).toBe('settings');
    press(menu, 'Home');
    expect(menu.getActiveKey()).toBe('home');
  });

  it('→ 展开父项，再按一次落到第一个子项；← 收起 / 回到父项', () => {
    const { menu } = setup();
    press(menu, 'ArrowDown');
    press(menu, 'ArrowDown'); // orders
    press(menu, 'ArrowRight');
    expect(menu.isExpanded('orders')).toBe(true);
    press(menu, 'ArrowRight');
    expect(menu.getActiveKey()).toBe('all');
    press(menu, 'ArrowLeft');
    expect(menu.getActiveKey()).toBe('orders');
    press(menu, 'ArrowLeft');
    expect(menu.isExpanded('orders')).toBe(false);
  });

  it('Enter / Space 激活：父项展开，叶子项选中并回调', () => {
    const { menu, picked } = setup();
    press(menu, 'ArrowDown');
    press(menu, 'ArrowDown'); // orders
    press(menu, 'Enter');
    expect(menu.isExpanded('orders')).toBe(true);
    press(menu, 'ArrowDown'); // all
    press(menu, ' ');
    expect(picked).toEqual(['all']);
    expect(menu.getSelectedKey()).toBe('all');
  });

  it('没有焦点时不抢键盘', () => {
    const { menu } = setup();
    menu.setFocused(false);
    press(menu, 'ArrowDown');
    expect(menu.getActiveKey()).toBe(null);
  });

  it('横向模式下 ← / → 在顶层项之间移动（不进子菜单）', () => {
    const { menu } = setup({ mode: 'horizontal' });
    press(menu, 'ArrowRight');
    expect(menu.getActiveKey()).toBe('home');
    press(menu, 'ArrowRight');
    expect(menu.getActiveKey()).toBe('orders');
    press(menu, 'ArrowRight');
    expect(menu.getActiveKey()).toBe('settings');
  });
});
