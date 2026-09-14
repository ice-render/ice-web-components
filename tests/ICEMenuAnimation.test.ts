/**
 * ICEMenu 的折叠动画。
 *
 * 规格：
 * - **默认不动画**（老行为：点子菜单立刻展开/收起）；
 * - `expandAnimation: 毫秒` 时子行从父行位置滑到最终位置（`isAnimating(key)` 可查）；
 * - 「减少动效」开着时立即展开（与全库同一个开关）；
 * - 动画结束后位置正确、状态清空。
 */
import { ICEMenu } from '../src/components/ICEMenu';
import { setICEReducedMotion } from '../src/util/ICEAnimation';

const ITEMS = [
  { key: 'home', label: '首页' },
  { key: 'orders', label: '订单', children: [{ key: 'all', label: '全部' }, { key: 'pending', label: '待处理' }] },
];

function setup(props: any = {}) {
  const menu = new ICEMenu({ left: 0, top: 0, width: 240, itemHeight: 40, items: ITEMS, ...props });
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

describe('ICEMenu 折叠动画', () => {
  afterEach(() => setICEReducedMotion('auto'));

  it('默认立即展开（老行为）', () => {
    const { menu } = setup();
    expect(menu.getExpandAnimation()).toBe(0);
    menu.toggleExpand('orders');
    expect(menu.isExpanded('orders')).toBe(true);
    expect(menu.isAnimating('orders')).toBe(false);
    expect(menu.getVisibleItems().map((item) => item.key)).toEqual(['home', 'orders', 'all', 'pending']);
  });

  it('开了动画：展开中可查、结束后位置正确', () => {
    jest.useFakeTimers();
    const { menu } = setup({ expandAnimation: 200 });
    expect(menu.getExpandAnimation()).toBe(200);
    menu.toggleExpand('orders');
    expect(menu.isExpanded('orders')).toBe(true);
    expect(menu.isAnimating('orders')).toBe(true);
    // 动画中：子行已经存在（先渲染到位再插值），但还没到最终位置
    const during = menu.getItemBox('all')!.top;
    jest.advanceTimersByTime(400);
    expect(menu.isAnimating('orders')).toBe(false);
    const after = menu.getItemBox('all')!.top;
    expect(after).toBeGreaterThan(during);
    expect(after).toBe(80); // 首页 0 / 订单 40 / 全部 80
    jest.useRealTimers();
  });

  it('减少动效时立即展开', () => {
    setICEReducedMotion(true);
    const { menu } = setup({ expandAnimation: 200 });
    menu.toggleExpand('orders');
    expect(menu.isAnimating('orders')).toBe(false);
    expect(menu.getItemBox('all')!.top).toBe(80);
  });

  it('收起也走同一条路径（动画结束回到收起态）', () => {
    const { menu } = setup({ expandAnimation: 0 });
    menu.toggleExpand('orders');
    menu.toggleExpand('orders');
    expect(menu.isExpanded('orders')).toBe(false);
    expect(menu.getItemBox('all')).toBe(null);
  });
});
