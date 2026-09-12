/**
 * 组件补全批次 2：Card extra 插槽 / Alert 图标 / Badge 计数封顶。
 */
import { ICECard } from '../src/components/ICECard';
import { ICEAlert } from '../src/components/ICEAlert';
import { ICEBadge } from '../src/components/ICEBadge';
import { ICELabel } from '../src/components/ICELabel';

describe('ICECard extra 插槽', () => {
  it('工厂形式：节点创建在卡片之后（zIndex 高于卡片），右对齐到内边距', () => {
    const card = new ICECard({
      title: 'T',
      width: 300,
      height: 160,
      extra: () => new ICELabel({ text: 'more', width: 40, height: 16 }),
    });
    const extra = card.getExtraNode();
    expect(extra).not.toBeNull();
    expect(Number(extra!.state.zIndex)).toBeGreaterThan(Number(card.state.zIndex));
    expect(Number(extra!.state.left)).toBe(300 - 16 - 40);
  });

  it('传现成节点时也会被抬到卡片之上（避免被卡片底色盖住）', () => {
    const node = new ICELabel({ text: 'x', width: 30, height: 14 });
    const card = new ICECard({ title: 'T', width: 200, height: 100, extra: node });
    expect(card.getExtraNode()).toBe(node);
    expect(Number(node.state.zIndex)).toBeGreaterThan(Number(card.state.zIndex));
  });

  it('setExtra 替换；不传则没有 extra', () => {
    const card = new ICECard({ title: 'T', width: 200, height: 100 });
    expect(card.getExtraNode()).toBeNull();
    const node = new ICELabel({ text: 'y', width: 20, height: 14 });
    card.setExtra(node);
    expect(card.getExtraNode()).toBe(node);
    card.setExtra(null);
    expect(card.getExtraNode()).toBeNull();
  });
});

describe('ICEAlert 图标', () => {
  it('默认显示类型图标，文案右移让位', () => {
    const withIcon = new ICEAlert({ title: 't', message: 'm', type: 'success' });
    const icon = withIcon.getIconNode();
    expect(icon).not.toBeNull();
    expect(icon!.getText()).toBe('✓');

    const offset = Number(icon!.state.left) + Number(icon!.state.width);
    expect(Number(withIcon.getTitleNode().state.left)).toBeGreaterThanOrEqual(offset);
  });

  it('showIcon:false 不出图标，文案贴左边距', () => {
    const plain = new ICEAlert({ title: 't', message: 'm', type: 'error', showIcon: false });
    expect(plain.getIconNode()).toBeNull();

    const themed = new ICEAlert({ title: 't', type: 'error' });
    expect(themed.getIconNode()!.getText()).toBe('✕');
  });
});

describe('ICEBadge 计数封顶', () => {
  it('count 转文案，超过 overflowCount 显示 N+', () => {
    expect(new ICEBadge({ count: 5 }).getText()).toBe('5');
    expect(new ICEBadge({ count: 128 }).getText()).toBe('99+');
    expect(new ICEBadge({ count: 128, overflowCount: 999 }).getText()).toBe('128');
    expect(new ICEBadge({ count: 0 }).getText()).toBe('0');
  });

  it('text 仍优先于 count；红点模式没有文字', () => {
    expect(new ICEBadge({ text: 'new', count: 9 }).getText()).toBe('new');
    expect(new ICEBadge({ dot: true, count: 9 }).getText()).toBe('');
  });
});
