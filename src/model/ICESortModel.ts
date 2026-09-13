/**
 * 排序轨迹（纯逻辑，不碰 canvas）。
 *
 * 它只做一件事：**把排序算法跑一遍，把过程录成一串帧**。回放交给 `ICETracePlayerModel`，
 * 画柱子交给页面（`examples/algorithm-sandbox.html` 里用一张 ICETileMap 画）。
 *
 * 一帧里带四样东西，正好对应可视化要画的四样：
 * - `values`：当前数组（柱子高度）；
 * - `compare`：正在比较的下标（黄色）；
 * - `swap`：刚刚交换 / 写入的下标（红色）；
 * - `sortedFrom`：从这里往后已经就位（绿色）。
 * 再带上 `comparisons` / `swaps` 两个计数 —— 页面上当「代价」展示，也是算法的客观指标。
 *
 * 为什么「先录轨迹、再回放」而不是「一边算一边画」：
 * 1. 算法本身能被单测（最终升序、每帧只是重排、比较次数上界）；
 * 2. 回放可以随便暂停、单步、倒带、变速，算法不用知道「现在第几帧」；
 * 3. 同一段轨迹可以换任意渲染方式（柱子 / 数字 / 音效），互不影响。
 */

export interface ICESortAlgorithm {
  key: string;
  label: string;
  complexity: string;
}

export interface ICESortFrame {
  values: number[];
  compare: number[];
  swap: number[];
  /** 从这里往后的元素已经就位；排完是 0 */
  sortedFrom: number;
  note: string;
  comparisons: number;
  swaps: number;
}

export interface ICESortOptions {
  /** 元素个数，默认 24 */
  size?: number;
  /** 最大值（柱子最高多少），默认 32 */
  max?: number;
  /** 随机源，测试可注入 */
  random?: () => number;
}

export const ICE_SORT_ALGORITHMS: ICESortAlgorithm[] = [
  { key: 'bubble', label: '冒泡排序', complexity: 'O(n²)' },
  { key: 'insertion', label: '插入排序', complexity: 'O(n²)' },
  { key: 'selection', label: '选择排序', complexity: 'O(n²)' },
  { key: 'merge', label: '归并排序', complexity: 'O(n log n)' },
  { key: 'quick', label: '快速排序', complexity: 'O(n log n)' },
];

export class ICESortModel {
  private size: number;
  private max: number;
  private random: () => number;
  private values: number[] = [];

  constructor(options: ICESortOptions = {}) {
    this.size = Math.max(1, Math.floor(options.size === undefined ? 24 : options.size));
    this.max = Math.max(2, Math.floor(options.max === undefined ? 32 : options.max));
    this.random = options.random || Math.random;
    this.randomize();
  }

  public getSize(): number { return this.size; }
  public getMax(): number { return this.max; }
  public getArray(): number[] { return this.values.slice(); }
  public getAlgorithms(): ICESortAlgorithm[] { return ICE_SORT_ALGORITHMS.map((item) => ({ ...item })); }

  /** 直接给一组数据（会取整、夹到 1..max）。 */
  public setArray(values: number[]): void {
    const list = Array.isArray(values) ? values : [];
    this.values = list.map((value) => this.__normalize(value));
    this.size = this.values.length;
  }

  /** 换一批新数据（1..max 的随机数）。 */
  public randomize(): void {
    const pool: number[] = [];
    for (let i = 0; i < this.size; i += 1) {
      pool.push(1 + Math.floor(this.random() * this.max));
    }
    this.values = pool;
  }

  /** 洗牌：把**当前这批数字**重新打乱（同一批数据换个顺序，方便对比不同算法）。 */
  public shuffle(): void {
    const next = this.values.slice();
    for (let i = next.length - 1; i > 0; i -= 1) {
      const j = Math.floor(this.random() * (i + 1));
      const temp = next[i];
      next[i] = next[j];
      next[j] = temp;
    }
    this.values = next;
  }

  /** 跑一遍算法，返回整段轨迹。 */
  public run(algorithm: string): ICESortFrame[] {
    const frames: ICESortFrame[] = [];
    const stats = { comparisons: 0, swaps: 0 };
    const snapshot = (compare: number[], swap: number[], sortedFrom: number, note: string) => {
      frames.push({
        values: this.values.slice(),
        compare: compare.slice(),
        swap: swap.slice(),
        sortedFrom,
        note,
        comparisons: stats.comparisons,
        swaps: stats.swaps,
      });
    };

    const swap = (i: number, j: number) => {
      const temp = this.values[i];
      this.values[i] = this.values[j];
      this.values[j] = temp;
      stats.swaps += 1;
    };
    const write = (index: number, value: number) => {
      this.values[index] = value;
      stats.swaps += 1;
    };

    if (this.values.length <= 1) {
      snapshot([], [], 0, '只有一个元素，无需排序');
      return frames;
    }

    switch (algorithm) {
      case 'bubble': {
        for (let end = this.values.length - 1; end > 0; end -= 1) {
          let swapped = false;
          for (let i = 0; i < end; i += 1) {
            stats.comparisons += 1;
            snapshot([i, i + 1], [], end + 1, `比较 ${i} 与 ${i + 1}`);
            if (this.values[i] > this.values[i + 1]) {
              swap(i, i + 1);
              swapped = true;
              snapshot([i, i + 1], [i, i + 1], end + 1, `交换 ${i} 与 ${i + 1}`);
            }
          }
          snapshot([], [], end, `${end} 号位已就位`);
          if (!swapped) {
            // 这一轮一次都没换 → 已经有序，剩下的都是就位状态
            snapshot([], [], 0, '本轮无交换，已经有序');
            break;
          }
        }
        snapshot([], [], 0, '排序完成');
        break;
      }
      case 'insertion': {
        snapshot([], [], 1, '第一个元素视为已排序');
        for (let i = 1; i < this.values.length; i += 1) {
          /**
           * 用「相邻交换」写法而不是「腾空位再逐格右移」：后者的中间态会临时出现重复值，
           * 而可视化里每一帧都该只是**同一批数字的重排**（单测就是这么断言的）。
           */
          let j = i;
          snapshot([j - 1], [], i, `把 ${this.values[j]} 往左插`);
          while (j > 0) {
            stats.comparisons += 1;
            snapshot([j - 1, j], [], i, `比较 ${j - 1} 与 ${j}`);
            if (this.values[j - 1] <= this.values[j]) break;
            swap(j - 1, j);
            snapshot([], [j - 1, j], i, `左移一位`);
            j -= 1;
          }
          snapshot([], [], i + 1, `前 ${i + 1} 个已就位`);
        }
        snapshot([], [], 0, '排序完成');
        break;
      }
      case 'selection': {
        for (let i = 0; i < this.values.length - 1; i += 1) {
          let min = i;
          for (let j = i + 1; j < this.values.length; j += 1) {
            stats.comparisons += 1;
            snapshot([min, j], [], i, `找最小值：比较 ${min} 与 ${j}`);
            if (this.values[j] < this.values[min]) min = j;
          }
          if (min !== i) {
            swap(i, min);
            snapshot([], [i, min], i, `把最小值换到 ${i}`);
          }
          snapshot([], [], i + 1, `${i} 号位已就位`);
        }
        snapshot([], [], 0, '排序完成');
        break;
      }
      case 'merge': {
        const sortRange = (left: number, right: number) => {
          if (right - left <= 1) return;
          const mid = (left + right) >> 1;
          sortRange(left, mid);
          sortRange(mid, right);
          const merged: number[] = [];
          let i = left;
          let j = mid;
          while (i < mid && j < right) {
            stats.comparisons += 1;
            snapshot([i, j], [], left, `合并：比较 ${i} 与 ${j}`);
            // <= 取左边 → 稳定排序
            if (this.values[i] <= this.values[j]) {
              merged.push(this.values[i]);
              i += 1;
            } else {
              merged.push(this.values[j]);
              j += 1;
            }
          }
          while (i < mid) {
            merged.push(this.values[i]);
            i += 1;
          }
          while (j < right) {
            merged.push(this.values[j]);
            j += 1;
          }
          /**
           * 整个区间**一次写回**：merged 是 left..right 这段的重排，所以写回前后都是同一批数字。
           * （逐格写回会把「空洞」暴露在帧里，出现重复值 —— 可视化上就是柱子凭空多了一根。）
           */
          for (let k = 0; k < merged.length; k += 1) this.values[left + k] = merged[k];
          stats.swaps += merged.length;
          const written: number[] = [];
          for (let k = left; k < right; k += 1) written.push(k);
          snapshot([], written, left, `合并 [${left}, ${right}) 写回 ${merged.length} 个`);
        };
        sortRange(0, this.values.length);
        snapshot([], [], 0, '排序完成');
        break;
      }
      case 'quick': {
        const sortRange = (left: number, right: number) => {
          if (left >= right) return;
          const pivot = this.values[right];
          let store = left;
          for (let i = left; i < right; i += 1) {
            stats.comparisons += 1;
            snapshot([i, right], [], left, `与基准 ${pivot} 比较`);
            if (this.values[i] < pivot) {
              if (i !== store) {
                swap(i, store);
                snapshot([], [i, store], left, `换到左半边`);
              }
              store += 1;
            }
          }
          if (store !== right) {
            swap(store, right);
            snapshot([], [store, right], left, `基准归位到 ${store}`);
          }
          snapshot([], [], left, `以 ${store} 分治`);
          sortRange(left, store - 1);
          sortRange(store + 1, right);
        };
        sortRange(0, this.values.length - 1);
        snapshot([], [], 0, '排序完成');
        break;
      }
      default:
        throw new Error(`ICESortModel: 未知排序算法 "${algorithm}"`);
    }
    return frames;
  }

  private __normalize(value: unknown): number {
    const number = Math.round(Number(value));
    if (!Number.isFinite(number)) return 1;
    return Math.max(1, Math.min(this.max, number));
  }
}

export default ICESortModel;
