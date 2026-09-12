/**
 * CHIP-8 虚拟机（纯逻辑，不碰 canvas）。
 *
 * 掌机的第四块卡带用它：前三个模型是"某款游戏的规则"，这是一个**真的微处理器模拟器**——
 * 4KB 内存、16 个 8 位寄存器、16 位地址寄存器 I、64×32 单色显存、两个 60Hz 定时器、16 键键盘。
 * 画面交给 `ICETileMap`（2048 格仍然只有 1 个节点）画，音效走掌机那套 WebAudio。
 *
 * 支持指令（跑 demo / 小 ROM 足够）：00E0 / 00EE / 1NNN / 2NNN / 3XNN / 4XNN / 5XY0 / 9XY0 /
 * 6XNN / 7XNN / 8XY0-8XYE / 9XY0 / ANNN / BNNN / CXNN / DXYN / EX9E / EXA1 / FX07 / FX0A /
 * FX15 / FX18 / FX1E / FX29 / FX33 / FX55 / FX65。
 */
export const ICE_CHIP8_KEYS = ['1', '2', '3', 'C', '4', '5', '6', 'D', '7', '8', '9', 'E', 'A', '0', 'B', 'F'] as const;

/** 内置 4×5 字模（0-F），FX29 会用到。 */
const FONT_SET = [
  0xf0, 0x90, 0x90, 0x90, 0xf0, 0x20, 0x60, 0x20, 0x20, 0x70, 0xf0, 0x10, 0xf0, 0x80, 0xf0, 0xf0, 0x10, 0xf0, 0x10, 0xf0,
  0x90, 0x90, 0xf0, 0x10, 0x10, 0xf0, 0x80, 0xf0, 0x10, 0xf0, 0xf0, 0x80, 0xf0, 0x90, 0xf0, 0xf0, 0x10, 0x20, 0x40, 0x40,
  0xf0, 0x90, 0xf0, 0x90, 0xf0, 0xf0, 0x90, 0xf0, 0x10, 0xf0, 0xf0, 0x90, 0xf0, 0x90, 0x90, 0xe0, 0x90, 0xe0, 0x90, 0xe0,
  0xf0, 0x80, 0x80, 0x80, 0xf0, 0xe0, 0x90, 0x90, 0x90, 0xe0, 0xf0, 0x80, 0xf0, 0x80, 0xf0, 0xf0, 0x80, 0xf0, 0x80, 0x80,
];
const FONT_BASE = 0x50;

/**
 * 自带的 demo ROM（自写，不依赖任何外部 ROM，避开版权）。
 *
 * 它做的事：清屏 → 在 (V0,V1) 画一个 8×8 笑脸 → 按 (V2,V3) 走一步 → 撞到边就把速度取反 → 跳回清屏重画。
 * 也就是**在屏幕里来回弹**的笑脸：既不会裂到对边，也把条件跳过（4XNN）、补码减法（7XNN / 6XNN 的 0xFE）
 * 和自建循环这几条最常用的指令演了一遍。
 * 地址：程序 0x200 起（20 条指令 = 40 字节），精灵数据在 0x228（8 字节）。
 */
export const ICE_CHIP8_DEMO_ROM: number[] = [
  0x60, 0x00, // V0 = 0（列）
  0x61, 0x00, // V1 = 0（行）
  0x62, 0x02, // V2 = +2（列速度）
  0x63, 0x02, // V3 = +2（行速度）
  0x64, 0x0a, // V4 = 10（每帧延时）
  0x00, 0xe0, // 清屏                     ← 循环入口 0x20A
  0xa2, 0x28, // I = 0x228（精灵数据地址，见本数组末尾）
  0xd0, 0x18, // 画 8 行精灵到 (V0,V1)
  0xf0, 0x15, // delay = V4
  0x80, 0x24, // V0 += V2（8XY4 的 X/Y 在低两位 nibble：0x8024）
  0x81, 0x34, // V1 += V3
  0x40, 0x38, // if V0 != 56 跳过下一条（列最大 64-8）
  0x62, 0xfe, // V2 = -2
  0x40, 0x00, // if V0 != 0 跳过下一条
  0x62, 0x02, // V2 = +2
  0x41, 0x18, // if V1 != 24 跳过下一条（行最大 32-8）
  0x63, 0xfe, // V3 = -2
  0x41, 0x00, // if V1 != 0 跳过下一条
  0x63, 0x02, // V3 = +2
  0x12, 0x0a, // 跳回循环入口（0x20A 的清屏）
  // 8×8 笑脸（放在 0x228，点亮 26 个像素）
  0x3c, 0x42, 0xa5, 0x81, 0xa5, 0x99, 0x42, 0x3c,
];

export const ICE_CHIP8_WIDTH = 64;
export const ICE_CHIP8_HEIGHT = 32;

/** 状态变化通知（掌机外壳拿它驱动重绘，和另外三个游戏模型是同一套契约）。 */
export type ICEChip8Listener = (model: ICEChip8Model) => void;

export class ICEChip8Model {
  private memory = new Uint8Array(4096);
  private v = new Uint8Array(16);
  private i = 0;
  private pc = 0x200;
  private sp = 0;
  private stack = new Uint16Array(16);
  private display = new Uint8Array(ICE_CHIP8_WIDTH * ICE_CHIP8_HEIGHT);
  private keys = new Array(16).fill(false);
  private delay = 0;
  private sound = 0;
  private cycles = 0;
  private random: () => number;
  private paused = false;
  /** 本条指令改了显存 → 执行完统一通知一次（别在 600 条/秒的频率上惊动渲染） */
  private displayDirty = false;
  private listeners: ICEChip8Listener[] = [];
  /** FX0A 正在等按键时记住键位寄存器 */
  private waitingForKey: number | null = null;

  constructor(options: { random?: () => number } = {}) {
    this.random = options.random || Math.random;
    this.memory.set(FONT_SET, FONT_BASE);
    this.pc = 0x200;
  }

  // ---------------------------------------------------------------- 查询
  public getPC(): number { return this.pc; }
  public getI(): number { return this.i; }
  public getV(index: number): number { return this.v[index & 0xf]; }
  public getDisplay(): Uint8Array { return this.display; }
  public getPixel(row: number, col: number): number {
    if (row < 0 || row >= ICE_CHIP8_HEIGHT || col < 0 || col >= ICE_CHIP8_WIDTH) return 0;
    return this.display[row * ICE_CHIP8_WIDTH + col];
  }
  public getDelayTimer(): number { return this.delay; }
  public getSoundTimer(): number { return this.sound; }
  public getCycles(): number { return this.cycles; }
  public isWaitingForKey(): boolean { return this.waitingForKey !== null; }
  public memoryRead(address: number): number { return this.memory[address & 0xfff]; }
  public isKeyDown(index: number): boolean { return !!this.keys[index & 0xf]; }
  /** 暂停中（调试/切走标签页）：`step()` 与 `tickTimers()` 都不推进。 */
  public isPaused(): boolean { return this.paused; }
  /** VM 没有"输赢"，但掌机外壳按统一契约询问，这里老实回答"没结束"。 */
  public isGameOver(): boolean { return false; }

  // ---------------------------------------------------------------- 操作
  public pause(): void {
    if (this.paused) return;
    this.paused = true;
    this.notify();
  }
  public resume(): void {
    if (!this.paused) return;
    this.paused = false;
    this.notify();
  }
  /**
   * 订阅状态变化：显存画了新东西、按键变了、定时器走了、机器复位了都会通知。
   * 返回取消订阅的函数（和其它模型一致）。
   */
  public addChangeListener(listener: ICEChip8Listener): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index !== -1) this.listeners.splice(index, 1);
    };
  }
  public loadProgram(bytes: ArrayLike<number>, address: number = 0x200): void {
    for (let i = 0; i < bytes.length; i += 1) this.memory[(address + i) & 0xfff] = bytes[i] & 0xff;
  }
  public memoryWrite(address: number, value: number): void { this.memory[address & 0xfff] = value & 0xff; }
  public setKey(index: number, down: boolean): void {
    const slot = index & 0xf;
    const next = !!down;
    if (this.keys[slot] === next) return; // 状态没变就不通知
    this.keys[slot] = next;
    this.notify();
  }
  /** 清掉所有按键（切卡带/失焦时用）。 */
  public clearKeys(): void {
    if (!this.keys.some(Boolean)) return;
    this.keys = new Array(16).fill(false);
    this.notify();
  }
  public setVForTest(index: number, value: number): void { this.v[index & 0xf] = value & 0xff; }
  public reset(): void {
    this.memory.fill(0);
    this.memory.set(FONT_SET, FONT_BASE);
    this.v.fill(0);
    this.display.fill(0);
    this.i = 0; this.pc = 0x200; this.sp = 0; this.delay = 0; this.sound = 0; this.cycles = 0;
    this.waitingForKey = null; this.keys = new Array(16).fill(false);
    this.paused = false;
    this.notify();
  }

  /** 60Hz：递减延时/声音定时器。 */
  public tickTimers(): void {
    if (this.paused) return;
    let changed = false;
    if (this.delay > 0) { this.delay -= 1; changed = true; }
    if (this.sound > 0) { this.sound -= 1; changed = true; }
    if (changed) this.notify();
  }

  /** 执行一条指令（FX0A 等按键时 PC 不动，直接返回）。 */
  public step(): void {
    if (this.paused) return;
    if (this.waitingForKey !== null) {
      const key = this.keys.findIndex(Boolean);
      if (key < 0) return;
      this.v[this.waitingForKey] = key;
      this.waitingForKey = null;
      this.pc = (this.pc + 2) & 0xfff;
      this.notify();
      return;
    }
    const opcode = (this.memory[this.pc] << 8) | this.memory[this.pc + 1];
    const nextPC = (this.pc + 2) & 0xfff;
    const nnn = opcode & 0x0fff;
    const nn = opcode & 0x00ff;
    const n = opcode & 0x000f;
    const x = (opcode >> 8) & 0xf;
    const y = (opcode >> 4) & 0xf;
    const head = opcode >> 12;
    let jumped = false;
    // FX0A：进入/维持等待状态时 PC 不动、也不计周期
    if (head === 0xf && nn === 0x0a) { this.waitingForKey = x; return; }
    switch (head) {
      case 0x0:
        if (opcode === 0x00e0) { this.display.fill(0); this.displayDirty = true; }
        else if (opcode === 0x00ee) { this.sp = (this.sp - 1) & 0xf; this.pc = this.stack[this.sp]; jumped = true; }
        break;
      case 0x1: this.pc = nnn; jumped = true; break;
      case 0x2:
        this.stack[this.sp & 0xf] = nextPC; this.sp = (this.sp + 1) & 0xf; this.pc = nnn; jumped = true; break;
      case 0x3: if (this.v[x] === nn) { this.pc = nextPC + 2; jumped = true; } break;
      case 0x4: if (this.v[x] !== nn) { this.pc = nextPC + 2; jumped = true; } break;
      case 0x5: if (this.v[x] === this.v[y]) { this.pc = nextPC + 2; jumped = true; } break;
      case 0x6: this.v[x] = nn; break;
      case 0x7: this.v[x] = (this.v[x] + nn) & 0xff; break;
      case 0x8: this.__alu(opcode, x, y, n); break;
      case 0x9: if (this.v[x] !== this.v[y]) { this.pc = nextPC + 2; jumped = true; } break;
      case 0xa: this.i = nnn; break;
      case 0xb: this.pc = (nnn + this.v[0]) & 0xfff; jumped = true; break;
      case 0xc: this.v[x] = Math.floor(this.random() * 256) & nn; break;
      case 0xd: this.__draw(x, y, n); break;
      case 0xe:
        if (nn === 0x9e) { if (this.keys[this.v[x] & 0xf]) { this.pc = nextPC + 2; jumped = true; } }
        else if (nn === 0xa1) { if (!this.keys[this.v[x] & 0xf]) { this.pc = nextPC + 2; jumped = true; } }
        break;
      case 0xf: this.__misc(opcode, x, nn); break;
      default:
        throw new Error(`ICEChip8Model: 未知指令 0x${opcode.toString(16)} @ 0x${this.pc.toString(16)}`);
    }
    if (!jumped) this.pc = nextPC;
    this.cycles += 1;
    if (this.displayDirty) {
      this.displayDirty = false;
      this.notify();
    }
  }

  // ---------------------------------------------------------------- 内部
  private notify(): void {
    if (!this.listeners.length) return;
    [...this.listeners].forEach((listener) => listener(this));
  }

  private __alu(opcode: number, x: number, y: number, n: number): void {
    const vy = this.v[y];
    switch (n) {
      case 0x0: this.v[x] = vy; break;
      case 0x1: this.v[x] |= vy; break;
      case 0x2: this.v[x] &= vy; break;
      case 0x3: this.v[x] ^= vy; break;
      case 0x4: { const sum = this.v[x] + vy; this.v[x] = sum & 0xff; this.v[0xf] = sum > 0xff ? 1 : 0; break; }
      case 0x5: { const carry = this.v[x] >= vy ? 1 : 0; this.v[x] = (this.v[x] - vy) & 0xff; this.v[0xf] = carry; break; }
      case 0x6: { const lsb = this.v[x] & 1; this.v[x] = (this.v[x] >> 1) & 0xff; this.v[0xf] = lsb; break; }
      case 0x7: { const carry = this.v[x] <= vy ? 1 : 0; this.v[x] = (vy - this.v[x]) & 0xff; this.v[0xf] = carry; break; }
      case 0xe: { const msb = (this.v[x] >> 7) & 1; this.v[x] = (this.v[x] << 1) & 0xff; this.v[0xf] = msb; break; }
      default: throw new Error(`ICEChip8Model: 未知算术指令 0x${opcode.toString(16)}`);
    }
  }

  /** DXYN：按位异或画精灵；撞到亮点就把 VF 置 1。 */
  private __draw(x: number, y: number, rows: number): void {
    const startCol = this.v[x] % ICE_CHIP8_WIDTH;
    const startRow = this.v[y] % ICE_CHIP8_HEIGHT;
    this.v[0xf] = 0;
    if (rows === 0) return; // DXYN 画 0 行 = 空操作
    this.displayDirty = true;
    for (let row = 0; row < rows; row += 1) {
      const bits = this.memory[(this.i + row) & 0xfff];
      for (let bit = 0; bit < 8; bit += 1) {
        if (!(bits & (0x80 >> bit))) continue;
        const col = (startCol + bit) % ICE_CHIP8_WIDTH;
        const target = (startRow + row) % ICE_CHIP8_HEIGHT;
        const index = target * ICE_CHIP8_WIDTH + col;
        if (this.display[index]) this.v[0xf] = 1;
        this.display[index] ^= 1;
      }
    }
  }

  private __misc(opcode: number, x: number, nn: number): void {
    switch (nn) {
      case 0x07: this.v[x] = this.delay; break;
      case 0x0a: this.waitingForKey = x; break; // 等按键：PC 停在原地（见 step 的早退）
      case 0x15: this.delay = this.v[x]; break;
      case 0x18: this.sound = this.v[x]; break;
      case 0x1e: this.i = (this.i + this.v[x]) & 0xfff; break;
      case 0x29: this.i = FONT_BASE + (this.v[x] & 0xf) * 5; break;
      case 0x33: {
        const value = this.v[x];
        this.memory[(this.i) & 0xfff] = Math.floor(value / 100);
        this.memory[(this.i + 1) & 0xfff] = Math.floor((value % 100) / 10);
        this.memory[(this.i + 2) & 0xfff] = value % 10;
        break;
      }
      case 0x55: for (let index = 0; index <= x; index += 1) this.memory[(this.i + index) & 0xfff] = this.v[index]; this.i = (this.i + x + 1) & 0xfff; break;
      case 0x65: for (let index = 0; index <= x; index += 1) this.v[index] = this.memory[(this.i + index) & 0xfff]; this.i = (this.i + x + 1) & 0xfff; break;
      default: throw new Error(`ICEChip8Model: 未知指令 0x${opcode.toString(16)}`);
    }
  }
}
