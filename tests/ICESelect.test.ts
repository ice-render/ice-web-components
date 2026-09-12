/**
 * ICESelect 单测。
 *
 * 规格：
 * - 单选：点开下拉、点选项后选中并关闭，字段显示标签，onChange(value, option)；
 * - 多选：点选项切换（不关闭），字段显示标签列表，getValue() 返回 value 数组；
 * - 搜索：showSearch 时打开后可输入过滤（Backspace 删除、Esc/关闭后清空查询）；
 * - 禁用：disabled 的 Select 不打开；disabled 的选项不可选；
 * - 表单集成：getFormValue/setFormValue 与 ICETextField 同语义，错误态边框标红。
 */
import { ICESelect } from '../src/components/ICESelect';
import { ICEOverlayManager } from '../src/core/ICEOverlayManager';

function makeICE() {
  const handlers: Record<string, Array<{ handler: any; ctx: any }>> = {};
  const ice: any = {
    canvasWidth: 800,
    canvasHeight: 600,
    childNodes: [],
    toolNodes: [],
    dirty: false,
    evtBus: {
      on(name: string, handler: any, ctx: any) {
        (handlers[name] = handlers[name] || []).push({ handler, ctx });
      },
      off(name: string, handler: any) {
        handlers[name] = handlers[name].filter((entry) => entry.handler !== handler);
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
  return ice;
}

const options = [
  { value: 'hangzhou', label: '杭州' },
  { value: 'shanghai', label: '上海' },
  { value: 'shenzhen', label: '深圳', disabled: true },
  { value: 'beijing', label: '北京' },
];

function setup(props: any = {}) {
  const ice = makeICE();
  const manager = new ICEOverlayManager(ice);
  const changes: any[] = [];
  const select = new ICESelect({
    left: 0,
    top: 0,
    width: 200,
    height: 32,
    options,
    manager,
    onChange: (value: any, option: any) => changes.push([value, option]),
    ...props,
  });
  (select as any).ice = ice;
  (select as any).afterAddHandler();
  return { ice, manager, select, changes };
}

describe('ICESelect', () => {
  it('单选：点开下拉、点选项后选中并关闭，字段显示标签', () => {
    const { select, changes, manager } = setup();
    expect(select.getFieldLabel()).toBe('');
    select.open();
    expect(select.isOpen()).toBe(true);
    expect(manager.isOpen()).toBe(true);

    select.getOptionNode('shanghai')!.trigger('click', null, {});
    expect(select.getValue()).toBe('shanghai');
    expect(select.isOpen()).toBe(false);
    expect(select.getFieldLabel()).toBe('上海');
    expect(changes).toEqual([['shanghai', options[1]]]);
  });

  it('placeholder 与禁用选项', () => {
    const { select, changes } = setup({ placeholder: '请选择城市' });
    expect(select.getFieldLabel()).toBe('请选择城市');
    select.open();
    select.getOptionNode('shenzhen')!.trigger('click', null, {});
    expect(select.getValue()).toBeUndefined();
    expect(changes).toEqual([]);
    expect(select.isOpen()).toBe(true);
  });

  it('多选：点击切换且不关闭，字段显示标签列表', () => {
    const { select, changes } = setup({ mode: 'multiple', value: [] });
    select.open();
    select.getOptionNode('hangzhou')!.trigger('click', null, {});
    select.getOptionNode('beijing')!.trigger('click', null, {});
    expect(select.getValue()).toEqual(['hangzhou', 'beijing']);
    expect(select.isOpen()).toBe(true);
    expect(select.getFieldLabel()).toBe('杭州、北京');

    select.getOptionNode('hangzhou')!.trigger('click', null, {}); // 再点取消选中
    expect(select.getValue()).toEqual(['beijing']);
    expect(changes.length).toBe(3);
  });

  it('搜索：输入过滤选项，Backspace 删除，关闭后清空查询', () => {
    const { ice, select } = setup({ showSearch: true });
    select.open();
    expect(select.getVisibleOptions().map((o: any) => o.value)).toEqual(['hangzhou', 'shanghai', 'shenzhen', 'beijing']);

    ice.evtBus.trigger('keydown', { key: 'h' });
    expect(select.getQuery()).toBe('h');
    // 过滤同时匹配 label 与 value（中文标签 + 拼音 value 都能搜到）
    expect(select.getVisibleOptions().map((o: any) => o.value)).toEqual(['hangzhou', 'shanghai', 'shenzhen']);

    ice.evtBus.trigger('keydown', { key: 'Backspace' });
    expect(select.getQuery()).toBe('');
    expect(select.getVisibleOptions().length).toBe(4);

    ice.evtBus.trigger('keydown', { key: 'b' });
    ice.evtBus.trigger('keydown', { key: 'Enter' }); // 选中过滤后的第一项
    expect(select.getValue()).toBe('beijing');
    expect(select.getQuery()).toBe('');
  });

  it('disabled 的 Select 不打开；activate()（键盘 Enter）可打开', () => {
    const disabled = setup({ disabled: true });
    disabled.select.open();
    expect(disabled.select.isOpen()).toBe(false);

    const { select } = setup();
    select.activate();
    expect(select.isOpen()).toBe(true);
  });

  it('鼠标点击字段开关下拉（再点关闭）', () => {
    const { select } = setup();
    select.trigger('click', null, {});
    expect(select.isOpen()).toBe(true);
    select.trigger('click', null, {});
    expect(select.isOpen()).toBe(false);

    const disabled = setup({ disabled: true });
    disabled.select.trigger('click', null, {});
    expect(disabled.select.isOpen()).toBe(false);
  });

  it('表单集成：getFormValue/setFormValue 与错误态边框', () => {
    const { select } = setup();
    select.setFormValue('beijing');
    expect(select.getFormValue()).toBe('beijing');
    expect(select.getFieldLabel()).toBe('北京');
    select.setValidateStatus('error');
    expect(String(select.state.style.strokeStyle)).toMatch(/^#/);
    expect(select.isFocusable()).toBe(true);
  });
});
