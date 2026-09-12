/**
 * ICEStatistic 规格：
 * - 数值格式化：精度、千分位、非数字原样透传；
 * - 排版：标题在上、数值在下，前缀 / 后缀与数值同一行；
 * - 倒计时模式：`countdown`（剩余毫秒）→ 「N 天 HH:mm:ss」/「HH:mm:ss」，
 *   归零触发 `finish` 事件与 onFinish 回调（用 tween 驱动，测试里不启动定时器）。
 */
import { ICEStatistic, formatStatisticValue, formatCountdown } from '../src/components/ICEStatistic';

describe('格式化助手', () => {
  it('千分位 + 精度', () => {
    expect(formatStatisticValue(1234567.891, 2, true)).toBe('1,234,567.89');
    expect(formatStatisticValue(1234567.891, 0, true)).toBe('1,234,568');
    expect(formatStatisticValue(1234, 0, false)).toBe('1234');
    expect(formatStatisticValue(0.5, 2, true)).toBe('0.50');
  });

  it('非数字原样返回，负数保留符号', () => {
    expect(formatStatisticValue('暂缺', 2, true)).toBe('暂缺');
    expect(formatStatisticValue(-1234567.5, 1, true)).toBe('-1,234,567.5');
  });

  it('倒计时格式：天 + 时分秒，无天时省略', () => {
    expect(formatCountdown(90061000)).toBe('1 天 01:01:01');
    expect(formatCountdown(3661000)).toBe('01:01:01');
    expect(formatCountdown(0)).toBe('00:00:00');
    expect(formatCountdown(-5)).toBe('00:00:00');
  });
});

describe('ICEStatistic', () => {
  it('渲染标题 / 前缀 / 数值 / 后缀，setValue 更新文案', () => {
    const stat = new ICEStatistic({
      title: '成交额',
      value: 1234567.891,
      precision: 2,
      groupSeparator: true,
      prefix: '¥',
      suffix: '元',
      width: 220,
    });
    expect(stat.getTitleText()).toBe('成交额');
    expect(stat.getValueText()).toBe('¥1,234,567.89元');
    stat.setValue(1234.5);
    expect(stat.getValueText()).toBe('¥1,234.50元');
  });

  it('默认不带千分位，精度为 0 时不显示小数', () => {
    const stat = new ICEStatistic({ title: '订单', value: 1234.6, width: 200 });
    expect(stat.getValueText()).toBe('1235');
  });

  it('倒计时模式：按剩余毫秒显示，setCountdown 更新', () => {
    const stat = new ICEStatistic({ title: '距结束', countdown: 90061000, autoStart: false, width: 220 });
    expect(stat.isCountdown()).toBe(true);
    expect(stat.getRemaining()).toBe(90061000);
    expect(stat.getValueText()).toBe('1 天 01:01:01');
    stat.setCountdown(3661000);
    expect(stat.getValueText()).toBe('01:01:01');
  });

  it('倒计时归零：触发 finish 事件与 onFinish 回调，文案归零', () => {
    let finished = 0;
    const stat = new ICEStatistic({
      title: '距结束',
      countdown: 5000,
      autoStart: false,
      width: 220,
      onFinish: () => (finished += 1),
    });
    const events: any[] = [];
    stat.on('finish', () => events.push(true));
    stat.setCountdown(0);
    expect(stat.getValueText()).toBe('00:00:00');
    expect(finished).toBe(1);
    expect(events).toHaveLength(1);
    expect(stat.isRunning()).toBe(false);
  });

  it('倒计时可以 start / stop，倒计时模式下 setValue 不影响文案来源', () => {
    const stat = new ICEStatistic({ title: '距结束', countdown: 3000, autoStart: false, width: 220 });
    expect(stat.isRunning()).toBe(false);
    stat.start();
    expect(stat.isRunning()).toBe(true);
    stat.stop();
    expect(stat.isRunning()).toBe(false);
  });
});
