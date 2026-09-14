/**
 * ICEAlert 的关闭动画。
 *
 * 规格：
 * - `close()` 默认淡出后再隐藏（`display: false` 在动画结束后才生效，`onClose` 也那时才回调）；
 * - `animation: false` 或 `closeDuration: 0` → 立即关闭（老行为）；
 * - 「减少动效」开着时也是立即关闭；
 * - 重复调用 `close()` 不会重复回调。
 */
import { ICEAlert } from '../src/components/ICEAlert';
import { setICEReducedMotion } from '../src/util/ICEAnimation';

describe('ICEAlert 关闭动画', () => {
  afterEach(() => setICEReducedMotion('auto'));

  it('animation: false 立即关闭（老行为）', () => {
    let closed = 0;
    const alert = new ICEAlert({ title: 'x', closable: true, animation: false, onClose: () => (closed += 1) });
    alert.close();
    expect(alert.isClosed()).toBe(true);
    expect(alert.state.display).toBe(false);
    expect(closed).toBe(1);
  });

  it('closeDuration: 0 也立即关闭', () => {
    const alert = new ICEAlert({ title: 'x', closable: true, closeDuration: 0 });
    alert.close();
    expect(alert.state.display).toBe(false);
  });

  it('减少动效时立即关闭', () => {
    setICEReducedMotion(true);
    const alert = new ICEAlert({ title: 'x', closable: true, animation: true, closeDuration: 200 });
    alert.close();
    expect(alert.state.display).toBe(false);
    expect(alert.isClosed()).toBe(true);
  });

  it('重复 close 只回调一次', () => {
    let closed = 0;
    const alert = new ICEAlert({ title: 'x', closable: true, animation: false, onClose: () => (closed += 1) });
    alert.close();
    alert.close();
    expect(closed).toBe(1);
  });
});
