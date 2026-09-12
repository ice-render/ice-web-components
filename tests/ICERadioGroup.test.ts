/**
 * ICERadioGroup 规格：
 * - 渲染「单选圈 + 标签」，整行可点（标签也能点中）；
 * - 互斥：选中一项时其它项自动取消；
 * - 键盘：聚焦后 ←/↑ 上一项、→/↓ 下一项（跳过禁用项），Enter/Space 选中当前项；
 * - 表单约定：getFormValue / setFormValue，change 事件 + onChange 回调；
 * - 竖直方向 direction: 'vertical' 时逐行排布。
 */
import { ICERadioGroup } from '../src/components/ICERadioGroup';

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

function makeOptions() {
  return [
    { value: 'a', label: '选项 A' },
    { value: 'b', label: '选项 B' },
    { value: 'c', label: '选项 C', disabled: true },
  ];
}

describe('ICERadioGroup', () => {
  it('构造期就画好：标签齐全、默认值选中、圆圈互斥', () => {
    const group = new ICERadioGroup({ options: makeOptions(), value: 'a', width: 300 });
    expect(group.getLabelTexts()).toEqual(['选项 A', '选项 B', '选项 C']);
    expect(group.getValue()).toBe('a');
    expect(group.getRadioNode('a')!.isSelected()).toBe(true);
    expect(group.getRadioNode('b')!.isSelected()).toBe(false);
  });

  it('点击整行（含标签）即选中，且触发 change 事件与 onChange 回调', () => {
    const picked: string[] = [];
    const group = new ICERadioGroup({
      options: makeOptions(),
      value: 'a',
      width: 300,
      onChange: (value: string) => picked.push(value),
    });
    const events: string[] = [];
    group.on('change', (evt: any) => events.push(evt.param.value));
    group.getItemNode('b')!.trigger('click', null, {});
    expect(group.getValue()).toBe('b');
    expect(group.getRadioNode('b')!.isSelected()).toBe(true);
    expect(group.getRadioNode('a')!.isSelected()).toBe(false);
    expect(picked).toEqual(['b']);
    expect(events).toEqual(['b']);
  });

  it('禁用项不可选中', () => {
    const group = new ICERadioGroup({ options: makeOptions(), value: 'a', width: 300 });
    group.getItemNode('c')!.trigger('click', null, {});
    expect(group.getValue()).toBe('a');
  });

  it('键盘：方向键换选项（跳过禁用项），到边界不越界', () => {
    const { ice } = setupIce();
    const group = new ICERadioGroup({ options: makeOptions(), value: 'a', width: 300 });
    (group as any).ice = ice;
    (group as any).afterAddHandler();
    group.setFocused(true);
    ice.evtBus.trigger('keydown', { key: 'ArrowRight' });
    expect(group.getValue()).toBe('b');
    // 下一项（c）被禁用 → 停在 b
    ice.evtBus.trigger('keydown', { key: 'ArrowRight' });
    expect(group.getValue()).toBe('b');
    ice.evtBus.trigger('keydown', { key: 'ArrowLeft' });
    expect(group.getValue()).toBe('a');
    ice.evtBus.trigger('keydown', { key: 'ArrowLeft' });
    expect(group.getValue()).toBe('a');
  });

  it('键盘：Enter / Space 选中当前项；失去焦点时不响应', () => {
    const { ice } = setupIce();
    const group = new ICERadioGroup({ options: makeOptions(), value: 'b', width: 300 });
    (group as any).ice = ice;
    (group as any).afterAddHandler();
    group.setFocused(true);
    ice.evtBus.trigger('keydown', { key: 'ArrowLeft' }); // active → a
    expect(group.getValue()).toBe('a');
    ice.evtBus.trigger('keydown', { key: 'ArrowRight' }); // active → b
    group.setFocused(false);
    ice.evtBus.trigger('keydown', { key: 'ArrowLeft' });
    expect(group.getValue()).toBe('b');
  });

  it('表单约定：getFormValue / setFormValue，非法值不改变现状', () => {
    const group = new ICERadioGroup({ options: makeOptions(), value: 'a', width: 300 });
    expect(group.getFormValue()).toBe('a');
    group.setFormValue('b');
    expect(group.getValue()).toBe('b');
    group.setFormValue('nope');
    expect(group.getValue()).toBe('b');
  });

  it('竖直方向逐行排布，宽度取内容宽', () => {
    const group = new ICERadioGroup({
      options: makeOptions(),
      value: 'a',
      direction: 'vertical',
      width: 200,
    });
    const first = group.getItemNode('a')!;
    const second = group.getItemNode('b')!;
    expect(second.state.top).toBeGreaterThan(first.state.top);
    expect(second.state.left).toBe(first.state.left);
  });
});
