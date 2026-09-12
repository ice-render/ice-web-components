/**
 * ICETreeSelect 单测。
 *
 * 规格：
 * - 字段区显示选中节点标签（无选中显示 placeholder），点击字段开/关下拉；
 * - 下拉里是 ICETree（层级展开/折叠、缩进、箭头命中区都复用），选中节点后回写值并关闭；
 * - 浮层自己管点外关闭（closeOnOutsideClick:false + 自身命中盒），Esc 也能关；
 * - 表单集成：getFormValue/setFormValue（存节点 key）。
 */
import { ICETreeSelect } from '../src/components/ICETreeSelect';

const nodes = [
  {
    key: 'db',
    label: '数据库',
    children: [
      { key: 'mysql', label: 'MySQL' },
      { key: 'pg', label: 'PostgreSQL' },
    ],
  },
  { key: 'cache', label: '缓存' },
];

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
  const changes: Array<[string, string]> = [];
  const select = new ICETreeSelect({
    left: 0,
    top: 0,
    width: 220,
    height: 32,
    nodes,
    placeholder: '请选择数据源',
    onChange: (key: string, node: any) => changes.push([key, node.label]),
    ...props,
  });
  (select as any).ice = ice;
  (select as any).afterAddHandler();
  return { ice, select, changes };
}

describe('ICETreeSelect', () => {
  it('默认显示 placeholder；点击字段展开下拉并渲染树', () => {
    const { select } = setup();
    expect(select.getFieldLabel()).toBe('请选择数据源');
    expect(select.isOpen()).toBe(false);

    select.trigger('click', null, {});
    expect(select.isOpen()).toBe(true);
    const tree = select.getTree()!;
    expect(tree.getVisibleNodes().map((node: any) => node.key)).toEqual(['db', 'cache']);
    select.trigger('click', null, {});
    expect(select.isOpen()).toBe(false);
  });

  it('选中节点：回写值、更新标签、关闭下拉并回调', () => {
    const { select, changes } = setup();
    select.trigger('click', null, {});
    const tree = select.getTree()!;
    tree.getRowNode('db')!.trigger('expand-click', null, {});
    expect(tree.getVisibleNodes().map((node: any) => node.key)).toEqual(['db', 'mysql', 'pg', 'cache']);

    tree.getRowNode('pg')!.trigger('click', null, {});
    expect(select.getValue()).toBe('pg');
    expect(select.getFieldLabel()).toBe('PostgreSQL');
    expect(select.isOpen()).toBe(false);
    expect(changes).toEqual([['pg', 'PostgreSQL']]);
  });

  it('Esc 与点外关闭（自己管理命中盒）', () => {
    const { ice, select } = setup();
    select.trigger('click', null, {});
    ice.evtBus.trigger('keydown', { key: 'Escape' });
    expect(select.isOpen()).toBe(false);

    select.trigger('click', null, {});
    ice.evtBus.trigger('mousedown', { offsetX: 700, offsetY: 500 }); // 面板之外
    expect(select.isOpen()).toBe(false);

    select.trigger('click', null, {});
    ice.evtBus.trigger('mousedown', { offsetX: 20, offsetY: 10 }); // 自己身上
    expect(select.isOpen()).toBe(true);
  });

  it('表单集成：值是节点 key，setFormValue 同步标签', () => {
    const { select } = setup();
    select.setFormValue('mysql');
    expect(select.getFormValue()).toBe('mysql');
    expect(select.getFieldLabel()).toBe('MySQL');
    expect(select.isFocusable()).toBe(true);
    select.setValidateStatus('error');
    expect(select.getValidateStatus()).toBe('error');
  });
});
