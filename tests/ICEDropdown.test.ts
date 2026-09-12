/**
 * ICEDropdown 单测。
 *
 * 规格：
 * - 点击触发组件打开菜单（浮层定位走 ICEOverlayManager），再次点击关闭；
 * - 菜单项：正常项可点选、disabled 项忽略；选中项高亮（primary + 勾选）；
 * - 键盘：↑/↓ 在可选项之间移动（跳过 disabled），Enter 选中并关闭，Esc 关闭；
 * - onSelect(item, index) 回调；setSelectedKey 更新高亮。
 */
import { ICEButton } from '../src/components/ICEButton';
import { ICEDropdown } from '../src/components/ICEDropdown';
import { ICEOverlayManager } from '../src/core/ICEOverlayManager';

function makeICE() {
  const handlers: Record<string, Array<{ handler: any; ctx: any }>> = {};
  const ice: any = {
    canvasWidth: 800,
    canvasHeight: 600,
    childNodes: [],
    toolNodes: [],
    dirty: false,
    focused: null,
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
    setFocusedComponent: (component: any) => {
      ice.focused = component;
    },
    getFocusedComponent: () => ice.focused,
    screenToWorld: (x: number, y: number) => [x, y],
    getRenderViewport: () => ({ scale: 1, tx: 0, ty: 0 }),
  };
  return ice;
}

function setup(options: any = {}) {
  const ice = makeICE();
  const manager = new ICEOverlayManager(ice);
  const target = new ICEButton({ left: 40, top: 40, width: 120, height: 32, text: '选择' });
  const selected: Array<[string, number]> = [];
  const dropdown = new ICEDropdown(ice, target, {
    manager,
    items: [
      { key: 'a', label: '选项 A' },
      { key: 'b', label: '选项 B' },
      { key: 'c', label: '选项 C', disabled: true },
      { key: 'd', label: '选项 D' },
    ],
    selectedKey: 'a',
    onSelect: (item: any, index: number) => selected.push([item.key, index]),
    ...options,
  }).start();
  return { ice, manager, target, dropdown, selected };
}

describe('ICEDropdown', () => {
  it('点击目标打开菜单、再点关闭；内容包含全部选项', () => {
    const { target, dropdown, manager } = setup();
    target.trigger('click', null, {});
    expect(dropdown.isOpen()).toBe(true);

    const layer = manager.getLayer()!;
    const panel = layer.childNodes[layer.childNodes.length - 1];
    const labels: string[] = [];
    const walk = (node: any) => {
      const text = node.state && node.state.text;
      if (typeof text === 'string' && text && labels.indexOf(text) === -1) labels.push(text);
      (node.childNodes || []).forEach(walk);
    };
    walk(panel);
    expect(labels.filter((t) => t !== '✓')).toEqual(['选项 A', '选项 B', '选项 C', '选项 D']);
    // 选中项带勾选标记
    expect(labels).toContain('✓');

    target.trigger('click', null, {});
    expect(dropdown.isOpen()).toBe(false);
    dropdown.destroy();
  });

  it('点选菜单项触发 onSelect 并关闭；disabled 项忽略', () => {
    const { target, dropdown, selected } = setup();
    target.trigger('click', null, {});

    dropdown.getItemNode(1)!.trigger('click', null, {}); // 选项 B
    expect(selected).toEqual([['b', 1]]);
    expect(dropdown.isOpen()).toBe(false);

    target.trigger('click', null, {});
    dropdown.getItemNode(2)!.trigger('click', null, {}); // 选项 C 已禁用
    expect(selected).toEqual([['b', 1]]);
    expect(dropdown.isOpen()).toBe(true);
    dropdown.destroy();
  });

  it('setSelectedKey 更新高亮；getSelectedKey 可读', () => {
    const { target, dropdown } = setup();
    target.trigger('click', null, {});
    expect(dropdown.getSelectedKey()).toBe('a');
    dropdown.setSelectedKey('d');
    expect(dropdown.getSelectedKey()).toBe('d');
    // 高亮项的文字变成 primary 色
    const node = dropdown.getItemNode(3)!;
    const label = (node.childNodes || []).find((child: any) => child.state && child.state.text === '选项 D');
    expect(String(label.state.style.fillStyle)).toMatch(/^#/);
    dropdown.destroy();
  });

  it('键盘：↓/↑ 在可选项间移动（跳过 disabled），Enter 选中并关闭', () => {
    const { ice, target, dropdown, selected } = setup();
    target.trigger('click', null, {});
    expect(dropdown.getActiveIndex()).toBe(0);

    ice.evtBus.trigger('keydown', { key: 'ArrowDown' });
    expect(dropdown.getActiveIndex()).toBe(1);
    ice.evtBus.trigger('keydown', { key: 'ArrowDown' });
    expect(dropdown.getActiveIndex()).toBe(3); // 跳过 disabled 的 c
    ice.evtBus.trigger('keydown', { key: 'ArrowDown' });
    expect(dropdown.getActiveIndex()).toBe(0); // 回绕
    ice.evtBus.trigger('keydown', { key: 'ArrowUp' });
    expect(dropdown.getActiveIndex()).toBe(3);

    ice.evtBus.trigger('keydown', { key: 'ArrowUp' });
    ice.evtBus.trigger('keydown', { key: 'ArrowUp' });
    expect(dropdown.getActiveIndex()).toBe(0);
    ice.evtBus.trigger('keydown', { key: 'Enter' });
    expect(selected).toEqual([['a', 0]]);
    expect(dropdown.isOpen()).toBe(false);
    dropdown.destroy();
  });

  it('关闭后不再响应方向键；destroy() 解绑', () => {
    const { ice, dropdown } = setup();
    ice.evtBus.trigger('keydown', { key: 'ArrowDown' });
    expect(dropdown.isOpen()).toBe(false);
    expect(dropdown.getActiveIndex()).toBe(0);
    dropdown.destroy();
  });
});
