/**
 * Tree 虚拟滚动 × 拖拽的交叉验证。
 *
 * 虚拟化之后只有窗口内的行有节点、滚动位置也会影响命中计算 —— 这两件事叠在一起最容易出错，
 * 所以单独钉几条：
 * - 滚到中间后，窗口内的行能拖，落点按**滚动后的世界坐标**算（不是「第 0 行」）；
 * - drag 落下后数据真的按落点重排，且窗口重新渲染后顺序正确；
 * - 窗口外的行没有节点，自然也没法被拖（不会静默拖错行）。
 */
import { ICETree } from '../src/components/ICETree';

const wideTree = (count: number) =>
  Array.from({ length: count }, (_, index) => ({ key: 'n' + index, label: '节点 ' + index }));

function setup(props: any = {}) {
  const drops: any[] = [];
  const tree = new ICETree({
    left: 0,
    top: 0,
    width: 240,
    height: 200,
    itemHeight: 30,
    nodes: wideTree(1000),
    draggable: true,
    onDrop: (info: any) => drops.push(info),
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
  (tree as any).ice = ice;
  return { tree, drops };
}

describe('Tree 虚拟滚动 × 拖拽', () => {
  it('命中计算把滚动偏移加回来：局部坐标 → 全局行号', () => {
    const { tree } = setup();
    // 没滚动时第 3 行
    expect(tree.getRowIndexAt(2 * 30 + 5)).toBe(2);
    // 滚了 500 行之后，同一个屏幕位置命中的是第 502 行
    tree.setScrollTop(500 * 30);
    expect(tree.getRowIndexAt(2 * 30 + 5)).toBe(502);
    expect(tree.getRowNode('n502')).toBeTruthy();
  });

  it('真实鼠标路径：滚动后按住窗口内的行开始拖，落点按全局行号算', () => {
    const { tree } = setup();
    tree.setScrollTop(500 * 30);
    const box = tree.getMinBoundingBox(true);
    const localY = 2 * 30 + 4; // 窗口内第三行
    (tree as any).__onGlobalMouseDown({ offsetX: box.tl[0] + 10, offsetY: box.tl[1] + localY });
    expect(tree.isDragging()).toBe(true);
    expect((tree as any).dragState.key).toBe('n502');
    (tree as any).__onGlobalMouseMove({ offsetX: box.tl[0] + 10, offsetY: box.tl[1] + 4 * 30 - 1 });
    expect(tree.getDropTarget()).toEqual({ index: 503, position: 'after' });
    (tree as any).__onGlobalMouseUp();
    const visible = tree.getVisibleNodes().map((node) => node.key);
    expect(visible.slice(500, 505)).toEqual(['n500', 'n501', 'n503', 'n502', 'n504']);
  });

  it('窗口外的行没有节点，也拖不动（不会静默拖错行）', () => {
    const { tree } = setup();
    expect(tree.getRowNode('n900')).toBe(null);
    const box = tree.getMinBoundingBox(true);
    // 指针落在最后一行显示的位置：命中的是「当前窗口里」的行，而不是看不见的 n900
    (tree as any).__onGlobalMouseDown({ offsetX: box.tl[0] + 10, offsetY: box.tl[1] + 5 });
    expect(tree.isDragging()).toBe(true);
    expect((tree as any).dragState.key).toBe('n0');
    (tree as any).__onGlobalMouseUp();
  });

  it('moveNode 之后虚拟窗口按新顺序渲染', () => {
    const { tree, drops } = setup();
    tree.setScrollTop(500 * 30);
    tree.moveNode('n500', 'n502', 'after');
    expect(drops.length).toBe(1);
    const visible = tree.getVisibleNodes().map((node) => node.key);
    expect(visible.slice(499, 504)).toEqual(['n499', 'n501', 'n502', 'n500', 'n503']);
    expect(tree.getRenderedRowKeys().length).toBeLessThan(20);
  });
});
