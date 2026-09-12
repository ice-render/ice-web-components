/**
 * ICELabel 尺寸语义回归。
 *
 * 背景：ICELabel 只是 ICEText 的一层包装容器，调用方不显式给尺寸时会停在 ICERect 的默认 10×10；
 * 而 ICEFlowLayout / ICEBoxLayout 排布时读的是子项的 `state.width/height`，于是「标题占 10px 宽」，
 * 紧跟其后的按钮直接压在标题文字上。
 *
 * 测试环境是 node（没有真实文本度量），所以直接给内部 ICEText 塞一个尺寸来驱动这套机制。
 */
import { ICEFlowLayout } from 'ice-render';
import { ICEButton, ICELabel, ICEPanel } from '../src';

function stubTextSize(label: ICELabel, width: number, height: number): void {
  const text = label.childNodes[0] as any;
  text.state.width = width;
  text.state.height = height;
  (label as any).__adoptTextSize(false);
}

describe('ICELabel 尺寸', () => {
  it('采用文字的实测尺寸，并作为首选尺寸对外报告', () => {
    const label = new ICELabel({ text: 'hello' });
    stubTextSize(label, 80, 18);
    expect(label.state.width).toBe(80);
    expect(label.state.height).toBe(18);
    expect(label.getPreferredSize()).toEqual([80, 18]);
  });

  it('调用方显式给了 width/height 时不被文字尺寸覆盖', () => {
    const label = new ICELabel({ text: 'hello', width: 40, height: 20 });
    stubTextSize(label, 200, 99);
    expect(label.state.width).toBe(40);
    expect(label.state.height).toBe(20);
  });

  it('流式布局按标签宽度留位，后续组件不与其重叠', () => {
    const panel = new ICEPanel({ width: 400, height: 60 });
    panel.setLayout(new ICEFlowLayout({ gap: 10 }));

    const label = new ICELabel({ text: 'hello' });
    stubTextSize(label, 120, 20);
    const button = new ICEButton({ text: 'Go', width: 80, height: 32 });
    panel.addChildren([label, button]);

    expect(label.state.left).toBe(0);
    expect(button.state.left).toBe(130); // 120 + gap 10
  });
});
