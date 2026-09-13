/**
 * 排序轨迹模型的规格（纯逻辑）。
 *
 * 它只做一件事：把五种排序算法跑一遍，把过程录成一串帧（回放交给 `ICETracePlayerModel`）。
 * 一帧里带三样东西，正好对应可视化要画的三样：当前数组 values（柱子高度）、正在比较的
 * 两个下标 compare（黄色）、刚刚交换的下标 swap（红色），外加 sortedFrom（从这里往后已就位）。
 * 再带上 comparisons / swaps 两个计数 —— 页面上当「代价」展示，也是算法的客观指标。
 */
import { ICESortModel, ICE_SORT_ALGORITHMS } from '../src/model/ICESortModel';

const makeModel = (values: number[]) => {
  const model = new ICESortModel({ size: values.length, random: () => 0.5 });
  model.setArray(values);
  return model;
};
/** 轨迹跑完之后的最终数组（最后一帧的 values）。 */
const lastValues = (frames: Array<{ values: number[] }>) => frames[frames.length - 1].values;

describe('数组与算法表', () => {
  it('默认数组随机但落在 1..max 之间，长度正确', () => {
    const model = new ICESortModel({ size: 12, max: 20, random: () => 0.42 });
    expect(model.getArray()).toHaveLength(12);
    model.getArray().forEach((value) => {
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(20);
    });
  });

  it('setArray 会取整并夹到合法范围（负数、小数、NaN 都不许进来）', () => {
    const model = makeModel([5, 3, 9, 1]);
    model.setArray([3.7, -2, Number.NaN, 999]);
    expect(model.getArray()).toEqual([4, 1, 1, 32]);
    expect(model.getArray().every((value) => value >= 1)).toBe(true);
  });

  it('算法表：五种经典排序，每种都带复杂度标签', () => {
    expect(ICE_SORT_ALGORITHMS.map((item) => item.key)).toEqual(['bubble', 'insertion', 'selection', 'merge', 'quick']);
    expect(ICE_SORT_ALGORITHMS.every((item) => item.label && item.complexity)).toBe(true);
  });
});

describe('五种排序的轨迹都真的能排好', () => {
  const input = [5, 3, 8, 1, 9, 2, 7, 4, 6, 5];
  const expected = [...input].sort((a, b) => a - b);

  ICE_SORT_ALGORITHMS.forEach((algorithm) => {
    it(`${algorithm.label}：最后一帧是升序，且每一帧都只是原数组的重排`, () => {
      const model = makeModel(input);
      const frames = model.run(algorithm.key);
      expect(frames.length).toBeGreaterThan(2);
      expect(lastValues(frames)).toEqual(expected);
      const sortedInput = [...input].sort((a, b) => a - b);
      frames.forEach((frame) => {
        expect([...frame.values].sort((a, b) => a - b)).toEqual(sortedInput);
      });
      expect(frames[frames.length - 1].sortedFrom).toBe(0);
      frames.forEach((frame) => {
        frame.compare.concat(frame.swap).forEach((index) => {
          expect(index).toBeGreaterThanOrEqual(0);
          expect(index).toBeLessThan(input.length);
        });
      });
    });
  });

  it('统计：冒泡的比较次数不超过 n(n-1)/2，交换次数大于 0', () => {
    const model = makeModel(input);
    const frames = model.run('bubble');
    const final = frames[frames.length - 1];
    expect(final.comparisons).toBeGreaterThan(0);
    expect(final.comparisons).toBeLessThanOrEqual((input.length * (input.length - 1)) / 2);
    expect(final.swaps).toBeGreaterThan(0);
  });

  it('已经是升序时，冒泡只做比较（交换 0 次）', () => {
    const model = makeModel([1, 2, 3, 4, 5, 6]);
    const frames = model.run('bubble');
    expect(frames[frames.length - 1].swaps).toBe(0);
    expect(lastValues(frames)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('快速排序对已经升序的输入也能正确排好（不会退化到卡死）', () => {
    const model = makeModel([1, 2, 3, 4, 5, 6, 7, 8]);
    const frames = model.run('quick');
    expect(lastValues(frames)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(frames.length).toBeGreaterThan(0);
  });

  it('归并排序是稳定排序：值相等时保持原顺序（重复值也排得稳）', () => {
    const model = makeModel([3, 1, 3, 2, 3, 1]);
    const frames = model.run('merge');
    expect(lastValues(frames)).toEqual([1, 1, 2, 3, 3, 3]);
  });

  it('未知算法抛错（编程错误要早点炸）', () => {
    const model = makeModel([3, 1, 2]);
    expect(() => model.run('not-an-algorithm')).toThrow(/未知排序算法/);
  });

  it('空数组 / 单元素：给一帧就收工，不崩', () => {
    const empty = new ICESortModel({ size: 1 });
    empty.setArray([]);
    expect(empty.run('bubble')).toHaveLength(1);
    const single = makeModel([7]);
    expect(lastValues(single.run('quick'))).toEqual([7]);
  });

  it('shuffle 之后还是同一批数字（洗牌不是重新随机）', () => {
    const model = makeModel([1, 2, 3, 4, 5, 6, 7, 8]);
    model.shuffle();
    expect([...model.getArray()].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});
