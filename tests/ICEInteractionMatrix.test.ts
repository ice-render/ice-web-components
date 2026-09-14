/**
 * 交互态矩阵：把「每个可交互组件都得有的那几件事」做成跨组件回归。
 *
 * 单测通常只测某个组件的某个行为；但有几条契约是**所有**交互组件共有的，缺一个就是一致性漏洞：
 * 1. 能禁用（`setEnabled(false)` → `isEnabled()` 为假），禁用是可逆的；
 * 2. 能设无障碍名（`setAriaLabel`），且不抛；
 * 3. 表单控件能取值/赋值往返一致（`setFormValue` / `getFormValue`）—— 表单收集全靠它；
 * 4. 键盘激活入口存在（`activate`），按钮类与选项类组件都该有。
 *
 * 这份矩阵的价值在于「批量兑现」：新增一个组件时，跑一遍就知道它有没有跟上家族约定。
 */
import {
  ICEAutoComplete,
  ICEButton,
  ICEButtonModel,
  ICECheckboxGroup,
  ICEInputNumber,
  ICERadioGroup,
  ICERate,
  ICESegmented,
  ICESelect,
  ICESlider,
  ICESwitch,
  ICETextField,
} from '../src';

/** 用按钮模型兜住构造期可能依赖的宿主对象。 */
const noopModel = () => new ICEButtonModel({ label: 'x' });

/** 组件清单：工厂 + 期望的表单值样本。 */
const CASES: Array<{ name: string; make: () => any; value?: any }> = [
  { name: 'ICEButton', make: () => new ICEButton({ text: 'Go', model: noopModel() }) },
  { name: 'ICETextField', make: () => new ICETextField({ width: 200 }), value: '中文 abc' },
  { name: 'ICEInputNumber', make: () => new ICEInputNumber({ width: 120 }), value: 42 },
  { name: 'ICESelect', make: () => new ICESelect({ width: 200, options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] }), value: 'b' },
  { name: 'ICEAutoComplete', make: () => new ICEAutoComplete({ width: 200, options: ['Ava', 'Liam'] }), value: 'Ava' },
  { name: 'ICESwitch', make: () => new ICESwitch({}), value: true },
  { name: 'ICESlider', make: () => new ICESlider({ width: 200, min: 0, max: 100 }), value: 30 },
  { name: 'ICESegmented', make: () => new ICESegmented({ width: 240, options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] }), value: 'b' },
  { name: 'ICERate', make: () => new ICERate({ count: 5 }), value: 4 },
  { name: 'ICERadioGroup', make: () => new ICERadioGroup({ width: 200, options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] }), value: 'a' },
  { name: 'ICECheckboxGroup', make: () => new ICECheckboxGroup({ width: 200, options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] }), value: ['a'] },
];

describe('交互态矩阵：所有交互组件的共有契约', () => {
  CASES.forEach(({ name, make }) => {
    it(`${name}：能禁用、能设无障碍名、有键盘激活入口`, () => {
      const node = make();
      expect({ node: name, enabledByDefault: node.isEnabled() }).toEqual({ node: name, enabledByDefault: true });
      node.setEnabled(false);
      expect({ node: name, disabled: node.isEnabled() }).toEqual({ node: name, disabled: false });
      node.setEnabled(true);
      expect({ node: name, reEnabled: node.isEnabled() }).toEqual({ node: name, reEnabled: true });

      expect(() => node.setAriaLabel(`${name} 的可读名称`)).not.toThrow();
      if (typeof node.getAriaLabel === 'function') {
        expect(node.getAriaLabel()).toContain(name);
      }
      expect(typeof node.activate).toBe('function');
    });
  });

  CASES.filter((item) => item.value !== undefined).forEach(({ name, make, value }) => {
    it(`${name}：表单取值/赋值往返一致（表单收集靠它）`, () => {
      const node = make();
      expect(typeof node.setFormValue).toBe('function');
      expect(typeof node.getFormValue).toBe('function');
      node.setFormValue(value);
      expect(node.getFormValue()).toEqual(value);
    });
  });
});
