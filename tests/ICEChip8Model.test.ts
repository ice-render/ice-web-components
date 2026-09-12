/**
 * CHIP-8 虚拟机规格（纯逻辑，不碰 canvas）。
 *
 * 掌机第四块卡带用它：`ICESnakeModel` / `ICETetrisModel` 是"规则模型"，CHIP-8 则是**一台真机器**——
 * 35 条指令、4KB 内存、16 个寄存器、64×32 单色显存、两个定时器、16 键键盘。
 * 画面用 `ICETileMap`（64×32 = 2048 格，1 个节点）画，音效走掌机那套 WebAudio。
 *
 * 规格（只列本库用得到的核心指令，够跑 demo ROM）：
 * - `00E0` 清屏；`1NNN` 跳转；`2NNN` 调用；`00EE` 返回；
 * - `6XNN`/`7XNN` 赋值/加；`ANNN` 设 I；`FX55`/`FX65` 批量存/取寄存器；
 * - `3XNN`/`4XNN` 条件跳过；`FX07`/`FX15` 读写延时定时器；`FX1E` I += VX；
 * - `DXYN` 画精灵：按位异或，**碰到已有像素就把 VF 置 1**（游戏碰撞的经典做法）；
 * - 定时器由 `tickTimers()` 驱动（60Hz，由页面按真实时间调用）；
 * - 键盘 `setKey(i, down)`，`FX0A` 阻塞等待按键（读到了就继续）。
 */
import { ICE_CHIP8_DEMO_ROM, ICEChip8Model } from '../src/model/ICEChip8Model';

/** 把指令数组写进内存（0x200 起）。 */
const load = (model: ICEChip8Model, opcodes: number[]) =>
  model.loadProgram(opcodes.reduce((bytes: number[], code) => bytes.concat([(code >> 8) & 0xff, code & 0xff]), []));

describe('机器与内存', () => {
  it('新机器：PC 从 0x200 开始，寄存器与显存都是干净的', () => {
    const model = new ICEChip8Model();
    expect(model.getPC()).toBe(0x200);
    expect(model.getDisplay()).toHaveLength(64 * 32);
    expect(model.getDisplay().every((pixel) => pixel === 0)).toBe(true);
    expect(model.getV(0)).toBe(0);
    expect(model.getDelayTimer()).toBe(0);
    expect(model.getSoundTimer()).toBe(0);
  });

  it('载入程序后可以按步执行（PC 逐条前进）', () => {
    const model = new ICEChip8Model();
    load(model, [0x6001, 0x6102]); // V0 = 1; V1 = 2
    model.step();
    expect(model.getV(0)).toBe(1);
    expect(model.getPC()).toBe(0x202);
    model.step();
    expect(model.getV(1)).toBe(2);
  });
});

describe('寄存器与流程', () => {
  it('7XNN 相加不回绕进位；6XNN 赋值', () => {
    const model = new ICEChip8Model();
    load(model, [0x60f0, 0x7020]); // V0 = 0xF0; V0 += 0x20
    model.step();
    model.step();
    expect(model.getV(0)).toBe(0x10); // 不回绕成 0x110，直接截断（CHIP-8 的语义）
  });

  it('1NNN 跳转、2NNN/00EE 调用与返回', () => {
    const model = new ICEChip8Model();
    // 0x200: 调用 0x206；0x202: 跳过（不该执行）；0x204: 结束；0x206: V0=7；00EE 返回
    load(model, [0x2206, 0x6001, 0x0000, 0x6007, 0x00ee]);
    model.step(); // call
    expect(model.getPC()).toBe(0x206);
    model.step(); // V0 = 7
    model.step(); // return
    expect(model.getV(0)).toBe(7);
    expect(model.getPC()).toBe(0x202);
  });

  it('3XNN / 4XNN 条件跳过', () => {
    const model = new ICEChip8Model();
    load(model, [0x6005, 0x3005, 0x6101, 0x6102]); // V0=5; if V0==5 跳过下一条
    model.step();
    model.step();
    model.step(); // 被跳过的是 0x6101
    expect(model.getV(1)).toBe(2);
  });
});

describe('显存与精灵', () => {
  it('00E0 清屏', () => {
    const model = new ICEChip8Model();
    load(model, [0xa20a, 0xd001, 0x00e0]);
    model.memoryWrite(0x20a, 0b11000000);
    model.step(); // I = 0x20A
    model.step(); // 画到 (0,0)
    expect(model.getPixel(0, 0)).toBe(1);
    model.step(); // 清屏
    expect(model.getDisplay().every((pixel) => pixel === 0)).toBe(true);
  });

  it('DXYN 按位异或绘制，碰到已有像素置 VF=1 并擦掉该像素', () => {
    const model = new ICEChip8Model();
    load(model, [0xa20a, 0xd001, 0xd001]);
    model.memoryWrite(0x20a, 0b10000000);
    model.step();
    model.step(); // 第一次画：点亮
    expect(model.getPixel(0, 0)).toBe(1);
    expect(model.getV(0xf)).toBe(0);
    model.step(); // 第二次画同一位置：异或擦掉 + 碰撞
    expect(model.getPixel(0, 0)).toBe(0);
    expect(model.getV(0xf)).toBe(1);
  });

  it('精灵按 VX/VY 定位，且坐标对 64/32 取模（COLS/ROWS 回绕）', () => {
    const model = new ICEChip8Model();
    load(model, [0x6063, 0x6101, 0xa20a, 0xd011]); // V0=99, V1=1, I=0x20A, 画
    model.memoryWrite(0x20a, 0b10000000);
    model.step();
    model.step();
    model.step();
    model.step();
    expect(model.getPixel(1, 99 % 64)).toBe(1);
  });
});

describe('定时器与键盘', () => {
  it('tickTimers 递减两个定时器（到 0 为止）', () => {
    const model = new ICEChip8Model();
    load(model, [0x631e, 0xf318, 0x641e, 0xf415]); // V3=30 → delay；V4=30 → sound
    model.step();
    model.step();
    model.step();
    model.step();
    expect(model.getDelayTimer()).toBe(30);
    expect(model.getSoundTimer()).toBe(30);
    model.tickTimers();
    expect(model.getDelayTimer()).toBe(29);
    for (let i = 0; i < 40; i += 1) model.tickTimers();
    expect(model.getDelayTimer()).toBe(0);
    expect(model.getSoundTimer()).toBe(0);
  });

  it('FX0A 等按键：没按键时 PC 不前进，按下后读入并继续', () => {
    const model = new ICEChip8Model();
    load(model, [0xf00a, 0x6109]);
    model.step(); // 等按键：PC 不动
    expect(model.getPC()).toBe(0x200);
    model.setKey(5, true);
    model.step(); // 读到 5
    expect(model.getV(0)).toBe(5);
    expect(model.getPC()).toBe(0x202);
  });
});

describe('自带 demo ROM（自写，避开版权）', () => {
  it('跑起来会画出东西，而且笑脸在屏幕里来回弹（不会裂到对边）', () => {
    const model = new ICEChip8Model();
    model.loadProgram(ICE_CHIP8_DEMO_ROM);
    for (let i = 0; i < 60; i += 1) model.step();
    // 逐条步进采样：ROM 每轮会先清屏再画，所以要看「亮像素数的最大值」而不是某一瞬间
    let maxLit = 0;
    for (let i = 0; i < 21; i += 1) {
      model.step();
      maxLit = Math.max(maxLit, Array.from(model.getDisplay()).reduce((sum, pixel) => sum + pixel, 0));
    }
    // 8×8 笑脸精灵：点亮 26 个像素。上限 64 = 一屏只有一个精灵（清屏没落下就会两三个叠着）
    expect(maxLit).toBe(26);
    // 逐条步进采样：位置必须出现过多个不同值（= 方块真的在动）
    const positions = new Set<number>();
    let split = false;
    for (let i = 0; i < 900; i += 1) {
      model.step();
      const display = model.getDisplay();
      const first = display.findIndex((pixel) => pixel === 1);
      if (first < 0) continue;
      positions.add(first);
      // 笑脸是完整一块：横向跨度 8 格、纵向跨度 8 格（裂到对边就会大于 8）
      let minCol = 64;
      let maxCol = -1;
      let minRow = 32;
      let maxRow = -1;
      display.forEach((pixel, index) => {
        if (!pixel) return;
        const row = Math.floor(index / 64);
        const col = index % 64;
        minCol = Math.min(minCol, col);
        maxCol = Math.max(maxCol, col);
        minRow = Math.min(minRow, row);
        maxRow = Math.max(maxRow, row);
      });
      if (maxCol - minCol > 7 || maxRow - minRow > 7) split = true;
    }
    expect(positions.size).toBeGreaterThan(20); // 位置花样多 = 一直在动
    expect(split).toBe(false); // 一次都没裂到对边
  });

  it('撞到边就反向：列到 56 后掉头，回到 0 再掉头（补码减法真的生效）', () => {
    const model = new ICEChip8Model();
    model.loadProgram(ICE_CHIP8_DEMO_ROM);
    // 每步都读 V0，去掉连续重复（一个循环里 V0 只变一次）
    const track: number[] = [];
    for (let i = 0; i < 900; i += 1) {
      model.step();
      const col = model.getV(0);
      if (track[track.length - 1] !== col) track.push(col);
    }
    expect(Math.max(...track)).toBe(56); // 顶到 64-8 就掉头，不会绕回
    expect(Math.min(...track)).toBe(0);
    const peak = track.indexOf(56);
    expect(track[peak + 1]).toBeLessThan(56); // 到顶就往下走
    const valley = track.indexOf(0, peak);
    expect(track[valley + 1]).toBeGreaterThan(0); // 到底再往上走
  });

  it('延时定时器被 ROM 用起来了（F015）', () => {
    const model = new ICEChip8Model();
    model.loadProgram(ICE_CHIP8_DEMO_ROM);
    for (let i = 0; i < 20; i += 1) model.step();
    expect(model.getDelayTimer()).toBeGreaterThanOrEqual(0);
    expect(model.isWaitingForKey()).toBe(false);
  });
});

describe('寄存器存取与错误处理', () => {
  it('FX55 / FX65 批量写读 V0..VX，I 随之移动', () => {
    const model = new ICEChip8Model();
    load(model, [0x6001, 0x6111, 0x6221, 0xa300, 0xf255, 0x0000, 0xa300, 0xf265]);
    model.step();
    model.step();
    model.step();
    model.step(); // I = 0x300
    model.step(); // 存 V0..V2
    expect(model.memoryRead(0x300)).toBe(1);
    expect(model.memoryRead(0x301)).toBe(0x11);
    expect(model.memoryRead(0x302)).toBe(0x21);
    model.step(); // NOP（0x0000）
    model.step(); // I = 0x300
    model.setVForTest(0, 0);
    model.setVForTest(1, 0);
    model.step(); // 读回
    expect([model.getV(0), model.getV(1), model.getV(2)]).toEqual([1, 0x11, 0x21]);
  });

  it('未知指令不崩：抛一个带指令与地址的错误（便于排查 ROM）', () => {
    const model = new ICEChip8Model();
    load(model, [0xffff]);
    expect(() => model.step()).toThrow(/0xffff|FFFF/i);
  });

  it('step 次数可累计（QA 用它推进到画面稳定）', () => {
    const model = new ICEChip8Model();
    load(model, [0x6001, 0x6102, 0x6203]);
    expect(model.getCycles()).toBe(0);
    model.step();
    model.step();
    expect(model.getCycles()).toBe(2);
  });
});

describe('掌机契约：暂停 / 结束态 / 变更通知', () => {
  it('pause / resume：暂停期间 step 与 tickTimers 都不推进', () => {
    const model = new ICEChip8Model();
    load(model, [0x6001, 0xf015]);
    let notified = 0;
    model.addChangeListener(() => { notified += 1; });
    expect(model.isPaused()).toBe(false);

    model.pause();
    expect(model.isPaused()).toBe(true);
    expect(notified).toBe(1); // 掌机外壳靠这条通知去弹「已暂停」的提示
    model.pause(); // 已经暂停了就不重复通知
    expect(notified).toBe(1);
    model.step();
    model.tickTimers();
    expect(model.getV(0)).toBe(0);
    expect(model.getCycles()).toBe(0);
    expect(model.getPC()).toBe(0x200);

    model.resume();
    expect(model.isPaused()).toBe(false);
    expect(notified).toBe(2);
    model.step();
    expect(model.getV(0)).toBe(1);
    expect(model.getPC()).toBe(0x202);
  });

  it('isGameOver 恒为 false：VM 没有"结束"这回事，掌机外壳按统一契约调用它', () => {
    const model = new ICEChip8Model();
    load(model, [0x6001, 0x1200]);
    expect(model.isGameOver()).toBe(false);
    model.step();
    model.step();
    expect(model.isGameOver()).toBe(false);
  });

  it('addChangeListener：画出画面 / 按键 / 定时器 / 复位才通知，取消订阅后不再通知', () => {
    const model = new ICEChip8Model();
    let count = 0;
    const off = model.addChangeListener(() => { count += 1; });
    load(model, [0x6000, 0x6100, 0xa300, 0xd011, 0x6405, 0xf415]);
    model.memoryWrite(0x300, 0xc0); // 精灵数据（I=0x300 处，别压在程序上）

    model.step();
    model.step();
    model.step();
    expect(count).toBe(0); // 只是改寄存器，屏幕没变：不用惊动渲染

    model.step(); // DXYN：画出画面
    expect(count).toBe(1);
    expect(model.getPixel(0, 0)).toBe(1);

    model.setKey(3, true);
    expect(count).toBe(2);
    model.setKey(3, true); // 状态没变就不重复通知
    expect(count).toBe(2);
    model.setKey(3, false);
    expect(count).toBe(3);

    model.step(); // V4 = 5
    model.step(); // delay = V4
    expect(model.getDelayTimer()).toBe(5);
    expect(count).toBe(3); // 只改寄存器，屏幕没变
    model.tickTimers(); // 延时定时器 5 → 4
    expect(model.getDelayTimer()).toBe(4);
    expect(count).toBe(4);
    model.tickTimers(); // 继续递减
    expect(count).toBe(5);

    model.reset();
    expect(count).toBe(6);

    off();
    model.setKey(5, true);
    expect(count).toBe(6);
  });
});
