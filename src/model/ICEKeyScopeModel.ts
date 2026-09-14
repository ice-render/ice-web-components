/**
 * 键盘作用域（纯逻辑）：把「这个键归谁」变成声明式 + 可诊断。
 *
 * 为什么需要它：键盘冲突已经咬过两次 —— 掌机里「卡带要拿 R 当机器键」和「外壳用 R 重开」撞车；
 * 终端里 Tab 既是补全又被焦点管理器当成轮转焦点，回车还会落到按钮上。这都不是打字错误，
 * 而是**没人能回答「这个键归谁」**。
 *
 * 画布体系里这件事比 DOM 好办：组件树是我们自己的，键盘也从同一条总线出来 ——
 * 于是可以做成一个**作用域栈 + 声明式键位**的模型：
 * - 内层（后 push 的）优先；同层按 `priority` 降序，再按注册顺序**倒序**（后注册的先接）；
 * - `keys: ['*']` 表示这一层要吃掉所有键（终端、全屏菜单）；
 * - 单字符键大小写不敏感；功能键（`ArrowLeft` / `Enter` / `Escape`）原样比较；
 * - `detectConflicts()` 把「同一个键被多处声明」列出来 —— 冲突可见，而不是靠猜；
 * - handler 抛错不炸分发：记进 `lastError`，当作「没处理」继续往下找。
 *
 * 模型不认识 DOM、不碰 evtBus；把引擎的事件接进来的是 `bindICEKeyScope()`（见 util）。
 */

export interface ICEKeyBinding {
  /** 作用域名（诊断里用它回答「这个键被谁拿走了」） */
  scope: string;
  /** 占用的键；`'*'` = 所有键。单字符键不区分大小写。 */
  keys: string[];
  /** 处理函数：返回 true = 已消费（调用方据此 preventDefault），返回 false/不返回 = 放行给下一层 */
  handler: (key: string, event?: any) => boolean | void;
  /** 同层优先级，数字大的先接（默认 0） */
  priority?: number;
}

export interface ICEKeyDispatchResult {
  handled: boolean;
  /** 实际接下来这层作用域的名字；没接住是 null */
  scope: string | null;
}

export interface ICEKeyConflict {
  key: string;
  /** 声明了这个键的作用域（按栈序：内层在前） */
  scopes: string[];
}

export interface ICEKeyScopeDiagnostics {
  scopes: string[];
  bindings: number;
  conflicts: ICEKeyConflict[];
  lastError: string | null;
}

export type ICEKeyScopeListener = (model: ICEKeyScopeModel) => void;

const WILDCARD = '*';

export class ICEKeyScopeModel {
  /** 作用域栈：容量不再限制，末尾是栈顶（最内层） */
  private scopes: string[] = [];
  private disabled = new Set<string>();
  private bindings: ICEKeyBinding[] = [];
  private listeners: ICEKeyScopeListener[] = [];
  private lastError: string | null = null;

  // ------------------------------------------------------------------ 作用域栈
  public push(scope: string): this {
    const name = String(scope || '');
    if (!name) return this;
    const index = this.scopes.indexOf(name);
    if (index !== -1) this.scopes.splice(index, 1);
    this.scopes.push(name);
    this.notify();
    return this;
  }

  public pop(scope?: string): this {
    if (!this.scopes.length) return this;
    if (scope === undefined) this.scopes.pop();
    else {
      const index = this.scopes.lastIndexOf(String(scope));
      if (index === -1) return this;
      this.scopes.splice(index, 1);
    }
    this.notify();
    return this;
  }

  /** 栈顶在前（越靠前越内层）。 */
  public getActiveScopes(): string[] {
    return [...this.scopes].reverse();
  }

  public setEnabled(scope: string, enabled: boolean): this {
    const name = String(scope || '');
    if (!name) return this;
    if (enabled) this.disabled.delete(name);
    else this.disabled.add(name);
    this.notify();
    return this;
  }

  public isEnabled(scope: string): boolean {
    return !this.disabled.has(String(scope || ''));
  }

  // ------------------------------------------------------------------ 绑定
  public bind(binding: ICEKeyBinding): () => void {
    const entry: ICEKeyBinding = {
      scope: String(binding.scope || ''),
      keys: (binding.keys || []).map((key) => normalizeKey(key)),
      handler: binding.handler,
      priority: Number(binding.priority) || 0,
    };
    this.bindings.push(entry);
    this.notify();
    return () => {
      const index = this.bindings.indexOf(entry);
      if (index !== -1) this.bindings.splice(index, 1);
      this.notify();
    };
  }

  // ------------------------------------------------------------------ 分发
  /**
   * 按「内层 → 外层、同层 priority 降序、同 priority 后注册先接」的顺序找人消费。
   * 没接住返回 `{ handled: false }`，调用方据此决定要不要让浏览器走默认行为。
   */
  public dispatch(key: string, event?: any): ICEKeyDispatchResult {
    const normalized = normalizeKey(key);
    for (let depth = this.scopes.length - 1; depth >= 0; depth -= 1) {
      const scope = this.scopes[depth];
      if (this.disabled.has(scope)) continue;
      const candidates = this.bindings
        .map((binding, index) => ({ binding, index }))
        .filter((item) => item.binding.scope === scope && matches(item.binding.keys, normalized))
        .sort((a, b) => (b.binding.priority || 0) - (a.binding.priority || 0) || b.index - a.index);
      for (const item of candidates) {
        try {
          const handled = item.binding.handler(normalized, event);
          if (handled === true) return { handled: true, scope };
        } catch (error) {
          // 一个坏 handler 不该让整页键盘失灵：记下来，继续找外层
          this.lastError = (error as Error)?.message || String(error);
        }
      }
    }
    return { handled: false, scope: null };
  }

  // ------------------------------------------------------------------ 诊断
  /** 同一个键被多处声明 → 列出来（内层作用域排在前面）。 */
  public detectConflicts(): ICEKeyConflict[] {
    const byKey = new Map<string, string[]>();
    const order = this.getActiveScopes();
    const rank = (scope: string) => {
      const index = order.indexOf(scope);
      return index === -1 ? order.length + 1 : index;
    };
    this.bindings.forEach((binding) => {
      binding.keys.forEach((key) => {
        const list = byKey.get(key) || [];
        if (!list.includes(binding.scope)) list.push(binding.scope);
        byKey.set(key, list);
      });
    });
    const conflicts: ICEKeyConflict[] = [];
    byKey.forEach((scopes, key) => {
      if (key === WILDCARD) {
        // 通配符作用域把所有「具体键」都盖住了 —— 有它就一定有冲突
        byKey.forEach((otherScopes, otherKey) => {
          if (otherKey === WILDCARD) return;
          const merged = Array.from(new Set([...scopes, ...otherScopes]));
          if (merged.length > 1) conflicts.push({ key: WILDCARD, scopes: merged.sort((a, b) => rank(a) - rank(b)) });
        });
        return;
      }
      if (scopes.length > 1) conflicts.push({ key, scopes: [...scopes].sort((a, b) => rank(a) - rank(b)) });
    });
    return conflicts;
  }

  public getDiagnostics(): ICEKeyScopeDiagnostics {
    return {
      scopes: this.getActiveScopes(),
      bindings: this.bindings.length,
      conflicts: this.detectConflicts(),
      lastError: this.lastError,
    };
  }

  public addChangeListener(listener: ICEKeyScopeListener): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index !== -1) this.listeners.splice(index, 1);
    };
  }

  private notify(): void {
    [...this.listeners].forEach((listener) => listener(this));
  }
}

/** 单字符键统一小写；功能键（ArrowLeft / Enter / Escape…）原样。 */
function normalizeKey(key: string): string {
  const text = String(key === undefined || key === null ? '' : key);
  if (text === ' ' || text === 'Spacebar') return ' ';
  return text.length === 1 ? text.toLowerCase() : text;
}

/** 通配符命中一切；否则精确比较（都已归一化）。 */
function matches(keys: string[], key: string): boolean {
  return keys.some((bindingKey) => bindingKey === WILDCARD || bindingKey === key);
}

export default ICEKeyScopeModel;
