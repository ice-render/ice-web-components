/**
 * 区间日期模型（纯逻辑，S2 第一批第四件的第一步）。
 *
 * 先做模型再画界面是这套库的老规矩：区间选择的难点全在**规则**上 ——
 * 用户先点结束再点开始怎么办（自动交换）、只点了一头（进行中，不算完整区间）、
 * 点「近 7 天」这类快捷项怎么算（含今天还是不含）、当前区间正好等于某个快捷项时怎么高亮。
 * 这些都能在 node 里钉死，界面只负责画。
 */
import { ICEDateRangeModel } from '../src/model/ICEDateRangeModel';

/** 固定「现在」：2026-09-14 15:30，避免用例随时钟漂。 */
const NOW = () => new Date(2026, 8, 14, 15, 30);
const day = (d: number) => new Date(2026, 8, d);
const key = (date: Date | null) => (date ? `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}` : null);

describe('取值与顺序', () => {
  it('先点结束再点开始会自动交换（用户的操作顺序不该被惩罚）', () => {
    const model = new ICEDateRangeModel({ now: NOW });
    model.setValue(day(20), day(10));
    expect(key(model.getStart())).toBe('2026-9-10');
    expect(key(model.getEnd())).toBe('2026-9-20');
    expect(model.isComplete()).toBe(true);
  });

  it('只给一头 = 进行中的选择：不算完整区间', () => {
    const model = new ICEDateRangeModel({ now: NOW });
    model.setValue(day(10), null);
    expect(model.isComplete()).toBe(false);
    expect(key(model.getStart())).toBe('2026-9-10');
    expect(model.getEnd()).toBe(null);
  });

  it('时间部分被归一化到当天零点（同一天的两个时刻不该变成非法区间）', () => {
    const model = new ICEDateRangeModel({ now: NOW });
    model.setValue(new Date(2026, 8, 10, 23, 59), new Date(2026, 8, 10, 0, 1));
    expect(model.getStart()!.getHours()).toBe(0);
    expect(model.isComplete()).toBe(true);
  });
});

describe('快捷预设', () => {
  it('今天 / 近 7 天（含今天） / 近 30 天 的解析都以「今天」为锚', () => {
    const model = new ICEDateRangeModel({ now: NOW });
    expect(model.applyPreset('today').map(key)).toEqual(['2026-9-14', '2026-9-14']);
    expect(model.applyPreset('last7').map(key)).toEqual(['2026-9-8', '2026-9-14']);
    expect(model.applyPreset('last30').map(key)).toEqual(['2026-8-16', '2026-9-14']);
  });

  it('本月 / 上月：起止都落在自然月边界上', () => {
    const model = new ICEDateRangeModel({ now: NOW });
    expect(model.applyPreset('thisMonth').map(key)).toEqual(['2026-9-1', '2026-9-30']);
    expect(model.applyPreset('lastMonth').map(key)).toEqual(['2026-8-1', '2026-8-31']);
  });

  it('matchPreset：当前区间正好等于某个预设时认出来（页面据此高亮快捷项）', () => {
    const model = new ICEDateRangeModel({ now: NOW });
    model.applyPreset('last7');
    expect(model.matchPreset()).toBe('last7');
    model.setValue(day(1), day(3));
    expect(model.matchPreset()).toBe(null);
  });

  it('预置项自带中文标签，供界面直接渲染', () => {
    const model = new ICEDateRangeModel({ now: NOW });
    const labels = model.getPresets().map((item) => item.label);
    expect(labels).toContain('今天');
    expect(labels).toContain('近 7 天');
    expect(model.getPresets().every((item) => !!item.key)).toBe(true);
  });
});

describe('变更通知', () => {
  it('setValue / applyPreset 通知一次，取消订阅后不再通知', () => {
    const model = new ICEDateRangeModel({ now: NOW });
    let count = 0;
    const off = model.addChangeListener(() => {
      count += 1;
    });
    model.setValue(day(1), day(2));
    expect(count).toBe(1);
    model.applyPreset('today');
    expect(count).toBe(2);
    off();
    model.setValue(day(3), day(4));
    expect(count).toBe(2);
  });
});
