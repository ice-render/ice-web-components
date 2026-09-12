/**
 * 回归：ICEScrollPane 在滚动位置真的变化时派发 `scroll` 事件（载荷 `{ x, y }`）。
 *
 * 背景：滚动位置变了但没人知道，`ICEBackTop`（回到顶部）与 `ICEAnchor`（锚点高亮）
 * 这类「跟着滚动走」的组件只能靠轮询。这里把事件补成底座能力。
 */
import { ICEScrollPane } from '../src/components/ICEScrollPane';
import { ICEWidget } from '../src/core/ICEWidget';

function makePane() {
  const pane = new ICEScrollPane({ width: 200, height: 100 });
  pane.setContent(new ICEWidget({ width: 200, height: 600 }));
  pane.setContentSize(200, 600);
  return pane;
}

describe('ICEScrollPane scroll 事件', () => {
  it('位置变化才派发，载荷是当前滚动位置', () => {
    const pane = makePane();
    const events: Array<{ x: number; y: number }> = [];
    pane.on('scroll', (evt: any) => events.push(evt.param));
    pane.setScroll(0, 120);
    expect(events).toEqual([{ x: 0, y: 120 }]);
    pane.setScroll(0, 120); // 没变 → 不再派发
    expect(events).toHaveLength(1);
    pane.scrollBy(0, 30);
    expect(events).toEqual([
      { x: 0, y: 120 },
      { x: 0, y: 150 },
    ]);
  });

  it('夹取到滚动范围后，越界的重复滚动不再派发', () => {
    const pane = makePane();
    const events: any[] = [];
    pane.on('scroll', (evt: any) => events.push(evt.param));
    pane.setScroll(0, 100000); // 夹到 maxY = 500
    expect(pane.getScroll()).toEqual([0, 500]);
    pane.setScroll(0, 999999);
    expect(events).toHaveLength(1);
  });
});
