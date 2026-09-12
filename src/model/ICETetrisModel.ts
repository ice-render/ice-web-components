/**
 * 俄罗斯方块的纯逻辑模型（不碰 canvas）。
 *
 * 规则按现代标准俄罗斯方块（SRS-lite）：
 * - **7-bag 随机**：每 7 个方块恰好包含 7 种各一次（公平性），可用注入的 `random` 复现同一局；
 * - 移动/旋转受墙与已落方块阻挡；旋转带简易踢墙（0 / ±1 / ±2 依次尝试）；
 * - 重力由 `tick()` 驱动（下落一行），间隔随等级变快；
 * - 消行计分：1/2/3/4 行 = 100/300/500/800 × 等级；每 10 行升一级；
 * - 软降 +1 分/格、硬降 +2 分/格；
 * - 生成位置被占 → game over；暂停时所有操作无效。
 *
 * 棋盘格存的直接是方块类型（`'I' | 'O' | ... | null`），UI 层拿它当调色板的 key 用。
 */

/** 七种方块。 */
export type ICETetrominoType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';

/** 棋盘格子：落了方块就是它的类型，否则 null。 */
export type ICETetrisCell = ICETetrominoType | null;

/** 方块内的一格，用 `[row, col]` 相对（或绝对）坐标表示。 */
export type ICETetrisOffset = [number, number];

/** 方块类型 → 4 个旋转状态，每个状态是 4 个 `[row, col]` 偏移。 */
export type ICETetrominoShape = ICETetrisOffset[];

/** 每种方块记在方阵里的原始形状（3×3；I 用 4×4、O 用 2×2，旋转时以方阵中心转）。 */
const BASE_SHAPES: Record<ICETetrominoType, string[]> = {
  I: ['....', 'XXXX', '....', '....'],
  O: ['XX', 'XX'],
  T: ['.X.', 'XXX', '...'],
  S: ['.XX', 'XX.', '...'],
  Z: ['XX.', '.XX', '...'],
  J: ['X..', 'XXX', '...'],
  L: ['..X', 'XXX', '...'],
};

/** 顺时针旋转一个方阵（行列都是 `size`）。 */
function rotateMatrix(matrix: string[], size: number): string[] {
  const next: string[] = [];
  for (let row = 0; row < size; row += 1) {
    let line = '';
    for (let col = 0; col < size; col += 1) line += matrix[size - 1 - col][row];
    next.push(line);
  }
  return next;
}

/** 从字符画里抽出占位的格子。 */
function matrixToOffsets(matrix: string[]): ICETetrisOffset[] {
  const cells: ICETetrisOffset[] = [];
  matrix.forEach((line, row) => {
    for (let col = 0; col < line.length; col += 1) {
      if (line[col] === 'X') cells.push([row, col]);
    }
  });
  return cells;
}

/**
 * 七种方块 × 4 个旋转状态。
 * 旋转在固定的方阵内进行（不做归一化），因此 O 转完还是 O、I 会躺平/立起来。
 */
export const ICE_TETROMINOES: Record<ICETetrominoType, ICETetrominoShape[]> = (() => {
  const table = {} as Record<ICETetrominoType, ICETetrominoShape[]>;
  (Object.keys(BASE_SHAPES) as ICETetrominoType[]).forEach((type) => {
    const size = BASE_SHAPES[type].length;
    const states: ICETetrominoShape[] = [];
    let matrix = BASE_SHAPES[type];
    for (let i = 0; i < 4; i += 1) {
      states.push(matrixToOffsets(matrix));
      matrix = rotateMatrix(matrix, size);
    }
    table[type] = states;
  });
  return table;
})();

/** 当前正在下落的方块。 */
export interface ICETetrisPiece {
  type: ICETetrominoType;
  /** 旋转状态下标 0..3 */
  rotation: number;
  /** 方块左上角在棋盘上的行 */
  row: number;
  /** 方块左上角在棋盘上的列 */
  col: number;
  /** 四个格子的**绝对**棋盘坐标 */
  cells: ICETetrisOffset[];
}

export interface ICETetrisOptions {
  rows?: number;
  cols?: number;
  /** 随机源（0..1），默认 `Math.random` —— 测试注入固定序列即可复现 */
  random?: () => number;
}

export type ICETetrisListener = (model: ICETetrisModel) => void;

/** 消 1/2/3/4 行的基础分（再乘等级），经典数值。 */
export const ICE_TETRIS_LINE_SCORES = [0, 100, 300, 500, 800];

export class ICETetrisModel {
  private rows: number;
  private cols: number;
  private random: () => number;
  private board: ICETetrisCell[][] = [];
  private queue: ICETetrominoType[] = [];
  private current!: ICETetrisPiece;
  private score = 0;
  private lines = 0;
  private gameOver = false;
  private paused = false;
  private lastCleared = 0;
  private listeners = new Set<ICETetrisListener>();

  constructor(options: ICETetrisOptions = {}) {
    this.rows = Math.max(4, Math.floor(options.rows ?? 20));
    this.cols = Math.max(4, Math.floor(options.cols ?? 10));
    this.random = options.random || Math.random;
    this.__resetBoard();
  }

  // ---------------------------------------------------------------- 查询

  getRows(): number {
    return this.rows;
  }

  getCols(): number {
    return this.cols;
  }

  getBoard(): ICETetrisCell[][] {
    return this.board;
  }

  getCurrent(): ICETetrisPiece {
    return this.current;
  }

  /** 预览队列（下一个方块在 `[0]`）。 */
  getNextQueue(): ICETetrominoType[] {
    return this.queue.slice();
  }

  isGameOver(): boolean {
    return this.gameOver;
  }

  isPaused(): boolean {
    return this.paused;
  }

  getScore(): number {
    return this.score;
  }

  getLines(): number {
    return this.lines;
  }

  /** 上一次锁定消掉了几行（0 表示没消；UI 用它做特效/连击提示）。 */
  getLastClearedLines(): number {
    return this.lastCleared;
  }

  /** 每 10 行升一级，从 1 开始。 */
  getLevel(): number {
    return 1 + Math.floor(this.lines / 10);
  }

  /** 当前等级下的自动下落间隔（毫秒），等级越高越短。 */
  getDropInterval(): number {
    return Math.max(60, Math.round(800 * 0.82 ** (this.getLevel() - 1)));
  }

  /** 当前方块笔直落下去会停在哪（画幽灵投影用）。 */
  getGhost(): ICETetrisOffset[] {
    let cells = this.current.cells.slice() as ICETetrisOffset[];
    for (;;) {
      const next = cells.map(([row, col]) => [row + 1, col] as ICETetrisOffset);
      if (this.collides(next)) return cells;
      cells = next;
    }
  }

  addChangeListener(listener: ICETetrisListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  // ---------------------------------------------------------------- 操作

  moveLeft(): boolean {
    return this.tryMove(0, -1);
  }

  moveRight(): boolean {
    return this.tryMove(0, 1);
  }

  /** 顺时针旋转（带上踢墙）。 */
  rotateCW(): boolean {
    return this.tryRotate(1);
  }

  /** 逆时针旋转（带上踢墙）。 */
  rotateCCW(): boolean {
    return this.tryRotate(3);
  }

  /** 重力：下落一行；到底就锁定。 */
  tick(): boolean {
    return this.stepDown(false);
  }

  /** 软降：下落一行并 +1 分；到底就锁定。 */
  softDrop(): boolean {
    return this.stepDown(true);
  }

  /** 硬降：一步落到底、锁定，按落下的格数 +2 分/格。 */
  hardDrop(): boolean {
    if (this.blocked()) return false;
    let distance = 0;
    while (this.tryMoveQuiet(1, 0)) distance += 1;
    this.score += distance * 2;
    this.lock();
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

  /** 重置：可只覆盖部分选项（行列、随机源），其余沿用构造时的配置。 */
  reset(options: ICETetrisOptions = {}): void {
    if (options.rows !== undefined) this.rows = Math.max(4, Math.floor(options.rows));
    if (options.cols !== undefined) this.cols = Math.max(4, Math.floor(options.cols));
    if (options.random) this.random = options.random;
    this.__resetBoard();
    this.notify();
  }

  // ------------------------------------------------------- 测试/存档用钩子

  /** 直接摆一格（造题、读档、UI demo 都用得上）。 */
  setCellForTest(row: number, col: number, type: ICETetrominoType | null): void {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return;
    this.board[row][col] = type;
    this.notify();
  }

  /** 直接改累计消行数（测试升级曲线用）。 */
  setLinesForTest(lines: number): void {
    this.lines = Math.max(0, Math.floor(lines));
    this.notify();
  }

  // ---------------------------------------------------------------- 内部

  private __resetBoard(): void {
    this.board = Array.from({ length: this.rows }, () => Array<ICETetrisCell>(this.cols).fill(null));
    this.queue = [];
    this.score = 0;
    this.lines = 0;
    this.lastCleared = 0;
    this.gameOver = false;
    this.paused = false;
    this.refillQueue();
    this.spawn();
  }

  /** 暂停 / 结束 / 没有当前方块时，一切输入无效。 */
  private blocked(): boolean {
    return this.paused || this.gameOver;
  }

  private tryMove(dRow: number, dCol: number): boolean {
    if (!this.tryMoveQuiet(dRow, dCol)) return false;
    this.notify();
    return true;
  }

  /** 移动但不通知（硬降内部用，避免一次操作刷屏）。 */
  private tryMoveQuiet(dRow: number, dCol: number): boolean {
    if (this.blocked()) return false;
    const cells = this.current.cells.map(([row, col]) => [row + dRow, col + dCol] as ICETetrisOffset);
    if (this.collides(cells)) return false;
    this.current.row += dRow;
    this.current.col += dCol;
    this.current.cells = cells;
    return true;
  }

  /** 旋转 + 踢墙：依次尝试 (0,0) → 左右各 1 → 左右各 2 → 上抬一格。 */
  private tryRotate(delta: number): boolean {
    if (this.blocked()) return false;
    const piece = this.current;
    const rotation = (piece.rotation + delta) % 4;
    const offsets = ICE_TETROMINOES[piece.type][rotation];
    const kicks: ICETetrisOffset[] = [
      [0, 0],
      [0, -1],
      [0, 1],
      [0, -2],
      [0, 2],
      [-1, 0],
      [-1, -1],
      [-1, 1],
    ];
    for (let i = 0; i < kicks.length; i += 1) {
      const [dRow, dCol] = kicks[i];
      const cells = offsets.map(([row, col]) => [piece.row + row + dRow, piece.col + col + dCol] as ICETetrisOffset);
      if (this.collides(cells)) continue;
      piece.rotation = rotation;
      piece.row += dRow;
      piece.col += dCol;
      piece.cells = cells;
      this.notify();
      return true;
    }
    return false;
  }

  private stepDown(soft: boolean): boolean {
    if (this.blocked()) return false;
    if (this.tryMoveQuiet(1, 0)) {
      if (soft) this.score += 1;
      this.notify();
      return true;
    }
    this.lock();
    this.notify();
    return false;
  }

  /** 把当前方块写进棋盘 → 消行 → 出下一个；顶到天花板就 game over。 */
  private lock(): void {
    const piece = this.current;
    let overflow = false;
    this.lastCleared = 0;
    piece.cells.forEach(([row, col]) => {
      if (row < 0) {
        overflow = true;
        return;
      }
      if (row < this.rows && col >= 0 && col < this.cols) this.board[row][col] = piece.type;
    });
    this.clearLines();
    if (overflow) {
      this.gameOver = true;
      return;
    }
    this.spawn();
  }

  private clearLines(): void {
    const kept = this.board.filter((row) => row.some((cell) => !cell));
    const cleared = this.rows - kept.length;
    if (cleared <= 0) return;
    while (kept.length < this.rows) kept.unshift(Array<ICETetrisCell>(this.cols).fill(null));
    this.board = kept;
    this.lastCleared = cleared;
    this.score += (ICE_TETRIS_LINE_SCORES[Math.min(cleared, 4)] || 0) * this.getLevel();
    this.lines += cleared;
  }

  private spawn(): void {
    this.refillQueue();
    const type = this.queue.shift() as ICETetrominoType;
    const offsets = ICE_TETROMINOES[type][0];
    const width = Math.max(...offsets.map(([, col]) => col)) + 1;
    const row = 0;
    const col = Math.floor((this.cols - width) / 2);
    const piece: ICETetrisPiece = {
      type,
      rotation: 0,
      row,
      col,
      cells: offsets.map(([r, c]) => [row + r, col + c] as ICETetrisOffset),
    };
    this.current = piece;
    if (this.collides(piece.cells)) this.gameOver = true;
  }

  /** 队列见底就补一袋（保证预览里永远有下一袋可看）。 */
  private refillQueue(): void {
    while (this.queue.length < 14) {
      const bag = Object.keys(ICE_TETROMINOES) as ICETetrominoType[];
      for (let i = bag.length - 1; i > 0; i -= 1) {
        const j = Math.floor(this.random() * (i + 1));
        const tmp = bag[i];
        bag[i] = bag[j];
        bag[j] = tmp;
      }
      this.queue.push(...bag);
    }
  }

  private collides(cells: ICETetrisOffset[]): boolean {
    for (let i = 0; i < cells.length; i += 1) {
      const row = cells[i][0];
      const col = cells[i][1];
      if (col < 0 || col >= this.cols) return true;
      if (row >= this.rows) return true;
      // 顶部之上（row < 0）先放行：旋转/出生瞬间允许探出，锁定时再判溢出
      if (row < 0) continue;
      if (this.board[row][col]) return true;
    }
    return false;
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener(this));
  }
}
