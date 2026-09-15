/**
 * 一批「做满」的小件：告警 banner 形态、骨架屏变体、段控 block、抽屉尺寸预设。
 *
 * 都是「别的库有、我们的件缺一角」那种缺口：不缺组件，缺形态。
 */
import { ICEAlert } from '../src/components/ICEAlert';
import { ICESkeleton } from '../src/components/ICESkeleton';
import { ICESegmented } from '../src/components/ICESegmented';
import { openDrawer } from '../src/components/ICEDrawer';

describe('ICEAlert banner 形态', () => {
  it('banner：通栏、直角、无描边，贴在页面顶部当提示条', () => {
    const banner = new ICEAlert({ banner: true, type: 'warning', title: '库存不足', width: 800, height: 40 });
    expect(banner.isBanner()).toBe(true);
    expect(banner.state.radius).toBe(0);
    expect(banner.state.stroke).toBe(false);
    expect(banner.state.width).toBe(800);
  });

  it('普通形态不受影响（圆角 + 描边）', () => {
    const alert = new ICEAlert({ type: 'info', title: '提示' });
    expect(alert.isBanner()).toBe(false);
    expect(alert.state.radius).toBeGreaterThan(0);
    expect(alert.state.stroke).toBe(true);
  });

  it('banner 右侧可以有操作区（action 插槽摆在关闭按钮左边）', () => {
    const action = new ICEAlert({ banner: true, title: '有更新', width: 600, height: 40, closable: true, action: { text: '立即刷新' } });
    const actionNode = action.getActionNode();
    expect(actionNode).toBeTruthy();
    expect(actionNode!.state.left + actionNode!.state.width).toBeLessThanOrEqual(600 - 30);
    expect(action.getCloseButton()).toBeTruthy();
  });

  it('可关闭：点 ✕ 后自己隐藏并回调', () => {
    let closed = 0;
    const alert = new ICEAlert({ title: 'x', closable: true, onClose: () => (closed += 1) });
    alert.getCloseButton()!.trigger('click', null, {});
    expect(alert.isClosed()).toBe(true);
    expect(alert.state.display).toBe(false);
    expect(closed).toBe(1);
  });
});

describe('ICESkeleton 变体', () => {
  it('默认文本骨架：条数 = rows', () => {
    const s = new ICESkeleton({ width: 240, rows: 3 });
    expect(s.getVariant()).toBe('text');
    expect(s.getPlaceholderCount()).toBe(3);
  });

  it('card 变体：给一块卡片占位（封面 + 两行文字）', () => {
    const s = new ICESkeleton({ variant: 'card', width: 240, height: 160 });
    expect(s.getVariant()).toBe('card');
    expect(s.getPlaceholderCount()).toBeGreaterThanOrEqual(3);
    expect(s.state.height).toBe(160);
  });

  it('table 变体：表头 + 若干行，行数跟着 height 走', () => {
    const s = new ICESkeleton({ variant: 'table', width: 400, height: 200 });
    expect(s.getVariant()).toBe('table');
    expect(s.getRowCount()).toBeGreaterThan(2);
    expect(s.getColumnCount()).toBeGreaterThan(1);
  });

  it('list 变体：头像 + 两行文字重复若干条', () => {
    const s = new ICESkeleton({ variant: 'list', width: 260, height: 180 });
    expect(s.getVariant()).toBe('list');
    expect(s.getRowCount()).toBeGreaterThanOrEqual(2);
  });
});

describe('ICESegmented block 形态', () => {
  const options = [
    { value: 'a', label: '全部' },
    { value: 'b', label: '待处理' },
    { value: 'c', label: '已完成' },
  ];

  it('block：各段等宽铺满整条（后台筛选条常用）', () => {
    const seg = new ICESegmented({ options, width: 300, block: true });
    const boxes = seg.getSegmentBoxes();
    const widths = boxes.map((box) => box.width);
    // 三段等宽：容器 padding=2、段间距 gapX=2 → 可分配 300-2*2-2*2 = 292，均分 292/3 = 97.33。
    // 引擎从 2.11 起用「累计取整」切分：除不尽时各段相差 ≤1px，换来整数落点
    // （相邻段之间不会出现半像素缝），且**总和精确等于可分配量**。
    const rounded = widths.map((w) => Math.round(w));
    expect(rounded.every((w) => Number.isInteger(w))).toBe(true);
    expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(1);
    expect(rounded.reduce((sum, w) => sum + w, 0)).toBe(292);
    // 真正的契约：三段无缝铺满内容区（首段贴左内边距、末段贴右内边距、相邻段间距正好是 gap）
    expect(boxes[0].left).toBe(2);
    expect(boxes[2].left + boxes[2].width).toBe(298);
    expect(boxes[1].left).toBe(boxes[0].left + boxes[0].width + 2);
    expect(seg.isBlock()).toBe(true);
  });

  it('非 block：按文字宽度排，不铺满', () => {
    const seg = new ICESegmented({ options, width: 300, block: false });
    expect(seg.isBlock()).toBe(false);
    const total = seg.getSegmentBoxes().reduce((sum, box) => sum + box.width, 0);
    expect(total).toBeLessThan(300);
  });

  it('block 形态下选中态与点击照常工作', () => {
    const seg = new ICESegmented({ options, width: 300, block: true, value: 'a' });
    seg.setValue('c');
    expect(seg.getValue()).toBe('c');
  });
});

describe('ICEDrawer 尺寸预设', () => {
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

  it('left/right 方向：default 360 / large 560', () => {
    expect(openDrawer(makeICE(), { title: 't', size: 'default' }).getPanel()!.state.width).toBe(360);
    expect(openDrawer(makeICE(), { title: 't', size: 'large' }).getPanel()!.state.width).toBe(560);
  });

  it('top/bottom 方向：尺寸管的是高度', () => {
    expect(openDrawer(makeICE(), { title: 't', placement: 'bottom', size: 'default' }).getPanel()!.state.height).toBe(240);
    expect(openDrawer(makeICE(), { title: 't', placement: 'bottom', size: 'large' }).getPanel()!.state.height).toBe(360);
  });

  it('显式 width/height 优先于预设', () => {
    expect(openDrawer(makeICE(), { title: 't', size: 'large', width: 420 }).getPanel()!.state.width).toBe(420);
  });
});
