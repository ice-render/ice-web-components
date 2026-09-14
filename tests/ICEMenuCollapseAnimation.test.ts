/**
 * ICEMenu 的**收起**动画（展开上一批做了，收起当时还是立即的）。
 *
 * 规格：
 * - `expandAnimation` 开着时收起也走动画：子行向上滑向父行并淡出，下方的行同步上移；
 * - 动画结束后子行真的消失、下方行落到新位置、`isAnimating(key)` 复位；
 * - 减少动效 / 时长为 0 时仍然立即收起（老行为）。
 */
import { ICEMenu } from '../src/components/ICEMenu';
import { setICEReducedMotion } from '../src/util/ICEAnimation';

const ITEMS = [
  { key: 'home', label: '首页' },
  { key: 'orders', label: '订单', children: [{ key: 'all', label: '全部' }, { key: 'pending', label: '待处理' }] },
  { key: 'settings', label: '设置' },
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

describe('ICEMenu 收起动画', () => {
  afterEach(() => setICEReducedMotion('auto'));

  it('默认立即收起（老行为）', () => {
    const { menu } = setup();
    menu.toggleExpand('orders');
    menu.toggleExpand('orders');
    expect(menu.isExpanded('orders')).toBe(false);
    expect(menu.isAnimating('orders')).toBe(false);
    expect(menu.getItemBox('settings')!.top).toBe(80);
  });

  it('开了动画：收起过程中可查，结束后子行消失、下方行上移', () => {
    jest.useFakeTimers();
    const { menu } = setup({ expandAnimation: 200 });
    menu.toggleExpand('orders');
    jest.advanceTimersByTime(400);
    expect(menu.getItemBox('settings')!.top).toBe(160); // 展开后是 4 行
    menu.toggleExpand('orders');
    expect(menu.isAnimating('orders')).toBe(true);
    jest.advanceTimersByTime(400);
    expect(menu.isAnimating('orders')).toBe(false);
    expect(menu.isExpanded('orders')).toBe(false);
    expect(menu.getItemBox('settings')!.top).toBe(80); // 回到 3 行
    jest.useRealTimers();
  });

  it('减少动效时立即收起', () => {
    setICEReducedMotion(true);
    const { menu } = setup({ expandAnimation: 200 });
    menu.toggleExpand('orders');
    menu.toggleExpand('orders');
    expect(menu.isAnimating('orders')).toBe(false);
    expect(menu.getItemBox('all')).toBe(null);
  });
});
