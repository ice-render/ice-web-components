/**
 * ICESelect 的大候选列表：滚动 + 虚拟窗口。
 *
 * 背景（这是真缺口）：候选超过 6 条时，下拉只画前 6 条，**剩下的根本翻不到**——只能靠搜索。
 *
 * 规格：
 * - 候选比 `listHeight` 高时，候选区自己变成滚动视口（内容高度按总条数算，滚动条比例正确）；
 * - 条数很多（默认 ≥ `virtualThreshold`）时只渲染可视窗口 + 缓冲，节点数有上界；
 * - 键盘上下移动到窗口外时自动把窗口滚过去（不能用键盘走到看不见的地方）；
 * - 搜索过滤后再决定要不要虚拟（过滤到 3 条就老老实实全画）；
 * - `getOptionNode()` / 选中态 / 点击在虚拟窗口里照常工作。
 */
import { ICESelect } from '../src/components/ICESelect';

function makeOptions(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    value: 'v' + index,
    label: '选项 ' + String(index + 1).padStart(3, '0'),
  }));
}

function setup(props: any = {}) {
  const changes: any[] = [];
  const select = new ICESelect({
    left: 0,
    top: 0,
    width: 240,
    height: 32,
    optionHeight: 30,
    options: makeOptions(12),
    onChange: (value: any) => changes.push(value),
    ...props,
  });
  const ice: any = {
    canvasWidth: 900,
    canvasHeight: 600,
    toolNodes: [],
    dirty: false,
    evtBus: { on() {}, off() {}, trigger() {} },
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
  (select as any).ice = ice;
  (select as any).afterAddHandler();
  return { select, changes };
}

const key = (select: ICESelect, evt: any) => (select as any).__onKeyDown(evt);

describe('ICESelect 选项滚动', () => {
  it('候选不超过一屏时不滚动：全部画出来', () => {
    const { select } = setup({ options: makeOptions(4) });
    select.open();
    expect(select.isListScrollable()).toBe(false);
    expect(select.getRenderedOptionValues()).toEqual(['v0', 'v1', 'v2', 'v3']);
  });

  it('候选超过一屏：候选区可滚动，内容高度 = 总条数 × 行高（条数不多时全部渲染）', () => {
    const { select } = setup({ listHeight: 90 }); // 3 行高
    select.open();
    expect(select.isListScrollable()).toBe(true);
    expect(select.getListContentHeight()).toBe(12 * 30);
    expect(select.getRenderedOptionValues().length).toBe(12);
    // 行按自己在列表里的下标定位（滚动时整体被视口裁掉/露出，不是重排一遍）
    expect(select.getOptionNode('v11')!.state.top).toBe(11 * 30);
  });

  it('滚动位置被夹到可滚动范围（滚到底看得到最后一条）', () => {
    const { select } = setup({ listHeight: 90 });
    select.open();
    select.setListScroll(150);
    expect(select.getListScroll()).toBe(150);
    select.setListScroll(100000); // 夹到底
    expect(select.getListScroll()).toBe(12 * 30 - 90);
  });

  it('键盘上下移动会把窗口滚到当前项（不能走进看不见的地方）', () => {
    const { select } = setup({ listHeight: 90 });
    select.open();
    for (let i = 0; i < 5; i += 1) {
      key(select, { key: 'ArrowDown' });
    }
    expect(select.getActiveIndex()).toBe(5);
    expect(select.getListScroll()).toBeGreaterThan(0);
    expect(select.getRenderedOptionValues()).toContain('v5');
  });
});

describe('ICESelect 选项虚拟化', () => {
  it('条数超过阈值才虚拟；渲染的节点数有上界', () => {
    const small = setup({ options: makeOptions(50), listHeight: 120 });
    small.select.open();
    expect(small.select.isVirtual()).toBe(false);
    expect(small.select.getRenderedOptionValues().length).toBe(50);

    const big = setup({ options: makeOptions(1000), listHeight: 120 });
    big.select.open();
    expect(big.select.isVirtual()).toBe(true);
    expect(big.select.getRenderedOptionValues().length).toBeLessThan(20);
  });

  it('滚动只换窗口，节点数不增长（一万条也一样）', () => {
    const { select } = setup({ options: makeOptions(10000), listHeight: 120 });
    select.open();
    const before = select.getRenderedOptionValues().length;
    select.setListScroll(1e9); // 夹到底
    const after = select.getRenderedOptionValues().length;
    expect(after).toBeLessThanOrEqual(before + 2);
    expect(select.getRenderedOptionValues()).toContain('v9999');
  });

  it('虚拟窗口里点得中：点当前窗口里的候选能选中并回调', () => {
    const { select, changes } = setup({ options: makeOptions(1000), listHeight: 120 });
    select.open();
    select.setListScroll(500 * 30);
    const value = select.getRenderedOptionValues()[0];
    select.getOptionNode(value)!.trigger('click', null, {});
    expect(select.getValue()).toBe(value);
    expect(changes).toEqual([value]);
  });

  it('虚拟窗口里选中态仍然标出来', () => {
    const { select } = setup({ options: makeOptions(1000), listHeight: 120, value: 'v505' });
    select.open();
    select.setListScroll(500 * 30);
    const row = select.getOptionNode('v505');
    expect(row).toBeTruthy();
    expect(select.getSelectedOptionValues()).toEqual(['v505']);
  });

  it('搜索过滤后再决定要不要虚拟（过滤到几条就全画）', () => {
    const { select } = setup({ options: makeOptions(1000), listHeight: 120, showSearch: true });
    select.open();
    expect(select.isVirtual()).toBe(true);
    key(select, { key: 'v' });
    key(select, { key: '9' });
    key(select, { key: '9' });
    key(select, { key: '9' });
    // '选项 999' / '选项 9999'（1000 条时只有 999）
    expect(select.getVisibleOptions().length).toBeLessThan(20);
    expect(select.isVirtual()).toBe(false);
    expect(select.getRenderedOptionValues()).toEqual(select.getVisibleOptions().map((option) => option.value));
  });
});
