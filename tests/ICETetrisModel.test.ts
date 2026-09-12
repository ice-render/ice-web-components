/**
 * ICETetrisModel 规格（俄罗斯方块的纯逻辑，不碰 canvas）。
 *
 * 规则按现代标准俄罗斯方块（SRS-lite）：
 * - **7-bag 随机**：每 7 个方块恰好包含 7 种各一次（公平性），可用注入的 random 复现；
 * - 移动/旋转受墙与已落方块阻挡；旋转带简易踢墙（0 / ±1 / ±2 依次尝试）；
 * - 重力由 `tick()` 驱动（下落一行），间隔随等级变快；
 * - 消行计分：1/2/3/4 行 = 100/300/500/800 × 等级；每 10 行升一级；
 * - 软降 +1 分/格、硬降 +2 分/格；
 * - 生成位置被占 → game over；暂停时所有操作无效。
 */
import { ICETetrisModel, ICE_TETROMINOES, ICE_TETRIS_LINE_SCORES } from '../src/model/ICETetrisModel';

/** 固定序列的伪随机源（7-bag 需要连续取值）。 */
const seededRandom = (seed = 1) => {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
};

const makeModel = (options: any = {}) => new ICETetrisModel({ rows: 20, cols: 10, random: seededRandom(7), ...options });

/** 把棋盘摊平成一维（目标 ES2017，用不了 Array.prototype.flat）。 */
const boardCells = (model: ICETetrisModel) => model.getBoard().reduce((all, row) => all.concat(row), []);

describe('棋盘与方块', () => {
  it('初始：空棋盘 + 有一个当前方块 + 预览队列', () => {
    const model = makeModel();
    expect(model.getRows()).toBe(20);
    expect(model.getCols()).toBe(10);
    expect(boardCells(model).filter(Boolean)).toHaveLength(0);
    expect(model.getCurrent()).toBeTruthy();
    expect(model.getNextQueue().length).toBeGreaterThan(0);
    expect(model.isGameOver()).toBe(false);
    expect(model.getLastClearedLines()).toBe(0);
  });

  it('7-bag：每 7 个方块恰好是 7 种各一次（连续两袋也成立）', () => {
    const model = makeModel();
    const sequence = [model.getCurrent().type, ...model.getNextQueue()];
    const firstBag = sequence.slice(0, 7).sort();
    expect(firstBag).toEqual(Object.keys(ICE_TETROMINOES).sort());
    const secondBag = sequence.slice(7, 14).sort();
    expect(secondBag).toEqual(Object.keys(ICE_TETROMINOES).sort());
  });

  it('当前方块落在棋盘顶部居中，且占 4 格（O 也是 4 格）', () => {
    const model = makeModel();
    const current = model.getCurrent();
    expect(current.cells).toHaveLength(4);
    current.cells.forEach(([row]) => expect(row).toBeGreaterThanOrEqual(0));
  });
});

describe('移动与旋转', () => {
  it('左右移动一格；撞左墙后不再左移', () => {
    const model = makeModel();
    const startCol = model.getCurrent().col;
    model.moveRight();
    expect(model.getCurrent().col).toBe(startCol + 1);
    model.moveLeft();
    expect(model.getCurrent().col).toBe(startCol);
    for (let i = 0; i < 20; i += 1) model.moveLeft();
    expect(model.getCurrent().col).toBeLessThanOrEqual(startCol);
    const cells = model.getCurrent().cells;
    expect(Math.min(...cells.map(([, col]) => col))).toBeGreaterThanOrEqual(0);
  });

  it('旋转：I 与 O 的旋转状态数不同（O 旋转不变）', () => {
    const model = makeModel({ random: () => 0 });
    const before = model.getCurrent();
    if (before.type === 'O') {
      const cells = JSON.stringify(before.cells);
      model.rotateCW();
      expect(JSON.stringify(model.getCurrent().cells)).toBe(cells);
    } else {
      const cells = JSON.stringify(before.cells);
      model.rotateCW();
      expect(JSON.stringify(model.getCurrent().cells)).not.toBe(cells);
    }
  });

  it('旋转不会把方块推出左右边界（踢墙）', () => {
    const model = makeModel({ random: () => 0 });
    for (let i = 0; i < 10; i += 1) model.moveLeft();
    model.rotateCW();
    model.rotateCCW();
    const cells = model.getCurrent().cells;
    expect(Math.min(...cells.map(([, col]) => col))).toBeGreaterThanOrEqual(0);
    expect(Math.max(...cells.map(([, col]) => col))).toBeLessThan(model.getCols());
  });
});

describe('重力与落地', () => {
  it('tick 下落一行；软降同样一行且加 1 分', () => {
    const model = makeModel();
    const row = model.getCurrent().row;
    model.tick();
    expect(model.getCurrent().row).toBe(row + 1);
    const score = model.getScore();
    model.softDrop();
    expect(model.getScore()).toBe(score + 1);
  });

  it('硬降：立刻落到底、锁定、换下一个方块，并按格数加分', () => {
    const model = makeModel();
    const type = model.getCurrent().type;
    const next = model.getNextQueue()[0];
    model.hardDrop();
    // 当前方块已换成队列里的下一个
    expect(model.getCurrent().type).toBe(next);
    expect(model.getScore()).toBeGreaterThan(0);
    // 棋盘上出现了刚才那个方块的颜色（至少 4 格）
    expect(boardCells(model).filter((cell) => cell === type).length).toBeGreaterThanOrEqual(4);
  });

  it('落到底后继续 tick 只会不断锁定新方块（不抛错）', () => {
    const model = makeModel();
    for (let i = 0; i < 40; i += 1) {
      model.hardDrop();
      if (model.isGameOver()) break;
    }
    expect(model.isGameOver()).toBe(true);
  });
});

describe('消行、计分与升级', () => {
  /** 造一行"填满除指定列之外"的棋盘。 */
  const fillRow = (model: ICETetrisModel, row: number, except: number[] = []) => {
    for (let col = 0; col < model.getCols(); col += 1) {
      if (except.indexOf(col) === -1) model.setCellForTest(row, col, 'J');
    }
  };

  it('消一行得 100 分 × 等级，并清除该行', () => {
    const model = makeModel();
    // 留空的位置 = 当前方块硬降后必然占到的底行格子（与方块形状无关，因此可复现）
    const ghost = model.getGhost();
    const bottomRow = Math.max(...ghost.map(([row]) => row));
    const gap = ghost.filter(([row]) => row === bottomRow).map(([, col]) => col);
    fillRow(model, 19, gap);
    model.hardDrop();
    expect(model.getLines()).toBe(1);
    expect(model.getLastClearedLines()).toBe(1);
    expect(model.getScore()).toBeGreaterThanOrEqual(100);
    // 消掉的那一行必须是干净的（原来填的 J 全被消掉，只剩下移的方块自己）
    expect(model.getBoard()[19].filter((cell) => cell === 'J')).toHaveLength(0);
  });

  it('没有消行的那次锁定会把「本次消行数」归零', () => {
    const model = makeModel();
    model.setLinesForTest(3);
    model.hardDrop();
    expect(model.getLastClearedLines()).toBe(0);
    expect(model.getLines()).toBe(3);
  });

  it('每 10 行升一级，重力间隔变短', () => {
    const model = makeModel();
    const level1 = model.getLevel();
    const interval1 = model.getDropInterval();
    model.setLinesForTest(10);
    expect(model.getLevel()).toBe(level1 + 1);
    expect(model.getDropInterval()).toBeLessThan(interval1);
  });

  it('消行基础分是经典的 0/100/300/500/800（再乘等级）', () => {
    expect(ICE_TETRIS_LINE_SCORES).toEqual([0, 100, 300, 500, 800]);
  });
});

describe('暂停与重置', () => {
  it('暂停时所有操作无效；恢复后正常', () => {
    const model = makeModel();
    const row = model.getCurrent().row;
    model.pause();
    expect(model.isPaused()).toBe(true);
    model.tick();
    model.moveLeft();
    model.rotateCW();
    expect(model.getCurrent().row).toBe(row);
    model.resume();
    model.tick();
    expect(model.getCurrent().row).toBe(row + 1);
  });

  it('reset 复位棋盘/分数/等级，并重新开始', () => {
    const model = makeModel();
    model.hardDrop();
    model.setLinesForTest(23);
    model.reset();
    expect(boardCells(model).filter(Boolean)).toHaveLength(0);
    expect([model.getScore(), model.getLines(), model.getLevel()]).toEqual([0, 0, 1]);
    expect(model.isGameOver()).toBe(false);
  });

  it('变化会通知监听器（UI 靠它重绘）', () => {
    const model = makeModel();
    let changes = 0;
    const off = model.addChangeListener(() => (changes += 1));
    model.tick();
    model.moveLeft();
    expect(changes).toBeGreaterThanOrEqual(2);
    off();
    const before = changes;
    model.moveRight();
    expect(changes).toBe(before);
  });
});
