/**
 * ICEScrollPane 的横向滚动条与平滑滚动。
 *
 * 规格：
 * - 内容比视口宽 → 底部出现横向滚动条（比例正确）；不宽就不出现；
 * - 拖横向滑块能滚（与竖向滑块同一套换算）；
 * - `smoothScrollTo(x, y, { duration })` 平滑到位；`duration: 0` 或「减少动效」时立即到位。
 */
import { ICEScrollPane } from '../src/components/ICEScrollPane';
import { ICEWidget } from '../src/core/ICEWidget';
import { setICEReducedMotion } from '../src/util/ICEAnimation';

function setup(props: any = {}) {
  const pane = new ICEScrollPane({ left: 0, top: 0, width: 200, height: 100, ...props });
  pane.setContent(new ICEWidget({ width: 200, height: 400 }));
  pane.setContentSize(400, 400);
  return pane;
}

describe('ICEScrollPane 横向', () => {
  it('内容比视口宽：横向滚动条出现，比例正确', () => {
    const pane = setup();
    expect(pane.isHorizontalScrollbarVisible()).toBe(true);
    const thumb = pane.getHorizontalThumb()!;
    expect(Number(thumb.state.width) / pane.getHorizontalTrackWidth()).toBeCloseTo(0.5, 2);
  });

  it('内容不超出时没有横向滚动条', () => {
    const pane = new ICEScrollPane({ width: 200, height: 100 });
    pane.setContent(new ICEWidget({ width: 100, height: 50 }));
    pane.setContentSize(100, 50);
    expect(pane.isHorizontalScrollbarVisible()).toBe(false);
  });

  it('拖横向滑块：按比例换算成滚动位置', () => {
    const pane = setup();
    const before = pane.getScroll()[0];
    (pane as any).__onHorizontalThumbDrag(0.5);
    expect(pane.getScroll()[0]).toBeGreaterThan(before);
    expect(pane.getScroll()[0]).toBeLessThanOrEqual(pane.getScrollRange()[0]);
  });

  it('smoothScrollTo：duration 0 立即到位', () => {
    const pane = setup();
    pane.smoothScrollTo(120, 80, { duration: 0 });
    expect(pane.getScroll()).toEqual([120, 80]);
  });

  it('减少动效时平滑滚动也立即到位', () => {
    setICEReducedMotion(true);
    try {
      const pane = setup();
      pane.smoothScrollTo(200, 100, { duration: 300 });
      expect(pane.getScroll()).toEqual([200, 100]);
    } finally {
      setICEReducedMotion('auto');
    }
  });

  it('平滑滚动会夹在可滚动范围里', () => {
    const pane = setup();
    pane.smoothScrollTo(99999, 99999, { duration: 0 });
    expect(pane.getScroll()).toEqual(pane.getScrollRange());
  });
});
