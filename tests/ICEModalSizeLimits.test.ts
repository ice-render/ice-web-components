/**
 * Modal 的尺寸下限可配 + Drawer 的 size 支持数字。
 */
import { openModal } from '../src/components/ICEModal';
import { openDrawer } from '../src/components/ICEDrawer';

function makeICE() {
  const ice: any = {
    canvasWidth: 1000,
    canvasHeight: 700,
    toolNodes: [],
    dirty: false,
    childNodes: [],
    evtBus: { on() {}, off() {}, trigger() {} },
    addTool: (tool: any) => ice.toolNodes.push(tool),
    removeTool: () => {},
    screenToWorld: (x: number, y: number) => [x, y],
    getRenderViewport: () => ({ scale: 1, tx: 0, ty: 0 }),
    setFocusedComponent: () => {},
    getFocusedComponent: () => null,
  };
  return ice;
}

describe('Modal 尺寸下限', () => {
  it('默认下限 240×140', () => {
    const modal = openModal(makeICE(), { title: 't', resizable: true });
    modal.setSize(10, 10);
    expect(modal.getDialogRect()).toMatchObject({ width: 240, height: 140 });
  });

  it('可以配 minWidth / minHeight（复杂表单要更宽的下限）', () => {
    const modal = openModal(makeICE(), { title: 't', resizable: true, minWidth: 420, minHeight: 300 });
    modal.setSize(100, 100);
    expect(modal.getDialogRect()).toMatchObject({ width: 420, height: 300 });
    modal.setSize(700, 500);
    expect(modal.getDialogRect()).toMatchObject({ width: 700, height: 500 });
  });
});

describe('Drawer size 预设', () => {
  it('size 也接受数字（这一单要 480 宽）', () => {
    const drawer = openDrawer(makeICE(), { title: 't', size: 480 });
    expect(drawer.getPanel()!.state.width).toBe(480);
  });
});
