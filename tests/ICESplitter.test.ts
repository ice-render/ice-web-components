/**
 * ICESplitter 规格：
 * - 两栏 + 分隔条：第一栏尺寸 = size，第二栏从 size + dividerSize 开始，两栏都铺满另一轴；
 * - size 夹取到 [min, 容器尺寸 - dividerSize - min]；
 * - 拖动分隔条改尺寸（全局 mousedown/mousemove/mouseup），mouseup 后不再跟随；
 * - 竖直方向改的是高度；
 * - setRatio / getRatio；
 * - 悬停分隔条变色。
 */
import { ICEPanel } from '../src/components/ICEPanel';
import { ICESplitter } from '../src/components/ICESplitter';
import { iceUIManager } from '../src/core/ICEManager';
import { resolvedStyleColor } from '../src/util/ICEStyle';

const theme = iceUIManager.getTheme();

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

function makeSplitter(props: any = {}) {
  const first = new ICEPanel({ width: 10, height: 10 });
  const second = new ICEPanel({ width: 10, height: 10 });
  const splitter = new ICESplitter({
    width: 400,
    height: 200,
    size: 160,
    min: 60,
    first,
    second,
    ...props,
  });
  return { splitter, first, second };
}

describe('ICESplitter', () => {
  it('横向：两栏与分隔条按 size 布局，另一轴铺满', () => {
    const { splitter, first, second } = makeSplitter();
    const divider = splitter.getDividerNode();
    expect(splitter.getSize()).toBe(160);
    expect(first.state.left).toBe(0);
    expect(first.state.width).toBe(160);
    expect(first.state.height).toBe(200);
    expect(divider.state.left).toBe(160);
    expect(second.state.left).toBe(160 + divider.state.width);
    expect(second.state.width).toBe(400 - 160 - divider.state.width);
    expect(second.state.height).toBe(200);
  });

  it('setSize 夹取到 [min, 容器 - 分隔条 - min]，并触发 resize 事件', () => {
    const { splitter } = makeSplitter();
    const sizes: number[] = [];
    splitter.on('resize', (evt: any) => sizes.push(evt.param.size));
    splitter.setSize(1000);
    expect(splitter.getSize()).toBe(400 - 6 - 60);
    splitter.setSize(10);
    expect(splitter.getSize()).toBe(60);
    expect(sizes).toEqual([400 - 6 - 60, 60]);
  });

  it('拖动分隔条改尺寸；松开后不再跟随', () => {
    const { ice } = setupIce();
    const resized: number[] = [];
    const { splitter } = makeSplitter({ onResize: (size: number) => resized.push(size) });
    (splitter as any).ice = ice;
    (splitter as any).afterAddHandler();
    ice.evtBus.trigger('mousedown', { offsetX: 163, offsetY: 50 });
    ice.evtBus.trigger('mousemove', { offsetX: 250, offsetY: 50 });
    // 分隔条中心跟随指针：第一栏 = 250 - divider/2 = 247
    expect(splitter.getSize()).toBe(247);
    ice.evtBus.trigger('mouseup', {});
    ice.evtBus.trigger('mousemove', { offsetX: 320, offsetY: 50 });
    expect(splitter.getSize()).toBe(247);
    expect(resized).toEqual([247]);
  });

  it('没按在分隔条上不启动拖动', () => {
    const { ice } = setupIce();
    const { splitter } = makeSplitter();
    (splitter as any).ice = ice;
    (splitter as any).afterAddHandler();
    ice.evtBus.trigger('mousedown', { offsetX: 40, offsetY: 50 });
    ice.evtBus.trigger('mousemove', { offsetX: 250, offsetY: 50 });
    expect(splitter.getSize()).toBe(160);
  });

  it('竖直方向改高度；setRatio / getRatio 与尺寸一致', () => {
    const { splitter, first, second } = makeSplitter({ direction: 'vertical', size: 80 });
    const divider = splitter.getDividerNode();
    expect(first.state.width).toBe(400);
    expect(first.state.height).toBe(80);
    expect(divider.state.top).toBe(80);
    expect(second.state.top).toBe(80 + divider.state.height);
    expect(second.state.height).toBe(200 - 80 - divider.state.height);
    splitter.setRatio(0.5);
    expect(splitter.getRatio()).toBeCloseTo(0.5, 5);
    expect(splitter.getSize()).toBe(100);
  });

  it('悬停分隔条变色', () => {
    const { splitter } = makeSplitter();
    const divider = splitter.getDividerNode();
    /**
     * ⚠️ 断言的是**解析后的颜色**，不是样式里存的字面量。
     *
     * 2026-09-17 起组件样式可以直接写**主题引用**（`token('ui.colors.primary')`，paint 时解析）——
     * 那是热切换与"每个 ICE 实例各自主题"的实现方式。所以"现在是什么颜色"要问
     * `resolvedStyleColor()`；直接读 `style.fillStyle` 拿到的是引用对象
     * （QA / 调试接口当初就只看到 `[object Object]`）。
     */
    const colorOf = () => resolvedStyleColor(divider, 'fillStyle');
    const before = colorOf();
    divider.setHovered(true);
    expect(colorOf()).toBe(theme.colors.primary);
    divider.setHovered(false);
    expect(colorOf()).toBe(before);
  });

  it('容器「先建后量」：拿到真实尺寸后恢复调用方要的 size，不被构造期夹取粘住', () => {
    const first = new ICEPanel({ width: 10, height: 10 });
    const second = new ICEPanel({ width: 10, height: 10 });
    // 构造时容器只有 100 宽 → 228 被夹到 min(160)
    const splitter = new ICESplitter({ width: 100, height: 100, size: 228, min: 160, first, second });
    expect(splitter.getSize()).toBe(160);
    // 真实尺寸到位（窗口/分栏给它 714×426）→ 恢复 228
    splitter.setState({ width: 714, height: 426 });
    expect(splitter.getSize()).toBe(228);
    expect(first.state.width).toBe(228);
    expect(first.state.height).toBe(426);
    expect(second.state.left).toBe(228 + 6);
    expect(second.state.width).toBe(714 - 228 - 6);
  });
});
