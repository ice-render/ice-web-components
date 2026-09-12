/**
 * 展示类组件批次单测：UISegmented / UIEmpty / UISkeleton。
 */
import { UIEmpty } from '../src/components/UIEmpty';
import { UISegmented } from '../src/components/UISegmented';
import { UISkeleton } from '../src/components/UISkeleton';

function textsOf(node: any): string[] {
  const out: string[] = [];
  const walk = (current: any) => {
    const text = current.state && current.state.text;
    if (typeof text === 'string' && text && out.indexOf(text) === -1) out.push(text);
    (current.childNodes || []).forEach(walk);
  };
  walk(node);
  return out;
}

describe('UISegmented', () => {
  const options = [
    { value: 'day', label: '日' },
    { value: 'week', label: '周' },
    { value: 'month', label: '月', disabled: true },
  ];

  it('渲染所有选项；点击切换选中并回调', () => {
    const changes: string[] = [];
    const segmented = new UISegmented({ width: 240, options, value: 'day', onChange: (v) => changes.push(v) });
    expect(textsOf(segmented).slice().sort()).toEqual(['周', '日', '月'].sort());

    segmented.getSegmentNode('week')!.trigger('click', null, {});
    expect(segmented.getValue()).toBe('week');
    expect(changes).toEqual(['week']);

    segmented.getSegmentNode('month')!.trigger('click', null, {}); // 禁用项
    expect(segmented.getValue()).toBe('week');
    expect(changes).toEqual(['week']);
  });

  it('setValue 更新选中态（选中项为 primary 实心）', () => {
    const segmented = new UISegmented({ width: 240, options, value: 'day' });
    const dayButton = segmented.getSegmentNode('day')!;
    const weekButton = segmented.getSegmentNode('week')!;
    const fillOf = (node: any) => String(node.state.style.fillStyle);
    const dayFill = fillOf(dayButton);
    segmented.setValue('week');
    expect(segmented.getValue()).toBe('week');
    expect(fillOf(segmented.getSegmentNode('week')!)).not.toBe(fillOf(weekButton)); // 高亮换到了 week
    expect(fillOf(segmented.getSegmentNode('day')!)).toBe(fillOf(weekButton)); // day 恢复未选中样式
    expect(dayFill).not.toBe(fillOf(segmented.getSegmentNode('day')!));
  });
});

describe('UIEmpty', () => {
  it('渲染图标与描述；actionText 时出现按钮并可点击', () => {
    let actionCount = 0;
    const empty = new UIEmpty({
      width: 240,
      height: 140,
      description: '暂无数据',
      actionText: '新建',
      onAction: () => actionCount++,
    });
    const texts = textsOf(empty);
    expect(texts).toContain('暂无数据');
    expect(texts).toContain('新建');
    empty.getActionButton()!.trigger('click', null, {});
    expect(actionCount).toBe(1);
  });

  it('无 actionText 时没有按钮', () => {
    const empty = new UIEmpty({ width: 200, height: 100, description: '空' });
    expect(empty.getActionButton()).toBeNull();
    expect(textsOf(empty).slice().sort()).toEqual(['◌', '空'].sort());
  });
});

describe('UISkeleton', () => {
  it('按 rows 渲染占位行，avatar / title 可配', () => {
    const skeleton = new UISkeleton({ width: 240, rows: 3, avatar: true, title: true });
    expect(skeleton.getPlaceholderCount()).toBe(3 + 1 + 1); // rows + avatar + title
    expect(skeleton.state.height).toBeGreaterThan(60);
  });

  it('setActive 切换呼吸动画状态（不改变占位结构）', () => {
    const skeleton = new UISkeleton({ width: 240, rows: 2 });
    expect(skeleton.isActive()).toBe(false);
    skeleton.setActive(true);
    expect(skeleton.isActive()).toBe(true);
    expect(skeleton.getPlaceholderCount()).toBe(2);
    skeleton.setActive(false);
    expect(skeleton.isActive()).toBe(false);
  });
});
