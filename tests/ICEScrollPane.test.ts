/**
 * ICEScrollPane 单测。
 *
 * 关键契约：
 * - 自身开启引擎的 `clipChildren`（内容超出部分被裁掉，且滚出去的子组件不可命中）；
 * - 内容组件挂在 `(-scrollX, -scrollY)`，滚动量按「内容尺寸 - 视口尺寸」夹取；
 * - 滚轮只在指针位于本视口内、且内容确实超出时才滚动；
 * - 内容不超出时纵向滚动条不显示（auto 语义）。
 */
import { ICEScrollPane } from '../src/components/ICEScrollPane';
import { ICELabel } from '../src/components/ICELabel';
import { ICEWidget } from '../src/core/ICEWidget';

function makeICE() {
  const handlers: Record<string, Array<{ handler: any; ctx: any }>> = {};
  const ice: any = {
    canvasWidth: 800,
    canvasHeight: 600,
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
    screenToWorld: (x: number, y: number) => [x, y],
  };
  return ice;
}

/** 造一个「5 行 × 20px = 100px 高」的内容，放进 60px 高的视口。 */
function makeRows(height = 100) {
  const content = new ICEWidget({ left: 0, top: 0, width: 200, height });
  for (let i = 0; i < height / 20; i++) {
    content.addChild(new ICELabel({ left: 0, top: i * 20, text: 'row ' + i }), false);
  }
  return content;
}

function attach(pane: ICEScrollPane, ice: any) {
  ice.childNodes = [pane];
  // 真实流程里组件入场景后 ICE 会注入 ice/ctx；这里手工注入 ice 即可
  (pane as any).ice = ice;
  (pane as any).afterAddHandler(); // protected 钩子：模拟引擎在挂载时调用
  return pane;
}

describe('ICEScrollPane', () => {
  it('开启子树裁剪，并保留自身作为可交互视口', () => {
    const pane = new ICEScrollPane({ left: 0, top: 0, width: 200, height: 60 });
    expect(pane.state.clipChildren).toBe(true);
    expect(pane.state.interactive).toBe(true);
  });

  it('setContent 后内容尺寸驱动可滚动范围，滚动量被夹取', () => {
    const pane = new ICEScrollPane({ width: 200, height: 60 });
    const content = makeRows(100);
    pane.setContent(content);
    expect(pane.getContent()).toBe(content);
    expect(pane.getContentSize()).toEqual([200, 100]);

    pane.setScroll(0, 30);
    expect(pane.getScroll()).toEqual([0, 30]);
    // 偏移作用在内容盒上（内容组件自身坐标不变，内部布局不受影响）
    expect(content.parentNode.state.left).toBe(0);
    expect(content.parentNode.state.top).toBe(-30);

    pane.setScroll(0, 999); // 超出上界 → 夹到 100 - 60 = 40
    expect(pane.getScroll()).toEqual([0, 40]);
    pane.setScroll(0, -50); // 下界 0
    expect(pane.getScroll()).toEqual([0, 0]);
  });

  it('内容不超出视口时不可滚动', () => {
    const pane = new ICEScrollPane({ width: 200, height: 60 });
    pane.setContent(makeRows(40));
    pane.setScroll(0, 20);
    expect(pane.getScroll()).toEqual([0, 0]);
    expect(pane.getScrollRange()).toEqual([0, 0]);
  });

  it('滚轮：指针在视口内且内容超出时滚动，视口外不响应', () => {
    const ice = makeICE();
    const pane = new ICEScrollPane({ left: 100, top: 100, width: 200, height: 60 });
    attach(pane, ice);
    pane.setContent(makeRows(100));

    ice.evtBus.trigger('wheel', { offsetX: 150, offsetY: 150, deltaY: 30 });
    expect(pane.getScroll()[1]).toBe(30);

    ice.evtBus.trigger('wheel', { offsetX: 500, offsetY: 500, deltaY: 30 }); // 视口外
    expect(pane.getScroll()[1]).toBe(30);

    ice.evtBus.trigger('wheel', { offsetX: 150, offsetY: 150, deltaY: -100 });
    expect(pane.getScroll()[1]).toBe(0);
  });

  it('滚轮事件用 originalEvent 里的 deltaY（DOM 事件属性不在 ICEEvent 自身上）', () => {
    const ice = makeICE();
    const pane = new ICEScrollPane({ left: 0, top: 0, width: 200, height: 60 });
    attach(pane, ice);
    pane.setContent(makeRows(100));
    ice.evtBus.trigger('wheel', { offsetX: 10, offsetY: 10, originalEvent: { deltaY: 25 } });
    expect(pane.getScroll()[1]).toBe(25);
  });

  it('scrollBy / scrollTo 用同一套夹取逻辑，兼容轴可选（横向默认不滚）', () => {
    const pane = new ICEScrollPane({ width: 200, height: 60 });
    pane.setContent(makeRows(100));
    pane.scrollBy(0, 15);
    expect(pane.getScroll()[1]).toBe(15);
    pane.scrollBy(50, 0); // 内容宽度 200 = 视口宽度 200 → 横向不可滚
    expect(pane.getScroll()[0]).toBe(0);
  });

  it('滚动条只在内容超出时显示，尺寸按比例', () => {
    const pane = new ICEScrollPane({ width: 200, height: 60 });
    pane.setContent(makeRows(40));
    expect(pane.isScrollbarVisible()).toBe(false);

    pane.setContent(makeRows(240));
    expect(pane.isScrollbarVisible()).toBe(true);
    // 轨道高 = 视口 60 - 上下留白 8 = 52；视口/内容 = 60/240 = 1/4 → 滑块 = 52 * 0.25 = 13
    expect(Math.round(pane.getScrollbarThumb().state.height)).toBe(13);
    pane.setScroll(0, 90); // 滚到一半（(240-60)/2）
    expect(Math.round(pane.getScrollbarThumb().state.top)).toBeGreaterThan(0);
  });

  it('内容比视口早创建时，内容子树被抬到视口之上（引擎按全局 zIndex 排序渲染）', () => {
    // 先造内容、后造视口 —— 常见的组装顺序，不处理的话视口背景会盖住内容
    const content = makeRows(100);
    const pane = new ICEScrollPane({ width: 200, height: 60 });
    pane.setContent(content);

    const paneZ = Number(pane.state.zIndex) || 0;
    expect(Number(content.state.zIndex)).toBeGreaterThan(paneZ);
    expect(Number(content.childNodes[0].state.zIndex)).toBe(Number(content.state.zIndex));
    expect(Number(pane.getScrollbarThumb().state.zIndex || pane.getScrollbarThumb().parentNode.state.zIndex)).toBeGreaterThan(paneZ);
  });
});
