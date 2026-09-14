/**
 * ICEScrollPane 的滚动条拖拽（真实鼠标路径）。
 *
 * 以前只有滚轮能滚，滚动条只是「指示器」—— 用户按住滑块拖是没反应的。
 *
 * 规格：
 * - 按住竖向 / 横向滑块拖动，滚动位置按「轨道行程 ↔ 滚动行程」的比例换算；
 * - 拖到轨道两端就是滚到底 / 滚到顶；不会越界；
 * - 按住轨道空白处（不在滑块上）不响应；
 * - 拖拽状态可查询（`isThumbDragging()`），松手后复位。
 */
import { ICEScrollPane } from '../src/components/ICEScrollPane';
import { ICEWidget } from '../src/core/ICEWidget';

function setup(props: any = {}) {
  const pane = new ICEScrollPane({ left: 0, top: 0, width: 200, height: 100, ...props });
  pane.setContent(new ICEWidget({ width: 200, height: 400 }));
  pane.setContentSize(400, 400);
  const ice: any = {
    canvasWidth: 800,
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
  (pane as any).ice = ice;
  (pane as any).afterAddHandler();
  return { pane };
}

describe('ICEScrollPane 滑块拖拽', () => {
  it('按住竖向滑块往下拖：滚动位置按比例前进，松手复位', () => {
    const { pane } = setup();
    const thumb = pane.getScrollbarThumb();
    pane.setScroll(0, 0);
    (pane as any).__onThumbMouseDown('vertical', { offsetX: 0, offsetY: 0, target: thumb });
    expect(pane.isThumbDragging()).toBe(true);
    (pane as any).__onThumbMouseMove({ offsetX: 0, offsetY: 10000 });
    expect(pane.getScroll()[1]).toBe(pane.getScrollRange()[1]);
    (pane as any).__onThumbMouseUp();
    expect(pane.isThumbDragging()).toBe(false);
  });

  it('按住横向滑块往右拖到底', () => {
    const { pane } = setup();
    (pane as any).__onThumbMouseDown('horizontal', { offsetX: 0, offsetY: 0, target: pane.getHorizontalThumb() });
    (pane as any).__onThumbMouseMove({ offsetX: 10000, offsetY: 0 });
    expect(pane.getScroll()[0]).toBe(pane.getScrollRange()[0]);
    (pane as any).__onThumbMouseUp();
  });

  it('没按住滑块时不响应（点在轨道空白 / 内容上）', () => {
    const { pane } = setup();
    (pane as any).__onThumbMouseDown('vertical', { offsetX: 0, offsetY: 0, target: null });
    expect(pane.isThumbDragging()).toBe(false);
    (pane as any).__onThumbMouseMove({ offsetX: 0, offsetY: 5000 });
    expect(pane.getScroll()[1]).toBe(0);
  });

  it('不需要滚动时不响应', () => {
    const pane = new ICEScrollPane({ left: 0, top: 0, width: 200, height: 100 });
    pane.setContent(new ICEWidget({ width: 100, height: 50 }));
    pane.setContentSize(100, 50);
    (pane as any).__onThumbMouseDown('vertical', { offsetX: 0, offsetY: 0, target: pane.getScrollbarThumb() });
    expect(pane.isThumbDragging()).toBe(false);
  });
});
