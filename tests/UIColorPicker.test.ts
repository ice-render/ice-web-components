/**
 * UIColorPicker 单测（色板网格）。
 *
 * 规格：
 * - 按 colors 渲染色块网格（columns 可配），选中项带描边环；
 * - 点击色块 → 回写 value + onChange；disabled 忽略；
 * - 表单取值约定 + 错误态边框；可聚焦。
 */
import { UIColorPicker } from '../src/components/UIColorPicker';

const palette = ['#1677ff', '#52c41a', '#faad14', '#ff4d4f', '#722ed1', '#13c2c2'];

describe('UIColorPicker', () => {
  it('渲染色块网格与选中环', () => {
    const picker = new UIColorPicker({ width: 200, colors: palette, columns: 6, value: '#52c41a' });
    expect(picker.getSwatchNodes().length).toBe(6);
    expect(picker.getValue()).toBe('#52c41a');
    expect(picker.isSelected('#52c41a')).toBe(true);
    expect(picker.isSelected('#1677ff')).toBe(false);
  });

  it('点击色块回写值并回调；disabled 忽略', () => {
    const changes: string[] = [];
    const picker = new UIColorPicker({ width: 200, colors: palette, columns: 6, onChange: (color) => changes.push(color) });
    picker.getSwatchNode('#ff4d4f')!.trigger('click', null, {});
    expect(picker.getValue()).toBe('#ff4d4f');
    expect(changes).toEqual(['#ff4d4f']);
    picker.getSwatchNode('#52c41a')!.trigger('click', null, {});
    expect(picker.getValue()).toBe('#52c41a');

    const disabled = new UIColorPicker({ width: 200, colors: palette, columns: 6, disabled: true });
    disabled.getSwatchNode('#ff4d4f')!.trigger('click', null, {});
    expect(disabled.getValue()).toBeUndefined();
    expect(disabled.isFocusable()).toBe(false);
  });

  it('setValue 同步选中；表单取值约定与错误态', () => {
    const picker = new UIColorPicker({ width: 200, colors: palette, columns: 6 });
    picker.setValue('#722ed1');
    expect(picker.isSelected('#722ed1')).toBe(true);
    picker.setFormValue('#13c2c2');
    expect(picker.getFormValue()).toBe('#13c2c2');
    picker.setValidateStatus('error');
    expect(picker.getValidateStatus()).toBe('error');
    expect(picker.isFocusable()).toBe(true);
  });

  it('rows 计算：6 列 6 色 → 1 行；高度按行数', () => {
    const picker = new UIColorPicker({ width: 200, colors: palette, columns: 3, swatchSize: 24, gap: 8 });
    expect(picker.getRowCount()).toBe(2);
    expect(picker.state.height).toBeGreaterThan(24);
  });
});
