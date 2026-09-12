/**
 * UITimePicker 单测（时间列浮层）。
 *
 * 规格：
 * - 字段显示所选时间（HH:mm:ss / HH:mm），未选显示 placeholder；点击字段开/关浮层；
 * - 浮层是「时/分/秒」三列（format 为 HH:mm 时只有两列），列内可滚动；
 * - 列取值受 step 控制（hourStep / minuteStep / secondStep）；
 * - 点某个取值 → 只改该单位 → 回写值 + 标签、关闭并回调 onChange；
 * - 禁用时不可打开、不可聚焦；表单取值约定 + 错误态边框。
 */
import { UITimePicker } from '../src/components/UITimePicker';

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
  const picker = new UITimePicker({
    left: 0,
    top: 0,
    width: 200,
    placeholder: '请选择时间',
    value: '09:30:00',
    onChange: (value: string) => changes.push(value),
    ...props,
  });
  (picker as any).ice = ice;
  (picker as any).afterAddHandler();
  return { ice, picker, changes };
}

describe('UITimePicker', () => {
  it('列取值与步进：时 24 项、分 60 项，step 生效', () => {
    const { picker } = setup();
    expect(picker.getUnits()).toEqual(['hour', 'minute', 'second']);
    const hours = picker.getColumnValues('hour');
    expect(hours.length).toBe(24);
    expect(hours[0]).toBe('00');
    expect(hours[23]).toBe('23');
    expect(picker.getColumnValues('minute').length).toBe(60);

    const stepped = setup({ minuteStep: 15, hourStep: 6 }).picker;
    expect(stepped.getColumnValues('minute')).toEqual(['00', '15', '30', '45']);
    expect(stepped.getColumnValues('hour')).toEqual(['00', '06', '12', '18']);
  });

  it('format=HH:mm 时只有两列（无秒）', () => {
    const { picker } = setup({ format: 'HH:mm', value: '09:30' });
    expect(picker.getUnits()).toEqual(['hour', 'minute']);
    expect(picker.getFieldLabel()).toBe('09:30');
  });

  it('字段显示与 placeholder；点击字段开关浮层', () => {
    const { picker } = setup();
    expect(picker.getFieldLabel()).toBe('09:30:00');
    expect(picker.isOpen()).toBe(false);

    picker.trigger('click', null, {});
    expect(picker.isOpen()).toBe(true);
    expect(picker.getPanel()).not.toBeNull();
    expect(picker.getColumnNode('hour')).not.toBeNull();
    expect(picker.getOptionNode('hour', '09')).not.toBeNull();
    expect(picker.getOptionNode('minute', '30')).not.toBeNull();

    picker.trigger('click', null, {});
    expect(picker.isOpen()).toBe(false);

    const empty = setup({ value: undefined }).picker;
    expect(empty.getFieldLabel()).toBe('请选择时间');
    expect(empty.getValue()).toBeUndefined();
  });

  it('点某个取值：只改该单位 + 回写标签 + 关闭 + onChange', () => {
    const { picker, changes } = setup();
    picker.open();
    picker.getOptionNode('hour', '14')!.trigger('click', null, {});
    expect(picker.getValue()).toBe('14:30:00');
    expect(picker.getFieldLabel()).toBe('14:30:00');
    expect(picker.isOpen()).toBe(false);
    expect(changes).toEqual(['14:30:00']);

    picker.open();
    picker.getOptionNode('second', '45')!.trigger('click', null, {});
    expect(picker.getValue()).toBe('14:30:45');
    expect(changes).toEqual(['14:30:00', '14:30:45']);
  });

  it('未选值时点列：其余单位补 00', () => {
    const { picker } = setup({ value: undefined });
    picker.open();
    picker.getOptionNode('minute', '05')!.trigger('click', null, {});
    expect(picker.getValue()).toBe('00:05:00');
  });

  it('disabled 不可打开、不可聚焦；表单取值与错误态', () => {
    const { picker } = setup({ disabled: true });
    expect(picker.isFocusable()).toBe(false);
    picker.open();
    expect(picker.isOpen()).toBe(false);

    const form = setup().picker;
    expect(form.getFormValue()).toBe('09:30:00');
    form.setFormValue('23:05:10');
    expect(form.getValue()).toBe('23:05:10');
    form.setValidateStatus('error');
    expect(form.getValidateStatus()).toBe('error');
    expect(form.isFocusable()).toBe(true);
  });
});
