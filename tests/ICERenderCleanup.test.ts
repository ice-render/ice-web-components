/**
 * 「重排前先清空」回归。
 *
 * 背景：`ICEDescriptions.__render()` / `ICETimeline.__render()` 原来只 `addChild` 不清理，
 * 于是每次重排（setItems、宽度变化触发的 __afterStateMerge）都会把新内容**叠在旧内容上** ——
 * 表现为文字重影/重复（XP 桌面「我的电脑 · 系统信息」两列布局糊成一团就是这么来的）。
 */
import { ICEDescriptions } from '../src/components/ICEDescriptions';
import { ICETimeline } from '../src/components/ICETimeline';

describe('重排前先清空', () => {
  it('ICEDescriptions：重复 setItems 不会叠加格子', () => {
    const list = new ICEDescriptions({
      width: 300,
      column: 2,
      items: [
        { label: 'A', value: '1' },
        { label: 'B', value: '2' },
      ],
    });
    expect(list.getRowNodes()).toHaveLength(2);
    expect(list.childNodes).toHaveLength(2);
    list.setItems([
      { label: 'A', value: '1' },
      { label: 'B', value: '2' },
    ]);
    expect(list.getRowNodes()).toHaveLength(2);
    expect(list.childNodes).toHaveLength(2);
  });

  it('ICEDescriptions：改宽度重排后子节点数量不变（不会留下旧几何）', () => {
    const list = new ICEDescriptions({
      width: 600,
      column: 2,
      items: [
        { label: 'A', value: '1' },
        { label: 'B', value: '2' },
        { label: 'C', value: '3' },
      ],
    });
    const before = list.childNodes.length;
    list.setState({ width: 300 });
    expect(list.childNodes).toHaveLength(before);
    // 第二列 = 列宽 + 12（左侧内边距）
    expect(list.getRowNodes()[1].state.left).toBe(Math.round(300 / 2) + 12);
  });

  it('ICETimeline：重复 setItems 不会叠加行', () => {
    const timeline = new ICETimeline({
      width: 300,
      items: [
        { title: 'a', time: '1' },
        { title: 'b', time: '2' },
      ],
    });
    const before = timeline.childNodes.length;
    timeline.setItems([
      { title: 'a', time: '1' },
      { title: 'b', time: '2' },
    ]);
    expect(timeline.childNodes).toHaveLength(before);
  });
});
