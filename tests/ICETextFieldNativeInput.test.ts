/**
 * ICETextField / ICETextArea / ICEPasswordField 的「原生输入替身」接线规格（IME 支持）。
 *
 * 规格：
 * - 聚焦（`setFocused(true)`）时挂一个透明原生输入；失焦时收起；
 * - 原生输入的 `input` / `compositionend` 回写组件 value，并触发**原来的** `change` 事件
 *   （表单取值、校验都还是同一套契约）；**同值不重复触发**；
 * - 挂载期间 canvas 的 `keydown` 路径要让路，避免同一个字符进两次；
 * - `maxLength` 依然生效；密码框的掩码显示不变（掩码是画布侧的事）；
 * - **没有 document 时（Node / 小程序）不挂载**，老老实实走原来的 keydown 路径（回归保护）。
 */
import { ICEPasswordField } from '../src/components/ICEPasswordField';
import { ICETextArea } from '../src/components/ICETextArea';
import { ICETextField } from '../src/components/ICETextField';

/** 极简 document + 极简 ICE（本仓库「假 ICE + 真组件」的套路）。 */
const makeEnv = () => {
  const created: any[] = [];
  const body = {
    children: [] as any[],
    appendChild(element: any) {
      body.children.push(element);
      element.parentNode = body;
    },
    removeChild(element: any) {
      const index = body.children.indexOf(element);
      if (index >= 0) body.children.splice(index, 1);
      element.parentNode = null;
    },
  };
  const doc = {
    body,
    createElement(tag: string) {
      const element: any = {
        tagName: String(tag).toUpperCase(),
        style: {},
        value: '',
        listeners: {} as Record<string, Array<(evt: any) => void>>,
        focus() {},
        setSelectionRange() {},
        addEventListener(type: string, handler: (evt: any) => void) {
          element.listeners[type] = element.listeners[type] || [];
          element.listeners[type].push(handler);
        },
        removeEventListener() {},
        dispatch(type: string, evt: any = {}) {
          (element.listeners[type] || []).slice().forEach((handler: (evt: any) => void) => handler(evt));
        },
      };
      created.push(element);
      return element;
    },
  };
  const ice: any = {
    dirty: false,
    root: { document: doc },
    canvasEl: { getBoundingClientRect: () => ({ left: 0, top: 0 }) },
    evtBus: { on() {}, off() {} },
  };
  return { ice, doc, body, created };
};

const attach = (component: any, env: ReturnType<typeof makeEnv>) => {
  component.ice = env.ice;
  (component as any).afterAddHandler();
  return component;
};

describe('ICETextField：原生输入替身', () => {
  it('聚焦挂载、失焦卸载', () => {
    const env = makeEnv();
    const field = attach(new ICETextField({ width: 200, value: 'abc' }), env);
    field.setFocused(true);
    expect(env.body.children).toHaveLength(1);
    expect(env.created[0].value).toBe('abc');
    field.setFocused(false);
    expect(env.body.children).toHaveLength(0);
  });

  it('鼠标路径：按下时先不挂，松开鼠标后再挂（避开 mousedown 的默认焦点转移）', () => {
    jest.useFakeTimers();
    const env = makeEnv();
    const field = attach(new ICETextField({ width: 200 }), env);
    (field as any).__onGlobalMouseDown({ offsetX: 0, offsetY: 0 });
    field.setFocused(true); // 等价于命中后置焦点
    expect(env.body.children).toHaveLength(0);
    (field as any).__onGlobalMouseUp();
    jest.runOnlyPendingTimers(); // 等一拍：click 的默认焦点动作跑完
    expect(env.body.children).toHaveLength(1);
    jest.useRealTimers();
  });

  it('input 回写 value 并触发 change；同值不重复触发', () => {
    const env = makeEnv();
    const field = attach(new ICETextField({ width: 200 }), env);
    const changes: string[] = [];
    field.on('change', (evt: any) => changes.push(evt.param.value));
    field.setFocused(true);
    const element = env.created[0];
    element.value = '中文';
    element.dispatch('input');
    expect(field.getValue()).toBe('中文');
    element.dispatch('compositionend'); // IME 收尾时会再补一次同值
    expect(changes).toEqual(['中文']);
    element.value = '中文输入';
    element.dispatch('compositionend');
    expect(field.getValue()).toBe('中文输入');
    expect(changes).toEqual(['中文', '中文输入']);
  });

  it('挂载期间 canvas 的 keydown 让路（不会被塞进第二个字符）', () => {
    const env = makeEnv();
    const field = attach(new ICETextField({ width: 200 }), env);
    field.setFocused(true);
    env.created[0].value = 'a';
    env.created[0].dispatch('input');
    (field as any).__onGlobalKeyDown({ key: 'b' });
    expect(field.getValue()).toBe('a');
  });

  it('maxLength 生效（截断后同步回元素）', () => {
    const env = makeEnv();
    const field = attach(new ICETextField({ width: 200, maxLength: 3 }), env);
    field.setFocused(true);
    const element = env.created[0];
    element.value = 'abcdef';
    element.dispatch('input');
    expect(field.getValue()).toBe('abc');
    expect(element.value).toBe('abc');
  });

  it('Enter 触发提交（抛 submit 事件）、组字中的 Enter 忽略', () => {
    const env = makeEnv();
    const field = attach(new ICETextField({ width: 200 }), env);
    let submits = 0;
    field.on('submit', () => (submits += 1));
    field.setFocused(true);
    env.created[0].dispatch('keydown', { key: 'Enter', isComposing: true });
    expect(submits).toBe(0);
    env.created[0].dispatch('keydown', { key: 'Enter' });
    expect(submits).toBe(1);
  });

  it('替身的「假失焦」不会把组件一起失焦（DOM 层丢焦点就抢回来）', () => {
    const env = makeEnv();
    const field = attach(new ICETextField({ width: 200 }), env);
    field.setFocused(true);
    const element = env.created[0];
    let focusCount = 0;
    element.focus = () => {
      focusCount += 1;
    };
    // 浏览器在 mousedown/click 的默认动作里会把焦点挪走，替身会收到 blur
    element.dispatch('blur');
    expect(field.isFocused()).toBe(true); // 组件不该跟着失焦
    expect(env.body.children).toHaveLength(1); // 替身也不该被拆掉
    expect(focusCount).toBe(1); // 而是把 DOM 焦点抢回来
  });

  it('没有 document 时不挂载，仍走 keydown 老路径（回归）', () => {
    const field = new ICETextField({ width: 200 });
    const ice: any = { dirty: false, root: {}, canvasEl: null, evtBus: { on() {}, off() {} } };
    attach(field, { ice } as any);
    field.setFocused(true);
    (field as any).__onGlobalKeyDown({ key: 'a' });
    expect(field.getValue()).toBe('a');
  });
});

describe('ICETextArea / ICEPasswordField：同样受益', () => {
  it('文本域挂的是 textarea（Enter 换行不提交）', () => {
    const env = makeEnv();
    const area = attach(new ICETextArea({ width: 240 }), env);
    let submits = 0;
    area.on('submit', () => (submits += 1));
    area.setFocused(true);
    expect(env.created[0].tagName).toBe('TEXTAREA');
    env.created[0].dispatch('keydown', { key: 'Enter' });
    expect(submits).toBe(0);
    env.created[0].value = '第一行\n第二行';
    env.created[0].dispatch('input');
    expect(area.getValue()).toBe('第一行\n第二行');
  });

  it('密码框：原生输入回写明文，画布上仍是掩码', () => {
    const env = makeEnv();
    const field = attach(new ICEPasswordField({ width: 200 }), env);
    field.setFocused(true);
    env.created[0].value = 'secret';
    env.created[0].dispatch('input');
    expect(field.getValue()).toBe('secret');
    // 聚焦时画布上会多一个光标占位（`|`），失焦后是纯掩码
    field.setFocused(false);
    expect(field.getFieldText()).toBe('••••••');
  });
});

/**
 * 光标错位回归（smart-water 登录页实测：原生光标比画面文字**偏左 12px** = `theme.spacing.sm`）。
 *
 * 三层原因：
 * ① 替身 box 取的是**组件整盒**，而 canvas 把文字内缩了 `textNode.left`（默认 12）再画 → 光标整体偏左；
 * ② 挂载期间 canvas 还画了一个 `|` 假光标 → 两个光标、相隔 12px；
 * ③ 掩码（密码框）另有第三层：canvas 画 `•`、与输入框里的真实字符宽度不同 → 原生光标还会随长度漂移。
 */
describe('ICETextField：光标对齐（替身 box = 文本盒 + 只留一个光标）', () => {
  it('替身 box 对齐到文本盒（含左内缩），不是组件整盒', () => {
    const env = makeEnv();
    const field: any = attach(new ICETextField({ width: 200 }), env);
    field.getMinBoundingBox = () => ({ tl: [40, 8], br: [240, 40] });
    field.setFocused(true);
    const element = env.created[0];
    const textLeft = Number(field.textNode.state.left);
    const textWidth = Number(field.textNode.state.width);
    const px = (v: any) => Number(String(v).replace('px', ''));

    expect(textLeft).toBeGreaterThan(0); // canvas 文字有左内缩（theme.spacing.sm）
    expect(px(element.style.left)).toBe(40 + textLeft); // 替身跟着内缩 —— 老实现这里是 40
    expect(px(element.style.top)).toBe(8);
    expect(px(element.style.width)).toBe(textWidth); // 宽度 = 文本盒宽，不是组件整宽
    expect(px(element.style.width)).toBeLessThan(200);
  });

  it('非掩码：挂了替身就不再画 canvas 的 `|`（避免两个光标）', () => {
    const env = makeEnv();
    const field = attach(new ICETextField({ width: 200, value: 'abc' }), env);
    field.setFocused(true);
    expect(field.getFieldText()).toBe('abc'); // 不再有 `|`
  });

  it('没有替身（Node / 小程序）时仍画 canvas 的 `|`（老兜底不丢）', () => {
    const field = new ICETextField({ width: 200, value: 'abc' });
    const ice: any = { dirty: false, root: {}, canvasEl: null, evtBus: { on() {}, off() {} } };
    attach(field, { ice } as any);
    field.setFocused(true);
    expect(field.getFieldText()).toBe('abc|');
  });

  it('掩码（密码框）：原生光标设成 transparent，光标交给 canvas 的 `|`', () => {
    const env = makeEnv();
    const field = attach(new ICEPasswordField({ width: 200 }), env);
    field.setFocused(true);
    const element = env.created[0];
    element.value = 'secret';
    element.dispatch('input');
    expect(element.style.caretColor).toBe('transparent');
    expect(field.getFieldText()).toBe('••••••|');
  });

  it('密码框聚焦期间切明文：原生光标恢复、canvas `|` 收起（不会两个都没有）', () => {
    const env = makeEnv();
    const field: any = attach(new ICEPasswordField({ width: 200 }), env);
    field.setFocused(true);
    env.created[0].value = 'secret';
    env.created[0].dispatch('input');
    expect(env.created[0].style.caretColor).toBe('transparent');

    field.setVisible(true); // 切明文
    expect(env.created[0].style.caretColor).not.toBe('transparent'); // 原生光标恢复
    expect(field.getFieldText()).toBe('secret'); // 明文、无 `|`（用原生光标）
  });
});
