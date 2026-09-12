/**
 * ICESnakeModel 规格（贪吃蛇的纯逻辑，不碰 canvas）。
 *
 * 规则按经典 Nokia / 街机贪吃蛇：
 * - **前进**：`tick()` 让头往前走一格，尾巴跟着收一格（长度不变）；
 * - **吃食物**：头落到食物上 → 长度 +1、得分增加、食物重新生成（绝不落在蛇身上）；
 * - **转向**：可以排队两个转向依次生效；**不能 180° 掉头**（向右时按左无效）；
 * - **撞墙即死**；`wrap: true` 时穿墙（从左边出去从右边回来）；
 * - **撞自己即死**，但**「正在移开的尾巴」不算**（这一格这一步就空出来了）；
 * - **越吃越快**：每吃 5 个升一级，`getTickInterval()` 按等级递减并有下限；
 * - 暂停时 `tick()` 与转向都无效；食物位置由注入的 `random` 决定，测试可复现。
 */
import { ICESnakeModel, ICE_SNAKE_DIRECTIONS } from '../src/model/ICESnakeModel';

/** 固定序列的伪随机源（食物位置可预测）。 */
const seededRandom = (seed = 1) => {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
};

const makeModel = (options: any = {}) =>
  new ICESnakeModel({ rows: 20, cols: 20, random: seededRandom(7), ...options });

/** 测试里的取食物助手：断言存在（`getFood()` 返回 null 表示棋盘被填满了）。 */
const foodAt = (model: ICESnakeModel) => {
  const food = model.getFood();
  if (!food) {
    throw new Error('食物不见了');
  }
  return food;
};

/** 蛇身是否自相交（不许出现重复格）。 */
const hasDuplicates = (body: Array<[number, number]>) =>
  body.some((cell, index) => body.findIndex((other) => other[0] === cell[0] && other[1] === cell[1]) !== index);

describe('初始状态', () => {
  it('默认长度 3、朝右、分数 0、没结束，食物不在蛇身上', () => {
    const model = makeModel();
    expect(model.getRows()).toBe(20);
    expect(model.getCols()).toBe(20);
    expect(model.getBody()).toHaveLength(3);
    expect(model.getDirection()).toBe('right');
    expect(model.getScore()).toBe(0);
    expect(model.getLength()).toBe(3);
    expect(model.isGameOver()).toBe(false);
    expect(model.isPaused()).toBe(false);
    expect(model.getLevel()).toBe(1);
    const food = foodAt(model);
    expect(model.getBody().some(([row, col]) => row === food[0] && col === food[1])).toBe(false);
  });

  it('身体是连续的横排，头在最前、都落在棋盘内', () => {
    const model = makeModel();
    const body = model.getBody();
    expect(hasDuplicates(body)).toBe(false);
    expect(body[0][0]).toBe(body[1][0]);
    expect(body[0][1]).toBe(body[1][1] + 1);
    body.forEach(([row, col]) => {
      expect(row).toBeGreaterThanOrEqual(0);
      expect(row).toBeLessThan(20);
      expect(col).toBeGreaterThanOrEqual(0);
      expect(col).toBeLessThan(20);
    });
  });
});

describe('前进与吃食物', () => {
  it('tick 让头前进一格、尾巴收一格（长度不变）', () => {
    const model = makeModel();
    const before = model.getBody();
    model.tick();
    const after = model.getBody();
    expect(after).toHaveLength(3);
    expect(after[0]).toEqual([before[0][0], before[0][1] + 1]);
    expect(after[2]).toEqual(before[1]);
  });

  it('吃到食物：长度 +1、加分、食物重新生成且不在蛇身上', () => {
    const model = makeModel();
    const head = model.getBody()[0];
    model.setFoodForTest(head[0], head[1] + 1); // 正前方
    model.tick();
    expect(model.getLength()).toBe(4);
    expect(model.getScore()).toBeGreaterThan(0);
    const food = foodAt(model);
    expect(model.getBody().some(([row, col]) => row === food[0] && col === food[1])).toBe(false);
    expect(hasDuplicates(model.getBody())).toBe(false);
  });

  it('食物总是落在空格上（连续吃 8 次都不打架）', () => {
    const model = makeModel();
    for (let i = 0; i < 8; i += 1) {
      const head = model.getBody()[0];
      const direction = model.getDirection();
      const step = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] }[direction];
      model.setFoodForTest(head[0] + step[0], head[1] + step[1]);
      model.tick();
      const food = foodAt(model);
      expect(model.getBody().some(([row, col]) => row === food[0] && col === food[1])).toBe(false);
    }
    expect(model.getLength()).toBe(11);
  });
});

describe('转向', () => {
  it('不能 180° 掉头：向右时按左无效', () => {
    const model = makeModel();
    expect(model.setDirection('left')).toBe(false);
    expect(model.getDirection()).toBe('right');
    const before = model.getBody();
    model.tick();
    expect(model.getBody()[0]).toEqual([before[0][0], before[0][1] + 1]);
  });

  it('转向按顺序排队生效（上、左 → 先上再左）', () => {
    const model = makeModel();
    expect(model.setDirection('up')).toBe(true);
    expect(model.setDirection('left')).toBe(true);
    const before = model.getBody();
    model.tick();
    expect(model.getBody()[0]).toEqual([before[0][0] - 1, before[0][1]]);
    model.tick();
    expect(model.getBody()[0]).toEqual([before[0][0] - 1, before[0][1] - 1]);
  });

  it('排队超过两个的转向会被丢掉（防止一键急转弯）', () => {
    const model = makeModel();
    expect(model.setDirection('up')).toBe(true);
    expect(model.setDirection('left')).toBe(true);
    expect(model.setDirection('down')).toBe(false); // 队列已满
  });

  it('重复的同一方向不会塞满队列', () => {
    const model = makeModel();
    expect(model.setDirection('right')).toBe(true);
    expect(model.setDirection('up')).toBe(true);
    expect(model.setDirection('left')).toBe(true); // 队列里只有 up / left
  });
});

describe('撞墙与撞自己', () => {
  it('撞墙即 game over，之后 tick 不再改变状态', () => {
    const model = makeModel();
    for (let i = 0; i < 20; i += 1) model.tick();
    expect(model.isGameOver()).toBe(true);
    const frozen = JSON.stringify(model.getBody());
    model.tick();
    model.setDirection('up');
    expect(JSON.stringify(model.getBody())).toBe(frozen);
    expect(model.isGameOver()).toBe(true);
  });

  it('wrap: true 时穿墙（右出左进）', () => {
    const model = makeModel({ wrap: true });
    const start = model.getBody()[0];
    for (let i = 0; i < 12; i += 1) model.tick();
    expect(model.isGameOver()).toBe(false);
    const body = model.getBody();
    // 从 (10,10) 向右走 12 步：10 + 12 = 22 → 绕过右边界落到第 2 列
    expect(body[0]).toEqual([start[0], (start[1] + 12) % model.getCols()]);
    expect(body[0][1]).toBeLessThan(start[1]);
    expect(hasDuplicates(body)).toBe(false);
  });

  it('撞到自己（非尾巴）即 game over', () => {
    const model = makeModel();
    // 摆成一个钩子：头 (5,4) 向右，正前方 (5,5) 是自己的第二节
    model.setBodyForTest([[5, 4], [5, 5], [5, 6], [6, 6], [6, 5]]);
    model.setFoodForTest(0, 0);
    model.setDirection('right');
    model.tick();
    expect(model.isGameOver()).toBe(true);
  });

  it('撞到「正在移开的尾巴」不算死（这一步尾巴就腾出来了）', () => {
    const model = makeModel();
    // 2×2 的环，头 (5,5) 向下正好走到尾 (6,5)
    model.setBodyForTest([[5, 5], [5, 6], [6, 6], [6, 5]]);
    model.setFoodForTest(0, 0);
    model.setDirection('down');
    model.tick();
    expect(model.isGameOver()).toBe(false);
    expect(model.getBody()).toHaveLength(4);
    expect(model.getBody()[0]).toEqual([6, 5]);
    expect(hasDuplicates(model.getBody())).toBe(false);
  });
});

describe('速度、暂停与重置', () => {
  it('每吃 5 个升一级，间隔变短且有下限', () => {
    const model = makeModel();
    const first = model.getTickInterval();
    expect(model.getLevel()).toBe(1);
    for (let i = 0; i < 5; i += 1) {
      const head = model.getBody()[0];
      const direction = model.getDirection();
      const step = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] }[direction];
      model.setFoodForTest(head[0] + step[0], head[1] + step[1]);
      model.tick();
    }
    expect(model.getLevel()).toBe(2);
    expect(model.getTickInterval()).toBeLessThan(first);
    expect(model.getTickInterval()).toBeGreaterThanOrEqual(70);
  });

  it('暂停时 tick 与转向都无效，恢复后继续', () => {
    const model = makeModel();
    const before = JSON.stringify(model.getBody());
    model.pause();
    expect(model.isPaused()).toBe(true);
    model.tick();
    model.setDirection('up');
    expect(JSON.stringify(model.getBody())).toBe(before);
    expect(model.getDirection()).toBe('right');
    model.resume();
    model.tick();
    expect(JSON.stringify(model.getBody())).not.toBe(before);
  });

  it('reset 复位长度 / 分数 / 等级 / 方向 / 结束状态', () => {
    const model = makeModel();
    for (let i = 0; i < 20; i += 1) model.tick();
    expect(model.isGameOver()).toBe(true);
    model.reset();
    expect(model.getLength()).toBe(3);
    expect(model.getScore()).toBe(0);
    expect(model.getLevel()).toBe(1);
    expect(model.getDirection()).toBe('right');
    expect(model.isGameOver()).toBe(false);
    expect(model.getTickInterval()).toBe(170);
  });

  it('变化会通知监听器（UI 靠它重绘），退订后不再通知', () => {
    const model = makeModel();
    let changes = 0;
    const off = model.addChangeListener(() => (changes += 1));
    model.tick();
    model.setDirection('up');
    expect(changes).toBeGreaterThanOrEqual(2);
    off();
    const before = changes;
    model.tick();
    expect(changes).toBe(before);
  });
});

describe('对外常量', () => {
  it('四个方向按上下左右的顺序导出', () => {
    expect(ICE_SNAKE_DIRECTIONS).toEqual(['up', 'right', 'down', 'left']);
  });
});
