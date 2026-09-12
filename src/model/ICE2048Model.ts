/**
 * 2048 的纯逻辑模型（不碰 canvas）。
 *
 * 规则按经典的 Gabriele Cirulli 版 2048：
 * - 开局两个块，值只能是 2 或 4（4 的概率由 `spawnFourChance` 控制，默认 10%）；
 * - `move(dir)` 把整盘往一个方向推：**同一次移动里每个块最多合并一次** ——
 *   `2,2,2,2` 往左是 `4,4`（不是 `8`），`2,2,4` 往左是 `4,4`（新合出来的 4 不会再吞掉后面的 4）；
 * - 合并得分 = 合并出来的值（4+4→8 得 8 分）；
 * - **只有真的动了才生成新块、才计一步**：推不动的方向返回 `false`，什么都不变；
 * - 棋盘填满且相邻无可合并 → game over；合并出 `target`（默认 2048）即 `isWon`，
 *   但**不结束**，可以继续冲高分；
 * - 新块位置由注入的 `random` 决定，测试可复现；`spawnAfterMove: false` 是「不刷新」的练习模式。
 */

/** 四个方向。 */
export type ICE2048Direction = 'up' | 'right' | 'down' | 'left';

/** 按上、右、下、左顺序排列（UI 画方向提示可以直接用）。 */
export const ICE_2048_DIRECTIONS: ICE2048Direction[] = ['up', 'right', 'down', 'left'];

export type ICE2048Cell = number | null;

export interface ICE2048Options {
  rows?: number;
  cols?: number;
  /** 随机源（0..1），默认 `Math.random` */
  random?: () => number;
  /** 合并出这个值算赢，默认 2048 */
  target?: number;
  /** 新块是 4 的概率，默认 0.1（其余是 2） */
  spawnFourChance?: number;
  /** 移动成功后是否生成新块，默认 true（关掉就是练习模式，便于测试断言整盘） */
  spawnAfterMove?: boolean;
}

export type ICE2048Listener = (model: ICE2048Model) => void;

export class ICE2048Model {
  private rows: number;
  private cols: number;
  private random: () => number;
  private target: number;
  private spawnFourChance: number;
  private spawnAfterMove: boolean;
  private cells: ICE2048Cell[] = [];
  private score = 0;
  private moves = 0;
  private won = false;
  private gameOver = false;
  private paused = false;
  /** 上一次移动里「合并落在哪几格」（UI 拿它做高亮 / 特效） */
  private lastMerged: Array<[number, number]> = [];
  private listeners = new Set<ICE2048Listener>();

  constructor(options: ICE2048Options = {}) {
    this.rows = Math.max(2, Math.floor(options.rows ?? 4));
    this.cols = Math.max(2, Math.floor(options.cols ?? 4));
    this.random = options.random || Math.random;
    this.target = Math.max(4, Math.floor(options.target ?? 2048));
    this.spawnFourChance = Math.min(1, Math.max(0, options.spawnFourChance === undefined ? 0.1 : options.spawnFourChance));
    this.spawnAfterMove = options.spawnAfterMove !== false;
    this.__resetBoard();
  }

  // ---------------------------------------------------------------- 查询

  getRows(): number {
    return this.rows;
  }

  getCols(): number {
    return this.cols;
  }

  /** 一维盘面（行优先），空格是 null。 */
  getCells(): ICE2048Cell[] {
    return this.cells.slice();
  }

  getCell(row: number, col: number): ICE2048Cell {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return null;
    return this.cells[row * this.cols + col];
  }

  getScore(): number {
    return this.score;
  }

  getMoves(): number {
    return this.moves;
  }

  getTarget(): number {
    return this.target;
  }

  /** 盘面上最大的块（空盘为 0）。 */
  getBestTile(): number {
    return this.cells.reduce<number>((best, value) => Math.max(best, Number(value) || 0), 0);
  }

  isWon(): boolean {
    return this.won;
  }

  isGameOver(): boolean {
    return this.gameOver;
  }

  isPaused(): boolean {
    return this.paused;
  }

  /** 上一次移动发生合并的格子（`[row, col]`）；没合并就是空数组。 */
  getLastMerged(): Array<[number, number]> {
    return this.lastMerged.map(([row, col]) => [row, col] as [number, number]);
  }

  /** 暂停：棋盘类页面（掌机）共用同一套 pause/resume 契约，这里暂停只挡输入。 */
  pause(): void {
    if (this.paused || this.gameOver) return;
    this.paused = true;
    this.notify();
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    this.notify();
  }

  /** 还有没有任何一个方向推得动。 */
  canMove(): boolean {
    if (this.gameOver || this.paused) return false;
    return ICE_2048_DIRECTIONS.some((direction) => this.__wouldMove(direction));
  }

  addChangeListener(listener: ICE2048Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  // ---------------------------------------------------------------- 操作

  /** 往一个方向推；推得动才返回 true（并计一步、生成新块）。 */
  move(direction: ICE2048Direction): boolean {
    if (this.gameOver || this.paused || ICE_2048_DIRECTIONS.indexOf(direction) === -1) return false;
    const before = this.cells.slice();
    let gained = 0;
    const mergedAt: Array<[number, number]> = [];
    for (let index = 0; index < this.__lineCount(); index += 1) {
      const line = this.__lineIndices(direction, index);
      const values = line.map((cellIndex) => this.cells[cellIndex]).filter((value) => value !== null) as number[];
      const merged: number[] = [];
      for (let i = 0; i < values.length; i += 1) {
        if (i + 1 < values.length && values[i] === values[i + 1]) {
          const value = values[i] * 2;
          const target = line[merged.length];
          if (target !== undefined) mergedAt.push([Math.floor(target / this.cols), target % this.cols]);
          merged.push(value);
          gained += value;
          i += 1; // 跳过被吞掉的那个：同一次移动里不再参与合并
        } else {
          merged.push(values[i]);
        }
      }
      line.forEach((cellIndex, position) => {
        this.cells[cellIndex] = merged[position] === undefined ? null : merged[position];
      });
    }
    const moved = this.cells.some((value, index) => value !== before[index]);
    if (!moved) {
      this.cells = before;
      return false;
    }
    this.score += gained;
    this.moves += 1;
    this.lastMerged = mergedAt;
    if (!this.won && this.getBestTile() >= this.target) this.won = true;
    if (this.spawnAfterMove) this.__spawnTile();
    this.__refreshGameOver();
    this.notify();
    return true;
  }

  /** 重置：可只覆盖部分选项。 */
  reset(options: ICE2048Options = {}): void {
    if (options.rows !== undefined) this.rows = Math.max(2, Math.floor(options.rows));
    if (options.cols !== undefined) this.cols = Math.max(2, Math.floor(options.cols));
    if (options.random) this.random = options.random;
    if (options.target !== undefined) this.target = Math.max(4, Math.floor(options.target));
    if (options.spawnFourChance !== undefined) {
      this.spawnFourChance = Math.min(1, Math.max(0, options.spawnFourChance));
    }
    if (options.spawnAfterMove !== undefined) this.spawnAfterMove = options.spawnAfterMove !== false;
    this.__resetBoard();
    this.notify();
  }

  // ------------------------------------------------------- 测试/存档用钩子

  /** 直接摆盘（长度必须等于 rows*cols，否则抛）。 */
  setCellsForTest(cells: ICE2048Cell[]): void {
    const expected = this.rows * this.cols;
    if (!cells || cells.length !== expected) {
      throw new Error(`ICE2048Model: setCellsForTest 需要 ${expected} 个格子，实际 ${cells ? cells.length : 0} 个`);
    }
    this.cells = cells.map((value) => (value === undefined || value === null ? null : Number(value)));
    this.__refreshGameOver();
    this.notify();
  }

  // ---------------------------------------------------------------- 内部

  private __resetBoard(): void {
    this.cells = new Array(this.rows * this.cols).fill(null);
    this.score = 0;
    this.moves = 0;
    this.won = false;
    this.gameOver = false;
    this.paused = false;
    this.lastMerged = [];
    this.__spawnTile();
    this.__spawnTile();
  }

  /** 在随机空格里放一个块：值 = 4 的概率由 spawnFourChance 控制。 */
  private __spawnTile(): void {
    const empty: number[] = [];
    this.cells.forEach((value, index) => {
      if (value === null) empty.push(index);
    });
    if (!empty.length) return;
    const position = Math.min(empty.length - 1, Math.floor(this.random() * empty.length));
    const value = this.random() < this.spawnFourChance ? 4 : 2;
    this.cells[empty[Math.max(0, position)]] = value;
  }

  private __lineCount(): number {
    return Math.max(this.rows, this.cols);
  }

  /**
   * 第 index 条线在给定方向下的**遍历顺序**（始终是「先碰到的在前」）：
   * 向左：从左到右；向右：从右到左；向上：从上到下；向下：从下到上。
   */
  private __lineIndices(direction: ICE2048Direction, index: number): number[] {
    const indices: number[] = [];
    if (direction === 'left' || direction === 'right') {
      if (index >= this.rows) return [];
      for (let col = 0; col < this.cols; col += 1) indices.push(index * this.cols + col);
      return direction === 'left' ? indices : indices.reverse();
    }
    if (index >= this.cols) return [];
    for (let row = 0; row < this.rows; row += 1) indices.push(row * this.cols + index);
    return direction === 'up' ? indices : indices.reverse();
  }

  /** 只算「推得动吗」，不改盘面（复制一份跑一遍）。 */
  private __wouldMove(direction: ICE2048Direction): boolean {
    const snapshot = this.cells.slice();
    for (let index = 0; index < this.__lineCount(); index += 1) {
      const line = this.__lineIndices(direction, index);
      const values = line.map((cellIndex) => this.cells[cellIndex]).filter((value) => value !== null) as number[];
      const merged: number[] = [];
      for (let i = 0; i < values.length; i += 1) {
        if (i + 1 < values.length && values[i] === values[i + 1]) {
          merged.push(values[i] * 2);
          i += 1;
        } else {
          merged.push(values[i]);
        }
      }
      line.forEach((cellIndex, position) => {
        this.cells[cellIndex] = merged[position] === undefined ? null : merged[position];
      });
    }
    const moved = this.cells.some((value, index) => value !== snapshot[index]);
    this.cells = snapshot;
    return moved;
  }

  /** 满盘且四邻都没有相同的块 → 结束。 */
  private __refreshGameOver(): void {
    if (this.cells.some((value) => value === null)) {
      this.gameOver = false;
      return;
    }
    for (let row = 0; row < this.rows; row += 1) {
      for (let col = 0; col < this.cols; col += 1) {
        const value = this.getCell(row, col);
        if (col + 1 < this.cols && value === this.getCell(row, col + 1)) {
          this.gameOver = false;
          return;
        }
        if (row + 1 < this.rows && value === this.getCell(row + 1, col)) {
          this.gameOver = false;
          return;
        }
      }
    }
    this.gameOver = true;
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener(this));
  }
}
