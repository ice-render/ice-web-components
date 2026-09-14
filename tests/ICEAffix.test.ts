/**
 * ICEAffix（吸顶）单测。
 *
 * 画布里没有 `position: sticky`，但语义可以照搬：
 * - 组件待在原来的位置（**占位高度不变**，布局不会因为吸顶而跳动）；
 * - 当它随内容滚到「视口顶 + offsetTop」以上时，把它**贴回去**（改自己的 top 补偿滚动量），
 *   同时抬到更高 zIndex —— 否则会被下面的内容盖住；
 * - 滚回原位时恢复本来位置与 zIndex；
 * - 贴着**最近的祖先滚动视口**做（不是整页），所以要能从父链上找到 ICEScrollPane。
 *
 * 注意语义：吸顶期间它会盖住后面的内容（和 CSS sticky 一样），这是特性不是 bug。
 */
import { ICEAffix } from '../src/components/ICEAffix';
import { ICEScrollPane } from '../src/components/ICEScrollPane';
import { ICEWidget } from '../src/core/ICEWidget';

/** 世界纵坐标：父链上的 top 累加（含滚动视口 contentBox 的负偏移）。 */
function screenTop(node: any): number {
  let top = 0;
  let current = node;
  while (current && current.state) {
    top += Number(current.state.top) || 0;
    current = current.parentNode;
  }
  return top;
}

/** 引擎的 afterAddHandler 需要场景替身（读 ice.ctx / ice.evtBus）。 */
function attach(affix: ICEAffix) {
  (affix as any).ice = { ctx: null, dirty: false, evtBus: { on() {}, off() {} } };
  (affix as any).afterAddHandler();
}

function setup(props: any = {}) {
  const pane = new ICEScrollPane({ width: 300, height: 200, left: 20, top: 10 });
  const content = new ICEWidget({ width: 300, height: 900 });
  pane.setContent(content);
  pane.setContentSize(300, 900);
  const affix = new ICEAffix({ left: 0, top: 240, width: 300, height: 40, ...props });
  affix.addChild(new ICEWidget({ width: 300, height: 40 }), false);
  content.addChild(affix, false);
  attach(affix);
  return { pane, content, affix };
}

describe('ICEAffix', () => {
  it('没滚动到位置时不吸顶：位置与 zIndex 都不动', () => {
    const { affix } = setup();
    affix.update();
    expect(affix.isPinned()).toBe(false);
    expect(affix.getBaseTop()).toBe(240);
    expect(screenTop(affix)).toBe(250); // pane.top(10) + contentBox.top(0) + 240
    expect(affix.state.zIndex).toBe(affix.getBaseZIndex());
  });

  it('滚过阈值就吸顶：贴在「视口顶 + offsetTop」上，并抬到最上层', () => {
    const { pane, affix } = setup();
    pane.setScroll(0, 300); // 240 的位置被滚到视口顶之上
    expect(affix.isPinned()).toBe(true);
    expect(screenTop(affix)).toBe(10); // = pane 的世界顶 + offsetTop(0)
    expect(affix.state.zIndex).toBeGreaterThan(affix.getBaseZIndex());
  });

  it('继续滚动时一直贴在视口顶（补偿量不累积漂移）', () => {
    const { pane, affix } = setup();
    pane.setScroll(0, 300);
    expect(screenTop(affix)).toBe(10);
    pane.setScroll(0, 500);
    expect(screenTop(affix)).toBe(10);
    expect(affix.isPinned()).toBe(true);
  });

  it('滚回原位就松手：位置与 zIndex 复原', () => {
    const { pane, affix } = setup();
    pane.setScroll(0, 300);
    expect(affix.isPinned()).toBe(true);
    pane.setScroll(0, 0);
    expect(affix.isPinned()).toBe(false);
    expect(screenTop(affix)).toBe(250);
    expect(affix.state.zIndex).toBe(affix.getBaseZIndex());
  });

  it('offsetTop 决定吸顶时距视口顶多远（顶部有固定头时用）', () => {
    const { pane, affix } = setup({ offsetTop: 56 });
    pane.setScroll(0, 400);
    expect(screenTop(affix)).toBe(10 + 56);
  });

  it('父容器重排（基准位置变了）之后按新基准算', () => {
    const { pane, affix } = setup();
    affix.setState({ top: 100 });
    affix.update();
    expect(affix.getBaseTop()).toBe(100);
    pane.setScroll(0, 200);
    expect(screenTop(affix)).toBe(10);
    pane.setScroll(0, 0);
    expect(screenTop(affix)).toBe(110);
  });

  it('onPinChange 只在状态翻转时触发', () => {
    const seen: boolean[] = [];
    const { pane } = setup({ onPinChange: (pinned: boolean) => seen.push(pinned) });
    pane.setScroll(0, 300);
    pane.setScroll(0, 400);
    pane.setScroll(0, 0);
    expect(seen).toEqual([true, false]);
  });

  it('不在滚动容器里也能用：不吸顶、不报错', () => {
    const host = new ICEWidget({ width: 200, height: 400 });
    const affix = new ICEAffix({ left: 0, top: 80, width: 200, height: 30 });
    host.addChild(affix, false);
    attach(affix);
    expect(affix.getScrollTarget()).toBe(null);
    affix.update();
    expect(affix.isPinned()).toBe(false);
    expect(affix.state.top).toBe(80);
  });

  it('scrollTarget 可以显式指定（自动找不到祖先视口时）', () => {
    const pane = new ICEScrollPane({ width: 300, height: 200 });
    pane.setContentSize(300, 900);
    const host = new ICEWidget({ width: 300, height: 900 });
    pane.setContent(host);
    const affix = new ICEAffix({ left: 0, top: 240, width: 300, height: 40, scrollTarget: pane });
    host.addChild(affix, false);
    attach(affix);
    expect(affix.getScrollTarget()).toBe(pane);
    pane.setScroll(0, 300);
    expect(affix.isPinned()).toBe(true);
  });
});
