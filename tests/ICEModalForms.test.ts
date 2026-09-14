/**
 * ICEModal 的形态：可拖拽 / 可缩放 / 全屏 / 尺寸预设。
 *
 * 规格：
 * - `draggable`：按住标题栏拖（这里走 `dragBy` 这条同源路径），且**不许拖出可见区**；
 * - `resizable`：`setSize` 有下限、且不超过可见区，标题/正文/页脚按钮跟着重排；
 * - `fullscreen` / `toggleFullscreen()`：铺满后能**还原到进入全屏前的位置与尺寸**；
 * - `size: 'sm' | 'lg'`：等价于预设宽度；
 * - 没开这些开关时行为与以前一模一样。
 */
import { openModal } from '../src/components/ICEModal';

function makeICE() {
  const ice: any = {
    canvasWidth: 900,
    canvasHeight: 600,
    toolNodes: [],
    dirty: false,
    childNodes: [],
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
  return ice;
}

const open = (props: any = {}) => openModal(makeICE(), { title: '编辑', content: '正文', ...props });

describe('ICEModal 形态', () => {
  it('默认居中、不可拖拽（老行为）', () => {
    const modal = open();
    const rect = modal.getDialogRect()!;
    expect(modal.isDraggable()).toBe(false);
    expect(rect.height).toBeGreaterThan(0);
    modal.dragBy(40, 40); // 没开开关 → 不动
    expect(modal.getDialogRect()).toEqual(rect);
  });

  it('可拖拽：移动对话框，但会被夹在可见区里', () => {
    const modal = open({ draggable: true });
    const start = modal.getDialogRect()!;
    modal.dragBy(30, 20);
    const moved = modal.getDialogRect()!;
    expect(moved.left).toBe(start.left + 30);
    expect(moved.top).toBe(start.top + 20);
    modal.dragBy(99999, 99999);
    const clamped = modal.getDialogRect()!;
    expect(clamped.left).toBe(900 - clamped.width);
    expect(clamped.top).toBe(600 - clamped.height);
    modal.dragBy(-99999, -99999);
    expect(modal.getDialogRect()).toEqual({ left: 0, top: 0, width: clamped.width, height: clamped.height });
  });

  it('可缩放：setSize 有下限，且标题与页脚按钮跟着重排', () => {
    const modal = open({ resizable: true, width: 420, height: 220 });
    modal.setSize(560, 320);
    expect(modal.getDialogRect()!.width).toBe(560);
    expect(modal.getConfirmButton()!.state.left).toBe(560 - 20 - 84);
    expect(modal.getConfirmButton()!.state.top).toBe(320 - 20 - 32);
    modal.setSize(10, 10); // 夹到下限
    const small = modal.getDialogRect()!;
    expect(small.width).toBe(240);
    expect(small.height).toBe(140);
  });

  it('全屏：铺满可见区，再切一次还原原来的位置与尺寸', () => {
    const modal = open({ draggable: true });
    modal.setPosition(60, 40);
    const before = modal.getDialogRect()!;
    modal.toggleFullscreen();
    expect(modal.isFullscreen()).toBe(true);
    expect(modal.getDialogRect()).toEqual({ left: 0, top: 0, width: 900, height: 600 });
    modal.toggleFullscreen();
    expect(modal.isFullscreen()).toBe(false);
    expect(modal.getDialogRect()).toEqual(before);
  });

  it('size 预设决定打开时的宽度；fullscreen 打开即铺满', () => {
    const sm = open({ size: 'sm' });
    expect(sm.getDialogRect()!.width).toBe(360);
    const lg = open({ size: 'lg' });
    expect(lg.getDialogRect()!.width).toBe(640);
    const full = open({ size: 'fullscreen' });
    expect(full.isFullscreen()).toBe(true);
    expect(full.getDialogRect()).toEqual({ left: 0, top: 0, width: 900, height: 600 });
  });

  it('全屏时拖拽无效（铺满就没有「拖」的语义了）', () => {
    const modal = open({ draggable: true });
    modal.toggleFullscreen();
    modal.dragBy(40, 40);
    expect(modal.getDialogRect()).toEqual({ left: 0, top: 0, width: 900, height: 600 });
  });
});
