/**
 * painter（Swing `ComponentUI` 的对应物）规格。
 *
 * 为什么要有它：组件内部的**装饰**（头像的圆底与首字、骨架屏的占位条…）既不是内容、
 * 也不该参与父容器的布局。把它们做成子节点会带来两个后果：
 * ① 「给组件挂布局」等于把装饰也排一遍（引擎旧实现还会把策略灌给后代）；
 * ② 每个装饰都要吃一次渲染/命中/队列的遍历。
 *
 * 约定（与 Swing 的 UI delegate 同构）：
 * - `paint({ ctx, theme, component, origin })` 在组件**本地坐标**里调用；
 * - `origin` 是本地原点（默认盒子中心），按"盒子左上角"画要减掉它；
 * - `getPreferredSize(component)` 让组件对外报"我想要多大"（布局会问它）；
 * - 交互交给 `install(component)` 里挂的事件监听（painter 自己算局部坐标），
 *   `uninstall` 必须拆掉自己装的东西。
 */
import { ICEBoxLayout } from 'ice-render';
import { ICEAvatar } from '../src/components/ICEAvatar';
import { ICEPanel } from '../src/components/ICEPanel';
import { ICESkeleton } from '../src/components/ICESkeleton';
import { ICEWidget } from '../src/core/ICEWidget';
import type { ICEPaintContext, ICEPainter } from '../src/core/ICEPainter';

/** 记录调用的假 ctx（只关心"画了什么"，不做像素断言）。 */
function makeCtxSpy() {
  const calls: Array<{ prop: string; args: any[] }> = [];
  const last: Record<string, any> = {};
  const ctx: any = new Proxy(last, {
    get(target, prop: string) {
      if (prop in target) {
        return target[prop];
      }
      return (...args: any[]) => {
        calls.push({ prop: String(prop), args });
      };
    },
    set(target, prop: string, value) {
      target[prop] = value;
      last[prop] = value;
      return true;
    },
  });
  return { ctx, calls, last };
}

describe('painter：组件内部装饰不进 childNodes', () => {
  it('设了 painter 后组件没有任何子节点（装饰不再是"内容"）', () => {
    const avatar = new ICEAvatar({ text: 'A', size: 40 });
    expect(avatar.childNodes).toHaveLength(0);
    expect(avatar.getPainter()).toBeTruthy();
  });

  it('paint 收到 ctx / theme / component / origin（按本地坐标画）', () => {
    const avatar = new ICEAvatar({ text: '张', size: 40 });
    const spy = makeCtxSpy();
    (avatar as any).ctx = spy.ctx; // 单测里没有 init 画布，手动挂一个假 ctx
    (avatar as any).composeMatrix(); // 派生 localOrigin（渲染时由引擎先算，单测要自己补）

    avatar.paintDecoration();

    const props = spy.calls.map((c) => c.prop);
    expect(props).toContain('arc'); // 圆底
    expect(props).toContain('fill');
    expect(props).toContain('stroke');
    expect(props).toContain('fillText'); // 首字
    const text = spy.calls.find((c) => c.prop === 'fillText');
    expect(text && text.args[0]).toBe('张');
    // 本地原点默认是盒子中心（40×40 → 20,20），所以圆心画在 (0,0)
    expect(spy.calls.find((c) => c.prop === 'arc')!.args.slice(0, 2)).toEqual([0, 0]);
  });

  it('setText 改的是组件自己的状态（不再有子节点需要同步）', () => {
    const avatar = new ICEAvatar({ text: 'A', size: 32 });
    expect(avatar.getText()).toBe('A');
    avatar.setText('B');
    expect(avatar.getText()).toBe('B');
    expect(avatar.childNodes).toHaveLength(0);
  });

  it('未挂到 ICE 实例（没有 ctx）时 paintDecoration 是空操作，不抛错', () => {
    const avatar = new ICEAvatar({ text: 'A' });
    expect(() => avatar.paintDecoration()).not.toThrow();
  });
});

describe('painter：install / uninstall 与尺寸协商', () => {
  it('setPainter 触发 install；换掉/清空时触发上一个的 uninstall', () => {
    const widget = new ICEWidget({ width: 40, height: 40 });
    const events: string[] = [];
    const painter: ICEPainter = {
      install: () => events.push('install'),
      uninstall: () => events.push('uninstall'),
      paint: () => {},
    };
    widget.setPainter(painter);
    expect(events).toEqual(['install']);
    widget.setPainter(null);
    expect(events).toEqual(['install', 'uninstall']);
    expect(widget.getPainter()).toBe(null);
  });

  it('布局问的是 painter 报的首选尺寸（UI delegate 口径）', () => {
    const parent = new ICEPanel({ width: 400, height: 100 });
    const widget = new ICEWidget({ height: 20 });
    const tail = new ICEWidget({ width: 30, height: 20 });
    const seen: Array<[number, number]> = [];
    widget.setPainter({
      getPreferredSize: (component: any) => {
        seen.push([component.state.width, component.state.height]);
        return [120, 20];
      },
      paint: () => {},
    } as ICEPainter);
    parent.addChildren([widget, tail]);
    parent.setLayout(new ICEBoxLayout({ axis: 'x', gap: 10 }));
    expect(seen.length).toBeGreaterThan(0);
    expect(tail.state.left).toBe(130); // BoxLayout 按 painter 报的 120 宽留位，再加 gap10
  });

  it('painter 可以自己挂事件（交互装饰走 install，不需要额外 API）', () => {
    const widget = new ICEWidget({ width: 40, height: 40 });
    const hits: string[] = [];
    const painter: ICEPainter = {
      install: (component: any) => component.on('click', () => hits.push('click')),
      uninstall: (component: any) => component.off('click'),
      paint: () => {},
    };
    widget.setPainter(painter);
    widget.trigger('click', null, {});
    expect(hits).toEqual(['click']);
    widget.setPainter(null);
    widget.trigger('click', null, {});
    expect(hits).toEqual(['click']); // 卸载后不再收到
  });
});

describe('painter 与布局互不干扰', () => {
  it('给挂了 painter 的组件设布局，装饰不会被排掉（因为它不是子节点）', () => {
    const panel = new ICEPanel({ width: 400, height: 100 });
    const avatar = new ICEAvatar({ text: 'A', size: 40 });
    panel.addChild(avatar);
    panel.setLayout(new ICEBoxLayout({ axis: 'x', gap: 10 }));
    expect(panel.childNodes).toHaveLength(1); // 面板眼里只有头像这一个内容
    expect(avatar.childNodes).toHaveLength(0); // 头像自己的装饰不在树里
    expect(avatar.getPainter()).toBeTruthy();
  });

  it('骨架屏：N 个占位条 = 0 个子节点，但画笔确实画了 N 个块', () => {
    const skeleton = new ICESkeleton({ width: 240, rows: 3, avatar: true, title: true });
    const spy = makeCtxSpy();
    (skeleton as any).ctx = spy.ctx;
    (skeleton as any).composeMatrix();

    skeleton.paintDecoration();

    expect(skeleton.childNodes).toHaveLength(0);
    const fills = spy.calls.filter((c) => c.prop === 'fill').length;
    expect(fills).toBe(skeleton.getPlaceholderCount()); // rows + avatar + title
  });
});
