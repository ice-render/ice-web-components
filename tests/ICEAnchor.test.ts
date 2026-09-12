/**
 * ICEAnchor 规格（业界组件库 Anchor）：
 * - 一组锚点项，点击滚动目标容器到该项的偏移位置，并回调 onChange(key)；
 * - 滚动目标容器时，活动项自动跟随（取最后一个 offset ≤ 当前 scrollY 的项）；
 * - 活动项高亮（主色文字）；
 * - 键盘 ↑/↓ 移动活动项并滚动（可聚焦）。
 */
import { ICEAnchor } from '../src/components/ICEAnchor';
import { ICEScrollPane } from '../src/components/ICEScrollPane';
import { ICEWidget } from '../src/core/ICEWidget';
import { iceUIManager } from '../src/core/ICEManager';

const theme = iceUIManager.getTheme();

function makePane() {
  const pane = new ICEScrollPane({ width: 240, height: 120 });
  pane.setContent(new ICEWidget({ width: 240, height: 800 }));
  pane.setContentSize(240, 800);
  return pane;
}

function makeItems() {
  return [
    { key: 'basic', label: '基本信息', top: 0 },
    { key: 'orders', label: '订单记录', top: 300 },
    { key: 'logs', label: '操作日志', top: 600 },
  ];
}

describe('ICEAnchor', () => {
  it('构造期渲染全部锚点，默认选中第一项', () => {
    const pane = makePane();
    const anchor = new ICEAnchor({ target: pane, items: makeItems(), width: 160 });
    expect(anchor.getLabelTexts()).toEqual(['基本信息', '订单记录', '操作日志']);
    expect(anchor.getActiveKey()).toBe('basic');
  });

  it('点击锚点：滚动到对应偏移 + onChange + 活动项高亮', () => {
    const pane = makePane();
    const picked: string[] = [];
    const anchor = new ICEAnchor({
      target: pane,
      items: makeItems(),
      width: 160,
      onChange: (key: string) => picked.push(key),
    });
    anchor.getItemNode('logs')!.trigger('click', null, {});
    expect(pane.getScroll()[1]).toBe(600);
    expect(anchor.getActiveKey()).toBe('logs');
    expect(picked).toEqual(['logs']);
    expect(anchor.getLabelColor('logs')).toBe(theme.colors.primary);
    expect(anchor.getLabelColor('basic')).toBe(theme.colors.textSecondary);
  });

  it('滚动容器时活动项跟随（取最后一个已越过的锚点）', () => {
    const pane = makePane();
    const anchor = new ICEAnchor({ target: pane, items: makeItems(), width: 160 });
    pane.setScroll(0, 320);
    expect(anchor.getActiveKey()).toBe('orders');
    pane.setScroll(0, 700);
    expect(anchor.getActiveKey()).toBe('logs');
    pane.setScroll(0, 10);
    expect(anchor.getActiveKey()).toBe('basic');
  });

  it('键盘：聚焦后 ↓/↑ 移动并滚动', () => {
    const pane = makePane();
    const handlers: Record<string, Array<{ handler: any; ctx: any }>> = {};
    const ice: any = {
      dirty: false,
      evtBus: {
        on(name: string, handler: any, ctx: any) {
          (handlers[name] = handlers[name] || []).push({ handler, ctx });
        },
        off() {},
        trigger(name: string, evt: any) {
          (handlers[name] || []).forEach((entry) => entry.handler.call(entry.ctx, evt));
        },
      },
    };
    const anchor = new ICEAnchor({ target: pane, items: makeItems(), width: 160 });
    (anchor as any).ice = ice;
    (anchor as any).afterAddHandler();
    anchor.setFocused(true);
    ice.evtBus.trigger('keydown', { key: 'ArrowDown' });
    expect(anchor.getActiveKey()).toBe('orders');
    expect(pane.getScroll()[1]).toBe(300);
    ice.evtBus.trigger('keydown', { key: 'ArrowUp' });
    expect(anchor.getActiveKey()).toBe('basic');
  });

  it('点击够不着的最后一项（目标滚不到底）时，高亮停在点中的锚点', () => {
    const pane = makePane();
    const anchor = new ICEAnchor({
      target: pane,
      width: 160,
      items: [
        { key: 'basic', label: '基本信息', top: 0 },
        { key: 'logs', label: '操作日志', top: 600 },
        // 视口 120 / 内容 800 → 最多滚到 680，这一项滚不到顶部
        { key: 'deep', label: '归档记录', top: 780 },
      ],
    });
    anchor.getItemNode('deep')!.trigger('click', null, {});
    expect(pane.getScroll()[1]).toBe(680); // 被夹取
    expect(anchor.getActiveKey()).toBe('deep'); // 高亮仍然停在被点的那一项
    // 用户自己再滚动，跟随逻辑恢复
    pane.setScroll(0, 0);
    expect(anchor.getActiveKey()).toBe('basic');
  });
});
