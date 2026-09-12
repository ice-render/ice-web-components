/**
 * ICEFloatButton 规格（业界组件库 FloatButton 的悬浮操作按钮 + 展开菜单）：
 * - 圆形主按钮，默认收起；点击展开 / 再点收起；
 * - 展开后子按钮沿指定方向（默认向上）依次排开，收起时 `display:false`；
 * - 点子按钮：回调 `onItemClick(key)` + 该子项自己的 onClick，并自动收起；
 * - hover 主按钮变色；`getItemNode(key)` 便于外部定位。
 */
import { ICEFloatButton } from '../src/components/ICEFloatButton';
import { iceUIManager } from '../src/core/ICEManager';

const theme = iceUIManager.getTheme();

describe('ICEFloatButton', () => {
  it('默认收起：子按钮不可见；点击主按钮展开', () => {
    const fab = new ICEFloatButton({
      left: 100,
      top: 200,
      items: [
        { key: 'edit', icon: '✎' },
        { key: 'share', icon: '↗' },
      ],
    });
    expect(fab.isExpanded()).toBe(false);
    expect(fab.getItemNode('edit')!.state.display).toBe(false);
    fab.trigger('click', null, {});
    expect(fab.isExpanded()).toBe(true);
    expect(fab.getItemNode('edit')!.state.display).toBe(true);
  });

  it('展开后子按钮向上依次排开（后一个在更上面）', () => {
    const fab = new ICEFloatButton({
      left: 0,
      top: 0,
      size: 40,
      gap: 8,
      items: [
        { key: 'a', icon: 'A' },
        { key: 'b', icon: 'B' },
        { key: 'c', icon: 'C' },
      ],
    });
    fab.expand();
    const a = fab.getItemNode('a')!;
    const b = fab.getItemNode('b')!;
    const c = fab.getItemNode('c')!;
    expect(a.state.top).toBe(-48);
    expect(b.state.top).toBe(-96);
    expect(c.state.top).toBe(-144);
    expect(a.state.left).toBe(0);
  });

  it('点子按钮：回调 + 自动收起', () => {
    const picked: string[] = [];
    let edited = 0;
    const fab = new ICEFloatButton({
      items: [
        { key: 'edit', icon: '✎', onClick: () => (edited += 1) },
        { key: 'share', icon: '↗' },
      ],
      onItemClick: (key: string) => picked.push(key),
    });
    fab.expand();
    fab.getItemNode('edit')!.trigger('click', null, {});
    expect(picked).toEqual(['edit']);
    expect(edited).toBe(1);
    expect(fab.isExpanded()).toBe(false);
  });

  it('再次点击主按钮收起；hover 变色', () => {
    const fab = new ICEFloatButton({ items: [{ key: 'a', icon: 'A' }] });
    const rest = fab.getButtonColor();
    fab.trigger('click', null, {});
    fab.trigger('click', null, {});
    expect(fab.isExpanded()).toBe(false);
    fab.setHovered(true);
    expect(fab.getButtonColor()).not.toBe(rest);
    expect(fab.getButtonColor()).toBe(theme.colors.primaryHover);
  });

  it('没有子项时点击不展开（避免空菜单）', () => {
    const fab = new ICEFloatButton({});
    fab.trigger('click', null, {});
    expect(fab.isExpanded()).toBe(false);
  });
});
