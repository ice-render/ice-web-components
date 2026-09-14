/**
 * ICEDrawer 的插槽形态：标题栏 `extra` 与贴底 `footer`。
 *
 * 规格：
 * - `extra` 摆在关闭按钮左边（没关按钮就靠右），纵向与标题栏对齐；
 * - `footer` 贴底铺满宽度，内容区让出这段高度（`getContentBox()` 的口径）；
 * - 没传时 `getExtraNode()/getFooterNode()` 是 null，行为与以前一致。
 */
import { openDrawer } from '../src/components/ICEDrawer';
import { ICEButton } from '../src/components/ICEButton';
import { ICEPanel } from '../src/components/ICEPanel';

function makeICE() {
  const ice: any = {
    canvasWidth: 1000,
    canvasHeight: 700,
    toolNodes: [],
    dirty: false,
    childNodes: [],
    evtBus: { on() {}, off() {}, trigger() {} },
    addTool: (tool: any) => ice.toolNodes.push(tool),
    removeTool: (tool: any) => {
      const index = ice.toolNodes.indexOf(tool);
      if (index !== -1) ice.toolNodes.splice(index, 1);
    },
    screenToWorld: (x: number, y: number) => [x, y],
    getRenderViewport: () => ({ scale: 1, tx: 0, ty: 0 }),
    setFocusedComponent: () => {},
    getFocusedComponent: () => null,
  };
  return ice;
}

const open = (props: any = {}) => openDrawer(makeICE(), { title: '订单详情', content: '正文', ...props });

describe('ICEDrawer 插槽', () => {
  it('没传 extra / footer 时是 null（老行为）', () => {
    const drawer = open();
    expect(drawer.getExtraNode()).toBe(null);
    expect(drawer.getFooterNode()).toBe(null);
    const box = drawer.getContentBox();
    expect(box.top).toBe(48);
    expect(box.height).toBe(700 - 48 - 16);
  });

  it('extra 摆在关闭按钮左边，并在标题栏高度内', () => {
    const extra = new ICEButton({ width: 88, height: 28, text: '导出', size: 'small' });
    const drawer = open({ width: 400, extra });
    expect(drawer.getExtraNode()).toBe(extra);
    expect(extra.state.left + 88).toBe(400 - 56); // 关闭按钮占右侧 48 + 8 间距
    expect(extra.state.top).toBe(Math.round((48 - 28) / 2));
  });

  it('没关按钮时 extra 靠右 20px', () => {
    const extra = new ICEButton({ width: 60, height: 28, text: '导出', size: 'small' });
    const drawer = open({ closable: false, width: 400, extra });
    expect(extra.state.left + 60).toBe(400 - 20);
    expect(drawer.getCloseButton()).toBe(null);
  });

  it('footer 贴底铺满，内容区让出它的高度', () => {
    const footer = new ICEButton({ width: 96, height: 32, text: '确认', variant: 'primary' });
    const drawer = open({ footer, footerHeight: 56 });
    expect(drawer.getFooterNode()).toBe(footer);
    const bar = drawer.getPanel()!.childNodes.find((node: any) => node instanceof ICEPanel && node.state.top === 700 - 56);
    expect(bar).toBeTruthy();
    expect(Number(bar!.state.width)).toBe(360); // 默认宽度
    expect(footer.state.left).toBe(20);
    const box = drawer.getContentBox();
    expect(box.height).toBe(700 - 48 - 56 - 16);
  });

  it('extra / footer 支持工厂函数（延迟到打开时才建）', () => {
    let extraBuilt = 0;
    const drawer = open({
      extra: () => {
        extraBuilt += 1;
        return new ICEButton({ width: 60, height: 28, text: '导出', size: 'small' });
      },
    });
    expect(extraBuilt).toBe(1);
    expect(drawer.getExtraNode()).toBeTruthy();
  });
});
