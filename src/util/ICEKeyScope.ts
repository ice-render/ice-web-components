/**
 * 键盘作用域 ↔ 引擎事件总线的适配层。
 *
 * 模型（`ICEKeyScopeModel`）是纯逻辑的，真正「接上键盘」就是这一步：
 * 订阅引擎的 `keydown` → 交给作用域栈决定归属 → 被消费就 `preventDefault()`，
 * 没消费就原样放行（浏览器默认行为、输入框打字都不受影响）。
 *
 * 返回解绑函数：换模式 / 卸载页面时一定要能摘干净（不然旧页面的快捷键会一直活着）。
 */
import { ICEKeyScopeModel } from '../model/ICEKeyScopeModel';

export interface ICEKeyScopeBindingOptions {
  /** 事件名，默认 `keydown`（引擎的 DOMEventDispatcher 会派发它） */
  eventName?: string;
}

/**
 * 把键盘接进作用域模型。
 * @returns 解绑函数（幂等：重复调用没有副作用）
 */
export function bindICEKeyScope(
  ice: any,
  model: ICEKeyScopeModel,
  options: ICEKeyScopeBindingOptions = {},
): () => void {
  const bus = ice && ice.evtBus;
  if (!bus || typeof bus.on !== 'function') {
    return () => undefined; // 没有总线（裸对象/单测）时安静降级
  }
  const eventName = options.eventName || 'keydown';
  const listener = (event: any) => {
    const key = event && typeof event.key === 'string' ? event.key : '';
    if (!key) return;
    const result = model.dispatch(key, event);
    if (result.handled && event && typeof event.preventDefault === 'function') {
      event.preventDefault();
    }
  };
  bus.on(eventName, listener, null);
  let bound = true;
  return () => {
    if (!bound) return;
    bound = false;
    if (typeof bus.off === 'function') bus.off(eventName, listener, null);
  };
}

export default bindICEKeyScope;
