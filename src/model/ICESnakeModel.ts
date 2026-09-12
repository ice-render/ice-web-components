/**
 * 贪吃蛇的纯逻辑模型（不碰 canvas）。
 *
 * 规则按经典街机 / Nokia 贪吃蛇：
 * - **前进**：`tick()` 让头往前走一格、尾巴收一格（长度不变）；
 * - **吃食物**：头落到食物上 → 长度 +1、加分、食物重新生成（绝不落在蛇身上）；
 * - **转向**：可以排队两个转向依次生效；**不能 180° 掉头**（向右时按左无效）；
 * - **撞墙即死**；`wrap: true` 时穿墙（从左边出去从右边回来）；
 * - **撞自己即死**，但「正在移开的尾巴」不算 —— 那格这一步就空出来了；
 * - **越吃越快**：每 5 个升一级，`getTickInterval()` 按等级递减并有下限（70ms）；
 * - 暂停时 `tick()` 与转向都无效；食物位置由注入的 `random` 决定，测试可复现。
 *
 * 蛇身是 `[row, col]` 数组，**头在最前**（`body[0]`），和 `ICETetrisModel` 的坐标约定一致。
 */

/** 四个方向。 */
export type ICESnakeDirection = 'up' | 'right' | 'down' | 'left';

/** 按上、右、下、左顺序排列的方向表（UI 画方向盘可以直接用）。 */
export const ICE_SNAKE_DIRECTIONS: ICESnakeDirection[] = ['up', 'right', 'down', 'left'];

/** 棋盘上的一格。 */
export type ICESnakePoint = [number, number];

export interface ICESnakeOptions {
  rows?: number;
  cols?: number;
  /** 随机源（0..1），默认 `Math.random` —— 测试注入固定序列即可复现食物位置 */
  random?: () => number;
  /** 撞墙时穿墙而不是死（默认 false） */
  wrap?: boolean;
  /** 初始长度（默认 3，最小 2） */
  initialLength?: number;
}

export type ICESnakeListener = (model: ICESnakeModel) => void;

/** 方向 → 行列增量。 */
const STEPS: Record<ICESnakeDirection, ICESnakePoint> = {
  up: [-1, 0],
  right: [0, 1],
  down: [1, 0],
  left: [0, -1],
};

/** 反方向（用来挡 180° 掉头）。 */
const OPPOSITE: Record<ICESnakeDirection, ICESnakeDirection> = {
  up: 'down',
  right: 'left',
  down: 'up',
  left: 'right',
};

const BASE_INTERVAL = 170;
const MIN_INTERVAL = 70;
/** 每吃这么多食物升一级。 */
const FOOD_PER_LEVEL = 5;
/** 一个食物值多少分（再乘当前等级）。 */
const FOOD_SCORE = 10;

export class ICESnakeModel {
  private rows: number;
  private cols: number;
  private random: () => number;
  private wrap: boolean;
  private initialLength: number;
  private body: ICESnakePoint[] = [];
  private food: ICESnakePoint | null = null;
  private direction: ICESnakeDirection = 'right';
  /** 待生效的转向（最多两个，按顺序 consume） */
  private queue: ICESnakeDirection[] = [];
  private score = 0;
  private eaten = 0;
  private gameOver = false;
  private paused = false;
  private listeners = new Set<ICESnakeListener>();

  constructor(options: ICESnakeOptions = {}) {
    this.rows = Math.max(4, Math.floor(options.rows ?? 20));
    this.cols = Math.max(4, Math.floor(options.cols ?? 20));
    this.random = options.random || Math.random;
    this.wrap = options.wrap === true;
    this.initialLength = Math.max(2, Math.floor(options.initialLength ?? 3));
    this.__resetBoard();
  }

  // ---------------------------------------------------------------- 查询

  getRows(): number {
    return this.rows;
  }

  getCols(): number {
    return this.cols;
  }

  /** 蛇身（头在最前）。 */
  getBody(): ICESnakePoint[] {
    return this.body.map(([row, col]) => [row, col] as ICESnakePoint);
  }

  /** 头的坐标。 */
  getHead(): ICESnakePoint {
    return [this.body[0][0], this.body[0][1]];
  }

  getLength(): number {
    return this.body.length;
  }

  getFood(): ICESnakePoint | null {
    return this.food ? [this.food[0], this.food[1]] : null;
  }

  getDirection(): ICESnakeDirection {
    return this.direction;
  }

  /** 排队中的转向（UI 可以拿它显示「已接收输入」）。 */
  getPendingDirections(): ICESnakeDirection[] {
    return this.queue.slice();
  }

  getScore(): number {
    return this.score;
  }

  /** 已经吃掉的food个数。 */
  getEaten(): number {
    return this.eaten;
  }

  /** 每 5 个食物升一级，从 1 开始。 */
  getLevel(): number {
    return 1 + Math.floor(this.eaten / FOOD_PER_LEVEL);
  }

  /** 当前等级下的步进间隔（毫秒），等级越高越短，下限 70ms。 */
  getTickInterval(): number {
    return Math.max(MIN_INTERVAL, Math.round(BASE_INTERVAL * 0.88 ** (this.getLevel() - 1)));
  }

  isGameOver(): boolean {
    return this.gameOver;
  }

  isPaused(): boolean {
    return this.paused;
  }

  addChangeListener(listener: ICESnakeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  // ---------------------------------------------------------------- 操作

  /**
   * 掉头请求会被忽略并返回 `false`；重复的「当前方向」算接受（`true`）但不占队列；
   * 队列满（已有两个待生效转向）也会被忽略。
   */
  setDirection(direction: ICESnakeDirection): boolean {
    if (!STEPS[direction] || this.gameOver || this.paused) return false;
    const last = this.queue.length ? this.queue[this.queue.length - 1] : this.direction;
    if (direction === last) return true;
    if (direction === OPPOSITE[last]) return false;
    if (this.queue.length >= 2) return false;
    this.queue.push(direction);
    this.notify();
    return true;
  }

  /** 前进一步；撞墙 / 撞自己则进入 game over 并返回 false。 */
  tick(): boolean {
    if (this.gameOver || this.paused) return false;
    if (this.queue.length) this.direction = this.queue.shift() as ICESnakeDirection;
    const [headRow, headCol] = this.body[0];
    const [dRow, dCol] = STEPS[this.direction];
    let nextRow = headRow + dRow;
    let nextCol = headCol + dCol;

    if (this.wrap) {
      nextRow = (nextRow + this.rows) % this.rows;
      nextCol = (nextCol + this.cols) % this.cols;
    } else if (nextRow < 0 || nextRow >= this.rows || nextCol < 0 || nextCol >= this.cols) {
      return this.__die();
    }

    const willGrow = !!this.food && this.food[0] === nextRow && this.food[1] === nextCol;
    // 不吃食物时尾巴会挪走，所以「尾巴那一格」不算撞到自己
    const blocking = willGrow ? this.body : this.body.slice(0, this.body.length - 1);
    if (blocking.some(([row, col]) => row === nextRow && col === nextCol)) {
      return this.__die();
    }

    this.body.unshift([nextRow, nextCol]);
    if (willGrow) {
      this.score += FOOD_SCORE * this.getLevel();
      this.eaten += 1;
      this.__spawnFood();
      if (!this.food) {
        // 棋盘被填满：没有地方放食物了，算通关
        this.gameOver = true;
      }
    } else {
      this.body.pop();
    }
    this.notify();
    return true;
  }

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

  /** 重置：可只覆盖部分选项（行列、随机源、穿墙、初始长度）。 */
  reset(options: ICESnakeOptions = {}): void {
    if (options.rows !== undefined) this.rows = Math.max(4, Math.floor(options.rows));
    if (options.cols !== undefined) this.cols = Math.max(4, Math.floor(options.cols));
    if (options.random) this.random = options.random;
    if (options.wrap !== undefined) this.wrap = options.wrap === true;
    if (options.initialLength !== undefined) this.initialLength = Math.max(2, Math.floor(options.initialLength));
    this.__resetBoard();
    this.notify();
  }

  // ------------------------------------------------------- 测试/存档用钩子

  /** 直接摆一条蛇（造题、读档、UI demo 都用得上）。 */
  setBodyForTest(cells: ICESnakePoint[], direction?: ICESnakeDirection): void {
    if (!cells.length) return;
    this.body = cells.map(([row, col]) => [row, col] as ICESnakePoint);
    if (direction) this.direction = direction;
    this.queue = [];
    this.gameOver = false;
    this.notify();
  }

  /** 直接摆一个食物。 */
  setFoodForTest(row: number, col: number): void {
    this.food = [row, col];
    this.notify();
  }

  // ---------------------------------------------------------------- 内部

  private __resetBoard(): void {
    const midRow = Math.floor(this.rows / 2);
    const midCol = Math.floor(this.cols / 2);
    this.body = [];
    for (let i = 0; i < this.initialLength; i += 1) {
      this.body.push([midRow, midCol - i]);
    }
    this.direction = 'right';
    this.queue = [];
    this.score = 0;
    this.eaten = 0;
    this.gameOver = false;
    this.paused = false;
    this.food = null;
    this.__spawnFood();
  }

  private __die(): boolean {
    this.gameOver = true;
    this.notify();
    return false;
  }

  /** 在所有空格里随机挑一个放食物（挑不到说明棋盘满了）。 */
  private __spawnFood(): void {
    const free: ICESnakePoint[] = [];
    for (let row = 0; row < this.rows; row += 1) {
      for (let col = 0; col < this.cols; col += 1) {
        if (!this.body.some(([bodyRow, bodyCol]) => bodyRow === row && bodyCol === col)) {
          free.push([row, col]);
        }
      }
    }
    if (!free.length) {
      this.food = null;
      return;
    }
    const index = Math.min(free.length - 1, Math.floor(this.random() * free.length));
    this.food = free[Math.max(0, index)];
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener(this));
  }
}
