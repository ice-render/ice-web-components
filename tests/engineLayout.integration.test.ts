/**
 * 引擎布局 × 组件内部几何（2026-09-15 回归）。
 *
 * 背景：引擎的 `setLayout()` 以前会把策略**递归传播**给所有后代容器（子容器默认继承父层布局），
 * 而本库每个组件都是 `ICEGroup` 子类、内部零件（按钮文字、输入框前后缀 / 清除按钮）都在同一个
 * `childNodes` 里 —— 于是「给面板设个布局」等于把整个界面的内部零件按同一策略重摆一遍。
 * 实测 `ICETextField(prefix, allowClear)` 的文本 `12 → 0`、清除按钮 `(170,6) → (316,0)`。
 *
 * 引擎已改为对齐 Swing 的 `Container.setLayout`（布局不继承：父布局只给子容器摆位置），
 * 本用例守住这条链路：**父容器挂布局，子组件内部几何必须原样不动**。
 */
import { ICEBoxLayout, ICEFlowLayout } from 'ice-render';
import { ICEButton, ICEPanel, ICESpace, ICETextField } from '../src';

function partsOf(node: any): string {
  return (node.childNodes || []).map((c: any) => `${c.state.left},${c.state.top}`).join('|');
}

describe('引擎布局不再穿透组件内部', () => {
  it('父面板挂 BoxLayout 后，输入框的前后缀 / 清除按钮仍停在原位', () => {
    const panel = new ICEPanel({ width: 420, height: 120 });
    panel.setLayout(new ICEBoxLayout({ axis: 'x', gap: 10 }));
    const field = new ICETextField({ value: 'abc', width: 200, height: 32, prefix: '￥', allowClear: true });
    panel.addChild(field);

    const before = partsOf(field);
    // 组件内部改值 / 改状态都会走 revalidate() → requestLayout()：以前这一步会带上父层策略
    field.revalidate();
    (field as any).doLayout();

    expect(partsOf(field)).toBe(before);
  });

  it('子容器不继承父层布局，仍按自己那套规则排子项', () => {
    const panel = new ICEPanel({ width: 400, height: 200 });
    panel.setLayout(new ICEFlowLayout({ gap: 10 }));
    const space = new ICESpace({ direction: 'horizontal', size: 8 });
    space.addItem(new ICEButton({ text: 'A', width: 60, height: 28 }));
    const b = new ICEButton({ text: 'B', width: 60, height: 28 });
    space.addItem(b);
    panel.addChild(space);

    expect((space as any).layoutManager).toBe(null); // 不继承
    expect(b.state.left).toBe(68); // ICESpace 自己的规则：60 + size8
  });

  it('容器自己要排布时显式 setLayout 引擎布局，同样生效', () => {
    const panel = new ICEPanel({ width: 400, height: 120 });
    const a = new ICEButton({ text: 'A', width: 80, height: 32 });
    const b = new ICEButton({ text: 'B', width: 80, height: 32 });
    panel.addChildren([a, b]);
    panel.setLayout(new ICEBoxLayout({ axis: 'x', gap: 12 }));
    expect(a.state.left).toBe(0);
    expect(b.state.left).toBe(92);
  });
});
