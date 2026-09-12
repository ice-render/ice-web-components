/**
 * 表单校验模型单测（纯逻辑，不依赖 canvas）。
 *
 * 规则：required / min / max / minLength / maxLength / pattern / validator；
 * 语义：一条规则失败即停止（取第一条错误信息）；required 对 null/undefined/空串/空数组/false 都算缺失；
 * 触发：setValue 时按 validateTrigger 决定是否立刻校验该字段；校验结果变化时通知监听器。
 */
import { ICEFormModel } from '../src/model/ICEFormModel';

describe('ICEFormModel', () => {
  it('required：空值报错，填上后错误清除', () => {
    const form = new ICEFormModel();
    form.addField({ name: 'email', label: '邮箱', rules: [{ required: true }] });

    expect(form.validateField('email')).toBe('邮箱不能为空');
    form.setValue('email', 'a@b.com');
    expect(form.getError('email')).toBeNull();
    expect(form.validate()).toBe(true);
  });

  it('required 对 false / 空数组同样算缺失（开关与多选）', () => {
    const form = new ICEFormModel();
    form.addField({ name: 'agree', rules: [{ required: true, message: '请先同意条款' }] });
    expect(form.validateField('agree')).toBe('请先同意条款');
    form.setValue('agree', false);
    expect(form.validateField('agree')).toBe('请先同意条款');
    form.setValue('agree', true);
    expect(form.validateField('agree')).toBeNull();
  });

  it('min / max：数值范围', () => {
    const form = new ICEFormModel();
    form.addField({ name: 'age', label: '年龄', rules: [{ min: 18, max: 99 }] });
    form.setValue('age', 10);
    expect(form.validateField('age')).toBe('年龄不能小于 18');
    form.setValue('age', 120);
    expect(form.validateField('age')).toBe('年龄不能大于 99');
    form.setValue('age', 30);
    expect(form.validateField('age')).toBeNull();
  });

  it('minLength / maxLength / pattern', () => {
    const form = new ICEFormModel();
    form.addField({
      name: 'code',
      label: '编号',
      rules: [{ minLength: 3 }, { maxLength: 6 }, { pattern: /^[A-Z]+$/, message: '只能是大写字母' }],
    });
    form.setValue('code', 'ab');
    expect(form.validateField('code')).toBe('编号长度不能少于 3');
    form.setValue('code', 'abcdefg');
    expect(form.validateField('code')).toBe('编号长度不能超过 6');
    form.setValue('code', 'abc');
    expect(form.validateField('code')).toBe('只能是大写字母');
    form.setValue('code', 'ABC');
    expect(form.validateField('code')).toBeNull();
  });

  it('validator：自定义校验可直接拿到全部值', () => {
    const form = new ICEFormModel();
    form.addField({ name: 'password', rules: [{ required: true }] });
    form.addField({
      name: 'confirm',
      label: '确认密码',
      rules: [
        {
          validator: (value, values) => (value === values.password ? null : '两次输入不一致'),
        },
      ],
    });
    form.setValues({ password: 'x', confirm: 'y' });
    expect(form.validateField('confirm')).toBe('两次输入不一致');
    form.setValue('confirm', 'x');
    expect(form.validateField('confirm')).toBeNull();
  });

  it('validate() 校验全部字段并返回是否通过', () => {
    const form = new ICEFormModel();
    form.addField({ name: 'a', label: 'A', rules: [{ required: true }] });
    form.addField({ name: 'b', label: 'B', rules: [{ required: true }] });
    expect(form.validate()).toBe(false);
    expect(form.getErrors()).toEqual({ a: 'A不能为空', b: 'B不能为空' });
    form.setValues({ a: 1, b: 2 });
    expect(form.validate()).toBe(true);
    expect(form.getErrors()).toEqual({});
  });

  it('validateTrigger=change（默认）时改值立即重算该字段；silent 可跳过', () => {
    const form = new ICEFormModel();
    form.addField({ name: 'name', label: '名称', rules: [{ required: true }] });
    form.validate(); // 先产生错误
    expect(form.getError('name')).toBe('名称不能为空');

    form.setValue('name', 'x');
    expect(form.getError('name')).toBeNull(); // 改值即重算

    form.setValue('name', '', { silent: true });
    expect(form.getError('name')).toBeNull(); // silent 不重算
  });

  it('validateTrigger=none 时改值不校验，只手动校验', () => {
    const form = new ICEFormModel({ validateTrigger: 'none' });
    form.addField({ name: 'name', rules: [{ required: true }] });
    form.setValue('name', '');
    expect(form.getError('name')).toBeNull(); // 未校验过 → 无错误（不是 undefined）
    expect(form.validateField('name')).toBe('name不能为空');
  });

  it('监听器：值/错误变化都会通知，返回的函数可注销', () => {
    const form = new ICEFormModel();
    form.addField({ name: 'n', rules: [{ required: true }] });
    const snapshots: Array<{ values: any; errors: any }> = [];
    const off = form.addChangeListener((model) => {
      snapshots.push({ values: model.getValues(), errors: model.getErrors() });
    });

    form.validate();
    form.setValue('n', 'ok');
    expect(snapshots.length).toBe(2);
    expect(snapshots[1]).toEqual({ values: { n: 'ok' }, errors: {} });

    off();
    form.setValue('n', 'next');
    expect(snapshots.length).toBe(2);
  });

  it('reset()：回到初始值并清空错误', () => {
    const form = new ICEFormModel();
    form.addField({ name: 'city', value: '杭州', rules: [{ required: true }] });
    form.setValue('city', '');
    form.validate();
    expect(form.getError('city')).toBe('city不能为空');
    form.reset();
    expect(form.getValues()).toEqual({ city: '杭州' });
    expect(form.getErrors()).toEqual({});
  });
});
