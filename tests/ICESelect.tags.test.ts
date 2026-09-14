/**
 * ICESelect 的 `tags` 模式与 `maxTagCount`。
 *
 * 规格：
 * - `mode: 'tags'`：多选 + 可以「创造」候选项里没有的取值（输入后回车）；
 *   输入与已有候选同名时选它，不重复造一个；
 * - 字段区画成一串**标签片**（不是一坨逗号串），放不下或超过 `maxTagCount` 时折叠成 `+M`；
 *   折叠只影响显示，`getValue()` 永远是全量的；
 * - 标签片上的 ✕ 与空查询时按 Backspace 都走 `removeTag()`；
 * - 搜索照旧过滤候选，并且在没有任何候选命中时给出「创建」那一行。
 */
import { ICESelect } from '../src/components/ICESelect';

const OPTIONS = [
  { value: 'beijing', label: '北京' },
  { value: 'shanghai', label: '上海' },
  { value: 'hangzhou', label: '杭州' },
  { value: 'shenzhen', label: '深圳' },
];

function setup(props: any = {}) {
  const ice: any = {
    canvasWidth: 800,
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
  const changes: any[] = [];
  const select = new ICESelect({
    left: 0,
    top: 0,
    width: 220,
    height: 32,
    options: OPTIONS,
    mode: 'tags',
    showSearch: true,
    placeholder: '请选择城市',
    onChange: (value: any) => changes.push(value),
    ...props,
  });
  (select as any).ice = ice;
  (select as any).afterAddHandler();
  return { select, changes, ice };
}

/** 模拟键盘：直接走组件的 keydown 处理（与 e2e 的按键路径同一条）。 */
function type(select: ICESelect, evt: any) {
  (select as any).__onKeyDown(evt);
}

function typeText(select: ICESelect, text: string) {
  for (const ch of text) {
    type(select, { key: ch });
  }
}

describe('ICESelect tags 模式', () => {
  it('输入候选里没有的词并回车 → 创造一个新标签', () => {
    const { select, changes } = setup();
    select.open();
    typeText(select, '成都');
    type(select, { key: 'Enter' });
    expect(select.getValue()).toEqual(['成都']);
    expect(changes).toEqual([['成都']]);
    expect(select.isOpen()).toBe(true);
  });

  it('输入与已有候选同名的词 → 选它，不重复造', () => {
    const { select } = setup();
    select.open();
    typeText(select, '北京');
    type(select, { key: 'Enter' });
    expect(select.getValue()).toEqual(['beijing']);
    expect(select.getVisibleOptions().map((option) => option.value)).toContain('beijing');
  });

  it('创建后再点候选：标签片并列，取值是数组', () => {
    const { select } = setup();
    select.open();
    typeText(select, '成都');
    type(select, { key: 'Enter' });
    select.getOptionNode('shanghai')!.trigger('click', null, {});
    expect(select.getValue()).toEqual(['成都', 'shanghai']);
  });

  it('没有候选命中时给一行「创建」，点它等于回车', () => {
    const { select } = setup();
    select.open();
    typeText(select, '西安');
    const create = select.getOptionNode('西安');
    expect(create).toBeTruthy();
    create!.trigger('click', null, {});
    expect(select.getValue()).toEqual(['西安']);
  });

  it('搜索仍然过滤候选（tags 不是另起一套）', () => {
    const { select } = setup();
    select.open();
    typeText(select, 'beij');
    expect(select.getVisibleOptions().map((option) => option.value)).toEqual(['beijing']);
  });

  it('空查询时按 Backspace 删掉最后一个标签', () => {
    const { select } = setup({ value: ['beijing', 'shanghai'] });
    select.open();
    type(select, { key: 'Backspace' });
    expect(select.getValue()).toEqual(['beijing']);
    select.removeTag('beijing');
    expect(select.getValue()).toEqual([]);
  });
});

describe('ICESelect 标签片与 maxTagCount', () => {
  it('多选/ tags 的字段画成标签片，标签片上的 ✕ 能删', () => {
    const { select } = setup({ value: ['beijing', 'shanghai'] });
    const tags = select.getTagNodes();
    expect(tags.map((tag: any) => tag.label)).toEqual(['北京', '上海']);
    tags[0].close!.trigger('click', null, {});
    expect(select.getValue()).toEqual(['shanghai']);
  });

  it('maxTagCount 只影响显示：超出部分折叠成 +M，取值仍是全量', () => {
    const { select } = setup({ value: ['beijing', 'shanghai', 'hangzhou', 'shenzhen'], maxTagCount: 2 });
    expect(select.getTagNodes().length).toBe(2);
    expect(select.getOverflowCount()).toBe(2);
    expect(select.getOverflowLabel()).toBe('+2');
    expect(select.getValue()).toEqual(['beijing', 'shanghai', 'hangzhou', 'shenzhen']);
  });

  it('宽度放不下时自动少画几个（溢出计数跟着涨）', () => {
    const wide = setup({ value: ['beijing', 'shanghai', 'hangzhou', 'shenzhen'], width: 400 });
    const narrow = setup({ value: ['beijing', 'shanghai', 'hangzhou', 'shenzhen'], width: 120 });
    expect(wide.select.getOverflowCount()).toBe(0);
    expect(narrow.select.getOverflowCount()).toBeGreaterThan(0);
  });

  it('单选的字段仍然是一行文本（不改成标签片）', () => {
    const { select } = setup({ mode: 'single', value: 'beijing' });
    expect(select.getTagNodes()).toEqual([]);
    expect(select.getFieldLabel()).toBe('北京');
  });

  it('多选的字段文本保持原样（标签片是显示层，语义 API 不变）', () => {
    const { select } = setup({ mode: 'multiple', value: ['hangzhou', 'beijing'] });
    expect(select.getFieldLabel()).toBe('杭州、北京');
  });
});
