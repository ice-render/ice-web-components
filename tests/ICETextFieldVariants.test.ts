/**
 * ICETextArea / ICEPasswordField 单测（ICETextField 的多行与密码变体）。
 *
 * 规格：
 * - TextArea：允许换行（Enter 插入 \n）、默认更高（多行显示）、其余与文本框一致
 *   （取值约定 / change 事件 / 错误态边框都能用）；
 * - PasswordField：显示为掩码（• 数量 = 真实长度），getValue 仍是明文；
 *   showToggle 时可点眼睛切换明文。
 */
import { ICEPasswordField } from '../src/components/ICEPasswordField';
import { ICETextArea } from '../src/components/ICETextArea';

describe('ICETextArea', () => {
  it('默认多行高度，Enter 插入换行并触发 change', () => {
    const area = new ICETextArea({ width: 240 });
    expect(area.state.height).toBeGreaterThanOrEqual(64);
    const changes: string[] = [];
    area.on('change', (evt: any) => changes.push(evt.param.value));

    area.setFocused(true);
    (area as any).__onGlobalKeyDown({ key: 'a' });
    (area as any).__onGlobalKeyDown({ key: 'Enter' });
    (area as any).__onGlobalKeyDown({ key: 'b' });
    expect(area.getValue()).toBe('a\nb');
    expect(changes).toEqual(['a', 'a\n', 'a\nb']);
  });

  it('普通文本框不受影响（Enter 不插入换行）', () => {
    const { ICETextField } = require('../src/components/ICETextField');
    const field = new ICETextField({ width: 200 });
    field.setFocused(true);
    (field as any).__onGlobalKeyDown({ key: 'a' });
    (field as any).__onGlobalKeyDown({ key: 'Enter' });
    expect(field.getValue()).toBe('a');
  });

  it('表单取值约定与错误态', () => {
    const area = new ICETextArea({ width: 240, value: '初始' });
    expect(area.getFormValue()).toBe('初始');
    area.setFormValue('改过');
    expect(area.getValue()).toBe('改过');
    area.setValidateStatus('error');
    expect(area.getValidateStatus()).toBe('error');
  });
});

describe('ICEPasswordField', () => {
  it('显示掩码但取值是明文', () => {
    const field = new ICEPasswordField({ width: 200, value: 'secret' });
    expect(field.getFieldText()).toBe('••••••');
    expect(field.getValue()).toBe('secret');
    expect(field.getFormValue()).toBe('secret');

    field.setValue('abcd');
    expect(field.getFieldText()).toBe('••••');
    expect(field.getValue()).toBe('abcd');
  });

  it('showToggle：点眼睛在明文/掩码之间切换', () => {
    const field = new ICEPasswordField({ width: 200, value: 'secret', showToggle: true });
    expect(field.isVisible()).toBe(false);
    field.getToggleButton()!.trigger('click', null, {});
    expect(field.isVisible()).toBe(true);
    expect(field.getFieldText()).toBe('secret');
    field.getToggleButton()!.trigger('click', null, {});
    expect(field.getFieldText()).toBe('••••••');
  });

  it('聚焦时掩码后仍带光标占位（不泄露明文）', () => {
    const field = new ICEPasswordField({ width: 200, value: 'abc' });
    field.setFocused(true);
    expect(field.getFieldText()).toBe('•••|');
    expect(field.getFieldText().indexOf('abc')).toBe(-1);
  });
});
