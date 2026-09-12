/**
 * ICEImagePreview 规格（业界组件库 Image 预览浮层）：
 * - 打开后全屏遮罩 + 居中图片 + 底部工具栏（缩小/放大/左旋/右旋/上一张/下一张/关闭）；
 * - 上一张/下一张循环切换，触发 `change` 事件与 onIndexChange；
 * - 缩放有步进与上下限，旋转按 90° 递进；
 * - 关闭途径：关闭按钮、遮罩点击（maskClosable）、Esc；关闭后浮层从工具层移除。
 */
import { ICEImagePreview } from '../src/components/ICEImagePreview';
import { ICEFocusManager } from '../src/core/ICEFocusManager';
import { ICEOverlayManager } from '../src/core/ICEOverlayManager';

function makeICE() {
  const handlers: Record<string, Array<{ handler: any; ctx: any }>> = {};
  const ice: any = {
    canvasWidth: 800,
    canvasHeight: 600,
    childNodes: [],
    toolNodes: [],
    dirty: false,
    focused: null,
    evtBus: {
      on(name: string, handler: any, ctx: any) {
        (handlers[name] = handlers[name] || []).push({ handler, ctx });
      },
      off(name: string, handler: any) {
        handlers[name] = (handlers[name] || []).filter((entry) => entry.handler !== handler);
      },
      trigger(name: string, evt: any) {
        (handlers[name] || []).forEach((entry) => entry.handler.call(entry.ctx, evt));
      },
    },
    addTool: (tool: any) => ice.toolNodes.push(tool),
    removeTool: (tool: any) => {
      const index = ice.toolNodes.indexOf(tool);
      if (index !== -1) ice.toolNodes.splice(index, 1);
    },
    setFocusedComponent: (component: any) => {
      ice.focused = component;
    },
    getFocusedComponent: () => ice.focused,
    screenToWorld: (x: number, y: number) => [x, y],
    getRenderViewport: () => ({ scale: 1, tx: 0, ty: 0 }),
  };
  return ice;
}

const IMAGES = ['a.png', 'b.png', 'c.png'];

function makePreview(options: any = {}) {
  const ice = makeICE();
  const manager = new ICEOverlayManager(ice);
  const preview = new ICEImagePreview(ice, {
    images: IMAGES,
    manager,
    focusManager: new ICEFocusManager(ice),
    ...options,
  });
  return { ice, preview, manager };
}

describe('ICEImagePreview', () => {
  it('打开后显示第一张图，遮罩铺满可见区域', () => {
    const { ice, preview } = makePreview();
    preview.open();
    expect(preview.isOpen()).toBe(true);
    expect(preview.getIndex()).toBe(0);
    expect(preview.getImageNode()!.getSrc()).toBe('a.png');
    expect(preview.getMask()!.state.width).toBe(800);
    expect(preview.getMask()!.state.height).toBe(600);
    expect(ice.toolNodes.length).toBe(1);
  });

  it('上一张 / 下一张循环切换，并回调 onIndexChange', () => {
    const changes: number[] = [];
    const { preview } = makePreview({ onIndexChange: (index: number) => changes.push(index) });
    preview.open(2);
    const events: number[] = [];
    preview.on('change', (evt: any) => events.push(evt.param.index));
    preview.next();
    expect(preview.getIndex()).toBe(0); // 3 → 0 循环
    preview.prev();
    expect(preview.getIndex()).toBe(2);
    expect(changes).toEqual([0, 2]);
    expect(events).toEqual([0, 2]);
    expect(preview.getImageNode()!.getSrc()).toBe('c.png');
  });

  it('缩放有上下限，reset 复位；旋转按 90° 递进', () => {
    const { preview } = makePreview({ zoomStep: 0.5, minZoom: 0.5, maxZoom: 2 });
    preview.open();
    expect(preview.getZoom()).toBe(1);
    preview.zoomIn();
    expect(preview.getZoom()).toBe(1.5);
    preview.zoomIn();
    expect(preview.getZoom()).toBe(2); // 上限
    preview.zoomOut();
    preview.zoomOut();
    preview.zoomOut();
    expect(preview.getZoom()).toBe(0.5); // 下限
    preview.rotateRight();
    preview.rotateRight();
    expect(preview.getRotation()).toBe(180);
    preview.rotateLeft();
    expect(preview.getRotation()).toBe(90);
    preview.reset();
    expect(preview.getZoom()).toBe(1);
    expect(preview.getRotation()).toBe(0);
  });

  it('Esc / 遮罩点击 / 关闭按钮都能关闭，且浮层从工具层移除', () => {
    const closed: string[] = [];
    const { ice, preview, manager } = makePreview({ onClose: (reason: string) => closed.push(reason) });
    preview.open();
    ice.evtBus.trigger('keydown', { key: 'Escape' });
    expect(preview.isOpen()).toBe(false);
    expect(preview.getMask()).toBeNull();
    expect(manager.getLayer().childNodes).toHaveLength(0);

    preview.open();
    preview.getMask()!.trigger('click', null, {});
    expect(preview.isOpen()).toBe(false);

    preview.open();
    preview.getToolbarButton('close')!.trigger('click', null, {});
    expect(preview.isOpen()).toBe(false);

    expect(closed).toEqual(['esc', 'mask', 'close']);
  });

  it('maskClosable: false 时点遮罩不关；键盘 ←/→ 也能切换', () => {
    const { ice, preview } = makePreview({ maskClosable: false });
    preview.open();
    preview.getMask()!.trigger('click', null, {});
    expect(preview.isOpen()).toBe(true);
    ice.evtBus.trigger('keydown', { key: 'ArrowRight' });
    expect(preview.getIndex()).toBe(1);
    ice.evtBus.trigger('keydown', { key: 'ArrowLeft' });
    expect(preview.getIndex()).toBe(0);
  });

  it('只有一张图时切换不产生变化', () => {
    const changes: number[] = [];
    const { preview } = makePreview({ images: ['only.png'], onIndexChange: (index: number) => changes.push(index) });
    preview.open();
    preview.next();
    preview.prev();
    expect(preview.getIndex()).toBe(0);
    expect(changes).toEqual([]);
  });
});
