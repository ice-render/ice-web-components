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

  it('显式写 width: 10 / height: 10 也算「给了尺寸」（不再拿默认值 10 当未设置哨兵）', () => {
    const label = new ICELabel({ text: 'hello', width: 10, height: 10 });
    stubTextSize(label, 200, 99);
    expect(label.state.width).toBe(10);
    expect(label.state.height).toBe(10);
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

  /**
   * 真机踩到的坑（admin.html 批量操作行）：
   * 构造期还没有 canvas ctx，ICEText 走 DOM 兜底量出来的宽度**偏大**（长中文串量成 418，真实只有 228）。
   * 之后引擎用真字体重量了一遍（内层 ICEText 自己变准了），但 ICELabel 这层**包装盒**还停在 418 ——
   * 于是盒子与文字长期不一致：点在盒子右边的空白上会命中标签，按盒子留位的邻居也全错位。
   * 盒子必须跟着内层实测尺寸走（并且通知父容器重排）。
   */
  it('内层文字后来重新量过，包装盒会自己跟上（不依赖调用方再 setText）', () => {
    const label = new ICELabel({ text: '未选中任何订单（勾选左侧复选框可多选）' });
    stubTextSize(label, 418, 20); // DOM 兜底量出来的假尺寸
    expect(label.state.width).toBe(418);

    // 引擎用真字体量完：内层文字变成 228，但没人调 setText
    const text = label.childNodes[0] as any;
    text.state.width = 228;
    text.state.height = 20;
    (label as any).__syncTextSize();

    expect(label.state.width).toBe(228);
    expect(label.state.height).toBe(20);
  });

  it('盒子跟着文字变窄时，会通知父容器重排一次（只发一次，尺寸没变不重复通知）', () => {
    const parent: any = new ICEPanel({ width: 400, height: 60 });
    let requested = 0;
    parent.requestLayout = () => { requested += 1; };
    const label = new ICELabel({ text: 'hello' });
    parent.addChild(label, false);

    stubTextSize(label, 300, 20);
    (label as any).__syncTextSize();
    expect(label.state.width).toBe(300);
    expect(requested).toBe(1);

    (label as any).__syncTextSize(); // 尺寸没变 → 不再打扰父容器
    expect(requested).toBe(1);
  });

  it('调用方显式给过宽高时，内层文字怎么量都不动包装盒', () => {
    const label = new ICELabel({ text: 'hello', width: 120, height: 24 });
    const text = label.childNodes[0] as any;
    text.state.width = 300;
    text.state.height = 40;
    (label as any).__syncTextSize();
    expect(label.state.width).toBe(120);
    expect(label.state.height).toBe(24);
  });
});
