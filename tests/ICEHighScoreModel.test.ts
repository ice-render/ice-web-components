/**
 * ICEHighScoreModel 规格（排行榜的纯逻辑，不碰 canvas / localStorage）。
 *
 * 存储通过构造函数注入（默认 `globalThis.localStorage`）：
 * - `add(score)` 插入后按**分数降序**排、并列时**先来的在前**，超过 `maxEntries` 截断；
 * - `getBest()` 给最高分（空榜为 0）；`isInTop(score)` 用来判断「这一局值不值得弹排行榜」；
 * - 每个 `key`（卡带）互不干扰；
 * - 存档损坏（非法 JSON / 不是数组 / 里层字段不合法）一律降级成空榜，不抛异常；
 * - 写盘失败（隐私模式 / 配额满）不能影响内存中的成绩。
 */
import { ICEHighScoreModel } from '../src/model/ICEHighScoreModel';

/** 内存版 storage。 */
const makeStorage = () => {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => (data.has(key) ? (data.get(key) as string) : null),
    setItem: (key: string, value: string) => {
      data.set(key, String(value));
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
    raw: data,
  };
};

const makeModel = (options: any = {}) => new ICEHighScoreModel({ key: 'tetris', storage: makeStorage(), ...options });

describe('记分与排序', () => {
  it('空榜：没有成绩、最高分 0', () => {
    const model = makeModel();
    expect(model.getScores()).toEqual([]);
    expect(model.getBest()).toBe(0);
    expect(model.isInTop(1)).toBe(true);
  });

  it('按分数降序排，并列的先来的在前', () => {
    const model = makeModel();
    model.add(100, { at: 1 });
    model.add(300, { at: 2 });
    model.add(100, { at: 3 });
    expect(model.getScores().map((item) => [item.score, item.at])).toEqual([
      [300, 2],
      [100, 1],
      [100, 3],
    ]);
    expect(model.getBest()).toBe(300);
  });

  it('超过 maxEntries 时丢掉最小的，并返回截断后的榜', () => {
    const model = makeModel({ maxEntries: 3 });
    [10, 50, 30, 40].forEach((score) => model.add(score));
    expect(model.getScores().map((item) => item.score)).toEqual([50, 40, 30]);
    expect(model.getScores()).toHaveLength(3);
  });

  it('isInTop：榜满了以后，比最小的还小就进不去（相等能进）', () => {
    const model = makeModel({ maxEntries: 2 });
    model.add(100);
    model.add(50);
    expect(model.isInTop(10)).toBe(false);
    expect(model.isInTop(50)).toBe(true);
    expect(model.isInTop(500)).toBe(true);
  });

  it('非法分数（NaN / 负数 / 非数字）直接忽略', () => {
    const model = makeModel();
    model.add(Number.NaN);
    model.add(-5);
    model.add('abc' as any);
    expect(model.getScores()).toEqual([]);
    model.add(20);
    expect(model.getScores()).toHaveLength(1);
  });
});

describe('存档', () => {
  it('add / clear 会写盘，reload 能读回', () => {
    const storage = makeStorage();
    const model = new ICEHighScoreModel({ key: 'snake', storage });
    model.add(30, { at: 1000 });
    model.add(70, { at: 2000 });
    expect(storage.raw.size).toBe(1);

    const reopened = new ICEHighScoreModel({ key: 'snake', storage });
    expect(reopened.getScores().map((item) => item.score)).toEqual([70, 30]);
    expect(reopened.getBest()).toBe(70);

    reopened.clear();
    expect(new ICEHighScoreModel({ key: 'snake', storage }).getScores()).toEqual([]);
  });

  it('不同 key（卡带）互不干扰', () => {
    const storage = makeStorage();
    const tetris = new ICEHighScoreModel({ key: 'tetris', storage });
    const snake = new ICEHighScoreModel({ key: 'snake', storage });
    tetris.add(120);
    snake.add(40);
    expect(tetris.getBest()).toBe(120);
    expect(snake.getBest()).toBe(40);
  });

  it('存档损坏时降级成空榜，不抛异常', () => {
    const storage = makeStorage();
    storage.setItem('ice-arcade-scores-tetris', '{ 这不是 JSON');
    expect(new ICEHighScoreModel({ key: 'tetris', storage }).getScores()).toEqual([]);

    storage.setItem('ice-arcade-scores-tetris', JSON.stringify({ entries: 'nope' }));
    expect(new ICEHighScoreModel({ key: 'tetris', storage }).getScores()).toEqual([]);

    storage.setItem(
      'ice-arcade-scores-tetris',
      JSON.stringify({ entries: [{ score: 10 }, { score: 'x' }, null, { nope: 1 }, { score: 30 }] }),
    );
    expect(new ICEHighScoreModel({ key: 'tetris', storage }).getScores().map((item) => item.score)).toEqual([30, 10]);
  });

  it('写盘失败不影响内存里的成绩', () => {
    const storage = makeStorage();
    storage.setItem = () => {
      throw new Error('quota exceeded');
    };
    const model = new ICEHighScoreModel({ key: 'tetris', storage });
    expect(() => model.add(42)).not.toThrow();
    expect(model.getBest()).toBe(42);
  });

  it('没有 storage（node 环境）也能当纯内存榜用', () => {
    const model = new ICEHighScoreModel({ key: 'tetris', storage: null });
    model.add(9);
    expect(model.getBest()).toBe(9);
  });
});
