/**
 * ICETypography 规格（业界组件库 Typography 的核心：标题层级 / 正文 / 链接 / 省略）：
 * - `variant: 'title'` 按 `level` 1..5 递减字号；paragraph / text 用正文字号；
 * - `type` 决定文字色（secondary / success / warning / danger / primary）；
 * - `ellipsis`：单行超宽截断并补 `…`；`rows > 1` 时按宽度折行、末行截断；
 * - `link` 可点击（hover 变主色），触发 `click` 与 `onClick`；
 * - 文本不超宽时**不加**省略号。
 */
import { ICETypography, truncateTextLines } from '../src/components/ICETypography';
import { iceUIManager } from '../src/core/ICEManager';

const theme = iceUIManager.getTheme();

describe('truncateTextLines', () => {
  it('单行超宽：末尾补 …，且内容确实被截短', () => {
    const source = '这是一段很长很长的中文说明文字';
    const lines = truncateTextLines(source, { maxWidth: 60, fontSize: 14, maxLines: 1 });
    expect(lines).toHaveLength(1);
    expect(lines[0].endsWith('…')).toBe(true);
    expect(lines[0].length).toBeLessThan(source.length);
  });

  it('多行折行：最多 maxLines 行，末行截断补 …', () => {
    const lines = truncateTextLines('一二三四五六七八九十一二三四五六七八九十', {
      maxWidth: 42,
      fontSize: 14,
      maxLines: 2,
    });
    expect(lines.length).toBeLessThanOrEqual(2);
    expect(lines[lines.length - 1].endsWith('…')).toBe(true);
  });

  it('放得下就原样返回，不加省略号', () => {
    expect(truncateTextLines('短文本', { maxWidth: 200, fontSize: 14, maxLines: 1 })).toEqual(['短文本']);
  });
});

describe('ICETypography', () => {
  it('标题层级：level 越大字号越小', () => {
    const h1 = new ICETypography({ text: '标题一', variant: 'title', level: 1, width: 300 });
    const h3 = new ICETypography({ text: '标题三', variant: 'title', level: 3, width: 300 });
    const h5 = new ICETypography({ text: '标题五', variant: 'title', level: 5, width: 300 });
    expect(h1.getFontSize()).toBeGreaterThan(h3.getFontSize());
    expect(h3.getFontSize()).toBeGreaterThan(h5.getFontSize());
    expect(h5.getFontSize()).toBeGreaterThanOrEqual(theme.font.size);
  });

  it('type 决定颜色：secondary / danger 各自取主题色', () => {
    const secondary = new ICETypography({ text: '次要', width: 200, type: 'secondary' });
    const danger = new ICETypography({ text: '危险', width: 200, type: 'danger' });
    expect(secondary.getTextColor()).toBe(theme.colors.textSecondary);
    expect(danger.getTextColor()).toBe(theme.colors.error);
  });

  it('超宽自动省略，并给出够用的高度', () => {
    const paragraph = new ICETypography({
      text: '这是一段特别长的段落文字，用来验证省略号与折行逻辑是否正确工作',
      variant: 'paragraph',
      width: 120,
      rows: 2,
    });
    const lines = paragraph.getLines();
    expect(lines.length).toBe(2);
    expect(lines[1].endsWith('…')).toBe(true);
    expect(paragraph.state.height).toBeGreaterThanOrEqual(2 * theme.font.size);
    expect(paragraph.state.width).toBe(120);
  });

  it('setText 后重新折行', () => {
    const text = new ICETypography({ text: '很长很长很长很长的文字内容呀', width: 60, ellipsis: true });
    expect(text.getLines()[0].endsWith('…')).toBe(true);
    text.setText('短');
    expect(text.getLines()).toEqual(['短']);
  });

  it('link：可点击 + 主色 + onClick 回调，且能聚焦', () => {
    const clicked: string[] = [];
    const link = new ICETypography({
      text: '查看详情',
      variant: 'link',
      width: 200,
      onClick: () => clicked.push('clicked'),
    });
    const events: any[] = [];
    link.on('click', (evt: any) => events.push(evt.param));
    expect(link.getTextColor()).toBe(theme.colors.primary);
    expect(link.state.interactive).toBe(true);
    link.trigger('click', null, {});
    expect(clicked).toEqual(['clicked']);
    expect(events).toHaveLength(1);
  });

  it('普通文本不可点击', () => {
    const text = new ICETypography({ text: '普通', width: 100 });
    expect(text.state.interactive).toBe(false);
  });
});
