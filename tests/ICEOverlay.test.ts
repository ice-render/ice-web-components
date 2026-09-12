/**
 * 弹层底座（ICEOverlayManager + resolveICEOverlayPosition）单测。
 *
 * 定位是纯函数，可直接断言；管理器用一个最小 ICE 桩验证：
 * 挂载到工具层、位置计算、点外关闭、Esc 关闭、exclusive、stop 清理。
 */
import { ICEWidget } from '../src/core/ICEWidget';
import { ICEOverlayManager } from '../src/core/ICEOverlayManager';
import { resolveICEOverlayPosition } from '../src/util/ICEOverlayPosition';

function makeICE() {
  const handlers: Record<string, Array<{ handler: any; ctx: any }>> = {};
  const ice: any = {
    canvasWidth: 800,
    canvasHeight: 600,
    toolNodes: [],
    dirty: false,
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
    addTool(tool: any) {
      ice.toolNodes.push(tool);
    },
    removeTool(tool: any) {
      const index = ice.toolNodes.indexOf(tool);
      if (index !== -1) ice.toolNodes.splice(index, 1);
    },
    getRenderViewport: () => ({ scale: 1, tx: 0, ty: 0 }),
    screenToWorld: (x: number, y: number) => [x, y],
  };
  return ice;
}

function panel(width: number, height: number) {
  return new ICEWidget({ fill: true, stroke: true, width, height });
}

/** 手动推进帧的 driver（动效断言不依赖真实 rAF） */
function makeFrameDriver() {
  let queue: Array<(time: number) => void> = [];
  return {
    driver: {
      request(callback: (time: number) => void) {
        queue.push(callback);
        return queue.length;
      },
      cancel() {},
    },
    step(time: number) {
      const pending = queue;
      queue = [];
      pending.forEach((callback) => callback(time));
    },
  };
}

describe('resolveICEOverlayPosition', () => {
  const base = {
    anchor: { left: 100, top: 100, width: 80, height: 30 },
    content: { width: 120, height: 40 },
    container: { width: 800, height: 600 },
  };

  it('bottom：水平居中对齐锚点，纵向留 offset', () => {
    const pos = resolveICEOverlayPosition({ ...base, placement: 'bottom' });
    expect(pos.left).toBe(80); // 100 + 40 - 60
    expect(pos.top).toBe(138); // 130 + 8
    expect(pos.flipped).toBe(false);
  });

  it('bottomLeft / bottomRight：按锚点边对齐', () => {
    const left = resolveICEOverlayPosition({ ...base, placement: 'bottomLeft' });
    const right = resolveICEOverlayPosition({ ...base, placement: 'bottomRight' });
    expect(left.left).toBe(100);
    expect(right.left).toBe(60); // 180 - 120
  });

  it('right：纵向居中对齐，横向留 offset', () => {
    const pos = resolveICEOverlayPosition({ ...base, placement: 'right' });
    expect(pos.left).toBe(188); // 180 + 8
    expect(pos.top).toBe(95); // 115 - 20
  });

  it('rightTop / rightBottom：按锚点边对齐', () => {
    expect(resolveICEOverlayPosition({ ...base, placement: 'rightTop' }).top).toBe(100);
    expect(resolveICEOverlayPosition({ ...base, placement: 'rightBottom' }).top).toBe(90); // 130 - 40
  });

  it('空间不足时翻转到对侧', () => {
    const pos = resolveICEOverlayPosition({
      anchor: { left: 100, top: 560, width: 80, height: 30 },
      content: { width: 120, height: 40 },
      container: { width: 800, height: 600 },
      placement: 'bottom',
    });
    expect(pos.flipped).toBe(true);
    expect(pos.placement).toBe('top');
    expect(pos.top).toBe(512); // 560 - 8 - 40
  });

  it('flip:false 时不翻转，改为夹进容器', () => {
    const pos = resolveICEOverlayPosition({
      anchor: { left: 100, top: 560, width: 80, height: 30 },
      content: { width: 120, height: 40 },
      container: { width: 800, height: 600 },
      placement: 'bottom',
      flip: false,
    });
    expect(pos.flipped).toBe(false);
    expect(pos.top).toBe(556); // 600 - 4 - 40
  });

  it('贴右边界时只做交叉轴夹取，不竖向翻转', () => {
    // 锚点在右下角、下方空间充足：浮层只是横向放不下，应该左移贴边而不是翻到上方
    const pos = resolveICEOverlayPosition({
      anchor: { left: 1084, top: 1526, width: 220, height: 32 },
      content: { width: 324, height: 102 },
      container: { width: 1400, height: 1960 },
      placement: 'bottomLeft',
    });
    expect(pos.flipped).toBe(false);
    expect(pos.placement).toBe('bottomLeft');
    expect(pos.left).toBe(1072); // 1400 - 4 - 324
    expect(pos.top).toBe(1566); // 1526 + 32 + 默认 offset 8（未被夹取）
  });

  it('夹进容器：锚点贴左边时不会溢出', () => {
    const pos = resolveICEOverlayPosition({
      anchor: { left: 0, top: 100, width: 40, height: 20 },
      content: { width: 120, height: 40 },
      container: { width: 800, height: 600 },
      placement: 'bottomLeft',
    });
    expect(pos.left).toBe(4); // padding
  });

  it('容器带平移时按世界坐标还原（视口平移场景）', () => {
    const pos = resolveICEOverlayPosition({
      anchor: { left: 150, top: 200, width: 40, height: 20 },
      content: { width: 100, height: 40 },
      container: { left: 100, top: 100, width: 400, height: 300 },
      placement: 'bottomLeft',
    });
    // 容器局部锚点 = (50,100) → 左对齐 50、下方 128 → 换回世界坐标 +100/+100
    expect(pos.left).toBe(150);
    expect(pos.top).toBe(228);
  });
});

describe('ICEOverlayManager', () => {
  it('open() 把内容挂到工具层的浮层根节点上，并按锚点定位', () => {
    const ice = makeICE();
    const manager = new ICEOverlayManager(ice);
    const anchor = new ICEWidget({ left: 100, top: 100, width: 80, height: 30 });
    const content = panel(120, 40);

    const handle = manager.open({ anchor, content, placement: 'bottom' });

    expect(ice.toolNodes).toHaveLength(1);
    const layer = manager.getLayer();
    expect(layer.childNodes).toContain(content);
    expect(layer.state.interactive).toBe(false); // 根节点不参与命中
    expect(content.state.left).toBe(80);
    expect(content.state.top).toBe(138);
    expect(handle.isOpen()).toBe(true);
    expect(manager.isOpen()).toBe(true);
  });

  it('锚点在深层容器里时按世界坐标定位', () => {
    const ice = makeICE();
    const manager = new ICEOverlayManager(ice);
    const panelParent = new ICEWidget({ left: 40, top: 60, width: 300, height: 200 });
    const anchor = new ICEWidget({ left: 20, top: 10, width: 60, height: 20 });
    panelParent.addChild(anchor, false);
    const content = panel(100, 30);

    manager.open({ anchor, content, placement: 'bottomLeft' });
    // 锚点世界盒 = (60,70)；bottomLeft → left 60 / top 70+20+8
    expect(content.state.left).toBe(60);
    expect(content.state.top).toBe(98);
  });

  it('点击浮层或锚点之外关闭，点在两者之内不关闭', () => {
    const ice = makeICE();
    const manager = new ICEOverlayManager(ice);
    const anchor = new ICEWidget({ left: 100, top: 100, width: 80, height: 30 });
    const content = panel(120, 40);
    const handle = manager.open({ anchor, content, placement: 'bottom' });

    ice.evtBus.trigger('mousedown', { offsetX: 110, offsetY: 110 }); // 锚点内
    expect(handle.isOpen()).toBe(true);

    ice.evtBus.trigger('mousedown', { offsetX: 120, offsetY: 150 }); // 浮层内（80..200 / 138..178）
    expect(handle.isOpen()).toBe(true);

    ice.evtBus.trigger('mousedown', { offsetX: 700, offsetY: 500 }); // 外面
    expect(handle.isOpen()).toBe(false);
    expect(manager.isOpen()).toBe(false);
  });

  it('Esc 关闭浮层', () => {
    const ice = makeICE();
    const manager = new ICEOverlayManager(ice);
    const handle = manager.open({
      anchor: new ICEWidget({ left: 0, top: 0, width: 10, height: 10 }),
      content: panel(50, 20),
    });
    ice.evtBus.trigger('keydown', { key: 'Escape' });
    expect(handle.isOpen()).toBe(false);
  });

  it('closeOnOutsideClick / closeOnEsc 可关闭默认行为', () => {
    const ice = makeICE();
    const manager = new ICEOverlayManager(ice);
    const handle = manager.open({
      anchor: new ICEWidget({ left: 0, top: 0, width: 10, height: 10 }),
      content: panel(50, 20),
      closeOnOutsideClick: false,
      closeOnEsc: false,
    });
    ice.evtBus.trigger('keydown', { key: 'Escape' });
    ice.evtBus.trigger('mousedown', { offsetX: 700, offsetY: 500 });
    expect(handle.isOpen()).toBe(true);
  });

  it('默认 exclusive：打开新浮层会关掉旧的', () => {
    const ice = makeICE();
    const manager = new ICEOverlayManager(ice);
    const anchor = new ICEWidget({ left: 10, top: 10, width: 20, height: 20 });
    const first = manager.open({ anchor, content: panel(50, 20) });
    const second = manager.open({ anchor, content: panel(60, 24) });
    expect(first.isOpen()).toBe(false);
    expect(second.isOpen()).toBe(true);
    expect(manager.getLayer().childNodes).toHaveLength(1);
  });

  it('keyboardCaptured：声明接管键盘的浮层会被 isKeyboardCaptured 反映', () => {
    const ice = makeICE();
    const manager = new ICEOverlayManager(ice);
    const anchor = new ICEWidget({ left: 0, top: 0, width: 20, height: 20 });
    expect(manager.isKeyboardCaptured()).toBe(false);
    const handle = manager.open({ anchor, content: panel(80, 40), keyboardCaptured: true });
    expect(manager.isKeyboardCaptured()).toBe(true);
    handle.close();
    expect(manager.isKeyboardCaptured()).toBe(false);
  });

  it('阻断型浮层（模态遮罩）不会被后来打开的非阻断浮层关掉', () => {
    const ice = makeICE();
    const manager = new ICEOverlayManager(ice);
    const anchor = new ICEWidget({ left: 10, top: 10, width: 20, height: 20 });

    const modal = manager.open({ centered: true, blocking: true, content: panel(200, 100) });
    const popup = manager.open({ anchor, content: panel(60, 24) });

    expect(modal.isOpen()).toBe(true); // 模态仍在
    expect(popup.isOpen()).toBe(true);
    expect(manager.getLayer().childNodes).toHaveLength(2);

    // 再开一个模态 → 清场
    const secondModal = manager.open({ centered: true, blocking: true, content: panel(200, 100) });
    expect(popup.isOpen()).toBe(false);
    expect(modal.isOpen()).toBe(false);
    expect(secondModal.isOpen()).toBe(true);
  });

  it('onClose 回调带上关闭原因；stop() 清理工具层与事件绑定', () => {
    const ice = makeICE();
    const manager = new ICEOverlayManager(ice);
    const reasons: string[] = [];
    manager.open({
      anchor: new ICEWidget({ left: 0, top: 0, width: 10, height: 10 }),
      content: panel(50, 20),
      onClose: (reason) => reasons.push(reason),
    });
    ice.evtBus.trigger('keydown', { key: 'Escape' });
    expect(reasons).toEqual(['esc']);

    manager.open({
      anchor: new ICEWidget({ left: 0, top: 0, width: 10, height: 10 }),
      content: panel(50, 20),
      onClose: (reason) => reasons.push(reason),
    });
    manager.stop();
    expect(reasons).toEqual(['esc', 'api']);
    expect(ice.toolNodes).toHaveLength(0);
    ice.evtBus.trigger('keydown', { key: 'Escape' }); // 已解绑，不应再出错
    expect(manager.isOpen()).toBe(false);
  });

  it('入场动效：enterAnimation=scale 先透明缩小，默认不动效', () => {
    const ice = makeICE();
    const manager = new ICEOverlayManager(ice);
    const anchor = new ICEWidget({ left: 0, top: 0, width: 10, height: 10 });
    const content = panel(50, 20);
    manager.open({ anchor, content, enterAnimation: 'scale' });
    expect(content.state.opacity).toBe(0);
    expect(content.state.transform.scale[0]).toBeLessThan(1);

    const plainContent = panel(50, 20);
    manager.open({ anchor, content: plainContent });
    expect(plainContent.state.opacity).toBe(1);
  });

  it('出场动效：exitAnimation=fade 时淡出结束才移除（isOpen 立即为 false）', () => {
    const ice = makeICE();
    const manager = new ICEOverlayManager(ice);
    const { driver, step } = makeFrameDriver();
    const anchor = new ICEWidget({ left: 0, top: 0, width: 10, height: 10 });
    const content = panel(50, 20);
    const handle = manager.open({ anchor, content, exitAnimation: 'fade', animation: { duration: 100, driver } });

    handle.close();
    expect(handle.isOpen()).toBe(false);
    expect(manager.getLayer().childNodes.indexOf(content) >= 0).toBe(true); // 正在淡出

    step(0);
    step(100);
    expect(manager.getLayer().childNodes.indexOf(content) >= 0).toBe(false);
  });
});
