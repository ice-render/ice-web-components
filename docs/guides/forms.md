# 表单与校验

三层结构，各管一件事：

```
ICEFormModel   值 + 规则 + 错误 + 监听器（纯逻辑，不碰 canvas，可以单独用）
   ▲
ICEFormItem    标签 / 控件 / 错误文案的排版；把错误转成控件的 validateStatus
   ▲
ICEForm        addItem / validate / submit / reset，负责在控件与模型之间搬值
```

## 最小用法

```ts
import { ICEForm, ICEFormItem, ICEInputNumber, ICETextField } from 'ice-web-components';

const form = new ICEForm({ width: 320, gap: 12 });
form.addItems([
  new ICEFormItem({
    name: 'name',
    label: '姓名',
    control: new ICETextField({ width: 240, placeholder: '请输入姓名' }),
    rules: [{ required: true }, { minLength: 2 }],
  }),
  new ICEFormItem({
    name: 'age',
    label: '年龄',
    control: new ICEInputNumber({ width: 240, value: 18 }),
    rules: [{ min: 18, message: '未满 18 岁不能注册' }],
  }),
]);

form.onSubmit((values) => console.log(values));  // { name: '...', age: 18 }
button.on('click', () => form.submit());         // 校验不过不会回调
```

## 规则清单（`UIFormRule`）

| 规则 | 说明 |
|---|---|
| `required` | 必填；空串 / 空数组 / `false` / `null` 都算缺失 |
| `min` / `max` | 数值上下界（值能转成数字时生效） |
| `minLength` / `maxLength` | 字符串或数组长度 |
| `pattern` | 正则 |
| `validator(value, values)` | 自定义同步校验：返回文案表示失败 |
| `asyncValidator(value, values)` | 异步校验：返回 `Promise<string \| null>` |
| `message` | 自定义错误文案（不传用默认文案） |

一条规则失败即停止（取第一条错误文案）。

## 异步校验

只在显式调用时才跑 —— **值变化触发的自动校验只跑同步规则**，避免每敲一个字就发请求：

```ts
form.getModel().getField('name').rules.push({
  asyncValidator: (value) =>
    fetch('/api/check?name=' + value).then((r) => r.json()).then((d) => (d.taken ? '该用户名已占用' : null)),
});

// 提交时：先同步、后异步；异步期间表单项显示“校验中…”
form.submitAsync().then((ok) => { if (!ok) toast('请检查表单填写', 'error'); });
```

也可以单独用：

```ts
await form.getModel().validateFieldAsync('name');   // 单字段
await form.getModel().validateAsync();              // 全部字段（并行）
form.getModel().isValidating('name');               // 是否正在校验
```

## 错误态

`ICEFormItem` 把错误写进控件的 `validateStatus`，控件的 `__applyValidateState()` 钩子负责画红框
(`ICETextField` / `ICESelect` / `ICEDatePicker` / `ICETimePicker` / `ICECascader` / `ICEInputNumber` /
`ICEAutoComplete` / `ICETreeSelect` 都已实现)，同时错误文案显示在控件下方。

## 让自定义控件进入表单

只要实现两个方法并触发 `change` 事件即可：

```ts
class MyControl extends ICEWidget {
  public getFormValue() { return this.value; }
  public setFormValue(value: any) { this.setValue(value); }
  private setValue(value: any) {
    this.value = value;
    this.trigger('change', null, { value });   // ICFormItem 靠这个事件同步到模型
  }
}
```

## 重置

```ts
form.reset();   // 回到初始值、清空错误，并把值写回控件的显示
```

## 跨字段校验（`dependencies`）

「确认密码」「结束日期不能早于开始日期」「手机与邮箱至少填一个」这类规则，字段的合法性
取决于**别的字段**。给 `ICEFormItem`（或直接给 `ICEFormModel.addField`）加 `dependencies`
即可 —— 被依赖字段一变，本字段立刻重算，不需要用户再动本字段一次：

```ts
form.addItems([
  new ICEFormItem({
    name: 'password',
    label: '密码',
    control: passwordInput,
    rules: [{ required: true, minLength: 6 }],
  }),
  new ICEFormItem({
    name: 'confirm',
    label: '确认密码',
    control: confirmInput,
    dependencies: ['password'],          // ← password 变了就重算 confirm
    rules: [
      { required: true },
      { validator: (value, values) => (value === values.password ? null : '两次输入的密码不一致') },
    ],
  }),
]);
```

配套行为：

- `model.getDependents('password')` → `['confirm']`（反向查依赖者）；
- `setValues({...})` 批量写入时同样会重算依赖字段；
- `validateTrigger: 'none'` 时连依赖重算一起关掉（只在显式校验时算）；
- **自定义 `validator` 在空值上也会执行**（内置的 min/max/长度/pattern 仍然跳过）——
  这是「至少填一个」这类规则能写出来的前提。
