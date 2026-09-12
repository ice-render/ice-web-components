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
import { ICEChip8Model } from '../src/model/ICEChip8Model';

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
