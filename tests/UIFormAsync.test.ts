/**
 * 表单异步校验。
 *
 * 规格：
 * - 规则里可加 `asyncValidator`，`validateFieldAsync` / `validateAsync` 显式触发；
 * - 同步规则先跑，同步就失败时短路（不发请求）；
 * - 校验中 `isValidating(name)` 为 true（用于「校验中…」提示），结束后复位；
 * - 值变化（validateTrigger: 'change'）只跑同步规则，异步校验交给显式调用；
 * - `UIForm.submitAsync()` 等异步校验通过才回调 onSubmit。
 */
import { UIFormModel } from '../src/model/UIFormModel';
import { UIForm } from '../src/components/UIForm';
import { UIFormItem } from '../src/components/UIFormItem';
import { UITextField } from '../src/components/UITextField';

function deferred() {
  let resolve!: (value: string | null | undefined) => void;
  const promise = new Promise<string | null | undefined>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('UIFormModel 异步校验', () => {
  it('异步通过：无错误、结束校验态', async () => {
    const model = new UIFormModel();
    model.addField({ name: 'nick', label: '昵称', value: 'ok', rules: [{ asyncValidator: async () => null }] });
    const error = await model.validateFieldAsync('nick');
    expect(error).toBeNull();
    expect(model.getError('nick')).toBeNull();
    expect(model.isValidating('nick')).toBe(false);
  });

  it('异步失败：写回错误文案', async () => {
    const model = new UIFormModel();
    model.addField({
      name: 'nick',
      label: '昵称',
      value: 'taken',
      rules: [{ asyncValidator: async () => '昵称已被占用' }],
    });
    expect(await model.validateFieldAsync('nick')).toBe('昵称已被占用');
    expect(model.getError('nick')).toBe('昵称已被占用');
    expect(model.hasErrors()).toBe(true);
  });

  it('同步规则失败时短路，异步校验不执行', async () => {
    let called = 0;
    const model = new UIFormModel();
    model.addField({
      name: 'nick',
      label: '昵称',
      value: '',
      rules: [
        { required: true },
        {
          asyncValidator: async () => {
            called += 1;
            return null;
          },
        },
      ],
    });
    expect(await model.validateFieldAsync('nick')).toBe('昵称不能为空');
    expect(called).toBe(0);
  });

  it('校验过程中 isValidating 为 true，结束后复位', async () => {
    const gate = deferred();
    const model = new UIFormModel();
    model.addField({ name: 'nick', value: 'x', rules: [{ asyncValidator: () => gate.promise }] });
    const pending = model.validateFieldAsync('nick');
    expect(model.isValidating('nick')).toBe(true);
    gate.resolve('重复了');
    await pending;
    expect(model.isValidating('nick')).toBe(false);
    expect(model.getError('nick')).toBe('重复了');
  });

  it('validateAsync 校验全部字段：任一失败即 false', async () => {
    const model = new UIFormModel();
    model.addField({ name: 'a', value: '1', rules: [{ asyncValidator: async () => null }] });
    model.addField({ name: 'b', value: '1', rules: [{ asyncValidator: async () => 'b 不合法' }] });
    expect(await model.validateAsync()).toBe(false);
    expect(model.getErrors()).toEqual({ b: 'b 不合法' });

    const ok = new UIFormModel();
    ok.addField({ name: 'a', value: '1', rules: [{ asyncValidator: async () => null }] });
    expect(await ok.validateAsync()).toBe(true);
  });

  it('值变化只跑同步规则（异步校验不自动发请求）', () => {
    let called = 0;
    const model = new UIFormModel({ validateTrigger: 'change' });
    model.addField({
      name: 'nick',
      label: '昵称',
      value: 'old',
      rules: [
        { required: true },
        {
          asyncValidator: async () => {
            called += 1;
            return null;
          },
        },
      ],
    });
    model.setValue('nick', 'new');
    expect(called).toBe(0);
    expect(model.getError('nick')).toBeNull();
    model.setValue('nick', '');
    expect(model.getError('nick')).toBe('昵称不能为空');
  });
});

describe('UIForm 异步提交', () => {
  it('异步校验不过不回调 onSubmit；通过才回调', async () => {
    const submitted: Array<Record<string, any>> = [];
    const form = new UIForm({ width: 320 });
    const item = new UIFormItem({
      name: 'nick',
      label: '昵称',
      control: new UITextField({ value: 'x', width: 200 }),
    });
    form.addItem(item);
    const gate = deferred();
    form.getModel().getField('nick')!.rules.push({ asyncValidator: () => gate.promise });
    form.onSubmit((values) => submitted.push(values));

    const pending = form.submitAsync();
    // 校验期间表单项进入「校验中…」态
    expect(item.isValidating()).toBe(true);
    expect(item.getErrorText()).toBe('校验中…');

    gate.resolve('已占用');
    expect(await pending).toBe(false);
    expect(submitted.length).toBe(0);
    expect(item.isValidating()).toBe(false);
    expect(item.getErrorText()).toBe('已占用');
    expect(form.getModel().getError('nick')).toBe('已占用');

    form.getModel().getField('nick')!.rules.pop();
    expect(await form.submitAsync()).toBe(true);
    expect(submitted.length).toBe(1);
    expect(submitted[0].nick).toBe('x');
  });
});
