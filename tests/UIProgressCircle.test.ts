/**
 * UIProgressBar 环形模式。
 *
 * 规格：
 * - `type: 'circle'` 时渲染「底环 + 进度弧 + 居中百分比文字」，尺寸取 size（默认 120）；
 * - 进度弧的扫过比例 = percent（0..1），随 setValue 更新；
 * - `showText: false` 不出文字；`format` 可自定义文案；
 * - 线形模式保持原样（子节点仍是 track + fill，childNodes[1] 是填充条）。
 */
import { UIProgressBar } from '../src/components/UIProgressBar';

describe('UIProgressBar 线形（回归）', () => {
  it('保持 track + fill 结构与填充宽度', () => {
    const bar = new UIProgressBar({ value: 40, min: 0, max: 100, width: 200, height: 10 });
    expect(bar.isCircle()).toBe(false);
    expect(bar.getPercent()).toBeCloseTo(0.4, 5);
    const fill = bar.childNodes[1] as any;
    expect(fill.state.width).toBe(80);
    expect(bar.getRingNode()).toBeNull();
    expect(bar.getTextNode()).toBeNull();
  });
});

describe('UIProgressBar 环形', () => {
  it('渲染底环 + 进度弧 + 百分比文字，尺寸取 size', () => {
    const bar = new UIProgressBar({ type: 'circle', value: 25, size: 120 });
    expect(bar.isCircle()).toBe(true);
    expect(bar.state.width).toBe(120);
    expect(bar.state.height).toBe(120);
    expect(bar.getTrackRingNode()).not.toBeNull();
    expect(bar.getRingNode()).not.toBeNull();
    expect(bar.getTextNode()).not.toBeNull();
    expect(bar.getTextNode()!.getText()).toBe('25%');
  });

  it('setValue 更新扫过比例与文字', () => {
    const bar = new UIProgressBar({ type: 'circle', value: 25, size: 100 });
    bar.setValue(50);
    expect(bar.getPercent()).toBeCloseTo(0.5, 5);
    expect(bar.getSweepRatio()).toBeCloseTo(0.5, 5);
    expect(bar.getTextNode()!.getText()).toBe('50%');
    bar.setValue(200);
    expect(bar.getSweepRatio()).toBe(1);
    expect(bar.getTextNode()!.getText()).toBe('100%');
    bar.setValue(-10);
    expect(bar.getSweepRatio()).toBe(0);
    expect(bar.getTextNode()!.getText()).toBe('0%');
  });

  it('showText:false 不出文字；format 可自定义', () => {
    const plain = new UIProgressBar({ type: 'circle', value: 30, size: 80, showText: false });
    expect(plain.getTextNode()).toBeNull();

    const custom = new UIProgressBar({
      type: 'circle',
      value: 30,
      size: 80,
      format: (percent: number) => `${Math.round(percent * 100)} 分`,
    });
    expect(custom.getTextNode()!.getText()).toBe('30 分');
  });

  it('成功态用成功色，size / strokeWidth 可配', () => {
    const bar = new UIProgressBar({ type: 'circle', value: 40, size: 90, strokeWidth: 12, status: 'success' });
    const ring = bar.getRingNode() as any;
    expect(ring.state.style.lineWidth).toBe(12);
    expect(bar.state.width).toBe(90);
  });
});
