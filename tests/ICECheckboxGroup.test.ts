/**
 * ICECheckboxGroup 规格：
 * - 渲染「勾选框 + 标签」，整行可点；多选，值为数组且保持选项顺序；
 * - `max`：超过上限的勾选被忽略并触发 `exceed`；
 * - 键盘：方向键移动活动项，Space 切换；
 * - checkAll（受 max 限制）/ clear / getCheckedCount；
 * - 表单约定：getFormValue / setFormValue 兼容单值与空值。
 */
import { ICECheckboxGroup } from '../src/components/ICECheckboxGroup';

function setupIce() {
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
    screenToWorld: (x: number, y: number) => [x, y],
  };
  return { ice };
}

const OPTIONS = [
  { value: 'a', label: '邮件' },
  { value: 'b', label: '短信' },
  { value: 'c', label: '站内信' },
];

describe('ICECheckboxGroup', () => {
  it('构造期就画好：值按选项顺序、勾选态正确', () => {
    const group = new ICECheckboxGroup({ options: OPTIONS, value: ['c', 'a'], width: 300 });
    expect(group.getLabelTexts()).toEqual(['邮件', '短信', '站内信']);
    expect(group.getValue()).toEqual(['a', 'c']);
    expect(group.getCheckedCount()).toBe(2);
    expect(group.getCheckboxNode('a')!.isSelected()).toBe(true);
    expect(group.getCheckboxNode('b')!.isSelected()).toBe(false);
  });

  it('点击整行切换勾选，change 事件 + onChange 回调带数组', () => {
    const picked: string[][] = [];
    const group = new ICECheckboxGroup({
      options: OPTIONS,
      value: ['a'],
      width: 300,
      onChange: (value: string[]) => picked.push(value),
    });
    const events: string[][] = [];
    group.on('change', (evt: any) => events.push(evt.param.value));
    group.getItemNode('b')!.trigger('click', null, {});
    group.getItemNode('a')!.trigger('click', null, {});
    expect(group.getValue()).toEqual(['b']);
    expect(picked).toEqual([['a', 'b'], ['b']]);
    expect(events).toEqual([['a', 'b'], ['b']]);
  });

  it('max 上限：超出的勾选被忽略并触发 exceed', () => {
    const group = new ICECheckboxGroup({ options: OPTIONS, value: [], width: 300, max: 2 });
    const exceeded: any[] = [];
    group.on('exceed', (evt: any) => exceeded.push(evt.param));
    group.getItemNode('a')!.trigger('click', null, {});
    group.getItemNode('b')!.trigger('click', null, {});
    group.getItemNode('c')!.trigger('click', null, {});
    expect(group.getValue()).toEqual(['a', 'b']);
    expect(exceeded).toEqual([{ value: 'c', max: 2 }]);
    // 已在选中的项可以取消（不受 max 影响）
    group.getItemNode('a')!.trigger('click', null, {});
    expect(group.getValue()).toEqual(['b']);
  });

  it('键盘：方向键移动活动项，Space 切换', () => {
    const { ice } = setupIce();
    const group = new ICECheckboxGroup({ options: OPTIONS, value: [], width: 300 });
    (group as any).ice = ice;
    (group as any).afterAddHandler();
    group.setFocused(true);
    ice.evtBus.trigger('keydown', { key: 'ArrowDown' });
    ice.evtBus.trigger('keydown', { key: ' ' });
    expect(group.getValue()).toEqual(['b']);
    ice.evtBus.trigger('keydown', { key: ' ' });
    expect(group.getValue()).toEqual([]);
  });

  it('checkAll 受 max 限制，clear 清空', () => {
    const group = new ICECheckboxGroup({ options: OPTIONS, value: [], width: 300, max: 2 });
    group.checkAll();
    expect(group.getValue()).toEqual(['a', 'b']);
    group.clear();
    expect(group.getValue()).toEqual([]);
    const unlimited = new ICECheckboxGroup({ options: OPTIONS, value: [], width: 300 });
    unlimited.checkAll();
    expect(unlimited.getValue()).toEqual(['a', 'b', 'c']);
  });

  it('表单约定：兼容数组 / 单值 / 空值', () => {
    const group = new ICECheckboxGroup({ options: OPTIONS, value: [], width: 300 });
    group.setFormValue(['c']);
    expect(group.getValue()).toEqual(['c']);
    group.setFormValue('a');
    expect(group.getValue()).toEqual(['a']);
    group.setFormValue(null);
    expect(group.getValue()).toEqual([]);
    expect(group.getFormValue()).toEqual([]);
  });
});
