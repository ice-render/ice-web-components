/**
 * ICEDateRangePicker 单测（区间选择的界面层）。
 *
 * 规格（承接 ICEDateRangeModel 的规则，界面只负责「画」和「把点击翻译成模型调用」）：
 * - 字段是两半：起 / 止，各自有占位文案，选完一半只顶掉一半的占位；
 * - 浮层左边是快捷项列（今天/近 7 天/…），右边是单月网格；两边**不许交叠**；
 * - 区间要点两次：第一下定起点（进行中、不关浮层、不回调），第二下收口
 *   （自动排序 → 关浮层 → onChange 只给完整区间）；
 * - 网格按区间着色：端点单独标记，区间内（含端点）整段标记；
 * - 快捷项点一下就写值 + 关浮层；当前区间正好等于某个快捷项时 `getActivePresetKey()` 认出来；
 * - 清空按钮把两头抹掉并回到占位；
 * - Esc / 点外关闭；`disabled` 时点不开。
 */
import { ICEDateRangePicker } from '../src/components/ICEDateRangePicker';

function setup(props: any = {}) {
  const handlers: Record<string, Array<{ handler: any; ctx: any }>> = {};
  const ice: any = {
    canvasWidth: 900,
    canvasHeight: 640,
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
  const changes: Array<[string, string]> = [];
  const picker = new ICEDateRangePicker({
    left: 0,
    top: 0,
    width: 260,
    height: 32,
    today: '2026-09-14',
    onChange: (value: [string, string]) => changes.push(value),
    ...props,
  });
  (picker as any).ice = ice;
  (picker as any).afterAddHandler();
  return { ice, picker, changes };
}

describe('字段显示', () => {
  it('未选时两半各显示自己的占位；选完一半只顶掉一半', () => {
    const { picker } = setup();
    expect(picker.getFieldParts()).toEqual({ start: '开始日期', end: '结束日期' });

    picker.open();
    picker.getDayNode('2026-09-10')!.trigger('click', null, {});
    expect(picker.getFieldParts()).toEqual({ start: '2026-09-10', end: '结束日期' });
    expect(picker.getFieldText()).toBe('2026-09-10 → 结束日期');
  });

  it('占位文案跟随实例语言（en-US）', () => {
    const { picker } = setup({ locale: 'en-US' });
    expect(picker.getFieldParts()).toEqual({ start: 'Start date', end: 'End date' });
  });

  it('完整区间显示成「起 → 止」', () => {
    const { picker } = setup({ value: ['2026-09-10', '2026-09-20'] });
    expect(picker.getFieldText()).toBe('2026-09-10 → 2026-09-20');
    expect(picker.isComplete()).toBe(true);
  });
});

describe('开合与布局', () => {
  it('点字段开浮层：左边快捷项列、右边 42 格网格，两边不交叠', () => {
    const { picker } = setup();
    expect(picker.isOpen()).toBe(false);
    picker.trigger('click', null, {});
    expect(picker.isOpen()).toBe(true);
    expect(picker.getDayCells().length).toBe(42);
    expect(picker.getPresetKeys()).toEqual(['today', 'last7', 'last30', 'thisMonth', 'lastMonth']);

    const layout = picker.getPanelLayout()!;
    expect(layout.presets.left + layout.presets.width).toBeLessThanOrEqual(layout.calendar.left);
    // 快捷项彼此不压：相邻两项的纵向区间不相交
    const boxes = picker.getPresetBoxes();
    expect(boxes.length).toBe(5);
    for (let i = 1; i < boxes.length; i++) {
      expect(boxes[i].top).toBeGreaterThanOrEqual(boxes[i - 1].top + boxes[i - 1].height);
    }
    // 网格整体落在面板内（不越界）
    expect(layout.calendar.left + layout.calendar.width).toBeLessThanOrEqual(layout.panel.width);
    expect(layout.calendar.top + layout.calendar.height).toBeLessThanOrEqual(layout.panel.height);
  });

  it('Esc 与点外关闭；disabled 时点不开', () => {
    const { ice, picker } = setup();
    picker.open();
    ice.evtBus.trigger('keydown', { key: 'Escape' });
    expect(picker.isOpen()).toBe(false);

    picker.open();
    ice.evtBus.trigger('mousedown', { offsetX: 800, offsetY: 560 });
    expect(picker.isOpen()).toBe(false);

    const { picker: disabled } = setup({ disabled: true });
    disabled.trigger('click', null, {});
    expect(disabled.isOpen()).toBe(false);
  });
});

describe('选区间', () => {
  it('两次点击才成区间：第一下进行中（不关、不回调），第二下收口', () => {
    const { picker, changes } = setup();
    picker.open();
    picker.getDayNode('2026-09-10')!.trigger('click', null, {});
    expect(picker.isComplete()).toBe(false);
    expect(picker.isOpen()).toBe(true);
    expect(changes).toEqual([]);

    picker.getDayNode('2026-09-20')!.trigger('click', null, {});
    expect(picker.isComplete()).toBe(true);
    expect(picker.isOpen()).toBe(false);
    expect(changes).toEqual([['2026-09-10', '2026-09-20']]);
    expect(picker.getValue()).toEqual(['2026-09-10', '2026-09-20']);
  });

  it('反向点（先 20 再 10）自动排序后再回调', () => {
    const { picker, changes } = setup();
    picker.open();
    picker.getDayNode('2026-09-20')!.trigger('click', null, {});
    picker.getDayNode('2026-09-10')!.trigger('click', null, {});
    expect(changes).toEqual([['2026-09-10', '2026-09-20']]);
  });

  it('同一天点两下 = 单日区间', () => {
    const { picker, changes } = setup();
    picker.open();
    picker.getDayNode('2026-09-14')!.trigger('click', null, {});
    picker.getDayNode('2026-09-14')!.trigger('click', null, {});
    expect(picker.getValue()).toEqual(['2026-09-14', '2026-09-14']);
    expect(changes).toEqual([['2026-09-14', '2026-09-14']]);
  });

  it('网格标记：端点 / 区间内 / 区间外；进行中只标起点', () => {
    const { picker } = setup();
    picker.open();
    picker.getDayNode('2026-09-10')!.trigger('click', null, {});
    const inProgress = picker.getDayCells();
    const ten = inProgress.find((cell) => cell.date === '2026-09-10')!;
    expect(ten.isRangeStart).toBe(true);
    expect(ten.inRange).toBe(true);
    expect(inProgress.every((cell) => !cell.isRangeEnd)).toBe(true);

    picker.getDayNode('2026-09-20')!.trigger('click', null, {});
    picker.open();
    const cells = picker.getDayCells();
    const start = cells.find((cell) => cell.date === '2026-09-10')!;
    const end = cells.find((cell) => cell.date === '2026-09-20')!;
    const middle = cells.find((cell) => cell.date === '2026-09-15')!;
    const outside = cells.find((cell) => cell.date === '2026-09-25')!;
    expect([start.isRangeStart, start.isRangeEnd]).toEqual([true, false]);
    expect([end.isRangeStart, end.isRangeEnd]).toEqual([false, true]);
    expect(middle.inRange).toBe(true);
    expect(outside.inRange).toBe(false);
    expect(cells.filter((cell) => cell.inRange).length).toBe(11);
  });
});

describe('快捷项', () => {
  it('点快捷项：写值 + 关浮层 + 回调；视图跳到区间起点所在月', () => {
    const { picker, changes } = setup();
    picker.open();
    picker.setViewMonth(2026, 9);
    picker.getPresetNode('lastMonth')!.trigger('click', null, {});
    expect(picker.getValue()).toEqual(['2026-08-01', '2026-08-31']);
    expect(changes).toEqual([['2026-08-01', '2026-08-31']]);
    expect(picker.isOpen()).toBe(false);
    expect(picker.getViewMonth()).toEqual({ year: 2026, month: 8 });
  });

  it('getActivePresetKey 认出「当前区间正好是某个快捷项」，否则 null', () => {
    const { picker } = setup();
    expect(picker.getActivePresetKey()).toBe(null);
    picker.applyPreset('last7');
    expect(picker.getActivePresetKey()).toBe('last7');
    picker.setValue('2026-09-02', '2026-09-05');
    expect(picker.getActivePresetKey()).toBe(null);
  });

  it('showPresets:false 时不渲染快捷项列，网格顶到左边', () => {
    const { picker } = setup({ showPresets: false });
    picker.open();
    expect(picker.getPresetKeys()).toEqual([]);
    const layout = picker.getPanelLayout()!;
    expect(layout.presets.width).toBe(0);
    expect(layout.calendar.left).toBeLessThan(40);
  });
});

describe('清空与表单取值', () => {
  it('clear() 抹掉两头、回到占位', () => {
    const { picker } = setup({ value: ['2026-09-10', '2026-09-20'] });
    picker.clear();
    expect(picker.getValue()).toEqual([null, null]);
    expect(picker.getFieldParts()).toEqual({ start: '开始日期', end: '结束日期' });
  });

  it('面板里的清空按钮走同一条路径（值非空时可见）', () => {
    const { picker } = setup();
    picker.open();
    expect(picker.isClearVisible()).toBe(true);
    picker.getDayNode('2026-09-10')!.trigger('click', null, {});
    picker.getClearNode()!.trigger('click', null, {});
    expect(picker.getValue()).toEqual([null, null]);
    expect(picker.isOpen()).toBe(true);
  });

  it('表单取值：setFormValue 接受数组，空值归一成 [null, null]', () => {
    const { picker } = setup();
    picker.setFormValue(['2026-09-01', '2026-09-05']);
    expect(picker.getFormValue()).toEqual(['2026-09-01', '2026-09-05']);
    expect(picker.getFieldText()).toBe('2026-09-01 → 2026-09-05');
    picker.setFormValue(null);
    expect(picker.getFormValue()).toEqual([null, null]);
  });
});
