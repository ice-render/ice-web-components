/**
 * 扫雷的纯逻辑模型（不碰 canvas）。
 *
 * 规则按 Windows XP 扫雷：
 * - **首次点击安全**：第一次掀开格子时才布雷，且排除该格及其 8 邻域（空间够时）——
 *   所以第一下永远不会炸，也常常一下展开一片；
 * - **揭示**：相邻雷数为 0 时洪水填充展开整片空白；
 * - **插旗循环**：无 → 🚩 → ❓ → 无（`questionMarks: false` 时只有旗）；
 * - **chord**（双击数字）：周围旗数等于数字时，掀开其余未插旗的邻格（可能炸）；
 * - **胜负**：掀开所有非雷格 = 胜；掀开雷 = 负（把所有雷亮出来）；
 * - **计时**：由调用方 `tick()`（每秒一次）驱动；**只有 playing 才累加**（XP 的计时从第一次点击开始），
 *   结束或还没开始都不动 —— 测试里可直接手动推进。
 *
 * 布雷用注入的 `random`（默认 `Math.random`），测试传固定序列即可复现棋局。
 */
export interface ICEMinesweeperDifficulty {
  key: string;
  label: string;
  rows: number;
  cols: number;
  mines: number;
}

/** XP 扫雷的三档标准难度。 */
export const ICE_MINESWEEPER_DIFFICULTIES: ICEMinesweeperDifficulty[] = [
  { key: 'beginner', label: '初级', rows: 9, cols: 9, mines: 10 },
  { key: 'intermediate', label: '中级', rows: 16, cols: 16, mines: 40 },
  { key: 'expert', label: '高级', rows: 16, cols: 30, mines: 99 },
];

export type ICEMinesweeperState = 'ready' | 'playing' | 'won' | 'lost';

export interface ICEMinesweeperCell {
  row: number;
  col: number;
  mine: boolean;
  revealed: boolean;
  flagged: boolean;
  question: boolean;
  /** 周围 8 格的雷数 */
  adjacent: number;
}

export interface ICEMinesweeperOptions {
  rows?: number;
  cols?: number;
  mines?: number;
  /** 随机源（0..1），默认 Math.random —— 测试可注入固定序列 */
  random?: () => number;
  /** 首次点击安全（默认 true） */
  firstClickSafe?: boolean;
  /** 插旗循环里是否带问号（默认 true） */
  questionMarks?: boolean;
}

export type ICEMinesweeperListener = (model: ICEMinesweeperModel) => void;

export class ICEMinesweeperModel {
  private rows: number;
  private cols: number;
  private mineCount: number;
  private random: () => number;
  private firstClickSafe: boolean;
  private questionMarks: boolean;
  private grid: ICEMinesweeperCell[] = [];
  private state: ICEMinesweeperState = 'ready';
  private minesPlaced = false;
  private elapsed = 0;
  private listeners = new Set<ICEMinesweeperListener>();

  constructor(options: ICEMinesweeperOptions = {}) {
    this.rows = Math.max(1, Math.floor(options.rows ?? 9));
    this.cols = Math.max(1, Math.floor(options.cols ?? 9));
    this.mineCount = Math.max(1, Math.min(this.rows * this.cols - 1, Math.floor(options.mines ?? 10)));
    this.random = options.random || Math.random;
    this.firstClickSafe = options.firstClickSafe !== false;
    this.questionMarks = options.questionMarks !== false;
    this.__resetGrid();
  }

  public getRows(): number {
    return this.rows;
  }

  public getCols(): number {
    return this.cols;
  }

  public getMineCount(): number {
    return this.mineCount;
  }

  public getState(): ICEMinesweeperState {
    return this.state;
  }

  public isWon(): boolean {
    return this.state === 'won';
  }

  public isLost(): boolean {
    return this.state === 'lost';
  }

  public isOver(): boolean {
    return this.state === 'won' || this.state === 'lost';
  }

  public getElapsed(): number {
    return this.elapsed;
  }

  public getFlags(): number {
    return this.grid.filter((cell) => cell.flagged).length;
  }

  /** 剩余雷数 = 总雷数 - 已插旗数（可能为负，和 XP 一样显示负数）。 */
  public getMinesLeft(): number {
    return this.mineCount - this.getFlags();
  }

  public getRevealedCount(): number {
    return this.grid.filter((cell) => cell.revealed).length;
  }

  public getCells(): ICEMinesweeperCell[] {
    return this.grid.map((cell) => ({ ...cell }));
  }

  public getCell(row: number, col: number): ICEMinesweeperCell | null {
    if (!this.__inBounds(row, col)) {
      return null;
    }
    return { ...this.grid[row * this.cols + col] };
  }

  /** 雷是否已经布好（首点安全时，第一次 reveal 之后才会布）。 */
  public areMinesPlaced(): boolean {
    return this.minesPlaced;
  }

  /** 相邻 8 格的坐标。 */
  public neighbors(row: number, col: number): Array<[number, number]> {
    const out: Array<[number, number]> = [];
    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        if (!dr && !dc) continue;
        const r = row + dr;
        const c = col + dc;
        if (this.__inBounds(r, c)) {
          out.push([r, c]);
        }
      }
    }
    return out;
  }

  /** 掀开格子（插旗的会被忽略）。首次掀开时布雷（首点安全）。 */
  public reveal(row: number, col: number): this {
    if (this.isOver() || !this.__inBounds(row, col)) {
      return this;
    }
    const cell = this.__at(row, col);
    if (cell.flagged || cell.revealed) {
      return this;
    }
    if (!this.minesPlaced) {
      this.__placeMines(this.firstClickSafe ? [row, col] : null);
      this.state = 'playing';
    }
    this.__revealCell(row, col);
    this.__checkFinish();
    this.__notify();
    return this;
  }

  /** 右键：无 → 旗 → 问号 → 无。 */
  public toggleFlag(row: number, col: number): this {
    if (this.isOver() || !this.__inBounds(row, col)) {
      return this;
    }
    const cell = this.__at(row, col);
    if (cell.revealed) {
      return this;
    }
    if (cell.flagged) {
      cell.flagged = false;
      cell.question = this.questionMarks;
    } else if (cell.question) {
      cell.question = false;
    } else {
      cell.flagged = true;
    }
    this.__notify();
    return this;
  }

  /** 双击已掀开的数字：周围旗数够时掀开其余邻格。 */
  public chord(row: number, col: number): this {
    if (this.isOver() || !this.__inBounds(row, col)) {
      return this;
    }
    const cell = this.__at(row, col);
    if (!cell.revealed || cell.adjacent === 0) {
      return this;
    }
    const around = this.neighbors(row, col);
    const flags = around.filter(([r, c]) => this.__at(r, c).flagged).length;
    if (flags !== cell.adjacent) {
      return this;
    }
    around
      .filter(([r, c]) => !this.__at(r, c).flagged && !this.__at(r, c).revealed)
      .forEach(([r, c]) => this.__revealCell(r, c));
    this.__checkFinish();
    this.__notify();
    return this;
  }

  /**
   * 计时 +1 秒（调用方按秒驱动）。只有 `playing` 才累加：
   * 还没点第一下（ready）不计时（和 XP 一致），胜负已分之后也不计。
   */
  public tick(): this {
    if (this.state === 'playing') {
      this.elapsed += 1;
    }
    return this;
  }

  /** 重开（可顺带换难度）。 */
  public reset(options: ICEMinesweeperOptions = {}): this {
    if (options.rows !== undefined) this.rows = Math.max(1, Math.floor(options.rows));
    if (options.cols !== undefined) this.cols = Math.max(1, Math.floor(options.cols));
    if (options.mines !== undefined) {
      this.mineCount = Math.max(1, Math.min(this.rows * this.cols - 1, Math.floor(options.mines)));
    }
    this.__resetGrid();
    this.__notify();
    return this;
  }

  public addChangeListener(listener: ICEMinesweeperListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private __inBounds(row: number, col: number): boolean {
    return row >= 0 && row < this.rows && col >= 0 && col < this.cols;
  }

  private __at(row: number, col: number): ICEMinesweeperCell {
    return this.grid[row * this.cols + col];
  }

  private __resetGrid(): void {
    this.grid = [];
    for (let row = 0; row < this.rows; row += 1) {
      for (let col = 0; col < this.cols; col += 1) {
        this.grid.push({ row, col, mine: false, revealed: false, flagged: false, question: false, adjacent: 0 });
      }
    }
    this.state = 'ready';
    this.minesPlaced = false;
    this.elapsed = 0;
    // 关掉「首点安全」时，棋局在构造/重开时就布好雷（可复现的固定棋局，测试与工具用）
    if (!this.firstClickSafe) {
      this.__placeMines(null);
    }
  }

  /** 布雷：`safe` 是首点坐标（连同 8 邻域一起排除）。 */
  private __placeMines(safe: [number, number] | null): void {
    const forbidden = new Set<number>();
    if (safe) {
      forbidden.add(safe[0] * this.cols + safe[1]);
      this.neighbors(safe[0], safe[1]).forEach(([r, c]) => forbidden.add(r * this.cols + c));
    }
    const pool = this.grid
      .map((cell, index) => index)
      .filter((index) => !forbidden.has(index));
    // 空间不足（小棋盘 + 多雷）时退化成「只排除首点」
    const candidates = pool.length >= this.mineCount ? pool : this.grid.map((cell, index) => index).filter((index) => !safe || index !== safe[0] * this.cols + safe[1]);
    for (let placed = 0; placed < this.mineCount && candidates.length; placed += 1) {
      const pick = Math.min(candidates.length - 1, Math.floor(this.random() * candidates.length));
      const index = candidates.splice(pick, 1)[0];
      this.grid[index].mine = true;
    }
    this.grid.forEach((cell) => {
      cell.adjacent = this.neighbors(cell.row, cell.col).filter(([r, c]) => this.__at(r, c).mine).length;
    });
    this.minesPlaced = true;
  }

  /** 掀开一格：是雷就结束，是 0 就递归展开。 */
  private __revealCell(row: number, col: number): void {
    const cell = this.__at(row, col);
    if (cell.revealed || cell.flagged) {
      return;
    }
    cell.revealed = true;
    cell.question = false;
    if (cell.mine) {
      this.state = 'lost';
      // 失败时把雷亮出来（XP 的行为）
      this.grid.filter((other) => other.mine).forEach((other) => (other.revealed = true));
      return;
    }
    if (cell.adjacent === 0) {
      this.neighbors(row, col).forEach(([r, c]) => {
        const next = this.__at(r, c);
        if (!next.revealed && !next.flagged && !next.mine) {
          this.__revealCell(r, c);
        }
      });
    }
  }

  private __checkFinish(): void {
    if (this.isOver()) {
      return;
    }
    const safeLeft = this.rows * this.cols - this.mineCount - this.getRevealedCount();
    if (safeLeft <= 0) {
      this.state = 'won';
      // 胜利时自动给所有雷插旗（XP 的行为）
      this.grid.filter((cell) => cell.mine).forEach((cell) => (cell.flagged = true));
    }
  }

  private __notify(): void {
    this.listeners.forEach((listener) => listener(this));
  }
}
