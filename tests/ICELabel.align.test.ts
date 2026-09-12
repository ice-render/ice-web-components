/**
 * ICELabel 水平对齐回归。
 *
 * 背景：ICELabel 是 ICEText 的包装容器，`align` 必须映射成内层 style.textAlign。
 * 曾经漏了映射 —— `new ICELabel({ align: 'center' })` 静默按左对齐渲染，
 * 表现为「给了居中却贴着盒子左边」（轮播文字、时间/日期列、空状态文字都中招）。
 */
import { ICELabel } from '../src/components/ICELabel';

function textStyle(label: ICELabel): any {
  return (label.childNodes[0] as any).state.style;
}

describe('ICELabel 水平对齐', () => {
  it('align:center / right 映射到内层 textAlign', () => {
    expect(textStyle(new ICELabel({ text: 'x', width: 100, align: 'center' })).textAlign).toBe('center');
    expect(textStyle(new ICELabel({ text: 'x', width: 100, align: 'right' })).textAlign).toBe('right');
  });

  it('默认（左对齐）不写 textAlign，保持旧行为', () => {
    expect(textStyle(new ICELabel({ text: 'x', width: 100 })).textAlign).toBeUndefined();
  });

  it('显式 style.textAlign 优先于 align 简写', () => {
    const label = new ICELabel({ text: 'x', width: 100, align: 'center', style: { textAlign: 'left' } });
    expect(textStyle(label).textAlign).toBe('left');
  });

  it('verticalAlign:middle 仍映射 textBaseline（与水平对齐互不影响）', () => {
    const style = textStyle(new ICELabel({ text: 'x', width: 100, height: 20, align: 'center', verticalAlign: 'middle' }));
    expect(style.textAlign).toBe('center');
    expect(style.textBaseline).toBe('middle');
  });
});
