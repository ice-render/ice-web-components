/**
 * 回归：禁用态的勾选类控件不响应鼠标。
 *
 * 背景：`ICECheckBox` / `ICERadioButton` / `ICESwitch` 的键盘路径（`activate()`）都判了
 * `enabled`，鼠标路径（`mousedown`）却直接改模型 —— 一旦事件绕过命中检测被派发到控件上
 * （例如父容器代转发），禁用控件依然会被改动。这里锁死「禁用即不动」。
 */
import { ICECheckBox } from '../src/components/ICECheckBox';
import { ICERadioButton } from '../src/components/ICERadioButton';
import { ICESwitch } from '../src/components/ICESwitch';

describe('禁用态守卫', () => {
  it('禁用复选框：点击 / 键盘都不改值', () => {
    const box = new ICECheckBox({ selected: false });
    box.setEnabled(false);
    box.trigger('mousedown', null, {});
    expect(box.isSelected()).toBe(false);
    box.activate();
    expect(box.isSelected()).toBe(false);
  });

  it('禁用单选框：点击 / 键盘都不改值', () => {
    const radio = new ICERadioButton({ selected: false });
    radio.setEnabled(false);
    radio.trigger('mousedown', null, {});
    expect(radio.isSelected()).toBe(false);
    radio.activate();
    expect(radio.isSelected()).toBe(false);
  });

  it('禁用开关：点击不改值；重新启用后恢复响应', () => {
    const toggle = new ICESwitch({ selected: false });
    toggle.setEnabled(false);
    toggle.trigger('mousedown', null, {});
    expect(toggle.isSelected()).toBe(false);
    toggle.setEnabled(true);
    toggle.trigger('mousedown', null, {});
    expect(toggle.isSelected()).toBe(true);
  });
});
