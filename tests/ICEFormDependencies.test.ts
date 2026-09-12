/**
 * 跨字段依赖重校验（业界组件库 Form 的 dependencies / shouldUpdate）。
 *
 * 场景（业务里最常见）：「确认密码」「结束日期」这类字段的合法性取决于**别的字段**。
 * 规格：
 * - `addField({ dependencies: ['other'] })`：other 变化时本字段自动重算；
 * - 依赖是反向查询：`getDependents('other')` 给出直接依赖者；
 * - 无关字段不受影响（不会全表重算）；
 * - `validateTrigger: 'none'` 时同样不自动重算（依赖重算也得关）；
 * - `setValues` 批量写入时依赖字段也会重算。
 */
import { ICEFormModel } from '../src/model/ICEFormModel';
import { ICEForm } from '../src/components/ICEForm';
import { ICEFormItem } from '../src/components/ICEFormItem';
import { ICETextField } from '../src/components/ICETextField';

function makeModel(options: any = {}) {
  const model = new ICEFormModel(options);
  model.addField({ name: 'password', label: '密码', rules: [{ required: true }] });
  model.addField({
    name: 'confirm',
    label: '确认密码',
    dependencies: ['password'],
    rules: [
      { required: true },
      {
        validator: (value: any, values: Record<string, any>) =>
          value === values.password ? null : '两次输入的密码不一致',
      },
    ],
  });
  model.addField({ name: 'nickname', label: '昵称' });
  return model;
}

describe('ICEFormModel 跨字段依赖', () => {
  it('getDependents 反向查询直接依赖者', () => {
    const model = makeModel();
    expect(model.getDependents('password')).toEqual(['confirm']);
    expect(model.getDependents('nickname')).toEqual([]);
  });

  it('被依赖字段变化时，依赖字段自动重算', () => {
    const model = makeModel();
    model.setValue('password', 'abc123');
    model.setValue('confirm', 'abc123');
    expect(model.getError('confirm')).toBeNull();

    // 改密码 → confirm 立刻变错（不用等 confirm 自己再改一次）
    model.setValue('password', 'xyz789');
    expect(model.getError('confirm')).toBe('两次输入的密码不一致');

    // 改回一致 → 错误消失
    model.setValue('password', 'abc123');
    expect(model.getError('confirm')).toBeNull();
  });

  it('无关字段变化不会触发依赖重算', () => {
    const model = makeModel();
    let notifications = 0;
    model.addChangeListener(() => (notifications += 1));
    model.setValue('password', 'a');
    model.setValue('confirm', 'b');
    const before = model.getError('confirm');
    model.setValue('nickname', 'tom');
    expect(model.getError('confirm')).toBe(before);
    expect(notifications).toBe(3);
  });

  it('validateTrigger: none 时不自动重算（包括依赖）', () => {
    const model = makeModel({ validateTrigger: 'none' });
    model.setValue('password', 'a');
    model.setValue('confirm', 'b');
    expect(model.getError('confirm')).toBeNull();
    model.validate();
    expect(model.getError('confirm')).toBe('两次输入的密码不一致');
  });

  it('setValues 批量写入时依赖字段也会重算', () => {
    const model = makeModel();
    model.setValues({ password: 'p1', confirm: 'p2' });
    expect(model.getError('confirm')).toBe('两次输入的密码不一致');
    model.setValues({ confirm: 'p1' });
    expect(model.getError('confirm')).toBeNull();
  });

  it('一个字段可以依赖多个字段（区间校验）', () => {
    const model = new ICEFormModel();
    model.addField({ name: 'start', label: '开始', rules: [{ required: true }] });
    model.addField({
      name: 'end',
      label: '结束',
      dependencies: ['start'],
      rules: [
        {
          validator: (value: any, values: Record<string, any>) =>
            Number(values.start) <= Number(value) ? null : '结束不能早于开始',
        },
      ],
    });
    model.setValue('start', 10);
    model.setValue('end', 20);
    expect(model.getError('end')).toBeNull();
    model.setValue('start', 50);
    expect(model.getError('end')).toBe('结束不能早于开始');
    model.setValue('start', 1);
    expect(model.getError('end')).toBeNull();
    expect(model.getDependents('start')).toEqual(['end']);
  });

  it('自定义 validator 在空值上也会执行（至少填一个的场景）', () => {
    const model = new ICEFormModel();
    model.addField({ name: 'phone', label: '手机' });
    model.addField({ name: 'email', label: '邮箱' });
    model.addField({
      name: 'contact',
      label: '联系方式',
      dependencies: ['phone', 'email'],
      rules: [
        {
          validator: (_value: any, values: Record<string, any>) =>
            values.phone || values.email ? null : '手机与邮箱至少填一个',
        },
      ],
    });
    model.setValue('phone', '13800000000');
    expect(model.getError('contact')).toBeNull();
    model.setValue('phone', '');
    expect(model.getError('contact')).toBe('手机与邮箱至少填一个');
  });

  it('UI 层打通：ICEFormItem 的 dependencies 透传给模型', () => {
    const form = new ICEForm({ width: 300 });
    const password = new ICETextField({ width: 200, height: 32 });
    const confirm = new ICETextField({ width: 200, height: 32 });
    form.addItems([
      new ICEFormItem({ name: 'password', label: '密码', control: password, rules: [{ required: true }] }),
      new ICEFormItem({
        name: 'confirm',
        label: '确认密码',
        control: confirm,
        dependencies: ['password'],
        rules: [
          { required: true },
          { validator: (value, values) => (value === values.password ? null : '两次输入的密码不一致') },
        ],
      }),
    ]);
    // 走真实路径：改控件值后触发 change（ICEForm 监听控件 change 写回模型）
    password.setFormValue('abc123');
    password.trigger('change', null, { value: 'abc123' });
    confirm.setFormValue('xyz');
    confirm.trigger('change', null, { value: 'xyz' });
    expect(form.getModel().getError('confirm')).toBe('两次输入的密码不一致');
    password.setFormValue('xyz');
    password.trigger('change', null, { value: 'xyz' });
    expect(form.getModel().getError('confirm')).toBeNull();
  });
});
