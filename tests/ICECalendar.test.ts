/**
 * ICECalendar 规格（业界组件库 Calendar 最小版）：
 * - 月视图：标题「YYYY 年 M 月」、星期表头、6×7 日期格；
 * - 相邻月份补齐的格子用弱色标出（inMonth=false），点击仍然可选；
 * - 选中日期高亮、今天带标记（today 可注入，测试确定性）；
 * - 上/下月切换并回调 onChangeMonth；点击日期触发 select 事件 + onSelect；
 * - 键盘：方向键按天/周移动选中，PageUp/PageDown 切月。
 */
import { ICECalendar, buildMonthGrid, formatCalendarDate } from '../src/components/ICECalendar';
import { iceUIManager } from '../src/core/ICEManager';

const theme = iceUIManager.getTheme();

describe('buildMonthGrid', () => {
  it('周一开头，补齐前后月份，共 42 格', () => {
    const cells = buildMonthGrid('2026-09');
    expect(cells).toHaveLength(42);
    // 2026-09-01 是周二 → 网格从 2026-08-31（周一）开始
    expect(cells[0].date).toBe('2026-08-31');
    expect(cells[0].inMonth).toBe(false);
    expect(cells[1].date).toBe('2026-09-01');
    expect(cells[1].inMonth).toBe(true);
  });

  it('格式化补零', () => {
    expect(formatCalendarDate(new Date(2026, 8, 5))).toBe('2026-09-05');
  });
});

describe('ICECalendar', () => {
  it('渲染标题 / 星期表头 / 42 个日期格', () => {
    const cal = new ICECalendar({ width: 280, month: '2026-09', today: '2026-09-12' });
    expect(cal.getTitleText()).toBe('2026 年 9 月');
    expect(cal.getWeekdayTexts()).toEqual(['一', '二', '三', '四', '五', '六', '日']);
    expect(cal.getCellNodes()).toHaveLength(42);
  });

  it('相邻月份的格子颜色弱化', () => {
    const cal = new ICECalendar({ width: 280, month: '2026-09' });
    expect(cal.getCellTextColor('2026-08-31')).toBe(theme.colors.textDisabled);
    expect(cal.getCellTextColor('2026-09-01')).toBe(theme.colors.text);
  });

  it('点击日期：选中高亮 + select 事件 + onSelect 回调', () => {
    const picked: string[] = [];
    const cal = new ICECalendar({
      width: 280,
      month: '2026-09',
      onSelect: (date: string) => picked.push(date),
    });
    const events: string[] = [];
    cal.on('select', (evt: any) => events.push(evt.param.date));
    cal.getCellNode('2026-09-15')!.trigger('click', null, {});
    expect(cal.getValue()).toBe('2026-09-15');
    expect(picked).toEqual(['2026-09-15']);
    expect(events).toEqual(['2026-09-15']);
    expect(cal.getCellBackground('2026-09-15')).toBe(theme.colors.primary);
    expect(cal.getCellTextColor('2026-09-15')).toBe(theme.colors.primaryText);
  });

  it('今天带标记（外圈），且不覆盖选中态', () => {
    const cal = new ICECalendar({ width: 280, month: '2026-09', today: '2026-09-12', value: '2026-09-12' });
    expect(cal.isToday('2026-09-12')).toBe(true);
    expect(cal.isToday('2026-09-13')).toBe(false);
    expect(cal.getCellBackground('2026-09-12')).toBe(theme.colors.primary);
  });

  it('上/下月切换：标题、网格、onChangeMonth 一起变', () => {
    const months: string[] = [];
    const cal = new ICECalendar({ width: 280, month: '2026-12', onChangeMonth: (month: string) => months.push(month) });
    cal.nextMonth();
    expect(cal.getVisibleMonth()).toBe('2027-01');
    expect(cal.getTitleText()).toBe('2027 年 1 月');
    cal.prevMonth();
    cal.prevMonth();
    expect(cal.getVisibleMonth()).toBe('2026-11');
    expect(months).toEqual(['2027-01', '2026-12', '2026-11']);
  });

  it('键盘：方向键按天/周移动选中，PageUp/PageDown 切月', () => {
    const handlers: Record<string, Array<{ handler: any; ctx: any }>> = {};
    const ice: any = {
      dirty: false,
      evtBus: {
        on(name: string, handler: any, ctx: any) {
          (handlers[name] = handlers[name] || []).push({ handler, ctx });
        },
        off(name: string, handler: any) {
          handlers[name] = (handlers[name] || []).filter((entry) => entry.handler !== handler);
        },
        trigger(name: string, evt: any) {
          (handlers[name] || []).forEach((entry) => entry.handler.call(entry.ctx, evt));
        },
      },
    };
    const cal = new ICECalendar({ width: 280, month: '2026-09', value: '2026-09-10' });
    (cal as any).ice = ice;
    (cal as any).afterAddHandler();
    cal.setFocused(true);
    ice.evtBus.trigger('keydown', { key: 'ArrowRight' });
    expect(cal.getValue()).toBe('2026-09-11');
    ice.evtBus.trigger('keydown', { key: 'ArrowDown' });
    expect(cal.getValue()).toBe('2026-09-18');
    ice.evtBus.trigger('keydown', { key: 'PageDown' });
    expect(cal.getVisibleMonth()).toBe('2026-10');
    expect(cal.getValue()).toBe('2026-10-18');
  });
});
