/**
 * ICESpace 规格（业界组件库 Space / Flex 的最小版）：
 * - 横向：子项依次排列，间距 `size`，容器高度取最高子项；
 * - 纵向：逐行排列，宽度取最宽子项；
 * - 交叉轴对齐 start / center / end；
 * - `wrap: true` 时超出容器宽度换行；
 * - `addItem` 之后自动重排；不给宽高时按内容自适应。
 */
import { ICEButton } from '../src/components/ICEButton';
import { ICEPanel } from '../src/components/ICEPanel';
import { ICESpace } from '../src/components/ICESpace';

describe('ICESpace', () => {
  it('横向：依次排列 + 间距，高度取最高子项，宽度自适应', () => {
    const space = new ICESpace({ direction: 'horizontal', size: 12, align: 'start' });
    space.addItem(new ICEPanel({ width: 80, height: 40 }));
    space.addItem(new ICEPanel({ width: 60, height: 24 }));
    expect(space.getItems()).toHaveLength(2);
    const [first, second] = space.getItems();
    expect(first.state.left).toBe(0);
    expect(second.state.left).toBe(92);
    expect(space.state.width).toBe(152);
    expect(space.state.height).toBe(40);
  });

  it('横向 center：矮的子项在容器里垂直居中', () => {
    const space = new ICESpace({ direction: 'horizontal', size: 8, align: 'center' });
    space.addItem(new ICEPanel({ width: 40, height: 60 }));
    space.addItem(new ICEPanel({ width: 40, height: 20 }));
    expect(space.getItems()[1].state.top).toBe(20);
  });

  it('纵向：逐行排列，宽度取最宽子项', () => {
    const space = new ICESpace({ direction: 'vertical', size: 10, align: 'end' });
    space.addItem(new ICEPanel({ width: 100, height: 30 }));
    space.addItem(new ICEPanel({ width: 60, height: 20 }));
    const [first, second] = space.getItems();
    expect(second.state.top).toBe(40);
    expect(space.state.width).toBe(100);
    expect(space.state.height).toBe(60);
    // align: end → 窄的那一项靠右
    expect(second.state.left).toBe(40);
    expect(first).toBeTruthy();
  });

  it('wrap: true 时超出给定宽度换行', () => {
    const space = new ICESpace({ direction: 'horizontal', size: 10, wrap: true, width: 130 });
    space.addItem(new ICEPanel({ width: 60, height: 20 }));
    space.addItem(new ICEPanel({ width: 60, height: 20 }));
    space.addItem(new ICEPanel({ width: 60, height: 20 }));
    const [first, second, third] = space.getItems();
    expect(second.state.left).toBe(70);
    expect(third.state.left).toBe(0);
    expect(third.state.top).toBe(30);
    expect(first.state.left).toBe(0);
  });

  it('可以混用真实组件（按钮 + 面板），addItem 后重排', () => {
    const space = new ICESpace({ size: 8, width: 400 });
    const button = new ICEButton({ text: '提交', width: 72, height: 32 });
    space.addItem(button);
    space.addItem(new ICEPanel({ width: 100, height: 32 }));
    expect(button.state.left).toBe(0);
    expect(space.getItems()[1].state.left).toBe(80);
    space.setSize(4);
    expect(space.getItems()[1].state.left).toBe(76);
  });
});
