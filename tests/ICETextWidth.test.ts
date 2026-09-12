/**
 * 文本宽度估算 + 气泡/下拉面板宽度回归。
 *
 * 背景：画布文本没有裁剪，tooltip / dropdown 面板宽度算窄了，中文标签会直接压出色块外面
 * （此前 tooltip 用 `length * fontSize * 0.62` 估算，中文被低估约 40%）。
 */
import { estimateTextWidth } from '../src/util/ICEStyle';
import { tooltipPanelWidth, ICE_TOOLTIP_FONT_SIZE, ICE_TOOLTIP_PADDING_X } from '../src/components/ICETooltip';

describe('estimateTextWidth', () => {
  it('中文按 1em、拉丁按 0.6em 估算', () => {
    expect(estimateTextWidth('中文四个', 12)).toBe(48);
    expect(estimateTextWidth('abcd', 10)).toBe(24);
    expect(estimateTextWidth('', 12)).toBe(0);
  });

  it('混排按各自权重累加', () => {
    // 「订单 #12」= 2 个中文(12*2) + 空格(7.2) + '#'(7.2) + '12'(14.4) → 向上取整
    expect(estimateTextWidth('订单 #12', 12)).toBe(Math.ceil(24 + 7.2 + 7.2 + 14.4));
  });
});

describe('tooltip / dropdown 面板宽度', () => {
  it('中文标题按每字 1em 计宽（此前被低估约 40%，文字会压出色块）', () => {
    const title = '收起 / 展开侧边栏';
    const width = tooltipPanelWidth(title);
    const cjkCount = (title.match(/[\u2e80-\u9fff]/g) || []).length;
    expect(width).toBeGreaterThanOrEqual(cjkCount * ICE_TOOLTIP_FONT_SIZE + ICE_TOOLTIP_PADDING_X * 2);
    expect(width).toBeLessThan(240);
  });

  it('极短文案也有最小宽度', () => {
    expect(tooltipPanelWidth('')).toBe(32);
  });
});
