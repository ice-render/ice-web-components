/**
 * 迷宫寻路轨迹（纯逻辑，不碰 canvas）。
 *
 * 和排序那边同一套路：**先算完整段过程录成一串帧**，回放交给 `ICETracePlayerModel`，
 * 画面由页面用一张 ICETileMap 画（每格一个状态）。
 *
 * 网格是「行优先的一维数组」，每格一个状态（空 / 墙 / 起点 / 终点 / 已访问 / 边界 / 路径）。
 * 四种算法在无权网格上每步代价都是 1，区别只在**怎么挑下一个格子**：
 * - BFS：队列 → 层序扩展，首次到达即最短；
 * - DFS：栈 → 一条道走到黑，找得到但不保证最短；
 * - Dijkstra：按代价取最小（无权网格里等价于 BFS，保留它是为了「代价」这条语义）；
 * - A*：代价 + 曼哈顿距离启发 → 同样最短，但访问的格子更少。
 */

export const ICE_MAZE_CELL = {
  EMPTY: 0,
  WALL: 1,
  START: 2,
  GOAL: 3,
  VISITED: 4,
  FRONTIER: 5,
  PATH: 6,
} as const;

export interface ICEMazeAlgorithm {
  key: string;
  label: string;
  note: string;
}

export interface ICEMazeFrame {
  /** 本帧的网格快照（可视化直接照着画） */
  cells: number[];
  /** 当前正在处理的格子（-1 表示没有） */
  current: number;
  /** 待探索的边界 */
  frontier: number[];
  /** 已经处理过的格子 */
  visited: number[];
  /** 找到路径之后才有（按起点 → 终点排序） */
  path: number[];
  reached: boolean;
  note: string;
  /** 访问过多少格（代价指标） */
  visitedCount: number;
}

export interface ICEMazeOptions {
  rows?: number;
  cols?: number;
  random?: () => number;
}

export const ICE_MAZE_ALGORITHMS: ICEMazeAlgorithm[] = [
  { key: 'bfs', label: '广度优先 BFS', note: '队列 · 保证最短路' },
  { key: 'dfs', label: '深度优先 DFS', note: '栈 · 不一定最短' },
  { key: 'dijkstra', label: 'Dijkstra', note: '按代价取最小' },
  { key: 'astar', label: 'A* 启发式', note: '曼哈顿距离 · 更快找到' },
];

export class ICEMazeModel {
  private rows: number;
  private cols: number;
  private random: () => number;
  private walls: boolean[] = [];
  private start: [number, number] = [0, 0];
  private goal: [number, number] = [0, 0];

  constructor(options: ICEMazeOptions = {}) {
    this.rows = Math.max(2, Math.floor(options.rows === undefined ? 16 : options.rows));
    this.cols = Math.max(2, Math.floor(options.cols === undefined ? 24 : options.cols));
    this.random = options.random || Math.random;
    this.walls = new Array(this.rows * this.cols).fill(false);
    this.start = [0, 0];
    this.goal = [this.rows - 1, this.cols - 1];
  }

  // ------------------------------------------------------------------ 查询
  public getRows(): number { return this.rows; }
  public getCols(): number { return this.cols; }
  public getStart(): [number, number] { return [this.start[0], this.start[1]]; }
  public getGoal(): [number, number] { return [this.goal[0], this.goal[1]]; }
  public getAlgorithms(): ICEMazeAlgorithm[] { return ICE_MAZE_ALGORITHMS.map((item) => ({ ...item })); }

  /** 可视化用的网格状态（起点/终点/墙）。 */
  public getCells(): number[] {
    const cells = new Array(this.rows * this.cols).fill(ICE_MAZE_CELL.EMPTY);
    for (let i = 0; i < cells.length; i += 1) {
      if (this.walls[i]) cells[i] = ICE_MAZE_CELL.WALL;
    }
    cells[this.__index(this.start[0], this.start[1])] = ICE_MAZE_CELL.START;
    cells[this.__index(this.goal[0], this.goal[1])] = ICE_MAZE_CELL.GOAL;
    return cells;
  }

  public getCell(row: number, col: number): number {
    if (!this.__inside(row, col)) return ICE_MAZE_CELL.WALL;
    const index = this.__index(row, col);
    if (this.walls[index]) return ICE_MAZE_CELL.WALL;
    if (row === this.start[0] && col === this.start[1]) return ICE_MAZE_CELL.START;
    if (row === this.goal[0] && col === this.goal[1]) return ICE_MAZE_CELL.GOAL;
    return ICE_MAZE_CELL.EMPTY;
  }

  public isWall(row: number, col: number): boolean {
    return this.__inside(row, col) ? this.walls[this.__index(row, col)] : true;
  }

  // ------------------------------------------------------------------ 编辑
  public setWall(row: number, col: number, wall: boolean): boolean {
    if (!this.__inside(row, col)) return false;
    if (row === this.start[0] && col === this.start[1]) return false;
    if (row === this.goal[0] && col === this.goal[1]) return false;
    const index = this.__index(row, col);
    const next = !!wall;
    if (this.walls[index] === next) return false;
    this.walls[index] = next;
    return true;
  }

  public toggleWall(row: number, col: number): boolean {
    if (!this.__inside(row, col)) return false;
    return this.setWall(row, col, !this.walls[this.__index(row, col)]);
  }

  public clearWalls(): void {
    this.walls.fill(false);
  }

  /** 按密度随机撒墙（起点终点永远不盖）。 */
  public randomWalls(density: number = 0.28): void {
    const ratio = Math.max(0, Math.min(0.6, Number(density) || 0));
    for (let row = 0; row < this.rows; row += 1) {
      for (let col = 0; col < this.cols; col += 1) {
        if (row === this.start[0] && col === this.start[1]) continue;
        if (row === this.goal[0] && col === this.goal[1]) continue;
        this.walls[this.__index(row, col)] = this.random() < ratio;
      }
    }
  }

  public setStart(row: number, col: number): boolean {
    if (!this.__inside(row, col)) return false;
    if (this.walls[this.__index(row, col)]) return false;
    if (row === this.goal[0] && col === this.goal[1]) return false;
    if (row === this.start[0] && col === this.start[1]) return false;
    this.start = [row, col];
    return true;
  }

  public setGoal(row: number, col: number): boolean {
    if (!this.__inside(row, col)) return false;
    if (this.walls[this.__index(row, col)]) return false;
    if (row === this.start[0] && col === this.start[1]) return false;
    if (row === this.goal[0] && col === this.goal[1]) return false;
    this.goal = [row, col];
    return true;
  }

  // ------------------------------------------------------------------ 寻路
  public solve(algorithm: string): ICEMazeFrame[] {
    if (!ICE_MAZE_ALGORITHMS.some((item) => item.key === algorithm)) {
      throw new Error(`ICEMazeModel: 未知寻路算法 "${algorithm}"`);
    }
    const total = this.rows * this.cols;
    const startIndex = this.__index(this.start[0], this.start[1]);
    const goalIndex = this.__index(this.goal[0], this.goal[1]);
    const frames: ICEMazeFrame[] = [];
    const cameFrom = new Int32Array(total).fill(-1);
    const visited = new Set<number>();
    const frontier = new Set<number>();
    let visitedCount = 0;
    let reached = false;
    let finalPath: number[] = [];

    const paint = (current: number, note: string) => {
      const cells = this.getCells();
      frontier.forEach((cell) => {
        if (cells[cell] === ICE_MAZE_CELL.EMPTY) cells[cell] = ICE_MAZE_CELL.FRONTIER;
      });
      visited.forEach((cell) => {
        if (cells[cell] === ICE_MAZE_CELL.EMPTY || cells[cell] === ICE_MAZE_CELL.FRONTIER) cells[cell] = ICE_MAZE_CELL.VISITED;
      });
      if (current >= 0 && cells[current] === ICE_MAZE_CELL.EMPTY) cells[current] = ICE_MAZE_CELL.FRONTIER;
      finalPath.forEach((cell) => {
        if (cells[cell] === ICE_MAZE_CELL.EMPTY || cells[cell] === ICE_MAZE_CELL.VISITED || cells[cell] === ICE_MAZE_CELL.FRONTIER) {
          cells[cell] = ICE_MAZE_CELL.PATH;
        }
      });
      frames.push({
        cells,
        current,
        frontier: [...frontier],
        visited: [...visited],
        path: finalPath.slice(),
        reached,
        note,
        visitedCount,
      });
    };

    const neighbours = (cell: number): number[] => {
      const row = Math.floor(cell / this.cols);
      const col = cell % this.cols;
      const list: number[] = [];
      if (row > 0) list.push(cell - this.cols);
      if (col < this.cols - 1) list.push(cell + 1);
      if (row < this.rows - 1) list.push(cell + this.cols);
      if (col > 0) list.push(cell - 1);
      return list.filter((next) => !this.walls[next]);
    };

    const heuristic = (cell: number): number => {
      const row = Math.floor(cell / this.cols);
      const col = cell % this.cols;
      return Math.abs(row - this.goal[0]) + Math.abs(col - this.goal[1]);
    };

    /** 每个格子的已知最短代价（Dijkstra / A* 用它挑下一个）。 */
    const cost = new Float64Array(total).fill(Infinity);
    cost[startIndex] = 0;

    /**
     * A* / Dijkstra 共用的「取最小代价」挑选器（A* 再加曼哈顿启发）。
     *
     * A* 里的**平局打破**很关键：空地上从起点到终点有一条巨大的「单调阶梯」，
     * 每个格子的 f 值都一样，若按入队顺序挑就退化成 BFS（8×10 的空地会访问 80 格，一个不少）。
     * 约定「f 相同就挑 g 更大（更靠近终点）的」，A* 才会顺着一条台阶走 —— 这正是它比 BFS 快的原因。
     */
    const pickByCost = (): number => {
      let best = -1;
      let bestScore = Infinity;
      let bestCost = -Infinity;
      frontier.forEach((cell) => {
        if (visited.has(cell)) return;
        const score = cost[cell] + (algorithm === 'astar' ? heuristic(cell) : 0);
        const deeper = algorithm === 'astar' && score === bestScore && cost[cell] > bestCost;
        if (score < bestScore || deeper) {
          bestScore = score;
          bestCost = cost[cell];
          best = cell;
        }
      });
      return best;
    };

    frontier.add(startIndex);
    paint(-1, `从起点 (${this.start[0]}, ${this.start[1]}) 出发`);
    const queue: number[] = [startIndex]; // BFS
    const stack: number[] = [startIndex]; // DFS

    while (true) {
      let current = -1;
      if (algorithm === 'bfs') {
        while (queue.length && visited.has(queue[0])) queue.shift();
        current = queue.length ? (queue.shift() as number) : -1;
      } else if (algorithm === 'dfs') {
        while (stack.length && visited.has(stack[stack.length - 1])) stack.pop();
        current = stack.length ? (stack.pop() as number) : -1;
      } else {
        current = pickByCost();
      }
      if (current === -1) break;
      if (visited.has(current)) continue;
      visited.add(current);
      frontier.delete(current);
      visitedCount += 1;

      if (current === goalIndex) {
        reached = true;
        // 顺着发现树回溯（BFS / Dijkstra / A* 给的就是最短路；DFS 给的是它发现的那条）
        const path: number[] = [current];
        let cursor = current;
        while (cursor !== startIndex && cameFrom[cursor] !== -1) {
          cursor = cameFrom[cursor];
          path.push(cursor);
        }
        finalPath = cursor === startIndex ? path.reverse() : [startIndex, current];
        paint(current, `到达终点，路径 ${finalPath.length} 格`);
        break;
      }

      neighbours(current).forEach((cell) => {
        if (visited.has(cell)) return;
        const next = cost[current] + 1;
        if (next < cost[cell]) {
          cost[cell] = next;
          cameFrom[cell] = current;
        }
        frontier.add(cell);
        if (algorithm === 'bfs') queue.push(cell);
        if (algorithm === 'dfs') stack.push(cell);
      });
      paint(current, `探索 (${Math.floor(current / this.cols)}, ${current % this.cols}) · 边界 ${frontier.size}`);
    }

    if (!reached) {
      finalPath = [];
      paint(-1, '终点被墙围死了，走不到');
    }
    return frames;
  }

  // ------------------------------------------------------------------ 内部
  private __inside(row: number, col: number): boolean {
    return Number.isFinite(row) && Number.isFinite(col) && row >= 0 && col >= 0 && row < this.rows && col < this.cols;
  }

  private __index(row: number, col: number): number {
    return Math.floor(row) * this.cols + Math.floor(col);
  }
}

export default ICEMazeModel;
