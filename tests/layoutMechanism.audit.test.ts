/**
 * 布局机制**在跑**的审计（2026-09-15）。
 *
 * 与 `layoutConvention.test.ts`（棘轮：谁该迁）互补：这里证明"迁完的真的在生效"——
 * ① 每个已迁移容器挂着**自己的**策略（不是继承父层那份）；
 * ② 几何由引擎 `doLayout()` 产出：改尺寸 → 重排，不依赖组件自己的手写代码。
 */
import { ICEBoxLayout, ICEBorderLayout, ICEGridLayout, ICELayoutManager } from 'ice-render';
import { ICELayout } from '../src/components/ICELayout';
import { ICEForm } from '../src/components/ICEForm';
import { ICEFormItem } from '../src/components/ICEFormItem';
import { ICESpace } from '../src/components/ICESpace';
import { ICESegmented } from '../src/components/ICESegmented';
import { ICETabs } from '../src/components/ICETabs';
import { ICEScrollPane } from '../src/components/ICEScrollPane';
import { ICEPagination } from '../src/components/ICEPagination';
import { ICEPanel } from '../src/components/ICEPanel';
import { ICETextField } from '../src/components/ICETextField';
import { ICEWidget } from '../src/core/ICEWidget';

const lm = (c: any): ICELayoutManager => c.layoutManager;

describe('审计：布局机制是否真的在跑', () => {
  it('每个已迁移容器都挂着自己的策略（不是继承父层那份）', () => {
    const layout = new ICELayout({ width: 800, height: 600, content: new ICEWidget({ width: 10, height: 10 }) });
    const form = new ICEForm({ width: 320 });
    const space = new ICESpace({ direction: 'horizontal', size: 8 });
    const seg = new ICESegmented({ width: 300, options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] });
    const tabs = new ICETabs({ tabs: ['A', 'B'], width: 320, height: 34 });
    const pane = new ICEScrollPane({ width: 200, height: 100 });
    const page = new ICEPagination({ total: 100, pageSize: 10 });
    const item = new ICEFormItem({ name: 'a', label: 'A', control: new ICETextField({ width: 200, height: 32 }) });
    const names: Array<[string, any]> = [
      ['ICELayout', layout],
      ['ICEForm', form],
      ['ICESpace', space],
      ['ICESegmented', seg],
      ['ICETabs', tabs],
      ['ICEScrollPane', pane],
      ['ICEPagination', page],
      ['ICEFormItem', item],
    ];
    names.forEach(([name, node]) => {
      expect(`${name}:${lm(node) ? lm(node).constructor.name : 'null'}`).not.toBe(`${name}:null`);
    });
    // 嵌套：子容器用的是自己的策略，不是父层那份
    const panel = new ICEPanel({ width: 400, height: 200 });
    const inner = new ICEPanel({ width: 100, height: 100 });
    panel.setLayout(new ICEBoxLayout({ axis: 'x', gap: 10 }));
    panel.addChild(inner);
    expect(inner.layoutManager).not.toBe(panel.layoutManager);
  });

  it('几何由引擎 doLayout 产出（改尺寸 → 重排，不依赖组件自己的代码）', () => {
    // ① ICELayout：内容盒跟着容器尺寸走（BorderLayout center）
    const layout = new ICELayout({ width: 800, height: 600, header: new ICEWidget({ width: 10, height: 10 }), content: new ICEWidget({ width: 10, height: 10 }) });
    expect(layout.getContent().state.width).toBe(800);
    layout.setState({ width: 500 });
    layout.doLayout(); // 只调引擎的入口
    expect(layout.getContent().state.width).toBe(500);
    expect(lm(layout)).toBeInstanceOf(ICEBorderLayout);

    // ② ICEForm：表单项宽度 = 表单宽度（BoxLayout align stretch）
    const form = new ICEForm({ width: 320 });
    const item = new ICEFormItem({ name: 'a', label: 'A', control: new ICETextField({ width: 200, height: 32 }) });
    form.addItem(item);
    expect(item.state.width).toBe(320);
    form.setState({ width: 480 });
    form.doLayout();
    expect(item.state.width).toBe(480);

    // ③ ICESegmented：等宽分栏（GridLayout equal），改宽后仍等分
    const seg = new ICESegmented({ width: 300, options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }, { value: 'c', label: 'C' }] });
    const boxes = seg.getSegmentBoxes();
    expect(Math.round(boxes[0].width)).toBe(Math.round(boxes[2].width));
    expect(lm(seg)).toBeInstanceOf(ICEGridLayout);
    seg.setState({ width: 600 });
    seg.doLayout();
    const after = seg.getSegmentBoxes();
    expect(Math.round(after[0].width)).toBe(Math.round(after[2].width));
    expect(Math.round(after[0].width)).toBeGreaterThan(Math.round(boxes[0].width));

    // ④ ICETabs（贴底）：top 由策略算
    const tabs = new ICETabs({ tabs: ['A', 'B'], width: 320, height: 34, placement: 'bottom' });
    tabs.getTabBoxes().forEach((box) => expect(box.top).toBe(6));

    // ⑤ ICEScrollPane：滚动后内容盒左移 = -scrollX
    const pane = new ICEScrollPane({ width: 100, height: 60 });
    pane.setContentSize(300, 300);
    pane.setScroll(40, 0);
    const content = pane.getContent();
    void content;
    expect((pane as any).__getScrollNodes().content.state.left).toBe(-40);
  });
});
