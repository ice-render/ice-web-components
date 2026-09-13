/**
 * 迷宫寻路轨迹模型的规格（纯逻辑）。
 *
 * 和排序那边是同一套路：算一遍，把过程录成一串帧（回放交给 `ICETracePlayerModel`）。
 * 网格是「行优先的一维数组」，每格一个状态（空 / 墙 / 起点 / 终点 / 已访问 / 边界 / 路径）。
 *
 * 四种算法在这里都是无权网格（每步代价 1），区别只在**怎么选下一个格子**：
 * BFS 用队列（保证最短）、DFS 用栈（不一定最短）、Dijkstra 按代价（等价于 BFS）、
 * A* 加上曼哈顿距离启发（最短且访问更少）。这四条性质都写进了断言。
 */
import { ICEMazeModel, ICE_MAZE_ALGORITHMS, ICE_MAZE_CELL } from '../src/model/ICEMazeModel';

/** 造一个全是空地的迷宫，方便手工摆墙。 */
const makeMaze = (rows: number, cols: number) => {
  const maze = new ICEMazeModel({ rows, cols, random: () => 0.5 });
  maze.clearWalls();
  return maze;
};
const index = (maze: ICEMazeModel, row: number, col: number) => row * maze.getCols() + col;

describe('网格与墙', () => {
  it('默认：起点在左上、终点在右下，其余都是空地', () => {
    const maze = makeMaze(4, 6);
    expect(maze.getRows()).toBe(4);
    expect(maze.getCols()).toBe(6);
    expect(maze.getCells()).toHaveLength(24);
    expect(maze.getStart()).toEqual([0, 0]);
    expect(maze.getGoal()).toEqual([3, 5]);
    const cells = maze.getCells();
    expect(cells[index(maze, 0, 0)]).toBe(ICE_MAZE_CELL.START);
    expect(cells[index(maze, 3, 5)]).toBe(ICE_MAZE_CELL.GOAL);
    expect(cells.filter((value) => value === ICE_MAZE_CELL.WALL)).toHaveLength(0);
  });

  it('setWall / toggleWall：越界不崩、墙不能盖在起点终点上', () => {
    const maze = makeMaze(4, 4);
    expect(maze.setWall(1, 1, true)).toBe(true);
    expect(maze.getCell(1, 1)).toBe(ICE_MAZE_CELL.WALL);
    expect(maze.setWall(1, 1, true)).toBe(false); // 已经是墙
    expect(maze.setWall(99, 99, true)).toBe(false);
    expect(maze.setWall(0, 0, true)).toBe(false); // 起点
    expect(maze.setWall(3, 3, true)).toBe(false); // 终点
    expect(maze.toggleWall(2, 2)).toBe(true);
    expect(maze.getCell(2, 2)).toBe(ICE_MAZE_CELL.WALL);
    expect(maze.toggleWall(2, 2)).toBe(true);
    expect(maze.getCell(2, 2)).toBe(ICE_MAZE_CELL.EMPTY);
  });

  it('randomWalls：按密度撒墙，起点终点一定还是空的', () => {
    const maze = new ICEMazeModel({ rows: 8, cols: 8, random: () => 0.1 });
    maze.randomWalls(0.5);
    const cells = maze.getCells();
    expect(cells.filter((value) => value === ICE_MAZE_CELL.WALL).length).toBeGreaterThan(0);
    expect(maze.getCell(0, 0)).toBe(ICE_MAZE_CELL.START);
    expect(maze.getCell(7, 7)).toBe(ICE_MAZE_CELL.GOAL);
  });

  it('setStart / setGoal：不能压墙，也不能重合', () => {
    const maze = makeMaze(4, 4);
    maze.setWall(1, 1, true);
    expect(maze.setStart(1, 1)).toBe(false);
    expect(maze.setStart(3, 3)).toBe(false); // 那是终点
    expect(maze.setStart(1, 2)).toBe(true);
    expect(maze.getStart()).toEqual([1, 2]);
    expect(maze.getCell(0, 0)).toBe(ICE_MAZE_CELL.EMPTY);
    expect(maze.setGoal(1, 2)).toBe(false); // 那是起点
  });
});

describe('四种算法的轨迹', () => {
  const algorithms = ICE_MAZE_ALGORITHMS.map((item) => item.key);

  it('算法表：BFS / DFS / Dijkstra / A*，每种带复杂度或策略标签', () => {
    expect(algorithms).toEqual(['bfs', 'dfs', 'dijkstra', 'astar']);
    expect(ICE_MAZE_ALGORITHMS.every((item) => item.label && item.note)).toBe(true);
  });

  it('空地上都能找到一条从起点到终点的路径', () => {
    algorithms.forEach((key) => {
      const maze = makeMaze(6, 8);
      const frames = maze.solve(key);
      const last = frames[frames.length - 1];
      expect(last.path.length).toBeGreaterThan(0);
      expect(last.path[0]).toBe(index(maze, 0, 0));
      expect(last.path[last.path.length - 1]).toBe(index(maze, 5, 7));
      expect(last.reached).toBe(true);
    });
  });

  it('BFS / Dijkstra / A* 都给最短路，DFS 只用它能找到的那条', () => {
    const maze = makeMaze(6, 8);
    const lengths: Record<string, number> = {};
    algorithms.forEach((key) => {
      const frames = maze.solve(key);
      lengths[key] = frames[frames.length - 1].path.length;
    });
    // 6×8 空地上最短路 = 5 步下 + 7 步右 + 起点 = 13 格
    expect(lengths.bfs).toBe(13);
    expect(lengths.dijkstra).toBe(13);
    expect(lengths.astar).toBe(13);
    expect(lengths.dfs).toBeGreaterThanOrEqual(13);
  });

  it('A* 比 BFS 访问的格子更少（启发式真的起作用）', () => {
    const maze = makeMaze(8, 10);
    const bfsFrames = maze.solve('bfs');
    const astarFrames = maze.solve('astar');
    const visited = (frames: Array<{ visited: number[] }>) => frames[frames.length - 1].visited.length;
    expect(visited(astarFrames)).toBeLessThan(visited(bfsFrames));
  });

  it('绕墙：墙挡出一条走廊时，三个最短路算法都绕过去且长度一致', () => {
    const maze = makeMaze(5, 9);
    // 竖着一堵墙，只留最下面一行过
    for (let row = 0; row < 4; row += 1) maze.setWall(row, 4, true);
    const bfs = maze.solve('bfs');
    const astar = maze.solve('astar');
    expect(bfs[bfs.length - 1].path.length).toBe(astar[astar.length - 1].path.length);
    expect(bfs[bfs.length - 1].reached).toBe(true);
    // 路径里不该有墙
    const walls = new Set();
    maze.getCells().forEach((value, i) => {
      if (value === ICE_MAZE_CELL.WALL) walls.add(i);
    });
    bfs[bfs.length - 1].path.forEach((cell) => {
      expect(walls.has(cell)).toBe(false);
    });
  });

  it('终点被围死：reached = false，path 为空（不是死循环）', () => {
    const maze = makeMaze(5, 5);
    // 把终点 (4,4) 用墙围起来
    maze.setWall(3, 4, true);
    maze.setWall(4, 3, true);
    const frames = maze.solve('bfs');
    const last = frames[frames.length - 1];
    expect(last.reached).toBe(false);
    expect(last.path).toEqual([]);
  });

  it('每一帧的 visited / frontier 都落在网格范围内，且轨迹有过程（不只是结果）', () => {
    const maze = makeMaze(6, 6);
    const frames = maze.solve('bfs');
    expect(frames.length).toBeGreaterThan(10);
    frames.forEach((frame) => {
      frame.visited.concat(frame.frontier).forEach((cell) => {
        expect(cell).toBeGreaterThanOrEqual(0);
        expect(cell).toBeLessThan(36);
      });
      expect(typeof frame.note).toBe('string');
    });
  });

  it('未知算法抛错', () => {
    const maze = makeMaze(3, 3);
    expect(() => maze.solve('dijkstra-with-negative-weights')).toThrow(/未知寻路算法/);
  });

  it('起终点相邻：最短路只有两格', () => {
    const maze = makeMaze(3, 3);
    maze.setStart(0, 0);
    maze.setGoal(0, 1);
    const frames = maze.solve('bfs');
    expect(frames[frames.length - 1].path).toHaveLength(2);
  });
});
