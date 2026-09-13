/**
 * 掌机 BIOS 的纯逻辑（不碰 canvas、不碰 DOM）。
 *
 * 掌机开机先跑一段「自检 → 菜单」的引导，然后才把控制权交给卡带：
 * 自检是**按时序推进**的（页面每帧调 `tick(dt)`），菜单是**光标 + 确认**的老式控制台交互。
 * 页面只负责把 `getSteps()` / `getMenuEntries()` 画成文字、把 `confirm()` 返回的动作执行掉。
 *
 * 约定：
 * - 自检项由 `steps` 注入（默认 5 项：CPU / RAM / VRAM / SOUND / CART），每项有自己的耗时；
 * - `tick(dt)` 推进自检：当前项 running、之前的 ok、之后的 pending，全部走完 progress = 1；
 * - 自检结束后进入哪里由「快速启动」决定：开 → 直接 `boot`，关 → 停在 `menu`；
 * - 菜单光标上下**循环**（到头绕回去，老式 BIOS 都这样）；
 * - `confirm()` 只返回动作（boot / settings / menu），执行动作是页面的事 —— 好测；
 * - 设置（快速启动 / 默认卡带）落到注入的存储里，坏数据一律降级成默认值，绝不抛。
 */
import { ICEBiosModel, ICE_BIOS_DEFAULT_STEPS } from '../src/model/ICEBiosModel';

const CARTRIDGES = [
  { key: 'tetris', label: '俄罗斯方块' },
  { key: 'snake', label: '贪吃蛇' },
  { key: '2048', label: '2048' },
  { key: 'chip8', label: 'CHIP-8' },
];

/** 内存版存储：断言写盘内容用。 */
const makeStorage = () => {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => (data.has(key) ? (data.get(key) as string) : null),
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
};

const makeBios = (options: any = {}) =>
  new ICEBiosModel({ cartridges: CARTRIDGES, storage: makeStorage(), ...options });

describe('开机自检（POST）', () => {
  it('默认 5 项自检，顺序固定，卡带那项会写进实际卡带数', () => {
    const bios = makeBios();
    const steps = bios.getSteps();
    expect(steps.map((step) => step.key)).toEqual(['cpu', 'ram', 'vram', 'sound', 'cart']);
    expect(steps[0].label).toBe('CPU');
    expect(steps[4].detail).toContain('4');
    expect(steps.every((step) => step.state === 'pending')).toBe(true);
    expect(bios.getPhase()).toBe('post');
    expect(bios.getPostProgress()).toBe(0);
  });

  it('tick 推进时序：当前项 running、前面的 ok、后面的 pending', () => {
    const bios = makeBios();
    bios.tick(ICE_BIOS_DEFAULT_STEPS[0].duration / 2);
    const steps = bios.getSteps();
    expect(steps[0].state).toBe('running');
    expect(steps[1].state).toBe('pending');
    expect(bios.getPostProgress()).toBeGreaterThan(0);
    expect(bios.getPostProgress()).toBeLessThan(1);
  });

  it('跑完整段自检：全部 ok、progress = 1、默认停在菜单', () => {
    const bios = makeBios();
    const total = ICE_BIOS_DEFAULT_STEPS.reduce((sum, step) => sum + step.duration, 0);
    bios.tick(total);
    expect(bios.getSteps().every((step) => step.state === 'ok')).toBe(true);
    expect(bios.getPostProgress()).toBe(1);
    expect(bios.getPhase()).toBe('menu');
    expect(bios.getPostElapsed()).toBeGreaterThanOrEqual(total);
  });

  it('开了「快速启动」：自检完直接进 boot，不停菜单', () => {
    const bios = makeBios({ settings: { quickBoot: true, defaultCartridge: 'snake' } });
    bios.tick(10000);
    expect(bios.getPhase()).toBe('boot');
  });

  it('自检跑完之后再 tick 不会把状态搅乱（幂等）', () => {
    const bios = makeBios();
    bios.tick(10000);
    const phase = bios.getPhase();
    bios.tick(10000);
    expect(bios.getPhase()).toBe(phase);
    expect(bios.getPostProgress()).toBe(1);
  });
});

describe('启动菜单', () => {
  it('菜单 = 卡带列表 + 设置 + 退出并启动；光标默认在默认卡带上', () => {
    const bios = makeBios({ settings: { quickBoot: false, defaultCartridge: '2048' } });
    bios.tick(10000);
    const entries = bios.getMenuEntries();
    expect(entries.map((entry) => entry.key)).toEqual(['tetris', 'snake', '2048', 'chip8', 'settings', 'boot']);
    expect(entries[4].type).toBe('settings');
    expect(entries[5].type).toBe('boot');
    expect(bios.getCursor()).toBe(2);
    expect(bios.getSelectedEntry()!.key).toBe('2048');
  });

  it('光标上下循环（到顶再上 = 绕到最后一个，反过来也一样）', () => {
    const bios = makeBios();
    bios.tick(10000);
    const count = bios.getMenuEntries().length;
    bios.setCursor(0);
    bios.moveCursor(-1);
    expect(bios.getCursor()).toBe(count - 1);
    bios.moveCursor(1);
    expect(bios.getCursor()).toBe(0);
    bios.moveCursor(1);
    expect(bios.getCursor()).toBe(1);
  });

  it('confirm() 选卡带 → 返回 boot 动作并切到 boot 相位', () => {
    const bios = makeBios();
    bios.tick(10000);
    bios.setCursor(1);
    const action = bios.confirm();
    expect(action).toEqual({ type: 'boot', cartridge: 'snake' });
    expect(bios.getPhase()).toBe('boot');
  });

  it('confirm() 选「设置」→ 进设置页；再返回菜单', () => {
    const bios = makeBios();
    bios.tick(10000);
    bios.setCursor(4);
    expect(bios.confirm()).toEqual({ type: 'settings' });
    expect(bios.getPhase()).toBe('settings');
    bios.back();
    expect(bios.getPhase()).toBe('menu');
    expect(bios.getCursor()).toBe(4); // 回到菜单时还停在「设置」上
  });

  it('confirm() 选「退出并启动」→ 用默认卡带启动', () => {
    const bios = makeBios({ settings: { quickBoot: false, defaultCartridge: 'chip8' } });
    bios.tick(10000);
    bios.setCursor(5);
    expect(bios.confirm()).toEqual({ type: 'boot', cartridge: 'chip8' });
  });

  it('游戏里按 BIOS 键回到菜单：openMenu() 把相位切回 menu 并重新对齐光标', () => {
    const bios = makeBios({ settings: { quickBoot: false, defaultCartridge: 'snake' } });
    bios.tick(10000);
    bios.setCursor(1);
    bios.confirm();
    expect(bios.getPhase()).toBe('boot');
    bios.openMenu();
    expect(bios.getPhase()).toBe('menu');
    expect(bios.getSelectedEntry()!.key).toBe('snake');
  });
});

describe('设置与持久化', () => {
  it('切换快速启动 / 默认卡带会写进存储，新实例读得回来', () => {
    const storage = makeStorage();
    const bios = new ICEBiosModel({ cartridges: CARTRIDGES, storage });
    expect(bios.getSettings()).toEqual({ quickBoot: false, defaultCartridge: 'tetris' });
    bios.toggleQuickBoot();
    bios.setDefaultCartridge('chip8');
    expect(bios.getSettings()).toEqual({ quickBoot: true, defaultCartridge: 'chip8' });
    expect(storage.data.size).toBe(1);

    const restored = new ICEBiosModel({ cartridges: CARTRIDGES, storage });
    expect(restored.getSettings()).toEqual({ quickBoot: true, defaultCartridge: 'chip8' });
  });

  it('存储坏掉（非法 JSON / 字段类型不对）降级成默认值，不抛', () => {
    const storage = makeStorage();
    storage.setItem('ice-arcade-bios-settings', '{');
    expect(() => new ICEBiosModel({ cartridges: CARTRIDGES, storage })).not.toThrow();
    expect(new ICEBiosModel({ cartridges: CARTRIDGES, storage }).getSettings().quickBoot).toBe(false);

    storage.setItem('ice-arcade-bios-settings', JSON.stringify({ quickBoot: 'yes', defaultCartridge: 42 }));
    const bios = new ICEBiosModel({ cartridges: CARTRIDGES, storage });
    expect(bios.getSettings()).toEqual({ quickBoot: false, defaultCartridge: 'tetris' });
  });

  it('默认卡带在存储里写的是不存在的 key → 回退到第一个卡带', () => {
    const storage = makeStorage();
    storage.setItem('ice-arcade-bios-settings', JSON.stringify({ quickBoot: false, defaultCartridge: 'not-a-cart' }));
    const bios = new ICEBiosModel({ cartridges: CARTRIDGES, storage });
    expect(bios.getSettings().defaultCartridge).toBe('tetris');
  });

  it('调用方给的 settings 只是「出厂默认」，存储里的用户设置优先', () => {
    const storage = makeStorage();
    storage.setItem('ice-arcade-bios-settings', JSON.stringify({ quickBoot: false, defaultCartridge: 'snake' }));
    const bios = new ICEBiosModel({ cartridges: CARTRIDGES, storage, settings: { quickBoot: true } });
    expect(bios.getSettings()).toEqual({ quickBoot: false, defaultCartridge: 'snake' });
  });

  it('写盘失败（隐私模式 / 配额满）不影响内存里的设置', () => {
    const storage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    const bios = new ICEBiosModel({ cartridges: CARTRIDGES, storage });
    expect(() => bios.toggleQuickBoot()).not.toThrow();
    expect(bios.getSettings().quickBoot).toBe(true);
  });

  it('变更通知：tick / moveCursor / confirm / 改设置都会通知，取消订阅后不再通知', () => {
    const bios = makeBios();
    let count = 0;
    const off = bios.addChangeListener(() => { count += 1; });
    bios.tick(100);
    expect(count).toBeGreaterThan(0);
    const afterPost = count;
    bios.tick(10000);
    expect(count).toBeGreaterThan(afterPost);
    const ready = count;
    bios.setCursor(2);
    bios.toggleQuickBoot();
    expect(count).toBeGreaterThan(ready);
    off();
    const before = count;
    bios.setCursor(0);
    expect(count).toBe(before);
  });
});
