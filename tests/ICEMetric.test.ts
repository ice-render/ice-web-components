/**
 * 「自定义组件」示例（docs/examples/ICEMetric.ts）的规格测试。
 *
 * 这个文件同时是「新组件该怎么测」的样板：
 * - 构造期就该画好（子节点存在、尺寸正确）；
 * - 值变化 → 文案更新 + change 事件 + onChange 回调；
 * - 键盘（↑/↓）只在聚焦时生效，且组件被移出场景后不崩；
 * - 表单取值 / 校验态；禁用时忽略交互。
 */
import { ICEMetric } from '../docs/examples/ICEMetric';

function makeIce() {
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
  };
  return { ice, handlers };
}

describe('ICEMetric（自定义组件示例）', () => {
  it('构造期就画好：标题 / 数值 / 提示都在，且保留了调用方的 id', () => {
    const metric = new ICEMetric({ id: 'metric-a', label: 'Token 用量', value: 12, unit: 'k' });
    expect(metric.state.id).toBe('metric-a');
    expect(metric.state.width).toBe(200);
    expect(metric.state.height).toBe(88);
    expect(metric.getValueNode()!.getText()).toBe('12 k');
    const texts = metric.childNodes.map((node: any) => node.state.text).filter(Boolean);
    expect(texts).toContain('Token 用量');
    expect(texts.some((text: string) => String(text).includes('↑/↓'))).toBe(true);
  });

  it('点击整块 +1（内部节点不抢点击），并触发 change 与 onChange', () => {
    const changes: number[] = [];
    const metric = new ICEMetric({ label: '订单', value: 0, onChange: (v) => changes.push(v) });
    const events: any[] = [];
    metric.on('change', (evt: any) => events.push(evt && evt.param));

    metric.trigger('click', null, {});
    expect(metric.getValue()).toBe(1);
    expect(metric.getValueNode()!.getText()).toBe('1');
    expect(changes).toEqual([1]);
    expect(events.length).toBe(1);
  });

  it('min/max 夹取；到达边界后不再回调', () => {
    const changes: number[] = [];
    const metric = new ICEMetric({ label: 'X', value: 4, min: 0, max: 5, onChange: (v) => changes.push(v) });
    metric.trigger('click', null, {});   // 5
    metric.trigger('click', null, {});   // 已经是 max，值不变 → 不回调
    expect(metric.getValue()).toBe(5);
    expect(changes).toEqual([5]);
  });

  it('键盘 ↑/↓：只在聚焦时生效，且组件被移出场景后不崩', () => {
    const { ice } = makeIce();
    const metric = new ICEMetric({ label: 'X', value: 10, step: 5 });
    (metric as any).ice = ice;
    (metric as any).afterAddHandler();

    ice.evtBus.trigger('keydown', { key: 'ArrowUp' });      // 未聚焦 → 忽略
    expect(metric.getValue()).toBe(10);

    metric.setFocused(true);
    ice.evtBus.trigger('keydown', { key: 'ArrowUp' });
    ice.evtBus.trigger('keydown', { key: 'ArrowDown' });
    expect(metric.getValue()).toBe(10);
    ice.evtBus.trigger('keydown', { key: 'ArrowUp' });
    ice.evtBus.trigger('keydown', { key: 'ArrowUp' });
    expect(metric.getValue()).toBe(20);

    metric.setFocused(false);
    (metric as any).ice = null;                             // 模拟被移出场景
    expect(() => ice.evtBus.trigger('keydown', { key: 'ArrowUp' })).not.toThrow();
  });

  it('表单取值 / 校验态 / 禁用态', () => {
    const metric = new ICEMetric({ label: 'X', value: 3 });
    expect(metric.getFormValue()).toBe(3);
    metric.setFormValue(7);
    expect(metric.getValue()).toBe(7);

    metric.setValidateStatus('error');
    expect(metric.getValidateStatus()).toBe('error');
    expect(metric.state.style.strokeStyle).toBe('#dc3545');

    metric.setEnabled(false);
    metric.trigger('click', null, {});
    expect(metric.getValue()).toBe(7);        // 禁用后点击无效
    expect(metric.isFocusable()).toBe(false);
  });
});
