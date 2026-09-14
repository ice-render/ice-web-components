/**
 * ICEMessage / ICENotification 单测（消息堆叠 + 自动消失）。
 *
 * 规格：
 * - 消息挂在独立的工具层容器上（不受浮层 exclusive 影响：打开弹层不会清掉消息）；
 * - 顶部居中（message）或右下角（notification，倒序堆叠）自动排布；
 * - duration 到期自动淡出并移除（fake timers 驱动）；duration=0 常驻；
 * - 每条消息返回 handle（可单独关闭）；closeAll() 清空。
 */
import { getICEMessageManager, ICEMessageManager } from '../src/core/ICEMessageManager';

function makeICE() {
  return {
    canvasWidth: 800,
    canvasHeight: 600,
    toolNodes: [] as any[],
    dirty: false,
    addTool(tool: any) {
      (this as any).toolNodes.push(tool);
    },
    removeTool(tool: any) {
      const nodes = (this as any).toolNodes as any[];
      const index = nodes.indexOf(tool);
      if (index !== -1) nodes.splice(index, 1);
    },
    evtBus: { on() {}, off() {}, trigger() {} },
  } as any;
}

function collectText(node: any): string[] {
  const out: string[] = [];
  const walk = (current: any) => {
    const text = current.state && current.state.text;
    if (typeof text === 'string' && text && out.indexOf(text) === -1) out.push(text);
    (current.childNodes || []).forEach(walk);
  };
  walk(node);
  return out;
}

describe('ICEMessageManager', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('show() 顶部居中堆叠，多条消息依次向下排', () => {
    const ice = makeICE();
    const manager = new ICEMessageManager(ice).start();
    const first = manager.show({ type: 'success', text: '已保存' });
    const second = manager.show({ type: 'info', text: '正在同步' });

    const layer = manager.getLayer()!;
    expect(layer.childNodes.length).toBe(2);
    const a = layer.childNodes[0];
    const b = layer.childNodes[1];
    expect(collectText(a)).toContain('已保存');
    expect(collectText(b)).toContain('正在同步');
    // 顶部居中：水平居中、纵向从 16 开始依次叠加
    expect(Math.round(a.state.left + a.state.width / 2)).toBe(400);
    expect(a.state.top).toBe(16);
    expect(b.state.top).toBe(16 + a.state.height + 12);

    first.close();
    second.close();
  });

  it('duration 到期自动消失；duration=0 常驻', () => {
    const ice = makeICE();
    const manager = new ICEMessageManager(ice).start();
    manager.show({ text: '三秒后消失', duration: 3000, animation: { duration: 0 } });
    manager.show({ text: '常驻消息', duration: 0 });

    jest.advanceTimersByTime(1000);
    expect(manager.getLayer()!.childNodes.length).toBe(2);
    jest.advanceTimersByTime(2500);
    expect(manager.getLayer()!.childNodes.length).toBe(1);
    expect(collectText(manager.getLayer()!.childNodes[0])).toContain('常驻消息');
    manager.closeAll();
    expect(manager.getLayer()!.childNodes.length).toBe(0);
  });

  it('notification：右下角倒序堆叠，带标题与关闭按钮', () => {
    const ice = makeICE();
    const manager = new ICEMessageManager(ice).start();
    const handle = manager.notification({ title: '部署完成', description: 'v1.4.0 已上线' });

    const layer = manager.getLayer()!;
    const node = layer.childNodes[0];
    expect(collectText(node)).toContain('部署完成');
    expect(collectText(node)).toContain('v1.4.0 已上线');
    // 右下角：右边缘留 16px、底边往上排
    expect(Math.round(node.state.left + node.state.width)).toBe(800 - 16);
    expect(Math.round(node.state.top + node.state.height)).toBe(600 - 16);
    handle.close();
    expect(layer.childNodes.length).toBe(0);
  });

  it('handle.close() 立即移除；多条消息移除后剩余项重新排布', () => {
    const ice = makeICE();
    const manager = new ICEMessageManager(ice).start();
    const first = manager.show({ text: 'A', duration: 0 });
    const second = manager.show({ text: 'B', duration: 0 });
    const layer = manager.getLayer()!;
    expect(layer.childNodes[1].state.top).toBeGreaterThan(layer.childNodes[0].state.top);

    first.close();
    expect(layer.childNodes.length).toBe(1);
    expect(layer.childNodes[0].state.top).toBe(16); // 剩下的 B 回到第一位
    second.close();
    manager.stop();
  });

  it('getICEMessageManager(ice) 按实例缓存', () => {
    const ice = makeICE();
    expect(getICEMessageManager(ice) === getICEMessageManager(ice)).toBe(true);
  });

  /**
   * 观感事故（smart-water 实测）：顶部 Message 的长中文被**横向压扁**、还溢出面板。
   *
   * 两个原因叠在一起：
   * ① 引擎把组件宽度当 `fillText(..., maxWidth)` 传下去 —— canvas 会压字形而不是截断（已在 ice-render 修掉）；
   * ② 这一层的宽度用 `text.length * 7` 粗估 —— 中文一字≈13px，估出来只有实际的一半。
   */
  describe('气泡宽度：按实测文字算，不再用「字符数 × 7」粗估', () => {
    /** 取出面板里的文案标签（左偏移 34 的那个）。 */
    const textLabelOf = (panel: any) => (panel.childNodes || []).find((c: any) => Number(c.state.left) === 34);

    it('长中文消息：宽度跟着实测长大（上限之内），不再被按 7px/字压到一半', () => {
      const ice = makeICE();
      const manager = new ICEMessageManager(ice).start();
      const text = '报警：生化池溶解氧偏低，建议提高鼓风机频率并检查曝气头堵塞情况';
      const handle = manager.show({ text, type: 'warning', duration: 0 });
      const panel = manager.getLayer()!.childNodes[0];

      // 旧算法：text.length * 7 + 48 ≈ 265
      const oldWidth = text.length * 7 + 48;
      expect(panel.state.width).toBeGreaterThan(oldWidth);
      // 上限之内（480），且文案区跟着面板走
      expect(panel.state.width).toBeLessThanOrEqual(480);
      expect(textLabelOf(panel).state.width).toBe(panel.state.width - 46);
      handle.close();
    });

    it('短消息不小于最小宽度', () => {
      const ice = makeICE();
      const manager = new ICEMessageManager(ice).start();
      const handle = manager.show({ text: '已保存', duration: 0 });
      expect(manager.getLayer()!.childNodes[0].state.width).toBe(160);
      handle.close();
    });

    it('超长消息：宽度封顶，且文案标签仍是「不压字形」的默认口径（由引擎按省略号截断）', () => {
      const ice = makeICE();
      const manager = new ICEMessageManager(ice).start();
      const handle = manager.show({ text: '很长的告警'.repeat(40), duration: 0 });
      const panel = manager.getLayer()!.childNodes[0];
      const label = textLabelOf(panel);
      expect(panel.state.width).toBe(480);
      expect(label.state.textOverflow ?? 'ellipsis').toBe('ellipsis');
      // 内层 ICEText 用同一个盒子（ICELabel 会把 width 透传下去）
      expect((label.childNodes[0] || {}).state.width).toBe(panel.state.width - 46);
      handle.close();
    });

    it('窄画布不越界：最大宽度受画布宽度约束', () => {
      const ice = makeICE();
      ice.canvasWidth = 300;
      const manager = new ICEMessageManager(ice).start();
      const handle = manager.show({ text: '很长的告警'.repeat(40), duration: 0 });
      expect(manager.getLayer()!.childNodes[0].state.width).toBe(300 - 32);
      handle.close();
    });
  });
});
