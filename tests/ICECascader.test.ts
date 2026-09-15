/**
 * ICECascader 单测（级联选择）。
 *
 * 规格：
 * - 字段显示已选路径（可自定义 separator），未选显示 placeholder；
 * - 浮层按层级横向排列：点父节点 → 展开下一列；点叶子 → 定值 + 关闭 + onChange；
 * - 点父节点不关闭浮层；disabled 节点忽略；禁用态不可打开、不可聚焦；
 * - 表单取值约定 + 错误态边框。
 */
import { ICECascader, ICECascaderOption } from '../src/components/ICECascader';

const options: ICECascaderOption[] = [
  {
    value: 'zj',
    label: '浙江',
    children: [
      {
        value: 'hz',
        label: '杭州',
        children: [
          { value: 'xh', label: '西湖' },
          { value: 'yh', label: '余杭' },
        ],
      },
      { value: 'nb', label: '宁波' },
    ],
  },
  {
    value: 'js',
    label: '江苏',
    children: [
      { value: 'nj', label: '南京' },
      { value: 'sz', label: '苏州' },
    ],
  },
  { value: 'other', label: '其它', disabled: true },
];

function setup(props: any = {}) {
  const handlers: Record<string, Array<{ handler: any; ctx: any }>> = {};
  const ice: any = {
    canvasWidth: 900,
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
  const changes: Array<{ value: string; path: ICECascaderOption[] }> = [];
  const cascader = new ICECascader({
    left: 0,
    top: 0,
    width: 220,
    options,
    placeholder: '请选择地区',
    onChange: (value: string, path: ICECascaderOption[]) => changes.push({ value, path }),
    ...props,
  });
  (cascader as any).ice = ice;
  (cascader as any).afterAddHandler();
  return { ice, cascader, changes };
}

describe('ICECascader', () => {
  it('字段显示已选路径；未选显示 placeholder', () => {
    const empty = setup();
    expect(empty.cascader.getValue()).toBeUndefined();
    expect(empty.cascader.getFieldLabel()).toBe('请选择地区');

    const picked = setup({ value: 'xh' });
    expect(picked.cascader.getValue()).toBe('xh');
    expect(picked.cascader.getFieldLabel()).toBe('浙江 / 杭州 / 西湖');
    expect(picked.cascader.getPath().map((node) => node.value)).toEqual(['zj', 'hz', 'xh']);
  });

  it('打开浮层：首列是根节点；点父节点展开下一列且不关闭', () => {
    const { cascader } = setup();
    expect(cascader.isOpen()).toBe(false);
    cascader.open();
    expect(cascader.isOpen()).toBe(true);
    expect(cascader.getColumnNodes().length).toBe(1);
    expect(cascader.getOptionNode(0, 'zj')).not.toBeNull();
    expect(cascader.getOptionNode(0, 'other')).not.toBeNull();

    cascader.getOptionNode(0, 'zj')!.trigger('click', null, {});
    expect(cascader.isOpen()).toBe(true);
    expect(cascader.getColumnNodes().length).toBe(2);
    expect(cascader.getOptionNode(1, 'hz')).not.toBeNull();

    cascader.getOptionNode(1, 'hz')!.trigger('click', null, {});
    expect(cascader.getColumnNodes().length).toBe(3);
    expect(cascader.getOptionNode(2, 'xh')).not.toBeNull();
    expect(cascader.getValue()).toBeUndefined();
  });

  it('点叶子：定值 + 关闭 + onChange 带完整路径', () => {
    const { cascader, changes } = setup();
    cascader.open();
    cascader.getOptionNode(0, 'zj')!.trigger('click', null, {});
    cascader.getOptionNode(1, 'hz')!.trigger('click', null, {});
    cascader.getOptionNode(2, 'xh')!.trigger('click', null, {});
    expect(cascader.getValue()).toBe('xh');
    expect(cascader.isOpen()).toBe(false);
    expect(cascader.getFieldLabel()).toBe('浙江 / 杭州 / 西湖');
    expect(changes.length).toBe(1);
    expect(changes[0].value).toBe('xh');
    expect(changes[0].path.map((node) => node.label)).toEqual(['浙江', '杭州', '西湖']);
  });

  it('二级叶子直接可选；换父节点会重置后面的列', () => {
    const { cascader, changes } = setup();
    cascader.open();
    cascader.getOptionNode(0, 'zj')!.trigger('click', null, {});
    cascader.getOptionNode(1, 'nb')!.trigger('click', null, {});
    expect(cascader.getValue()).toBe('nb');
    expect(cascader.isOpen()).toBe(false);
    expect(changes[0].path.map((node) => node.value)).toEqual(['zj', 'nb']);

    const browse = setup({ value: 'xh' });
    browse.cascader.open();
    expect(browse.cascader.getColumnNodes().length).toBe(3);
    browse.cascader.getOptionNode(0, 'js')!.trigger('click', null, {});
    expect(browse.cascader.getColumnNodes().length).toBe(2);
    expect(browse.cascader.getOptionNode(1, 'sz')).not.toBeNull();
    expect(browse.cascader.getValue()).toBe('xh');
  });

  it('disabled：节点点击忽略；控件不可打开、不可聚焦', () => {
    const { cascader, changes } = setup();
    cascader.open();
    cascader.getOptionNode(0, 'other')!.trigger('click', null, {});
    expect(cascader.getValue()).toBeUndefined();
    expect(cascader.getColumnNodes().length).toBe(1);
    expect(changes.length).toBe(0);
    cascader.close();

    const disabled = setup({ disabled: true }).cascader;
    expect(disabled.isFocusable()).toBe(false);
    disabled.open();
    expect(disabled.isOpen()).toBe(false);
  });

  it('separator 可定制；表单取值与错误态', () => {
    const { cascader } = setup({ value: 'xh', separator: ' > ' });
    expect(cascader.getFieldLabel()).toBe('浙江 > 杭州 > 西湖');
    expect(cascader.getFormValue()).toBe('xh');
    cascader.setFormValue('sz');
    expect(cascader.getValue()).toBe('sz');
    expect(cascader.getFieldLabel()).toBe('江苏 > 苏州');
    cascader.setValidateStatus('error');
    expect(cascader.getValidateStatus()).toBe('error');
    expect(cascader.isFocusable()).toBe(true);
  });

  it('浮层几何走布局器后仍与历史一致：列 = `6 + level × 104`，列内选项行距 = 30', () => {
    const { cascader } = setup();
    cascader.open();
    const columns = cascader.getColumnNodes();
    expect(columns.length).toBe(1);
    // 列行宿主（横向 BoxLayout）：起点 = PANEL_PADDING
    const host = columns[0].parentNode as any;
    expect([host.state.left, host.state.top]).toEqual([6, 6]);
    // 每一列都是滚动面板，宽 = COLUMN_WIDTH
    expect(columns[0].state.width).toBe(104);
    // 选项行在列内容里按 ROW_HEIGHT 逐行排
    const rows = options.map((option) => cascader.getOptionNode(0, option.value)!);
    expect(rows.map((row) => row.state.top)).toEqual([0, 30, 60]);
    expect(rows.every((row) => row.state.left === 0 && row.state.height === 30)).toBe(true);
    cascader.close();
  });
});
