/**
 * ICELabel 动态改色的回归。
 *
 * 背景：ICELabel 的 `style` 在构造期就下沉到内层 `ICEText`（文字是它画的），
 * 之后再 `label.setState({ style })` 只改了外壳容器 —— 文字颜色纹丝不动。
 * 掌机 BIOS 的自检行（灰 → 黄 → 绿）和菜单选中态都要动态改色，
 * 所以补一个走内层节点的正规入口 `setTextColor()`。
 */
import { ICELabel } from '../src/components/ICELabel';

const inner = (label: ICELabel): any => label.childNodes[0] as any;
const textStyle = (label: ICELabel): any => inner(label).state.style;

describe('ICELabel 文字颜色', () => {
  it('setTextColor 改的是内层文字节点的 fillStyle（不是外壳容器）', () => {
    const label = new ICELabel({ text: 'OK', width: 60, style: { fillStyle: '#6b7480' } });
    expect(textStyle(label).fillStyle).toBe('#6b7480');
    label.setTextColor('#20c997');
    expect(textStyle(label).fillStyle).toBe('#20c997');
    expect(label.state.style.fillStyle).not.toBe('#20c997');
  });

  it('只动颜色，字号 / 字体 / 对齐这些不丢', () => {
    const label = new ICELabel({ text: 'OK', width: 60, align: 'center', style: { fontSize: 13, fontFamily: '"Courier New", monospace' } });
    const before = textStyle(label);
    label.setTextColor('#ffc107');
    const after = textStyle(label);
    expect(after.fillStyle).toBe('#ffc107');
    expect(after.fontSize).toBe(before.fontSize);
    expect(after.fontFamily).toBe(before.fontFamily);
    expect(after.textAlign).toBe('center');
  });

  it('链式调用 + 置脏（改了颜色要重画）', () => {
    const label = new ICELabel({ text: 'OK', width: 60 });
    label.dirty = false;
    expect(label.setTextColor('#0d6efd')).toBe(label);
    expect(label.dirty).toBe(true);
    expect(inner(label).dirty).toBe(true);
  });
});
