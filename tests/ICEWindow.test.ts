/**
 * ICEWindow 规格（通用窗口外壳，XP / 经典桌面场景的底座）：
 * - 结构：标题栏（图标 + 标题 + 最小化/最大化/关闭）+ 客户端内容区 + 右下角缩放手柄；
 * - 拖动：按住标题栏移动窗口；点在标题栏按钮上不触发拖动；
 * - 焦点态：active 与非 active 的标题栏配色不同；点击窗口任意位置会 activate 并广播 `activate`；
 * - 最大化 / 还原：记住还原前的盒子，按 bounds 铺满；最小化触发回调（由外部决定怎么藏）；
 * - 关闭触发 `close` 事件与 onClose；
 * - 缩放：拖右下角手柄改尺寸，受 min 限制；`setContent` 把内容装进客户端区域。
 */
import { ICELabel } from '../src/components/ICELabel';
import { ICEWindow } from '../src/components/ICEWindow';

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

const makeWindow = (extra: any = {}) =>
  new ICEWindow({
    left: 100,
    top: 80,
    width: 400,
    height: 300,
    title: '我的电脑',
    icon: '🖥',
    bounds: { left: 0, top: 0, width: 1024, height: 768 },
    ...extra,
  });

describe('ICEWindow', () => {
  it('构造期画好标题栏与三个按钮，客户端区域在标题栏下方', () => {
    const win = makeWindow();
    expect(win.getTitle()).toBe('我的电脑');
    expect(win.getTitleBar()).toBeTruthy();
    expect(win.getCloseButton()).toBeTruthy();
    expect(win.getMinimizeButton()).toBeTruthy();
    expect(win.getMaximizeButton()).toBeTruthy();
    const client = win.getClientBox();
    // 客户端区域在 3px 窗体外框之内：top = 3 + 标题栏高，宽 = 窗口宽 - 6
    expect(client.top).toBe(win.getTitleBarHeight() + 3);
    expect(client.height).toBe(300 - win.getTitleBarHeight() - 6);
    expect(client.width).toBe(400 - 6);
  });

  it('setContent：内容装进客户端区域并铺满', () => {
    const win = makeWindow();
    const label = new ICELabel({ text: '内容' });
    win.setContent(label);
    expect(win.getContent()).toBe(label);
    expect(label.state.left).toBe(0);
    expect(label.state.top).toBe(0);
    expect(label.state.width).toBe(400 - 6);
  });

  it('active 状态切换标题栏配色；点击窗口会 activate 并广播事件', () => {
    const win = makeWindow({ active: false });
    const inactiveColor = win.getTitleBarColor();
    const events: any[] = [];
    win.on('activate', () => events.push(true));
    win.setState({}); // no-op，保持接口健壮
    win.activate();
    expect(win.isActive()).toBe(true);
    expect(win.getTitleBarColor()).not.toBe(inactiveColor);
    expect(events).toHaveLength(1);
    win.setActive(false);
    expect(win.isActive()).toBe(false);
    expect(win.getTitleBarColor()).toBe(inactiveColor);
  });

  it('关闭 / 最小化 / 最大化回调', () => {
    let closed = 0;
    let minimized = 0;
    const sizes: boolean[] = [];
    const win = makeWindow({
      onClose: () => (closed += 1),
      onMinimize: () => (minimized += 1),
      onMaximize: (maximized: boolean) => sizes.push(maximized),
    });
    const closeEvents: any[] = [];
    win.on('close', () => closeEvents.push(true));
    win.getCloseButton()!.trigger('click', null, {});
    win.getMinimizeButton()!.trigger('click', null, {});
    expect(closed).toBe(1);
    expect(minimized).toBe(1);
    expect(closeEvents).toHaveLength(1);

    win.maximize();
    expect(win.isMaximized()).toBe(true);
    expect([win.state.left, win.state.top, win.state.width, win.state.height]).toEqual([0, 0, 1024, 768]);
    win.restore();
    expect(win.isMaximized()).toBe(false);
    expect([win.state.left, win.state.top, win.state.width, win.state.height]).toEqual([100, 80, 400, 300]);
    expect(sizes).toEqual([true, false]);
  });

  it('拖标题栏移动窗口；点在按钮上不移动；不能拖出 bounds', () => {
    const { ice } = setupIce();
    const win = makeWindow();
    (win as any).ice = ice;
    (win as any).afterAddHandler();

    ice.evtBus.trigger('mousedown', { offsetX: 200, offsetY: 90 }); // 标题栏
    ice.evtBus.trigger('mousemove', { offsetX: 260, offsetY: 140 });
    expect([win.state.left, win.state.top]).toEqual([160, 130]);

    // 继续拖到左上角之外：夹在 bounds 内
    ice.evtBus.trigger('mousemove', { offsetX: -500, offsetY: -500 });
    expect([win.state.left, win.state.top]).toEqual([0, 0]);
    ice.evtBus.trigger('mouseup', {});
    ice.evtBus.trigger('mousemove', { offsetX: 900, offsetY: 700 });
    expect([win.state.left, win.state.top]).toEqual([0, 0]);

    // 按钮上按下不拖动
    const close = win.getCloseButton()!;
    const box = { l: close.state.left, t: close.state.top };
    ice.evtBus.trigger('mousedown', { offsetX: 100 + box.l + 4, offsetY: 80 + box.t + 4 });
    const before = [win.state.left, win.state.top];
    ice.evtBus.trigger('mousemove', { offsetX: 400, offsetY: 400 });
    expect([win.state.left, win.state.top]).toEqual(before);
  });

  it('拖右下角手柄改尺寸，受 min 限制', () => {
    const { ice } = setupIce();
    const win = makeWindow({ minWidth: 240, minHeight: 180 });
    (win as any).ice = ice;
    (win as any).afterAddHandler();
    const handle = win.getResizeHandle()!;
    const hx = 100 + Number(handle.state.left) + 4;
    const hy = 80 + Number(handle.state.top) + 4;
    ice.evtBus.trigger('mousedown', { offsetX: hx, offsetY: hy });
    ice.evtBus.trigger('mousemove', { offsetX: hx + 60, offsetY: hy + 40 });
    expect([win.state.width, win.state.height]).toEqual([460, 340]);
    ice.evtBus.trigger('mousemove', { offsetX: -900, offsetY: -900 });
    expect([win.state.width, win.state.height]).toEqual([240, 180]);
  });

  it('setTitle / setSize 会重排标题栏与按钮', () => {
    const win = makeWindow();
    win.setTitle('回收站');
    expect(win.getTitle()).toBe('回收站');
    const closeBefore = Number(win.getCloseButton()!.state.left);
    win.setSize(600, 400);
    expect(win.state.width).toBe(600);
    expect(Number(win.getCloseButton()!.state.left)).toBeGreaterThan(closeBefore);
    expect(win.getClientBox().width).toBe(600 - 6);
  });
});
