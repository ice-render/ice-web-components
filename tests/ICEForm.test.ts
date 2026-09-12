/**
 * 表单容器单测（ICEFormItem / ICEForm）。
 *
 * 规格：
 * - 控件实现统一取值约定（getFormValue / setFormValue），ICEForm 直接读写控件；
 * - 控件触发 'change' 时同步进模型并按 validateTrigger 校验；
 * - 校验失败：控件进入 error 状态（setValidateStatus('error')）、字段下方显示错误文案；
 *   通过后错误隐藏、状态复位；
 * - 布局：默认纵向堆叠（标签在上、控件在中、错误在下）；horizontal 时标签在左；
 * - getValues / setValues / reset / onSubmit 走模型。
 */
import { ICECheckBox } from '../src/components/ICECheckBox';
import { ICETextField } from '../src/components/ICETextField';
import { ICEForm } from '../src/components/ICEForm';
import { ICEFormItem } from '../src/components/ICEFormItem';
import { ICEFormModel } from '../src/model/ICEFormModel';

function makeForm() {
  const form = new ICEForm({ left: 0, top: 0, width: 320 });
  const nameField = new ICETextField({ left: 0, top: 0, width: 200, height: 32 });
  const agreeBox = new ICECheckBox({ left: 0, top: 0, width: 24, height: 24 });
  const nameItem = new ICEFormItem({
    name: 'name',
    label: '姓名',
    control: nameField,
    rules: [{ required: true }],
  });
  const agreeItem = new ICEFormItem({
    name: 'agree',
    label: '同意条款',
    control: agreeBox,
    rules: [{ required: true, message: '请先同意条款' }],
  });
  form.addItems([nameItem, agreeItem]);
  return { form, nameField, agreeBox, nameItem, agreeItem };
}

describe('ICEFormItem', () => {
  it('控件满足取值约定，默认无错误、错误文案隐藏', () => {
    const { nameField, nameItem } = makeForm();
    expect(typeof nameField.getFormValue).toBe('function');
    expect(typeof nameField.setFormValue).toBe('function');
    expect(nameItem.getErrorText()).toBe('');
    expect(nameItem.getControl() === nameField).toBe(true);
    expect(nameField.getValidateStatus()).toBe('default');
  });

  it('setError 显示文案并把控件切到 error 状态，清空后复位', () => {
    const { nameField, nameItem } = makeForm();
    nameItem.setError('姓名不能为空');
    expect(nameItem.getErrorText()).toBe('姓名不能为空');
    expect(nameItem.getErrorNode().state.display).toBe(true);
    expect(nameField.getValidateStatus()).toBe('error');

    nameItem.setError(null);
    expect(nameItem.getErrorText()).toBe('');
    expect(nameItem.getErrorNode().state.display).toBe(false);
    expect(nameField.getValidateStatus()).toBe('default');
  });

  it('纵向布局：标签在上、控件在中、错误文案在下', () => {
    const field = new ICETextField({ width: 200, height: 32 });
    const item = new ICEFormItem({ name: 'x', label: '标签', control: field, rules: [] });
    const label = item.getLabelNode();
    const error = item.getErrorNode();
    expect(label.state.top).toBeLessThan(field.state.top);
    expect(error.state.top).toBeGreaterThan(field.state.top);
    expect(item.state.height).toBeGreaterThanOrEqual(32 + label.state.height + error.state.height - 8);
  });

  it('横向布局：标签在左（宽度可配），控件在右', () => {
    const field = new ICETextField({ width: 200, height: 32 });
    const item = new ICEFormItem({
      name: 'x',
      label: '标签',
      control: field,
      layout: 'horizontal',
      labelWidth: 80,
    });
    expect(item.getLabelNode().state.left).toBe(0);
    expect(field.state.left).toBe(80);
  });
});

describe('ICEForm', () => {
  it('validate()：全部字段联动，失败时控件进入 error 且错误文案可见', () => {
    const { form, nameField, agreeBox, nameItem, agreeItem } = makeForm();
    expect(form.validate()).toBe(false);
    expect(nameItem.getErrorText()).toBe('姓名不能为空');
    expect(agreeItem.getErrorText()).toBe('请先同意条款');
    expect(nameField.getValidateStatus()).toBe('error');
    expect(agreeBox.getValidateStatus()).toBe('error');

    nameField.setFormValue('张三');
    agreeBox.setFormValue(true);
    expect(form.validate()).toBe(true);
    expect(nameItem.getErrorText()).toBe('');
    expect(nameField.getValidateStatus()).toBe('default');
  });

  it('控件 change 事件同步进模型（取值 / 立即校验）', () => {
    const { form, nameField, nameItem } = makeForm();
    form.validate();
    expect(nameItem.getErrorText()).toBe('姓名不能为空');

    nameField.setFormValue('李四'); // 内部会触发 change
    expect(form.getModel().getValue('name')).toBe('李四');
    expect(nameItem.getErrorText()).toBe(''); // change 触发该字段重算
  });

  it('getValues / setValues / reset 走模型并同步到控件', () => {
    const { form, nameField, agreeBox } = makeForm();
    form.setValues({ name: '王五', agree: true });
    expect(form.getValues()).toEqual({ name: '王五', agree: true });
    expect(nameField.getFormValue()).toBe('王五');
    expect(agreeBox.getFormValue()).toBe(true);

    form.reset();
    // 回到「挂载时的控件初值」：空文本框是 ''、未选中的开关是 false
    expect(form.getValues()).toEqual({ name: '', agree: false });
    expect(agreeBox.getFormValue()).toBe(false);
  });

  it('onSubmit：校验通过才回调，失败不回调', () => {
    const { form, nameField, agreeBox } = makeForm();
    const submitted: any[] = [];
    form.onSubmit((values) => submitted.push(values));

    form.submit();
    expect(submitted).toEqual([]);

    nameField.setFormValue('赵六');
    agreeBox.setFormValue(true);
    form.submit();
    expect(submitted).toEqual([{ name: '赵六', agree: true }]);
  });

  it('addItems 按纵向堆叠布局（gap 可配）', () => {
    const form = new ICEForm({ left: 0, top: 0, width: 320, gap: 10 });
    const first = new ICEFormItem({
      name: 'a',
      label: 'A',
      control: new ICETextField({ width: 200, height: 32 }),
    });
    const second = new ICEFormItem({
      name: 'b',
      label: 'B',
      control: new ICETextField({ width: 200, height: 32 }),
    });
    form.addItems([first, second]);
    expect(first.state.top).toBe(0);
    expect(second.state.top).toBe(first.state.height + 10);
  });

  it('外部传入 model 时直接复用（便于表单与业务共享状态）', () => {
    const model = new ICEFormModel();
    const form = new ICEForm({ width: 320, model });
    expect(form.getModel() === model).toBe(true);
  });
});
