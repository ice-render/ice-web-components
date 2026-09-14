/**
 * ICETabs 的方位（上/下/左/右）与拖动排序。
 *
 * 规格：
 * - `placement: 'top'`（默认）/ `'bottom'`：横向条，靠上或靠下；
 * - `'left'` / `'right'`：竖向排列，宽度 = 页签宽，高度 = 页签数 × 行高；
 * - `draggable`：按住页签左右（竖向是上下）拖到别的位置松手 → 顺序真的变了、
 *   `onReorder(from, to, tabs)` 回调、**选中的那个页签跟着它自己走**（不是停在旧下标）；
 * - 老行为（不传 placement / draggable）完全不变。
 */
import { ICETabs } from '../src/components/ICETabs';

const TABS = ['概览', '订单', '库存', '设置'];

function setup(props: any = {}) {
  const reorders: any[] = [];
  const tabs = new ICETabs({
    tabs: TABS,
    width: 400,
    height: 34,
    tabWidth: 96,
    itemGap: 6,
    onReorder: (from: number, to: number, next: string[]) => reorders.push([from, to, next]),
    ...props,
  });
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
  (tabs as any).ice = ice;
  (tabs as any).afterAddHandler();
  return { tabs, reorders };
}

describe('ICETabs 方位', () => {
  it('默认在顶部：所有页签 top=0', () => {
    const { tabs } = setup();
    expect(tabs.getPlacement()).toBe('top');
    expect(tabs.getTabBoxes().every((box) => box.top === 0)).toBe(true);
  });

  it('bottom：页签贴底（top = 高度 - 行高）', () => {
    const { tabs } = setup({ placement: 'bottom' });
    const boxes = tabs.getTabBoxes();
    expect(tabs.getPlacement()).toBe('bottom');
    // 贴底并留 6px 内边距
    expect(boxes.every((box) => box.top === 6)).toBe(true);
  });

  it('left：竖向排列，左右位置一致、top 递增', () => {
    const { tabs } = setup({ placement: 'left' });
    const boxes = tabs.getTabBoxes();
    expect(boxes.every((box) => box.left === 0)).toBe(true);
    expect(boxes[1].top).toBeGreaterThan(boxes[0].top);
    expect(tabs.state.height).toBe(4 * 34);
  });

  it('right：竖向排列并贴右', () => {
    const { tabs } = setup({ placement: 'right' });
    const boxes = tabs.getTabBoxes();
    expect(boxes.every((box) => box.left + box.width === 400)).toBe(true);
    expect(boxes[2].top).toBeGreaterThan(boxes[1].top);
  });
});

describe('ICETabs 拖动排序', () => {
  it('不传 draggable 时拖不动（老行为）', () => {
    const { tabs, reorders } = setup();
    (tabs as any).__onGlobalMouseDown({ offsetX: 10, offsetY: 10 });
    expect(tabs.isReordering()).toBe(false);
    expect(reorders).toEqual([]);
  });

  it('拖动第一页到第三页之后：顺序变了 + 回调 + 选中项跟着走', () => {
    const { tabs, reorders } = setup({ draggable: true });
    tabs.setActiveIndex(0);
    (tabs as any).__onGlobalMouseDown({ offsetX: 10, offsetY: 10 });
    expect(tabs.isReordering()).toBe(true);
    (tabs as any).__onGlobalMouseMove({ offsetX: 2 * 102 + 10, offsetY: 10 });
    (tabs as any).__onGlobalMouseUp();
    expect(tabs.getTabs()).toEqual(['订单', '库存', '概览', '设置']);
    expect(reorders[0][0]).toBe(0);
    expect(reorders[0][1]).toBe(2);
    expect(tabs.getActiveIndex()).toBe(2);
    expect(tabs.getActiveLabel()).toBe('概览');
  });

  it('竖向拖动按纵坐标算落点', () => {
    const { tabs } = setup({ draggable: true, placement: 'left' });
    (tabs as any).__onGlobalMouseDown({ offsetX: 5, offsetY: 5 });
    (tabs as any).__onGlobalMouseMove({ offsetX: 5, offsetY: 2 * 34 + 5 });
    (tabs as any).__onGlobalMouseUp();
    expect(tabs.getTabs()).toEqual(['订单', '库存', '概览', '设置']);
  });

  it('位置没变时不回调（拖回原处不算排序）', () => {
    const { tabs, reorders } = setup({ draggable: true });
    (tabs as any).__onGlobalMouseDown({ offsetX: 10, offsetY: 10 });
    (tabs as any).__onGlobalMouseMove({ offsetX: 12, offsetY: 10 });
    (tabs as any).__onGlobalMouseUp();
    expect(reorders).toEqual([]);
    expect(tabs.getTabs()).toEqual(TABS);
  });
});
