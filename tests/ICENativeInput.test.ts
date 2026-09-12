/**
 * ICENativeInput 规格（原生输入替身：canvas 里支持中文 IME 的关键一步）。
 *
 * 背景：canvas 文本框自己处理 `keydown` 只能吃单字符键 —— 中文输入法在组字阶段
 * 根本没有 keydown，所以「打中文」一直打不进去（只能 `setValue`）。
 * 引擎的 `ICEText.startEditing()` 早就用「透明 input + compositionend」解决了这件事，
 * 组件库这一层现在也照做：聚焦时在组件上方挂一个**完全透明**的原生输入元素，
 * 输入法怎么组字都行，`input` / `compositionend` 把结果回写进组件。
 *
 * 规格：
 * - `mount()` 创建元素（单行 input / 多行 textarea）挂到 body，按画布坐标定位，
 *   文字透明、背景透明、无边框，光标色可配，并聚焦、光标定位到末尾；
 * - `input` 与 `compositionend` 都回写（IME 走后者），`maxLength` 生效；
 * - Enter / Escape 触发回调；**组字中（`isComposing`）的 Enter 不算提交**；多行模式 Enter 换行；
 * - `blur` 触发回调；`unmount()` 摘掉元素，重复卸载安全；
 * - **没有 document（Node / 小程序）时 mount 是空操作**，不抛异常 —— 组件库据此降级回 keydown。
 */
import { ICENativeInput } from '../src/util/ICENativeInput';

/** 极简 document 替身：记录创建出来的元素与它们的监听器。 */
const makeDoc = () => {
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
        parentNode: null,
        focused: false,
        selection: null as null | [number, number],
        focus() {
          element.focused = true;
        },
        setSelectionRange(start: number, end: number) {
          element.selection = [start, end];
        },
        addEventListener(type: string, handler: (evt: any) => void) {
          element.listeners[type] = element.listeners[type] || [];
          element.listeners[type].push(handler);
        },
        removeEventListener(type: string, handler: (evt: any) => void) {
          const list = element.listeners[type] || [];
          const index = list.indexOf(handler);
          if (index >= 0) list.splice(index, 1);
        },
        dispatch(type: string, evt: any = {}) {
          (element.listeners[type] || []).slice().forEach((handler: (evt: any) => void) => handler(evt));
        },
      };
      created.push(element);
      return element;
    },
  };
  return { doc, body, created };
};

const makeInput = (options: any = {}) => {
  const { doc, body, created } = makeDoc();
  const events: any[] = [];
  const input = new ICENativeInput({
    doc,
    box: { left: 10, top: 20, width: 200, height: 30 },
    value: '',
    font: '400 14px Tahoma',
    caretColor: '#212529',
    maxLength: 5,
    onInput: (value: string) => events.push(['input', value]),
    onEnter: () => events.push(['enter']),
    onEscape: () => events.push(['escape']),
    onBlur: () => events.push(['blur']),
    ...options,
  });
  return { input, doc, body, created, events };
};

describe('挂载与定位', () => {
  it('创建一个透明 input，按画布坐标定位并聚焦、光标在末尾', () => {
    const { input, body, created } = makeInput({ value: 'abc' });
    input.mount();
    expect(created).toHaveLength(1);
    const element = created[0];
    expect(element.tagName).toBe('INPUT');
    expect(body.children).toContain(element);
    expect(element.value).toBe('abc');
    expect(element.style.position).toBe('absolute');
    expect([element.style.left, element.style.top, element.style.width, element.style.height]).toEqual(['10px', '20px', '200px', '30px']);
    expect(element.style.font).toBe('400 14px Tahoma');
    expect(element.style.color).toBe('transparent');
    expect(element.style.background).toBe('transparent');
    expect(element.style.border).toBe('none');
    expect(element.style.caretColor).toBe('#212529');
    expect(element.focused).toBe(true);
    expect(element.selection).toEqual([3, 3]);
    expect(input.isMounted()).toBe(true);
    expect(input.getElement()).toBe(element);
  });

  it('多行模式创建 textarea', () => {
    const { input, created } = makeInput({ multiline: true });
    input.mount();
    expect(created[0].tagName).toBe('TEXTAREA');
  });

  it('重复 mount 不会重复创建；unmount 摘掉元素且可重复调用', () => {
    const { input, body, created } = makeInput();
    input.mount();
    input.mount();
    expect(created).toHaveLength(1);
    input.unmount();
    expect(body.children).toHaveLength(0);
    expect(input.isMounted()).toBe(false);
    expect(() => input.unmount()).not.toThrow();
  });

  it('没有 document 时 mount 是空操作（Node 下降级）', () => {
    const { input } = makeInput({ doc: null });
    expect(() => input.mount()).not.toThrow();
    expect(input.isMounted()).toBe(false);
    expect(input.getElement()).toBeNull();
  });
});

describe('输入与 IME', () => {
  it('input 事件回写、maxLength 截断', () => {
    const { input, created, events } = makeInput();
    input.mount();
    const element = created[0];
    element.value = 'abcdefg';
    element.dispatch('input');
    expect(events).toEqual([['input', 'abcde']]);
    expect(element.value).toBe('abcde'); // 截断后同步回元素，光标才不会错位
  });

  it('compositionend 回写（中文输入法走这条）', () => {
    const { input, created, events } = makeInput({ maxLength: 0 });
    input.mount();
    const element = created[0];
    element.value = '中文输入';
    element.dispatch('compositionend');
    expect(events).toEqual([['input', '中文输入']]);
  });

  it('Enter / Escape 触发回调；组字中的 Enter 不算提交', () => {
    const { input, created, events } = makeInput();
    input.mount();
    const element = created[0];
    element.dispatch('keydown', { key: 'Enter', isComposing: true });
    expect(events).toEqual([]);
    element.dispatch('keydown', { key: 'Enter' });
    element.dispatch('keydown', { key: 'Escape' });
    expect(events).toEqual([['enter'], ['escape']]);
  });

  it('多行模式（textarea）Enter 不触发提交', () => {
    const { input, created, events } = makeInput({ multiline: true });
    input.mount();
    created[0].dispatch('keydown', { key: 'Enter' });
    expect(events).toEqual([]);
  });

  it('blur 触发回调（组件据此收起替身）', () => {
    const { input, created, events } = makeInput();
    input.mount();
    created[0].dispatch('blur');
    expect(events).toEqual([['blur']]);
  });

  it('setValue / getValue 与元素同步，并把光标移到末尾', () => {
    const { input, created } = makeInput();
    input.mount();
    input.setValue('hello');
    expect(input.getValue()).toBe('hello');
    expect(created[0].value).toBe('hello');
    expect(created[0].selection).toEqual([5, 5]);
  });
});
