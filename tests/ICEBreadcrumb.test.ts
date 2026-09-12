/**
 * ICEBreadcrumb 规格：
 * - 水平排布「标签 + 分隔符」，宽度按内容自适应（中文按 1em 估算，不能压出色块外）；
 * - 最后一项 = 当前页：弱化为正文色、不响应点击；
 * - 点击可点的项触发 `navigate` 事件 + `onNavigate` 回调（带 item 与 index）；
 * - `maxItems`：超长时中间折叠成「…」，点击省略号展开。
 */
import { ICEBreadcrumb } from '../src/components/ICEBreadcrumb';
import { iceUIManager } from '../src/core/ICEManager';
import { estimateTextWidth } from '../src/util/ICEStyle';

const theme = iceUIManager.getTheme();

describe('ICEBreadcrumb', () => {
  it('渲染标签与分隔符，宽度不小于文字总宽（中文不压出色块）', () => {
    const crumb = new ICEBreadcrumb({
      items: [{ label: '首页' }, { label: '订单管理' }, { label: '订单详情' }],
    });
    expect(crumb.getLabelTexts()).toEqual(['首页', '订单管理', '订单详情']);
    expect(crumb.getSeparatorNodes()).toHaveLength(2);
    const textWidth = ['首页', '订单管理', '订单详情'].reduce(
      (sum, text) => sum + estimateTextWidth(text, theme.font.size),
      0,
    );
    expect(crumb.state.width).toBeGreaterThanOrEqual(textWidth);
  });

  it('最后一项是当前页：颜色与其它项不同，点击不触发 navigate', () => {
    const crumb = new ICEBreadcrumb({ items: [{ label: '首页' }, { label: '详情' }] });
    const events: any[] = [];
    crumb.on('navigate', (evt: any) => events.push(evt.param));
    const [first, last] = crumb.getItemNodes();
    // 文字颜色落在内层 ICEText 上（ICELabel 只是包装）
    const colorOf = (node: any) => node.getLabel().childNodes[0].state.style.fillStyle;
    expect(colorOf(first)).not.toBe(colorOf(last));
    last.trigger('click', null, {});
    expect(events).toHaveLength(0);
    first.trigger('click', null, {});
    expect(events).toHaveLength(1);
  });

  it('点击中间项：事件载荷带 item 与 index，并调用 onNavigate 回调', () => {
    const clicked: Array<{ label: string; index: number }> = [];
    const crumb = new ICEBreadcrumb({
      items: [{ label: '首页' }, { label: '订单' }, { label: '详情' }],
      onNavigate: (item: any, index: number) => clicked.push({ label: item.label, index }),
    });
    const events: any[] = [];
    crumb.on('navigate', (evt: any) => events.push(evt.param));
    crumb.getItemNodes()[1].trigger('click', null, {});
    expect(events).toEqual([{ item: { label: '订单' }, index: 1 }]);
    expect(clicked).toEqual([{ label: '订单', index: 1 }]);
  });

  it('禁用项不响应点击', () => {
    const crumb = new ICEBreadcrumb({
      items: [{ label: '首页' }, { label: '禁用页', disabled: true }, { label: '详情' }],
    });
    const events: any[] = [];
    crumb.on('navigate', (evt: any) => events.push(evt.param));
    crumb.getItemNodes()[1].trigger('click', null, {});
    expect(events).toHaveLength(0);
  });

  it('maxItems：折叠中间项为省略号，点击省略号展开', () => {
    const crumb = new ICEBreadcrumb({
      items: [
        { label: '首页' },
        { label: '订单' },
        { label: '发货' },
        { label: '物流' },
        { label: '详情' },
      ],
      maxItems: 3,
    });
    expect(crumb.isCollapsed()).toBe(true);
    expect(crumb.getLabelTexts()).toEqual(['首页', '…', '物流', '详情']);
    crumb.getItemNodes()[1].trigger('click', null, {});
    expect(crumb.isCollapsed()).toBe(false);
    expect(crumb.getLabelTexts()).toEqual(['首页', '订单', '发货', '物流', '详情']);
  });

  it('setItems 重新渲染并回到未折叠状态', () => {
    const crumb = new ICEBreadcrumb({ items: [{ label: 'A' }, { label: 'B' }] });
    crumb.setItems([{ label: '概览' }, { label: '报表' }, { label: '明细' }]);
    expect(crumb.getLabelTexts()).toEqual(['概览', '报表', '明细']);
    expect(crumb.getSeparatorNodes()).toHaveLength(2);
  });
});
