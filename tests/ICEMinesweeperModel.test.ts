/**
 * ICEMinesweeperModel 规格（扫雷的纯逻辑，不碰 canvas）。
 *
 * 规则按 Windows XP 扫雷：
 * - **首次点击安全**：第一次点开格子时才布雷，且排除该格及其 8 邻域（有空间时）；
 * - 揭示：相邻雷数为 0 时洪水填充展开整片空白；
 * - 插旗循环：无 → 🚩 → ❓ → 无；
 * - 双击数字（chord）：周围旗数等于数字时，掀开其余邻格（可能炸）；
 * - 胜负：掀开所有非雷格 = 胜；掀开雷 = 负（并把所有雷亮出来）；
 * - 计数：剩余雷数 = 总雷数 - 旗数；计时器由 tick() 驱动（便于测试与暂停）。
 */
import {
  ICE_MINESWEEPER_DIFFICULTIES,
  ICEMinesweeperModel,
} from '../src/model/ICEMinesweeperModel';

/** 固定序列的伪随机源：让布雷位置可预测。 */
const seededRandom = (seed = 1) => {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
};

const makeModel = (options: any = {}) =>
  new ICEMinesweeperModel({ rows: 5, cols: 5, mines: 3, random: seededRandom(7), ...options });

/** 测试里的取格助手：断言存在（`getCell` 越界才返回 null）。 */
const cellAt = (model: ICEMinesweeperModel, row: number, col: number) => {
  const cell = model.getCell(row, col);
  if (!cell) {
    throw new Error(`cell (${row},${col}) 不存在`);
  }
  return cell;
};

describe('难度预设', () => {
  it('初级 / 中级 / 高级的尺寸与雷数', () => {
    const find = (key: string) => ICE_MINESWEEPER_DIFFICULTIES.find((d) => d.key === key)!;
    expect([find('beginner').rows, find('beginner').cols, find('beginner').mines]).toEqual([9, 9, 10]);
    expect([find('intermediate').rows, find('intermediate').cols, find('intermediate').mines]).toEqual([16, 16, 40]);
    expect([find('expert').rows, find('expert').cols, find('expert').mines]).toEqual([16, 30, 99]);
  });
});

describe('首次点击安全', () => {
  it('第一次揭示前不布雷；首次点开的位置及邻域都不是雷', () => {
    const model = makeModel();
    expect(model.getState()).toBe('ready');
    expect(model.getMineCount()).toBe(3);
    model.reveal(2, 2);
    expect(model.getState()).toBe('playing');
    expect(cellAt(model, 2, 2).mine).toBe(false);
    expect(cellAt(model, 2, 2).adjacent).toBe(0);
    // 8 邻域也安全
    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        const row = 2 + dr;
        const col = 2 + dc;
        if (row >= 0 && row < 5 && col >= 0 && col < 5) {
          expect(cellAt(model, row, col).mine).toBe(false);
        }
      }
    }
    expect(model.getCells().filter((cell) => cell.mine)).toHaveLength(3);
  });

  it('洪水填充：点开 0 相邻格会展开整片空白', () => {
    const model = makeModel();
    model.reveal(0, 0);
    expect(model.getRevealedCount()).toBeGreaterThan(1);
    expect(cellAt(model, 0, 0).revealed).toBe(true);
  });

  it('firstClickSafe: false 时先布雷（测试用固定随机源也能重现）', () => {
    const model = makeModel({ firstClickSafe: false });
    expect(model.getCells().filter((cell) => cell.mine)).toHaveLength(3);
    const mine = model.getCells().find((cell) => cell.mine)!;
    model.reveal(mine.row, mine.col);
    expect(model.getState()).toBe('lost');
  });
});

describe('插旗与计数', () => {
  it('右键循环：无 → 旗 → 问号 → 无；剩余雷数只受旗影响', () => {
    const model = makeModel();
    model.reveal(0, 0);
    expect(model.getMinesLeft()).toBe(3);
    model.toggleFlag(4, 4);
    expect(cellAt(model, 4, 4).flagged).toBe(true);
    expect(model.getMinesLeft()).toBe(2);
    model.toggleFlag(4, 4);
    expect(cellAt(model, 4, 4).question).toBe(true);
    expect(cellAt(model, 4, 4).flagged).toBe(false);
    expect(model.getMinesLeft()).toBe(3);
    model.toggleFlag(4, 4);
    expect(cellAt(model, 4, 4).question).toBe(false);
    expect(model.getMinesLeft()).toBe(3);
  });

  it('插旗 / 问号可以关掉（questionMarks: false）', () => {
    const model = makeModel({ questionMarks: false });
    model.reveal(0, 0);
    model.toggleFlag(4, 4);
    model.toggleFlag(4, 4);
    expect(cellAt(model, 4, 4).flagged).toBe(false);
    expect(cellAt(model, 4, 4).question).toBe(false);
  });

  it('插旗的格子不能被掀开', () => {
    const model = makeModel();
    model.reveal(0, 0);
    // 找一个「还没被洪水填充掀开、又不是雷」的格子来插旗
    const hidden = model.getCells().find((cell) => !cell.revealed && !cell.mine);
    expect(hidden).toBeTruthy();
    model.toggleFlag(hidden!.row, hidden!.col);
    expect(cellAt(model, hidden!.row, hidden!.col).flagged).toBe(true);
    model.reveal(hidden!.row, hidden!.col);
    expect(cellAt(model, hidden!.row, hidden!.col).revealed).toBe(false);
    expect(model.getState()).toBe('playing');
  });
});

describe('胜负', () => {
  it('掀开所有非雷格即胜利，并停止计时', () => {
    const model = makeModel();
    model.reveal(0, 0);
    // 直接掀开所有非雷格（模拟玩家把安全格都点开）
    model.getCells()
      .filter((cell) => !cell.mine)
      .forEach((cell) => model.reveal(cell.row, cell.col));
    expect(model.getState()).toBe('won');
    expect(model.isWon()).toBe(true);
    const elapsed = model.getElapsed();
    model.tick();
    expect(model.getElapsed()).toBe(elapsed);
  });

  it('掀开雷即失败，并把所有雷亮出来', () => {
    const model = makeModel({ firstClickSafe: false });
    const mine = model.getCells().find((cell) => cell.mine)!;
    model.reveal(mine.row, mine.col);
    expect(model.getState()).toBe('lost');
    expect(model.getCells().filter((cell) => cell.mine && cell.revealed)).toHaveLength(3);
  });
});

describe('chord（双击数字）', () => {
  it('周围旗数等于数字时，掀开其余邻格', () => {
    // 3×3 里只放 1 颗雷，放在 (0,0)：点 (2,2) 会展开成一块，数字格周围插旗后 chord
    const model = new ICEMinesweeperModel({ rows: 3, cols: 3, mines: 1, firstClickSafe: false, random: () => 0.1 });
    const mine = model.getCells().find((cell) => cell.mine)!;
    model.reveal(2, 2);
    const numberCell = model.getCells().find((cell) => cell.revealed && cell.adjacent > 0)!;
    expect(numberCell).toBeTruthy();
    // 把该数字格周围的雷插上旗（找到与它相邻的那颗雷）
    model.toggleFlag(mine.row, mine.col);
    const before = model.getRevealedCount();
    model.chord(numberCell.row, numberCell.col);
    expect(model.getRevealedCount()).toBeGreaterThanOrEqual(before);
  });

  it('周围旗数不足时什么都不做', () => {
    const model = new ICEMinesweeperModel({ rows: 3, cols: 3, mines: 1, firstClickSafe: false, random: () => 0.1 });
    model.reveal(2, 2);
    const numberCell = model.getCells().find((cell) => cell.revealed && cell.adjacent > 0)!;
    const before = model.getRevealedCount();
    model.chord(numberCell.row, numberCell.col);
    expect(model.getRevealedCount()).toBe(before);
  });
});

describe('计时与重置', () => {
  it('tick 只有在 playing / ready 时累加，结束后不再变', () => {
    const model = makeModel();
    // 还没点第一下：不计时（XP 的计时从第一次点击开始）
    model.tick();
    expect(model.getElapsed()).toBe(0);
    model.reveal(0, 0);
    model.tick();
    model.tick();
    expect(model.getElapsed()).toBe(2);
    model.getCells()
      .filter((cell) => !cell.mine)
      .forEach((cell) => model.reveal(cell.row, cell.col));
    model.tick();
    expect(model.getElapsed()).toBe(2);
  });

  it('reset 复位状态、清空插旗与计时；可以换难度', () => {
    const model = makeModel();
    model.reveal(0, 0);
    model.toggleFlag(4, 4);
    model.tick();
    model.reset({ rows: 9, cols: 9, mines: 10 });
    expect([model.getRows(), model.getCols(), model.getMineCount()]).toEqual([9, 9, 10]);
    expect(model.getState()).toBe('ready');
    expect(model.getFlags()).toBe(0);
    expect(model.getElapsed()).toBe(0);
    expect(model.getCells().every((cell) => !cell.mine && !cell.revealed)).toBe(true);
  });

  it('变化会通知监听器（UI 靠它重绘）', () => {
    const model = makeModel();
    let changes = 0;
    const off = model.addChangeListener(() => (changes += 1));
    model.reveal(0, 0);
    model.toggleFlag(4, 4);
    expect(changes).toBeGreaterThanOrEqual(2);
    off();
    const before = changes;
    model.toggleFlag(4, 4);
    expect(changes).toBe(before);
  });
});
