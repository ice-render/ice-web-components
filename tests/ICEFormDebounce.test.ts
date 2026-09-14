/**
 * ICEForm 的 `validateDebounce`：改值先写模型，校验延后一会儿再跑。
 *
 * 为什么需要：每敲一个字符就弹「格式不正确」是最讨嫌的交互之一 —— 用户还没输完就被判错。
 * 规格：
 * - 值**立刻**写进模型（`getValues()` 拿到的是最新的），但错误提示延后 `validateDebounce` 毫秒才更新；
 * - 防抖期间连续改值只跑最后一次校验（不是每个字符一次）；
 * - `validate()` / `submit()` 仍然立刻校验（不能因为防抖把提交也推迟）；
 * - 不传 `validateDebounce` 时行为与以前完全一致（即时校验）。
 */
import { ICEForm } from '../src/components/ICEForm';
import { ICEFormItem } from '../src/components/ICEFormItem';
import { ICETextField } from '../src/components/ICETextField';

function setup(props: any = {}) {
  const form = new ICEForm({ width: 320, ...props });
  const field = new ICETextField({ width: 240, height: 32, placeholder: '邮箱' });
  const item = new ICEFormItem({
    name: 'email',
    label: '邮箱',
    control: field,
    rules: [{ pattern: /^[^@]+@[^@]+$/, message: '邮箱格式不正确' }],
  });
  form.addItem(item);
  return { form, field, item };
}

describe('ICEForm validateDebounce', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('不传 validateDebounce：改值当场校验（老行为不变）', () => {
    const { form, field, item } = setup();
    field.setValue('not-an-email');
    expect(item.getErrorText()).toBe('邮箱格式不正确');
    expect(form.validate()).toBe(false);
  });

  it('防抖期间错误提示先不更新，到点才出现', () => {
    jest.useFakeTimers();
    const { form, field, item } = setup({ validateDebounce: 300 });
    field.setValue('not-an-email');
    expect(form.getValues().email).toBe('not-an-email'); // 值立刻写进去了
    expect(item.getErrorText()).toBe('');
    jest.advanceTimersByTime(299);
    expect(item.getErrorText()).toBe('');
    jest.advanceTimersByTime(1);
    expect(item.getErrorText()).toBe('邮箱格式不正确');
  });

  it('连续改值只跑最后一次（不是每个字符一次）', () => {
    jest.useFakeTimers();
    const seen: string[] = [];
    const { form, field, item } = setup({ validateDebounce: 200 });
    form.getModel().addChangeListener(() => seen.push(String(form.getValues().email)));
    field.setValue('a');
    jest.advanceTimersByTime(100);
    field.setValue('ab');
    jest.advanceTimersByTime(100);
    field.setValue('a@b.com');
    jest.advanceTimersByTime(200);
    expect(item.getErrorText()).toBe('');
    expect(seen.length).toBeLessThanOrEqual(2);
  });

  it('validate() / submit() 不受防抖影响，立刻给结果', () => {
    jest.useFakeTimers();
    let submitted = 0;
    const { form, field } = setup({ validateDebounce: 300 });
    form.onSubmit(() => {
      submitted += 1;
    });
    field.setValue('bad');
    expect(form.validate()).toBe(false); // 还没到防抖时间，手动校验也要立刻出结果
    expect(form.submit()).toBe(false);
    expect(submitted).toBe(0);
  });

  it('防抖到点后通过校验会清掉旧错误', () => {
    jest.useFakeTimers();
    const { field, item } = setup({ validateDebounce: 200 });
    field.setValue('bad');
    jest.advanceTimersByTime(200);
    expect(item.getErrorText()).toBe('邮箱格式不正确');
    field.setValue('a@b.com');
    jest.advanceTimersByTime(200);
    expect(item.getErrorText()).toBe('');
  });
});
