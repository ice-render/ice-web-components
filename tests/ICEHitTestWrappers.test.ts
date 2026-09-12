/**
 * 布局容器不参与命中检测（回归）。
 *
 * 背景：`ICEFormItem` / `ICEForm` / `ICESpace` / `ICEGrid` 这些「纯布局」组件默认 `interactive: true`，
 * 又比内部控件**后创建**（zIndex 更高），命中检测会先撞上容器 → 焦点管理器拿不到真正的控件
 * （表现：点表单里的输入框没有焦点环、拖 Slider 手柄反而框住整块）。
 *
 * 这里把「布局容器必须 interactive:false」钉死；真正需要交互的组件（表格、菜单、标签页、
 * 折叠面板…）不受影响。
 */
import { ICEForm } from '../src/components/ICEForm';
import { ICEFormItem } from '../src/components/ICEFormItem';
import { ICEGrid, ICEGridCol } from '../src/components/ICEGrid';
import { ICESpace } from '../src/components/ICESpace';
import { ICESplitter } from '../src/components/ICESplitter';
import { ICETextField } from '../src/components/ICETextField';

describe('布局容器不参与命中', () => {
  it('ICEFormItem / ICEForm：interactive 为 false，内部控件仍然可聚焦', () => {
    const field = new ICETextField({ width: 200, height: 32 });
    const item = new ICEFormItem({ name: 'name', label: '名称', control: field });
    const form = new ICEForm({ width: 260 });
    form.addItems([item]);
    expect(item.state.interactive).toBe(false);
    expect(form.state.interactive).toBe(false);
    expect(field.isFocusable()).toBe(true);
  });

  it('ICESpace / ICEGrid / ICEGridCol / ICESplitter：都是纯布局，不参与命中', () => {
    expect(new ICESpace({ width: 200 }).state.interactive).toBe(false);
    expect(new ICEGrid({ width: 200 }).state.interactive).toBe(false);
    expect(new ICEGridCol({ span: 12 }).state.interactive).toBe(false);
    expect(new ICESplitter({ width: 200, height: 100 }).state.interactive).toBe(false);
  });
});
