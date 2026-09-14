/**
 * 横向菜单的子菜单开合表现。
 *
 * 规格：
 * - 点父项开子菜单；再点同一个父项**收起**（开关语义，不是只能开）；
 * - 点另一个父项：前一个自动收起（同一时刻只开一个）；
 * - 父项上的指示符跟着开合状态走（收起 ⌄ / 展开 ⌃）；
 * - Esc 能收起。
 */
import { ICEMenu } from '../src/components/ICEMenu';

const ITEMS = [
  { key: 'home', label: '首页' },
  { key: 'orders', label: '订单', children: [{ key: 'all', label: '全部' }] },
  { key: 'goods', label: '商品', children: [{ key: 'list', label: '列表' }] },
];

function setup(props: any = {}) {
  const menu = new ICEMenu({ left: 0, top: 0, width: 420, itemHeight: 40, items: ITEMS, mode: 'horizontal', ...props });
  const ice: any = {
    canvasWidth: 900,
    canvasHeight: 600,
    toolNodes: [],
    dirty: false,
    evtBus: { on() {}, off() {}, trigger() {} },
    addTool: () => {},
    removeTool: () => {},
    screenToWorld: (x: number, y: number) => [x, y],
    getRenderViewport: () => ({ scale: 1, tx: 0, ty: 0 }),
    setFocusedComponent: () => {},
    getFocusedComponent: () => null,
  };
  (menu as any).ice = ice;
  return { menu };
}

describe('横向菜单子菜单开合', () => {
  it('点父项开、再点同一个收起', () => {
    const { menu } = setup();
    menu.getItemNode('orders')!.trigger('click', null, {});
    expect(menu.isSubmenuOpen()).toBe(true);
    expect(menu.getSubmenuKey()).toBe('orders');
    menu.getItemNode('orders')!.trigger('click', null, {});
    expect(menu.isSubmenuOpen()).toBe(false);
  });

  it('点另一个父项：前一个自动收起', () => {
    const { menu } = setup();
    menu.getItemNode('orders')!.trigger('click', null, {});
    menu.getItemNode('goods')!.trigger('click', null, {});
    expect(menu.getSubmenuKey()).toBe('goods');
    expect(menu.isSubmenuOpen()).toBe(true);
  });

  it('父项指示符跟着开合状态走', () => {
    const { menu } = setup();
    expect(menu.getSubmenuIndicator('orders')).toBe('⌄');
    menu.openSubmenu('orders');
    expect(menu.getSubmenuIndicator('orders')).toBe('⌃');
    menu.closeSubmenu();
    expect(menu.getSubmenuIndicator('orders')).toBe('⌄');
  });

  it('Esc 收起子菜单', () => {
    const { menu } = setup();
    menu.setFocused(true);
    menu.openSubmenu('orders');
    (menu as any).__onKeyDown({ key: 'Escape' });
    expect(menu.isSubmenuOpen()).toBe(false);
  });
});
