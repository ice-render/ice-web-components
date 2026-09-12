/**
 * 展示/反馈批次三：ICESpin / ICERate / ICESteps / ICEResult。
 */
import { ICEResult } from '../src/components/ICEResult';
import { ICERate } from '../src/components/ICERate';
import { ICESpin } from '../src/components/ICESpin';
import { ICESteps } from '../src/components/ICESteps';

function textsOf(node: any): string[] {
  const out: string[] = [];
  const walk = (current: any) => {
    const text = current.state && current.state.text;
    if (typeof text === 'string' && text && out.indexOf(text) === -1) out.push(text);
    (current.childNodes || []).forEach(walk);
  };
  walk(node);
  return out;
}

describe('ICESpin', () => {
  it('渲染旋转弧线，可选提示文字', () => {
    const spin = new ICESpin({ size: 32, tip: '加载中…' });
    expect(spin.getArcNode().state.width).toBe(32); // 弧线是 size×size；外层宽度还会加上 tip
    expect(spin.state.height).toBe(32);
    expect(textsOf(spin)).toContain('加载中…');
    expect(spin.getArcNode()).toBeTruthy();
  });

  it('spinning=false 时不注册旋转动画', () => {
    const paused = new ICESpin({ size: 24, spinning: false });
    expect(paused.isSpinning()).toBe(false);
    const running = new ICESpin({ size: 24 });
    expect(running.isSpinning()).toBe(true);
    running.setSpinning(false);
    expect(running.isSpinning()).toBe(false);
  });
});

describe('ICERate', () => {
  it('渲染 N 颗星、点击设置分值并回调', () => {
    const changes: number[] = [];
    const rate = new ICERate({ count: 5, value: 3, onChange: (value) => changes.push(value) });
    expect(rate.getStarNodes().length).toBe(5);
    expect(rate.getValue()).toBe(3);

    // 点击由组件自身处理（星节点不各自监听点击，避免 hover 重绘后丢点击）
    (rate as any).__onClick({ offsetX: 28 * 4 + 5 });
    expect(rate.getValue()).toBe(5);
    expect(changes).toEqual([5]);
  });

  it('键盘 ←/→ 调整分值；disabled 不响应', () => {
    const rate = new ICERate({ count: 5, value: 2 });
    (rate as any).ice = { evtBus: { on() {}, off() {}, trigger() {} }, dirty: false };
    rate.setFocused(true);
    const press = (key: string) => (rate as any).__onKeyDown({ key });
    press('ArrowRight');
    expect(rate.getValue()).toBe(3);
    press('ArrowLeft');
    press('ArrowLeft');
    expect(rate.getValue()).toBe(1);

    const disabled = new ICERate({ count: 5, value: 2, disabled: true });
    (disabled as any).__onClick({ offsetX: 28 * 4 + 5 });
    expect(disabled.getValue()).toBe(2);
  });

  it('悬停预览：指针在哪颗星上就预览到哪（不改 value）', () => {
    const rate = new ICERate({ count: 5, value: 1 });
    const ice: any = { evtBus: { on() {}, off() {}, trigger() {} }, dirty: false, screenToWorld: (x: number, y: number) => [x, y] };
    (rate as any).ice = ice;
    (rate as any).afterAddHandler();
    // 第 4 颗星覆盖 x ∈ [3*28, 4*28)（间距 4）
    (rate as any).__onMouseMove({ offsetX: 5 + 28 * 3, offsetY: 5 });
    expect(rate.getPreviewValue()).toBe(4);
    expect(rate.getValue()).toBe(1);
    (rate as any).__onMouseLeave();
    expect(rate.getPreviewValue()).toBe(0);
  });
});

describe('ICESteps', () => {
  const items = [{ title: '填写信息' }, { title: '确认订单', description: '核对商品' }, { title: '完成' }];

  it('渲染标题与序号，当前步骤高亮', () => {
    const steps = new ICESteps({ width: 400, items, current: 1 });
    const texts = textsOf(steps);
    expect(texts).toContain('填写信息');
    expect(texts).toContain('确认订单');
    expect(texts).toContain('完成');
    expect(texts).toContain('✓'); // 已完成的步骤显示对勾
    expect(steps.getCurrent()).toBe(1);
    expect(String(steps.getStepNode(1)!.state.style.fillStyle)).toMatch(/^#/);
  });

  it('setCurrent 夹取范围并更新节点状态', () => {
    const steps = new ICESteps({ width: 400, items, current: 0 });
    steps.setCurrent(99);
    expect(steps.getCurrent()).toBe(2);
    steps.setCurrent(-1);
    expect(steps.getCurrent()).toBe(0);
  });
});

describe('ICEResult', () => {
  it('渲染状态图标、标题、副标题与操作按钮', () => {
    let clicked = 0;
    const result = new ICEResult({
      width: 320,
      height: 200,
      status: 'success',
      title: '提交成功',
      subtitle: '我们会在 1 个工作日内联系你',
      actions: [{ key: 'ok', text: '返回首页', primary: true }],
      onAction: () => clicked++,
    });
    const texts = textsOf(result);
    expect(texts).toContain('✓');
    expect(texts).toContain('提交成功');
    expect(texts).toContain('我们会在 1 个工作日内联系你');
    expect(texts).toContain('返回首页');
    result.getActionButton('ok')!.trigger('click', null, {});
    expect(clicked).toBe(1);
  });

  it('不同状态用不同图标与颜色', () => {
    const error = new ICEResult({ width: 200, height: 160, status: 'error', title: '出错了' });
    expect(textsOf(error)).toContain('✕');
    const info = new ICEResult({ width: 200, height: 160, status: 'info', title: '提示' });
    expect(textsOf(info)).toContain('ℹ');
  });
});
