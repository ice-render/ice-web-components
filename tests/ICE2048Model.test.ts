/**
 * ICE2048Model 规格（2048 的纯逻辑，不碰 canvas）。
 *
 * 规则按经典的 Gabriele Cirulli 版 2048：
 * - 开局两个块，值只能是 2 或 4（4 的概率由 `spawnFourChance` 控制，默认 10%）；
 * - `move(dir)` 把整盘往一个方向推：**同一次移动里每个块最多合并一次**，
 *   合并出的新块可以继续与后面的块合并吗？—— 不可以（这是 2048 与「滑到不能再滑」的关键区别）；
 * - 合并得分 = 合并出来的值（2+2→4 得 4 分，4+4→8 得 8 分）；
 * - **只有真的动了才生成新块、才计一步**；
 * - 棋盘填满且相邻无可合并 → game over；`target`（默认 2048）合并出来即 `isWon`，
 *   但**不结束**，可以继续冲更高分；
 * - 新块位置由注入的 `random` 决定，测试可复现。
 */
import { ICE2048Model, ICE_2048_DIRECTIONS } from '../src/model/ICE2048Model';

/** 固定序列的伪随机源。 */
const seededRandom = (seed = 1) => {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
};

const makeModel = (options: any = {}) =>
  new ICE2048Model({ rows: 4, cols: 4, random: seededRandom(7), spawnAfterMove: false, ...options });

/** 用二维数组摆盘（null = 空）。 */
const setGrid = (model: ICE2048Model, grid: Array<Array<number | null>>) =>
  model.setCellsForTest(grid.reduce<Array<number | null>>((all, line) => all.concat(line), []));

const gridOf = (model: ICE2048Model) => {
  const rows = model.getRows();
  const cols = model.getCols();
  const flat = model.getCells();
  const out: Array<Array<number | null>> = [];
  for (let row = 0; row < rows; row += 1) out.push(flat.slice(row * cols, (row + 1) * cols));
  return out;
};

describe('开局与生成', () => {
  it('开局两个块，值只能是 2 或 4，分数 0、步数 0、未结束', () => {
    const model = makeModel();
    const tiles = model.getCells().filter((value) => value !== null);
    expect(tiles).toHaveLength(2);
    tiles.forEach((value) => expect([2, 4]).toContain(value));
    expect(model.getScore()).toBe(0);
    expect(model.getMoves()).toBe(0);
    expect(model.isGameOver()).toBe(false);
    expect(model.isWon()).toBe(false);
    expect([model.getRows(), model.getCols()]).toEqual([4, 4]);
  });

  it('4 的出现概率由注入的 random 决定', () => {
    const alwaysTwo = new ICE2048Model({ random: () => 0.5 });
    expect(alwaysTwo.getCells().filter(Boolean).every((value) => value === 2)).toBe(true);
    // 4 的条件是 `random() < spawnFourChance`
    const alwaysFour = new ICE2048Model({ random: () => 0.05, spawnFourChance: 0.1 });
    expect(alwaysFour.getCells().filter(Boolean).every((value) => value === 4)).toBe(true);
  });

  it('同一个随机种子两次开局的盘面一致（可复现）', () => {
    const a = new ICE2048Model({ random: seededRandom(3) });
    const b = new ICE2048Model({ random: seededRandom(3) });
    expect(a.getCells()).toEqual(b.getCells());
  });

  it('行列可配（5×5），目标值可配', () => {
    const model = makeModel({ rows: 5, cols: 5, target: 64 });
    expect([model.getRows(), model.getCols()]).toEqual([5, 5]);
    expect(model.getCells()).toHaveLength(25);
    setGrid(model, [
      [32, 32, null, null, null],
      [null, null, null, null, null],
      [null, null, null, null, null],
      [null, null, null, null, null],
      [null, null, null, null, null],
    ]);
    model.move('left');
    expect(model.isWon()).toBe(true);
  });
});

describe('滑动与合并', () => {
  it('不合并地滑动：靠拢、保持顺序、不得分', () => {
    const model = makeModel();
    setGrid(model, [
      [null, 2, null, 4],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ]);
    expect(model.move('left')).toBe(true);
    expect(gridOf(model)[0]).toEqual([2, 4, null, null]);
    expect(model.getScore()).toBe(0);
    expect(model.getMoves()).toBe(1);
  });

  it('两个相同数字合并成一个，得分 = 合并出的值', () => {
    const model = makeModel();
    setGrid(model, [
      [2, 2, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ]);
    model.move('left');
    expect(gridOf(model)[0]).toEqual([4, null, null, null]);
    expect(model.getScore()).toBe(4);
  });

  it('一次移动里同一个块只合并一次（2,2,2,2 → 4,4）', () => {
    const model = makeModel();
    setGrid(model, [
      [2, 2, 2, 2],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ]);
    model.move('left');
    expect(gridOf(model)[0]).toEqual([4, 4, null, null]);
    expect(model.getScore()).toBe(8);
  });

  it('新合并出来的块不会马上再吞掉后面的块（2,2,4 → 4,4）', () => {
    const model = makeModel();
    setGrid(model, [
      [2, 2, 4, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ]);
    model.move('left');
    expect(gridOf(model)[0]).toEqual([4, 4, null, null]);
    expect(model.getScore()).toBe(4);
  });

  it('三个相同：4,4,4 → 8,4', () => {
    const model = makeModel();
    setGrid(model, [
      [4, 4, 4, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ]);
    model.move('left');
    expect(gridOf(model)[0]).toEqual([8, 4, null, null]);
    expect(model.getScore()).toBe(8);
  });

  it('四个方向各自成立（向右 / 向上 / 向下）', () => {
    const rows = makeModel();
    setGrid(rows, [
      [2, 2, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ]);
    rows.move('right');
    expect(gridOf(rows)[0]).toEqual([null, null, null, 4]);

    const cols = makeModel();
    setGrid(cols, [
      [null, 2, null, null],
      [null, 2, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ]);
    cols.move('up');
    expect(gridOf(cols).map((line) => line[1])).toEqual([4, null, null, null]);
    cols.move('down');
    expect(gridOf(cols).map((line) => line[1])).toEqual([null, null, null, 4]);
  });

  it('推不动就不算一步、不得分', () => {
    const model = makeModel();
    setGrid(model, [
      [2, 4, 8, 16],
      [4, 8, 16, 32],
      [8, 16, 32, 64],
      [16, 32, 64, 128],
    ]);
    expect(model.move('left')).toBe(false);
    expect(model.move('right')).toBe(false);
    expect(model.move('up')).toBe(false);
    expect(model.move('down')).toBe(false);
    expect(model.getScore()).toBe(0);
    expect(model.getMoves()).toBe(0);
  });
});

describe('生成新块与结束判定', () => {
  it('移动成功后在空格里生成一个新块（默认开启）', () => {
    const model = makeModel({ spawnAfterMove: true });
    setGrid(model, [
      [2, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ]);
    setGrid(model, [
      [null, 2, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ]);
    model.move('left');
    const tiles = model.getCells().filter((value) => value !== null);
    expect(tiles).toHaveLength(2); // 原来的 2 + 新生成的
    expect([2, 4]).toContain(tiles[1]);
    expect(gridOf(model)[0][0]).toBe(2);
  });

  it('填满且相邻没有相同数字 → game over', () => {
    const model = makeModel();
    setGrid(model, [
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2],
    ]);
    expect(model.isGameOver()).toBe(true);
    expect(model.canMove()).toBe(false);
    expect(model.move('left')).toBe(false);
  });

  it('填满但还有可合并的相邻块 → 没结束', () => {
    const model = makeModel();
    setGrid(model, [
      [2, 2, 4, 8],
      [4, 8, 16, 32],
      [2, 4, 8, 16],
      [4, 8, 16, 32],
    ]);
    expect(model.canMove()).toBe(true);
    expect(model.isGameOver()).toBe(false);
  });

  it('合并出目标值即获胜，但还能继续玩', () => {
    const model = makeModel();
    setGrid(model, [
      [1024, 1024, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ]);
    expect(model.isWon()).toBe(false);
    model.move('left');
    expect(model.getBestTile()).toBe(2048);
    expect(model.isWon()).toBe(true);
    expect(model.isGameOver()).toBe(false);
    expect(model.getScore()).toBe(2048);
  });
});

describe('重置与监听', () => {
  it('暂停时推不动（棋盘类页面共用同一套 pause/resume 契约）', () => {
    const model = makeModel();
    setGrid(model, [
      [null, 2, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ]);
    expect(model.isPaused()).toBe(false);
    model.pause();
    expect(model.isPaused()).toBe(true);
    expect(model.move('left')).toBe(false);
    expect(gridOf(model)[0]).toEqual([null, 2, null, null]);
    model.resume();
    expect(model.isPaused()).toBe(false);
    expect(model.move('left')).toBe(true);
    expect(gridOf(model)[0]).toEqual([2, null, null, null]);
  });

  it('reset 复位盘面 / 分数 / 步数 / 胜负标记', () => {
    const model = makeModel();
    setGrid(model, [
      [1024, 1024, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ]);
    model.move('left');
    expect(model.isWon()).toBe(true);
    model.reset();
    expect(model.getScore()).toBe(0);
    expect(model.getMoves()).toBe(0);
    expect(model.isWon()).toBe(false);
    expect(model.isGameOver()).toBe(false);
    expect(model.getCells().filter(Boolean)).toHaveLength(2);
    expect(model.getBestTile()).toBeLessThanOrEqual(4);
  });

  it('变化会通知监听器，退订后不再通知', () => {
    const model = makeModel();
    let changes = 0;
    const off = model.addChangeListener(() => (changes += 1));
    setGrid(model, [
      [2, 2, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ]);
    model.move('left');
    expect(changes).toBeGreaterThanOrEqual(2);
    off();
    const before = changes;
    model.move('right');
    expect(changes).toBe(before);
  });

  it('对外常量：四个方向按上下左右导出', () => {
    expect(ICE_2048_DIRECTIONS).toEqual(['up', 'right', 'down', 'left']);
  });
});
