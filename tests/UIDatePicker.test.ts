/**
 * UIDatePicker 单测（日历浮层）。
 *
 * 规格：
 * - 字段显示所选日期（可自定义格式），未选显示 placeholder；点击字段开/关浮层；
 * - 日历网格：6 周 × 7 天（周一开头），含上/下月补位，inMonth / isToday / isSelected 标记正确；
 * - 上一月/下一月切换重算网格；点某天 → 回写值 + 标签、关闭并回调 onChange；
 * - Esc 与点外关闭自己管（浮层 closeOnOutsideClick:false）。
 */
import { UIDatePicker } from '../src/components/UIDatePicker';

function setup(props: any = {}) {
  const handlers: Record<string, Array<{ handler: any; ctx: any }>> = {};
  const ice: any = {
    canvasWidth: 800,
    canvasHeight: 600,
    toolNodes: [],
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
    addTool: (tool: any) => ice.toolNodes.push(tool),
    removeTool: (tool: any) => {
      const index = ice.toolNodes.indexOf(tool);
      if (index !== -1) ice.toolNodes.splice(index, 1);
    },
    setFocusedComponent: () => {},
    getFocusedComponent: () => null,
    screenToWorld: (x: number, y: number) => [x, y],
    getRenderViewport: () => ({ scale: 1, tx: 0, ty: 0 }),
  };
  const changes: string[] = [];
  const picker = new UIDatePicker({
    left: 0,
    top: 0,
    width: 200,
    height: 32,
    placeholder: '请选择日期',
    today: '2026-09-12',
    value: '2026-09-12',
    onChange: (value: string) => changes.push(value),
    ...props,
  });
  (picker as any).ice = ice;
  (picker as any).afterAddHandler();
  return { ice, picker, changes };
}

describe('UIDatePicker', () => {
  it('日历网格：周一开头、6×7 = 42 格，含上下月补位与今天/选中标记', () => {
    const { picker } = setup();
    const cells = picker.getDayCells();
    expect(cells.length).toBe(42);
    // 2026-09-01 是周二 → 周一开头时第一格是 2026-08-31
    expect(cells[0].date).toBe('2026-08-31');
    expect(cells[0].inMonth).toBe(false);
    expect(cells[1].date).toBe('2026-09-01');
    expect(cells[1].inMonth).toBe(true);

    const today = cells.find((cell) => cell.date === '2026-09-12')!;
    expect(today.isToday).toBe(true);
    expect(today.isSelected).toBe(true);
    const sep30 = cells.find((cell) => cell.date === '2026-09-30')!;
    expect(sep30.inMonth).toBe(true);
    expect(cells.filter((cell) => cell.inMonth).length).toBe(30);
  });

  it('字段显示所选日期；点击字段开关浮层', () => {
    const { picker } = setup();
    expect(picker.getFieldLabel()).toBe('2026-09-12');
    expect(picker.isOpen()).toBe(false);
    picker.trigger('click', null, {});
    expect(picker.isOpen()).toBe(true);
    expect(picker.getPanel()).toBeTruthy();
    picker.trigger('click', null, {});
    expect(picker.isOpen()).toBe(false);
  });

  it('上一月/下一月切换并重算网格', () => {
    const { picker } = setup();
    picker.open();
    expect(picker.getViewMonth()).toEqual({ year: 2026, month: 9 });
    picker.prevMonth();
    expect(picker.getViewMonth()).toEqual({ year: 2026, month: 8 });
    expect(picker.getDayCells().filter((cell) => cell.inMonth).length).toBe(31);
    picker.nextMonth();
    picker.nextMonth();
    expect(picker.getViewMonth()).toEqual({ year: 2026, month: 10 });
    expect(picker.getDayCells().filter((cell) => cell.inMonth).length).toBe(31);
  });

  it('点某天 → 回写值 + 标签、关闭并回调', () => {
    const { picker, changes } = setup();
    picker.open();
    picker.getDayNode('2026-09-20')!.trigger('click', null, {});
    expect(picker.getValue()).toBe('2026-09-20');
    expect(picker.getFieldLabel()).toBe('2026-09-20');
    expect(picker.isOpen()).toBe(false);
    expect(changes).toEqual(['2026-09-20']);
  });

  it('Esc 与点外关闭；表单取值约定', () => {
    const { ice, picker } = setup();
    picker.open();
    ice.evtBus.trigger('keydown', { key: 'Escape' });
    expect(picker.isOpen()).toBe(false);

    picker.open();
    ice.evtBus.trigger('mousedown', { offsetX: 700, offsetY: 500 });
    expect(picker.isOpen()).toBe(false);

    picker.setFormValue('2026-10-01');
    expect(picker.getFormValue()).toBe('2026-10-01');
    expect(picker.getFieldLabel()).toBe('2026-10-01');
  });

  it('自定义显示格式', () => {
    const { picker } = setup({ value: '2026-09-12', format: (date: string) => date.replace(/-/g, '/') });
    expect(picker.getFieldLabel()).toBe('2026/09/12');
  });
});
