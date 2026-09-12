/**
 * 组件补全批次：Badge 红点 / Alert 可关闭 / Avatar 头像组。
 */
import { UIBadge } from '../src/components/UIBadge';
import { UIAlert } from '../src/components/UIAlert';
import { UIAvatarGroup } from '../src/components/UIAvatarGroup';

describe('UIBadge 红点', () => {
  it('dot 模式：小圆点、没有文字节点、尺寸可配', () => {
    const dot = new UIBadge({ dot: true });
    expect(dot.isDot()).toBe(true);
    expect(dot.state.width).toBe(dot.state.height);
    expect(dot.childNodes.length).toBe(0);

    const big = new UIBadge({ dot: true, dotSize: 12 });
    expect(big.state.width).toBe(12);
    expect(big.state.height).toBe(12);
  });

  it('非 dot 模式仍是带文字的胶囊', () => {
    const badge = new UIBadge({ text: '5', width: 32, height: 24 });
    expect(badge.isDot()).toBe(false);
    expect(badge.childNodes.length).toBeGreaterThan(0);
  });
});

describe('UIAlert 可关闭', () => {
  it('默认不可关闭；closable 时渲染关闭按钮', () => {
    const plain = new UIAlert({ title: 't', message: 'm' });
    expect(plain.isClosable()).toBe(false);
    expect(plain.getCloseButton()).toBeNull();
    expect(plain.isClosed()).toBe(false);

    const closable = new UIAlert({ title: 't', message: 'm', closable: true });
    expect(closable.isClosable()).toBe(true);
    expect(closable.getCloseButton()).not.toBeNull();
  });

  it('点关闭按钮：隐藏自己并回调 onClose（只回调一次）', () => {
    let closed = 0;
    const alert = new UIAlert({ title: 't', message: 'm', closable: true, onClose: () => (closed += 1) });
    alert.getCloseButton()!.trigger('click', null, {});
    expect(alert.isClosed()).toBe(true);
    expect(alert.state.display).toBe(false);
    expect(closed).toBe(1);

    alert.getCloseButton()!.trigger('click', null, {});
    expect(closed).toBe(1);
  });

  it('非 closable 也能用 close() 编程式关闭', () => {
    const alert = new UIAlert({ title: 't' });
    alert.close();
    expect(alert.isClosed()).toBe(true);
  });
});

describe('UIAvatarGroup 头像组', () => {
  const avatars = [
    { text: 'A' },
    { text: 'B' },
    { text: 'C' },
    { text: 'D' },
    { text: 'E' },
  ];

  it('超出 max 时折叠成 +N，并算出可见数量', () => {
    const group = new UIAvatarGroup({ avatars, size: 32, max: 3 });
    expect(group.getCount()).toBe(5);
    expect(group.getVisibleCount()).toBe(3);
    expect(group.getRestCount()).toBe(2);
    expect(group.getAvatarNodes().length).toBe(3);
    expect(group.getRestNode()).not.toBeNull();
    expect(group.getRestNode()!.state.width).toBe(32);

    const all = new UIAvatarGroup({ avatars: avatars.slice(0, 2), size: 32, max: 3 });
    expect(all.getRestNode()).toBeNull();
    expect(all.getVisibleCount()).toBe(2);
    expect(all.getRestCount()).toBe(0);
  });

  it('重叠排布：相邻头像左移 overlap', () => {
    const group = new UIAvatarGroup({ avatars, size: 32, max: 4, overlap: 8 });
    expect(group.getAvatarNodes()[0].state.left).toBe(0);
    expect(group.getAvatarNodes()[1].state.left).toBe(24);
    expect(group.getRestNode()!.state.left).toBe(96);
    expect(group.state.width).toBe(96 + 32);
  });

  it('setAvatars 重建；空列表不崩', () => {
    const group = new UIAvatarGroup({ avatars, size: 32, max: 3 });
    group.setAvatars([{ text: 'X' }]);
    expect(group.getCount()).toBe(1);
    expect(group.getRestNode()).toBeNull();
    group.setAvatars([]);
    expect(group.getAvatarNodes().length).toBe(0);
    expect(group.state.width).toBe(0);
  });
});
