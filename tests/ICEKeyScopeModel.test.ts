/**
 * 键盘作用域（纯逻辑）规格。
 *
 * 为什么要它：键盘冲突已经咬过两次 ——
 * ① 掌机里「卡带要用 R 当机器键 7」和「外壳用 R 重开」撞车；
 * ② DOS 终端里 Tab 既是「补全」又被焦点管理器当成「轮转焦点」，回车还会落到按钮上。
 * 两次都不是打字错误，而是**没人能回答「这个键归谁」**。
 *
 * 画布体系里这件事比 DOM 更好办：组件树是我们自己的，键盘也从同一条总线出来 ——
 * 所以可以做成一个**作用域栈 + 声明式键位**的模型：
 * - 内层（后 push 的）优先，同层按 `priority` 降序、再按注册顺序倒序；
 * - `keys: ['*']` 表示「这个作用域要吃掉所有键」（终端、全屏菜单都这么用）；
 * - 单字符键大小写不敏感；功能键（`ArrowLeft` / `Enter` / `Escape`）原样比较；
 * - `detectConflicts()` 把「同一个键被多个作用域声明」直接列出来 —— 冲突可见，而不是靠猜；
 * - handler 抛错不能炸掉分发：记进诊断，当作「没处理」继续往下找。
 */
import { ICEKeyScopeModel } from '../src/model/ICEKeyScopeModel';

const makeModel = () => new ICEKeyScopeModel();

describe('作用域栈与优先级', () => {
  it('内层优先：后 push 的作用域先拿到键', () => {
    const scope = makeModel();
    const got: string[] = [];
    scope.push('shell');
    scope.push('game');
    scope.bind({ scope: 'shell', keys: ['r'], handler: () => { got.push('shell'); return true; } });
    scope.bind({ scope: 'game', keys: ['r'], handler: () => { got.push('game'); return true; } });
    const result = scope.dispatch('r');
    expect(result).toEqual({ handled: true, scope: 'game' });
    expect(got).toEqual(['game']);
  });

  it('同层按 priority 降序；priority 相同则后注册的先接', () => {
    const scope = makeModel();
    const order: string[] = [];
    scope.push('page');
    scope.bind({ scope: 'page', keys: ['x'], priority: 1, handler: () => { order.push('low'); return true; } });
    scope.bind({ scope: 'page', keys: ['x'], priority: 5, handler: () => { order.push('high'); return true; } });
    scope.bind({ scope: 'page', keys: ['x'], priority: 5, handler: () => { order.push('later'); return true; } });
    expect(scope.dispatch('x').handled).toBe(true);
    expect(order).toEqual(['later']);
  });

  it('没有 handler 接就返回未处理（浏览器默认行为留给调用方）', () => {
    const scope = makeModel();
    scope.push('shell');
    scope.bind({ scope: 'shell', keys: ['p'], handler: () => true });
    expect(scope.dispatch('k')).toEqual({ handled: false, scope: null });
  });

  it('handler 返回 false / 不返回值 = 没消费，继续找下一个', () => {
    const scope = makeModel();
    const order: string[] = [];
    scope.push('outer');
    scope.push('inner');
    scope.bind({ scope: 'outer', keys: [' '], handler: () => { order.push('outer'); return true; } });
    scope.bind({ scope: 'inner', keys: [' '], handler: () => { order.push('inner'); return false; } });
    const result = scope.dispatch(' ');
    expect(result.scope).toBe('outer');
    expect(order).toEqual(['inner', 'outer']); // inner 先跑但说「我不要」，outer 才接
  });
});

describe('键位匹配', () => {
  it('单字符键大小写不敏感；功能键原样比较', () => {
    const scope = makeModel();
    scope.push('page');
    const hits: string[] = [];
    scope.bind({ scope: 'page', keys: ['A', 'ArrowLeft'], handler: (key) => { hits.push(key); return true; } });
    expect(scope.dispatch('a').handled).toBe(true);
    expect(scope.dispatch('ArrowLeft').handled).toBe(true);
    expect(scope.dispatch('b').handled).toBe(false);
    expect(hits).toEqual(['a', 'ArrowLeft']);
  });

  it("keys: ['*'] 吃掉所有键（终端、全屏菜单）", () => {
    const scope = makeModel();
    scope.push('terminal');
    scope.bind({ scope: 'terminal', keys: ['*'], handler: () => true });
    expect(scope.dispatch('a').handled).toBe(true);
    expect(scope.dispatch('F5').handled).toBe(true);
  });

  it('禁用的作用域整层让路（退出态、播放暂停…）', () => {
    const scope = makeModel();
    scope.push('shell');
    scope.push('terminal');
    scope.bind({ scope: 'terminal', keys: ['*'], handler: () => true });
    scope.bind({ scope: 'shell', keys: ['p'], handler: () => true });
    expect(scope.dispatch('a').scope).toBe('terminal');
    scope.setEnabled('terminal', false);
    expect(scope.dispatch('a')).toEqual({ handled: false, scope: null });
    expect(scope.dispatch('p').scope).toBe('shell'); // 让路之后外层能接到
  });
});

describe('入栈 / 出栈 / 解绑', () => {
  it('pop 回到上一层；push 同名作用域 = 提到栈顶（不重复入栈）', () => {
    const scope = makeModel();
    const hits: string[] = [];
    scope.push('shell');
    scope.push('game');
    scope.push('shell');
    expect(scope.getActiveScopes()).toEqual(['shell', 'game']);
    scope.bind({ scope: 'shell', keys: ['q'], handler: () => { hits.push('shell'); return true; } });
    scope.bind({ scope: 'game', keys: ['q'], handler: () => { hits.push('game'); return true; } });
    expect(scope.dispatch('q').scope).toBe('shell');
    scope.pop('shell');
    expect(scope.dispatch('q').scope).toBe('game');
    expect(hits).toEqual(['shell', 'game']);
  });

  it('bind 返回解绑函数：解绑之后这一层不再接键', () => {
    const scope = makeModel();
    scope.push('page');
    const off = scope.bind({ scope: 'page', keys: ['z'], handler: () => true });
    expect(scope.dispatch('z').handled).toBe(true);
    off();
    expect(scope.dispatch('z').handled).toBe(false);
  });
});

describe('诊断', () => {
  it('detectConflicts：同一个键被多个作用域（或同层多处）声明就列出来', () => {
    const scope = makeModel();
    scope.push('shell');
    scope.push('cartridge');
    scope.bind({ scope: 'shell', keys: ['r', 'p'], handler: () => true });
    scope.bind({ scope: 'cartridge', keys: ['r'], handler: () => true });
    scope.bind({ scope: 'cartridge', keys: ['p'], handler: () => true });
    const conflicts = scope.detectConflicts();
    expect(conflicts.map((item) => item.key).sort()).toEqual(['p', 'r']);
    // 内层在前：这个键会先给 cartridge，再接 shell
    expect(conflicts.find((item) => item.key === 'r')!.scopes).toEqual(['cartridge', 'shell']);
  });

  it('通配符作用域会把所有具体键都标成冲突（提醒别再往下传）', () => {
    const scope = makeModel();
    scope.push('shell');
    scope.push('terminal');
    scope.bind({ scope: 'shell', keys: ['p'], handler: () => true });
    scope.bind({ scope: 'terminal', keys: ['*'], handler: () => true });
    const conflicts = scope.detectConflicts();
    expect(conflicts.some((item) => item.key === '*' && item.scopes.includes('shell'))).toBe(true);
  });

  it('handler 抛错不炸分发：记进诊断，当作没处理继续找外层', () => {
    const scope = makeModel();
    scope.push('shell');
    scope.push('broken');
    scope.bind({ scope: 'broken', keys: ['k'], handler: () => { throw new Error('boom'); } });
    scope.bind({ scope: 'shell', keys: ['k'], handler: () => true });
    const result = scope.dispatch('k');
    expect(result).toEqual({ handled: true, scope: 'shell' });
    expect(scope.getDiagnostics().lastError).toContain('boom');
  });

  it('变更通知：push / pop / bind / 解绑都会通知，取消订阅后不再通知', () => {
    const scope = makeModel();
    let count = 0;
    const off = scope.addChangeListener(() => { count += 1; });
    scope.push('a');
    scope.bind({ scope: 'a', keys: ['x'], handler: () => true });
    expect(count).toBe(2);
    scope.pop('a');
    expect(count).toBe(3);
    off();
    scope.push('b');
    expect(count).toBe(3);
  });
});
