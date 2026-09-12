/**
 * ICEBackTop 规格（业界组件库 BackTop）：
 * - 绑定滚动容器，滚动超过 `visibilityHeight` 才出现（用不透明度过渡）；
 * - 点击（或键盘 Enter/Space）回到顶部：目标滚动到 (0,0)，并回调 onClick；
 * - 不可见时点击无效；
 * - hover 变色。
 */
import { ICEBackTop } from '../src/components/ICEBackTop';
import { ICEScrollPane } from '../src/components/ICEScrollPane';
import { ICEWidget } from '../src/core/ICEWidget';
import { iceUIManager } from '../src/core/ICEManager';

const theme = iceUIManager.getTheme();

function makePane() {
  const pane = new ICEScrollPane({ width: 200, height: 100 });
  pane.setContent(new ICEWidget({ width: 200, height: 600 }));
  pane.setContentSize(200, 600);
  return pane;
}

describe('ICEBackTop', () => {
  it('初始隐藏；滚动超过阈值后出现', () => {
    const pane = makePane();
    const backTop = new ICEBackTop({ target: pane, visibilityHeight: 200 });
    expect(backTop.isVisible()).toBe(false);
    expect(backTop.state.opacity).toBe(0);
    pane.setScroll(0, 120);
    expect(backTop.isVisible()).toBe(false);
    pane.setScroll(0, 260);
    expect(backTop.isVisible()).toBe(true);
    expect(backTop.state.opacity).toBe(1);
  });

  it('点击回到顶部并回调；回到顶部后自己隐藏', () => {
    const pane = makePane();
    let clicks = 0;
    const backTop = new ICEBackTop({
      target: pane,
      visibilityHeight: 100,
      onClick: () => (clicks += 1),
    });
    pane.setScroll(0, 300);
    expect(backTop.isVisible()).toBe(true);
    backTop.trigger('click', null, {});
    expect(pane.getScroll()).toEqual([0, 0]);
    expect(clicks).toBe(1);
    expect(backTop.isVisible()).toBe(false);
  });

  it('不可见时不响应点击；键盘 activate 同样回顶', () => {
    const pane = makePane();
    const backTop = new ICEBackTop({ target: pane, visibilityHeight: 100 });
    backTop.trigger('click', null, {});
    expect(pane.getScroll()).toEqual([0, 0]);
    pane.setScroll(0, 300);
    backTop.activate();
    expect(pane.getScroll()).toEqual([0, 0]);
  });

  it('悬停变色', () => {
    const pane = makePane();
    const backTop = new ICEBackTop({ target: pane });
    const rest = backTop.getButtonColor();
    backTop.setHovered(true);
    expect(backTop.getButtonColor()).not.toBe(rest);
    expect(backTop.getButtonColor()).toBe(theme.colors.primaryHover);
  });
});
