/**
 * 「复合组件的内部零件跟随自身尺寸」回归（2026-09-15）。
 *
 * 背景：一批组件在**构造期**按当时的宽高算好内部偏移（文字盒、图标盒…），
 * 之后被父层布局改尺寸时零件不跟着走 —— 比组件宽就溢出盖住邻居。
 * ice-smart-water 的统计卡一行（等分网格）与「1×/2×/4×」分段控件分别踩到 ICEStatCard 与 ICEButton。
 *
 * 修法（按 AGENTS「布局铁律」）：复合组件自己持有一个 `ICELayoutManager`，
 * 尺寸变化走引擎的失效链路自动重排内部 —— 不再靠"构造期算一次"。
 */
import { ICEGridLayout, ICEGroup } from 'ice-render';
import { ICEButton } from '../src/components/ICEButton';
import { ICEStatCard } from '../src/components/ICEStatCard';

describe('复合组件的内部零件跟随尺寸', () => {
  it('集成路径：统计卡一行用等分网格，行变宽后卡片与卡内文字都跟着走', () => {
    const row = new ICEGroup({ left: 0, top: 0, width: 600, height: 100 });
    row.setLayout(new ICEGridLayout({ cols: 3, gapX: 12, gapY: 0, cellSizing: 'equal' }));
    const cards = ['进水流量', '溶解氧', '污泥浓度'].map((title) => {
      const card: any = new ICEStatCard({ title, value: '—', height: 100 });
      row.addChild(card, false);
      return card;
    });
    // 等分： (600 - 2*12) / 3 = 192
    expect(cards[0].state.width).toBeCloseTo(192, 5);
    expect((cards[0] as any).__getStatCardNodes().titleNode.state.width).toBe(192 - 64 - 12);

    // 行变宽 → 布局重排 → 卡片变宽 → 卡片内部（自持策略）同帧跟上
    row.setState({ width: 912 });
    row.doLayout();
    expect(cards[0].state.width).toBeCloseTo(296, 5); // (912 - 24) / 3
    expect((cards[0] as any).__getStatCardNodes().titleNode.state.width).toBe(296 - 64 - 12);
  });

  it('ICEButton：改宽高后内部文字标签铺满新盒子（不再停在构造期尺寸）', () => {
    const button = new ICEButton({ text: '提交', width: 96, height: 32 });
    const label = button.childNodes[0] as any;
    expect([label.state.width, label.state.height]).toEqual([96, 32]);

    button.setState({ width: 74.67, height: 28 });
    expect(label.state.width).toBeCloseTo(74.67, 5);
    expect(label.state.height).toBe(28);
    expect(label.state.left).toBe(0);
    expect(label.state.top).toBe(0);
  });

  it('ICEStatCard：改宽高后图标与文字块重新按新盒子摆（文字宽 = 卡宽 - 内距）', () => {
    const card = new ICEStatCard({ title: '进水流量', value: '1.2', trend: '+3%', width: 220, height: 100 });
    const nodes = (card as any).__getStatCardNodes();
    expect(nodes).toBeTruthy();
    const before = nodes.titleNode.state.width;
    expect(before).toBeGreaterThan(0);

    card.setState({ width: 160, height: 100 });
    // 尺寸变化的生效时机 = 下一次布局（引擎的失效链路），单测里显式排一次
    card.doLayout();
    const after = (card as any).__getStatCardNodes();
    // 文字块右内距固定 12：宽度 = 卡宽 - (16 + 36 + 12) - 12
    expect(after.titleNode.state.width).toBe(160 - (16 + 36 + 12) - 12);
    expect(after.valueNode.state.width).toBe(after.titleNode.state.width);
    expect(after.trendNode.state.width).toBe(after.titleNode.state.width);
    // 图标盒固定在左内距处，垂直居中
    expect(after.iconBox.state.left).toBe(16);
    expect(after.iconBox.state.top).toBe(Math.round((100 - 36) / 2));
  });

  it('ICEStatCard 被等分网格拉窄后，内部文字不会溢出卡片', () => {
    const card = new ICEStatCard({ title: '溶解氧', value: '—', width: 120, height: 100 });
    card.setState({ width: 64, height: 100 });
    card.doLayout();
    const nodes = (card as any).__getStatCardNodes();
    const textRight = nodes.titleNode.state.left + nodes.titleNode.state.width;
    expect(textRight).toBeLessThanOrEqual(64);
    expect(nodes.titleNode.state.width).toBeGreaterThanOrEqual(0);
  });
});
