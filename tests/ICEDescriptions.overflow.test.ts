/**
 * 描述列表的长值处理（回归）。
 *
 * 背景：画布文本不会自动裁剪 —— 多列布局里「Intel Pentium 4 2.4GHz」这类长值会直接
 * 压到相邻列的标签上（XP 桌面的「我的电脑 · 系统信息」就是这么糊掉的）。
 * 现在标签/值超宽都会截断并补省略号。
 */
import { ICEDescriptions } from '../src/components/ICEDescriptions';
import { estimateTextWidth } from '../src/util/ICEStyle';

const items = [
  { label: '处理器', value: 'Intel Pentium 4 2.4GHz' },
  { label: '内存', value: '512 MB' },
];

describe('ICEDescriptions 长值省略', () => {
  it('值超宽：截断 + 省略号，宽度不超过值列', () => {
    const list = new ICEDescriptions({ width: 300, column: 2, labelWidth: 60, items });
    const row = list.getRowNodes()[0];
    const valueLabel = row.childNodes[1] as any;
    const text = valueLabel.getText();
    expect(text.endsWith('…')).toBe(true);
    expect(estimateTextWidth(text, 13)).toBeLessThanOrEqual(Number(valueLabel.state.width) + 1);
  });

  it('放得下就原样显示，不加省略号', () => {
    const list = new ICEDescriptions({ width: 700, column: 1, labelWidth: 60, items });
    const row = list.getRowNodes()[0];
    expect((row.childNodes[1] as any).getText()).toBe('Intel Pentium 4 2.4GHz');
  });

  it('标签超宽也省略', () => {
    const list = new ICEDescriptions({
      width: 300,
      column: 2,
      labelWidth: 60,
      items: [{ label: '超级超级超级超级长的标签名', value: 'x' }],
    });
    const row = list.getRowNodes()[0];
    expect((row.childNodes[0] as any).getText().endsWith('…')).toBe(true);
  });

  it('宽度变化后重新省略（配合 __afterStateMerge）', () => {
    const list = new ICEDescriptions({ width: 700, column: 1, labelWidth: 60, items });
    expect((list.getRowNodes()[0].childNodes[1] as any).getText()).toBe('Intel Pentium 4 2.4GHz');
    list.setState({ width: 220 });
    const text = (list.getRowNodes()[0].childNodes[1] as any).getText();
    expect(text.endsWith('…')).toBe(true);
  });
});
