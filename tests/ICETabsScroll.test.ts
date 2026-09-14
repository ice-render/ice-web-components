/**
 * ICETabs 的溢出滚动：页签多到装不下时要能翻到（以前只能被挤扁或溢出）。
 *
 * 规格：
 * - 装得下：老行为（等宽铺满、没有箭头）；
 * - 装不下：页签按自然宽度排、超出部分被裁剪，两端出现 ‹ › 箭头；
 * - `scrollBy` 被夹在 [0, 最大偏移]；`scrollIntoView(index)` 把某一页滚进可视区；
 * - 点箭头翻页；点被裁掉的页签仍然能切换并且自己滚进视野。
 */
import { ICETabs } from '../src/components/ICETabs';

const manyTabs = Array.from({ length: 10 }, (_, index) => '页签 ' + (index + 1));

describe('ICETabs 溢出滚动', () => {
  it('装得下时没有箭头，仍是等宽铺满（老行为）', () => {
    const tabs = new ICETabs({ tabs: ['全部', '待处理', '已完成'], width: 360, height: 32 });
    expect(tabs.isOverflow()).toBe(false);
    expect(tabs.getPrevButton()).toBe(null);
    expect(tabs.getNextButton()).toBe(null);
    const widths = tabs.getTabBoxes().map((box) => box.width);
    expect(new Set(widths.map((w) => Math.round(w))).size).toBe(1);
    expect(Math.round(widths[0] * 3)).toBeGreaterThanOrEqual(340);
  });

  it('装不下时出现箭头，页签按自然宽度排并被裁剪', () => {
    const tabs = new ICETabs({ tabs: manyTabs, width: 300, height: 32 });
    expect(tabs.isOverflow()).toBe(true);
    expect(tabs.getPrevButton()).toBeTruthy();
    expect(tabs.getNextButton()).toBeTruthy();
    expect(tabs.getMaxScroll()).toBeGreaterThan(0);
    expect(tabs.getTabBoxes()[0].left).toBe(0);
  });

  it('scrollBy 夹在 [0, maxScroll]，页签跟着移动', () => {
    const tabs = new ICETabs({ tabs: manyTabs, width: 300, height: 32 });
    tabs.scrollBy(60);
    expect(tabs.getScrollOffset()).toBe(60);
    // 盒子跟着滚：比不滚时整体左移 60
    expect(tabs.getTabBoxes()[2].left).toBe(2 * (96 + 8) - 60);
    tabs.scrollBy(100000);
    expect(tabs.getScrollOffset()).toBe(tabs.getMaxScroll());
    tabs.scrollBy(-100000);
    expect(tabs.getScrollOffset()).toBe(0);
  });

  it('scrollIntoView 把目标页签滚进可视区', () => {
    const tabs = new ICETabs({ tabs: manyTabs, width: 300, height: 32 });
    tabs.scrollIntoView(9);
    const box = tabs.getTabBoxes()[9];
    expect(box.left + box.width).toBeLessThanOrEqual(tabs.getViewportWidth());
    expect(tabs.getScrollOffset()).toBeGreaterThan(0);
    tabs.scrollIntoView(0);
    expect(tabs.getScrollOffset()).toBe(0);
  });

  it('点箭头翻页；点被裁掉的页签仍能切换并滚进视野', () => {
    const changed: number[] = [];
    const tabs = new ICETabs({ tabs: manyTabs, width: 300, height: 32, onChange: (index: number) => changed.push(index) });
    tabs.getNextButton()!.trigger('click', null, {});
    expect(tabs.getScrollOffset()).toBeGreaterThan(0);
    tabs.setActiveIndex(9);
    expect(tabs.getActiveIndex()).toBe(9);
    tabs.scrollIntoView(9);
    expect(tabs.getScrollOffset()).toBe(tabs.getMaxScroll());
    expect(changed).toEqual([]); // 程序式切换不触发 onChange（老约定不变）
  });
});
