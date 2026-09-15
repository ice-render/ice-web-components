/**
 * 选项组（单选 / 多选）改用引擎 `ICEBoxLayout` 之后的**几何不变量**回归。
 *
 * 这两组组件的选项排布 2026-09-15 从「组件里手写 `left/top`」迁到引擎布局器；
 * 迁移的验收口径就是**坐标与历史手写版逐项一致**（不是"看起来差不多"）：
 * - 横向：左 = 累计（项宽 + itemGap）；行内 = 圈/框 + controlGap + 文字；
 * - 纵向：行距 = itemHeight（历史口径：`itemGap` 不参与纵向 —— 见组件里的注释）。
 *
 * 这两条一旦被改坏，用户看到的不是报错而是"选项叠在一起 / 串行错位"，所以钉在这里。
 */
import { ICERadioGroup } from '../src/components/ICERadioGroup';
import { ICECheckboxGroup } from '../src/components/ICECheckboxGroup';

describe('选项组：布局器摆位与历史坐标一致', () => {
  it('横向单选组：逐项累计（项宽 + itemGap），行内 圈 + controlGap + 文字', () => {
    const group = new ICERadioGroup({ options: [{ value: 'a' }, { value: 'b' }, { value: 'c' }], left: 10, top: 20 });
    const items = group.childNodes as any[];
    const widths = items.map((item) => item.state.width);
    const expectedLefts = [0];
    for (let i = 1; i < items.length; i += 1) {
      expectedLefts.push(expectedLefts[i - 1] + widths[i - 1] + 16); // itemGap 默认 theme.spacing.md
    }
    expect(items.map((item) => item.state.left)).toEqual(expectedLefts);
    items.forEach((item) => {
      expect(item.state.top).toBe(0);
      const [radio, label] = item.childNodes as any[];
      expect(radio.state.left).toBe(0);
      expect(label.state.left).toBe(radio.state.width + 8); // theme.spacing.xs
      expect(label.state.top).toBe(0);
      expect(label.state.height).toBe(item.state.height);
    });
  });

  it('纵向多选组：行距 = itemHeight、左边界 0（itemGap 不参与纵向，历史口径）', () => {
    const group = new ICECheckboxGroup({
      options: [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' },
        { value: 'c', label: 'C' },
      ],
      direction: 'vertical',
    });
    const items = group.childNodes as any[];
    expect(items.map((item) => item.state.left)).toEqual([0, 0, 0]);
    expect(items.map((item) => item.state.top)).toEqual([0, items[0].state.height, items[0].state.height * 2]);
    expect(group.state.height).toBe(items[0].state.height * items.length);
  });

  it('选项组挂在引擎布局器上（不是"看起来用了"）', () => {
    const radio = new ICERadioGroup({ options: [{ value: 'a' }] });
    const checkbox = new ICECheckboxGroup({ options: [{ value: 'a' }] });
    expect(typeof (radio as any).layoutManager.layoutContainer).toBe('function');
    expect(typeof (checkbox as any).layoutManager.layoutContainer).toBe('function');
  });
});
