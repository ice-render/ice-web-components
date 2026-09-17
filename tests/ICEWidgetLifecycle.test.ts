/**
 * 容器契约的机器部分：生命周期钩子的分发回归（2026-09-17）。
 *
 * 契约写在 `ICEContainer` 上（应用层对外入口），分发点在 `ICEWidget`。
 * 这组用例守住四件事：
 *
 * 1. 挂 / 摘（引擎 `AFTER_ADD` / `AFTER_REMOVE`）→ `onMount` / `onUnmount`；
 * 2. 自身显隐翻转 → `onShow` / `onHide`（**祖先**隐藏不误报，对齐 Swing 的 componentShown 口径）；
 * 3. 尺寸变化 → `onResize`，**包含父容器布局器摆位算出来的尺寸**；
 * 4. 重复写同一个值不重复通知 —— 钩子不是「每次 setState 都调一次」。
 */
import { ICEGridLayout, ICEGroup } from 'ice-render';
import { ICEContainer } from '../src/core/ICEContainer';

/** 探针：把收到的钩子按顺序记下来。 */
class Probe extends ICEContainer {
  public calls: string[] = [];

  protected onMount(): void {
    this.calls.push('mount');
  }

  protected onUnmount(): void {
    this.calls.push('unmount');
  }

  protected onShow(): void {
    this.calls.push('show');
  }

  protected onHide(): void {
    this.calls.push('hide');
  }

  protected onResize(): void {
    this.calls.push('resize');
  }
}

/** 假场景：只要 `ice` 非空，`addChild` 就会走真实的 `syncChildEvents` 链路。 */
const makeScene = () =>
  ({
    dirty: false,
    ctx: {},
    evtBus: { on() {}, off() {} },
    renderer: null,
  }) as any;

describe('生命周期钩子分发', () => {
  it('挂进场景调 onMount，摘出场景调 onUnmount', () => {
    const parent: any = new ICEGroup({ left: 0, top: 0, width: 100, height: 100 });
    parent.ice = makeScene();
    const probe = new Probe({ width: 10, height: 10 });

    parent.addChild(probe);
    expect(probe.calls).toEqual(['mount']);

    parent.removeChild(probe);
    expect(probe.calls).toEqual(['mount', 'unmount']);
  });

  it('自身 display 翻转调 onShow / onHide，同值重复写不重复通知', () => {
    const probe = new Probe({ width: 10, height: 10 });
    expect(probe.state.display).toBe(true); // 引擎默认可见

    probe.setState({ display: false });
    expect(probe.calls).toEqual(['hide']);

    probe.setState({ display: false }); // 同值
    expect(probe.calls).toEqual(['hide']);

    probe.setState({ display: true });
    expect(probe.calls).toEqual(['hide', 'show']);

    probe.setState({ left: 42 }); // 只挪位置
    expect(probe.calls).toEqual(['hide', 'show']);
  });

  it('祖先隐藏不触发子容器的 onHide（只看自身 display）', () => {
    const parent: any = new ICEGroup({ left: 0, top: 0, width: 100, height: 100 });
    const probe = new Probe({ width: 10, height: 10 });
    parent.addChild(probe);

    parent.setState({ display: false });
    expect(probe.calls).toEqual([]);
    expect(probe.isEffectivelyVisible()).toBe(false); // 但「最终可见性」确实是假的
  });

  it('尺寸变化调 onResize，只改位置不调', () => {
    const probe = new Probe({ width: 100, height: 50 });

    probe.setState({ width: 120 });
    expect(probe.calls).toEqual(['resize']);

    probe.setState({ left: 3, top: 4 });
    expect(probe.calls).toEqual(['resize']);
  });

  it('父容器布局器摆出来的尺寸同样调 onResize', () => {
    const row: any = new ICEGroup({ left: 0, top: 0, width: 600, height: 100 });
    row.setLayout(new ICEGridLayout({ cols: 3, gapX: 12, gapY: 0, cellSizing: 'equal' }));

    const cards = [new Probe({ height: 100 }), new Probe({ height: 100 }), new Probe({ height: 100 })];
    cards.forEach((card) => row.addChild(card, false));

    // 等分：(600 - 2*12) / 3 = 192
    expect(cards[0].state.width).toBeCloseTo(192, 5);
    expect(cards.every((card) => card.calls.includes('resize'))).toBe(true);
  });
});
