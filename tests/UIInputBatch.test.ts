/**
 * 录入类批次：UIInputNumber / UIAutoComplete。
 *
 * UIInputNumber 规格：
 * - [-]/[+] 步进，按 min/max 夹取；step 与 precision 可配；disabled 忽略；
 * - 键盘 ↑/↓ 步进、直接输入数字（含小数点与负号）、Backspace 删除；
 * - 表单取值约定 getFormValue/setFormValue + 错误态。
 *
 * UIAutoComplete 规格：
 * - 输入即过滤（按 label/value 包含匹配），下拉展示候选；点击候选写入输入框并回调 onSelect；
 * - 键盘 ↑/↓ 移动高亮、Enter 选中、Esc 关闭；清空输入后下拉收起；
 * - 表单集成与错误态同 UITextField。
 */
import { UIAutoComplete } from '../src/components/UIAutoComplete';
import { UIInputNumber } from '../src/components/UIInputNumber';

describe('UIInputNumber', () => {
  it('步进加减 + 夹取 + precision', () => {
    const changes: number[] = [];
    const input = new UIInputNumber({ width: 140, value: 5, min: 0, max: 10, step: 2, onChange: (v) => changes.push(v) });
    expect(input.getValue()).toBe(5);

    input.getIncreaseButton()!.trigger('click', null, {});
    expect(input.getValue()).toBe(7);
    input.getIncreaseButton()!.trigger('click', null, {});
    input.getIncreaseButton()!.trigger('click', null, {});
    expect(input.getValue()).toBe(10); // 夹到 max
    input.getDecreaseButton()!.trigger('click', null, {});
    input.getDecreaseButton()!.trigger('click', null, {});
    input.getDecreaseButton()!.trigger('click', null, {});
    input.getDecreaseButton()!.trigger('click', null, {});
    input.getDecreaseButton()!.trigger('click', null, {});
    input.getDecreaseButton()!.trigger('click', null, {});
    expect(input.getValue()).toBe(0); // 夹到 min
    expect(changes.length).toBeGreaterThan(0);
  });

  it('precision：步进结果按精度取整', () => {
    const input = new UIInputNumber({ width: 140, value: 1, step: 0.1, precision: 1 });
    input.getIncreaseButton()!.trigger('click', null, {});
    expect(input.getValue()).toBe(1.1);
  });

  it('键盘 ↑/↓ 步进，直接输入数字与小数点', () => {
    const input = new UIInputNumber({ width: 140, value: 1, step: 1, max: 100 });
    (input as any).ice = { evtBus: { on() {}, off() {}, trigger() {} }, dirty: false };
    input.setFocused(true);
    const press = (key: string) => (input as any).__onKeyDown({ key });
    press('ArrowUp');
    expect(input.getValue()).toBe(2);
    press('ArrowDown');
    press('ArrowDown');
    expect(input.getValue()).toBe(0);

    input.setValue(0);
    press('3');
    expect(input.getValue()).toBe(3);
    press('Backspace');
    expect(input.getValue()).toBe(0);
  });

  it('disabled 不响应；表单取值约定', () => {
    const input = new UIInputNumber({ width: 140, value: 5, disabled: true });
    input.getIncreaseButton()!.trigger('click', null, {});
    expect(input.getValue()).toBe(5);
    expect(input.isFocusable()).toBe(false);

    input.setEnabled(true);
    input.setFormValue(9);
    expect(input.getFormValue()).toBe(9);
    expect(input.getText()).toBe('9');
  });
});

describe('UIAutoComplete', () => {
  const options = ['杭州', '上海', '深圳', '北京'];

  it('输入过滤候选并展示下拉', () => {
    const { autocomplete } = setup();
    autocomplete.setValue('杭');
    expect(autocomplete.getVisibleOptions()).toEqual(['杭州']);
    expect(autocomplete.isOpen()).toBe(true);

    autocomplete.setValue('深');
    expect(autocomplete.getVisibleOptions()).toEqual(['深圳']);

    autocomplete.setValue('');
    expect(autocomplete.getVisibleOptions()).toEqual(options);
  });

  it('点击候选写入输入框并回调 onSelect', () => {
    const { autocomplete, selected } = setup();
    autocomplete.setValue('上');
    autocomplete.getOptionNode('上海')!.trigger('click', null, {}); // 候选行自身处理点击
    expect(autocomplete.getValue()).toBe('上海');
    expect(selected).toEqual(['上海']);
    expect(autocomplete.isOpen()).toBe(false);
  });

  it('键盘 ↑/↓ 移动高亮、Enter 选中、Esc 关闭', () => {
    const { autocomplete, ice, selected } = setup();
    autocomplete.setValue(''); // 全部候选
    (autocomplete as any).__onKeyDown({ key: 'ArrowDown' });
    expect(autocomplete.getActiveIndex()).toBe(1);
    (autocomplete as any).__onKeyDown({ key: 'ArrowUp' });
    expect(autocomplete.getActiveIndex()).toBe(0);
    (autocomplete as any).__onKeyDown({ key: 'Enter' });
    expect(selected).toEqual(['杭州']);
    expect(autocomplete.getValue()).toBe('杭州');

    autocomplete.setValue('北');
    (autocomplete as any).__onKeyDown({ key: 'Escape' });
    expect(autocomplete.isOpen()).toBe(false);
    expect(autocomplete.getValue()).toBe('北');
    void ice;
  });

  it('表单集成：getFormValue/setFormValue 与错误态', () => {
    const { autocomplete } = setup();
    autocomplete.setFormValue('北京');
    expect(autocomplete.getFormValue()).toBe('北京');
    expect(autocomplete.getFieldText()).toBe('北京');
    autocomplete.setValidateStatus('error');
    expect(autocomplete.getValidateStatus()).toBe('error');
  });
});

function setup() {
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
  const selected: string[] = [];
  const autocomplete = new UIAutoComplete({
    left: 0,
    top: 0,
    width: 200,
    options: ['杭州', '上海', '深圳', '北京'],
    onSelect: (value: string) => selected.push(value),
  });
  (autocomplete as any).ice = ice;
  (autocomplete as any).afterAddHandler();
  return { ice, autocomplete, selected };
}
