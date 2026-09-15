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
import { ICEButton, ICEForm, ICEFormItem, ICELayout, ICEPanel, ICESpace, ICETextField, ICEWidget } from '../src';

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

  it('子容器用的是自己的策略（不是继承父层那份），按自己的规则排子项', () => {
    const panel = new ICEPanel({ width: 400, height: 200 });
    panel.setLayout(new ICEFlowLayout({ gap: 10 }));
    const space = new ICESpace({ direction: 'horizontal', size: 8 });
    space.addItem(new ICEButton({ text: 'A', width: 60, height: 28 }));
    const b = new ICEButton({ text: 'B', width: 60, height: 28 });
    space.addItem(b);
    panel.addChild(space);

    // ICESpace 自己挂引擎布局（横向 → BoxLayout），与父面板那份不是同一个实例
    expect((space as any).layoutManager).not.toBe((panel as any).layoutManager);
    expect((space as any).layoutManager.constructor.name).toBe('ICEBoxLayout');
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

/**
 * 「容器型组件真的在用引擎布局机制」：这三个容器以前各写一套手排代码，
 * 现在把排列交给引擎布局器，自己只保留组件级策略（自适应尺寸、声明区高/宽…）。
 */
describe('容器型组件的排列交给引擎布局器', () => {
  it('ICELayout → ICEBorderLayout（四区 = north/west|east/center/south）', () => {
    const layout = new ICELayout({ width: 800, height: 600, header: region(), sider: region(), content: region() });
    expect((layout as any).layoutManager.constructor.name).toBe('ICEBorderLayout');
    expect((layout as any).getHeader().state.layoutConstraint).toBe('north');
    expect((layout as any).getSider().state.layoutConstraint).toBe('west');
    expect((layout as any).getContent().state.layoutConstraint).toBe('center');
    // 侧栏收起 = display:false → 布局器跳过它，内容自动占满（不用手算剩余宽度）
    layout.setSiderVisible(false);
    expect(layout.getRegionBox('content')).toEqual({ left: 0, top: 56, width: 800, height: 544 });
  });

  it('ICEForm → ICEBoxLayout(axis y, align stretch)（纵向堆叠 + 表单项拉满宽度）', () => {
    const form = new ICEForm({ width: 320, gap: 12 });
    const item = new ICEFormItem({
      name: 'a',
      label: 'A',
      control: new ICETextField({ width: 200, height: 32 }),
    });
    form.addItem(item);
    expect((form as any).layoutManager.constructor.name).toBe('ICEBoxLayout');
    expect(item.state.left).toBe(0);
    expect(item.state.width).toBe(320); // stretch：拉满表单宽度
    expect(form.state.height).toBe(item.state.height); // 组件自己的策略：高度 = 内容高度
  });

  it('ICESpace → 按形态选引擎布局（横向 BoxLayout / 换行 FlowLayout / 纵向 BoxLayout）', () => {
    const row = new ICESpace({ direction: 'horizontal', size: 8 });
    expect((row as any).layoutManager.constructor.name).toBe('ICEBoxLayout');
    const wrapped = new ICESpace({ direction: 'horizontal', size: 8, wrap: true, width: 130 });
    expect((wrapped as any).layoutManager.constructor.name).toBe('ICEFlowLayout');
    const column = new ICESpace({ direction: 'vertical', size: 8 });
    expect((column as any).layoutManager.constructor.name).toBe('ICEBoxLayout');
    // 换方向/间距 = 重挂对应的策略（不是自己算一遍坐标）
    wrapped.setSize(4);
    expect((wrapped as any).layoutManager.constructor.name).toBe('ICEFlowLayout');
  });
});

function region(): any {
  return new ICEWidget({ width: 10, height: 10 });
}
