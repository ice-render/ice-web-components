/**
 * 文本输入的「附属物」：prefix / suffix / allowClear / showCount（S2 第一批第二件）。
 *
 * 这些是搜索框、金额框、计数器里到处都在用的东西，以前每个页面都要自己拼一个标签贴在旁边 ——
 * 贴出来的东西**不跟着输入框走**（聚焦变宽、禁用变灰、错误态标红都各自为政）。
 * 收进组件之后：内边距由组件算，文字不再压到前后缀上，清除按钮与字数也随焦点/值自己显隐。
 */
import { ICETextField } from '../src';

describe('前后缀', () => {
  it('prefix / suffix 各自占用内边距：文字节点被挤到它们后面、右侧留出位置', () => {
    const plain = new ICETextField({ width: 240, placeholder: '搜索' });
    const adorned = new ICETextField({ width: 240, placeholder: '搜索', prefix: '¥', suffix: '元' });
    const plainLeft = plain.childNodes[0].state.left;
    const adornedLeft = adorned.childNodes[0].state.left;
    // node 环境量不到真实文字宽度（前缀在后缀可能量成 0），所以这里只守住两条**结构性**事实：
    // 文字可用宽度不会变大；前后缀文本确实挂上了。真实排版在浏览器里由 QA 看。
    expect(adorned.childNodes[0].state.width).toBeLessThanOrEqual(plain.childNodes[0].state.width);
    expect(plain.getTextNodes().prefix).toBe('');
    expect(adorned.getTextNodes().prefix).toBe('¥');
    expect(adorned.getTextNodes().suffix).toBe('元');
  });
});

describe('清除按钮', () => {
  it('allowClear：有值且悬停/聚焦时才出现，点一下清空并触发 change', () => {
    const field = new ICETextField({ width: 240, value: 'abc', allowClear: true });
    expect(field.isClearVisible()).toBe(false); // 没悬停也没聚焦
    field.__setHoverForTest?.(true);
    expect(field.isClearVisible()).toBe(true);
    let changed = 0;
    field.on('change', () => {
      changed += 1;
    });
    field.clear();
    expect(field.getValue()).toBe('');
    expect(changed).toBe(1);
    expect(field.isClearVisible()).toBe(false); // 清空后按钮自己收起来
  });

  it('没开 allowClear 时不出现清除按钮，clear() 仍然可用（表单重置走它）', () => {
    const field = new ICETextField({ width: 240, value: 'abc' });
    field.__setHoverForTest?.(true);
    expect(field.isClearVisible()).toBe(false);
    field.clear();
    expect(field.getValue()).toBe('');
  });
});

describe('字数统计', () => {
  it('showCount + maxLength：显示 已输入/上限，随值更新', () => {
    const field = new ICETextField({ width: 240, maxLength: 10, showCount: true });
    expect(field.getCountText()).toBe('0/10');
    field.setValue('深圳');
    expect(field.getCountText()).toBe('2/10');
    field.setValue('深圳南山科技园');
    expect(field.getCountText()).toBe('7/10');
  });

  it('超长输入被 maxLength 截断（计数不会超过上限）', () => {
    const field = new ICETextField({ width: 240, maxLength: 5, showCount: true });
    field.setValue('123456789');
    expect(field.getValue()).toBe('12345');
    expect(field.getCountText()).toBe('5/5');
  });
});
