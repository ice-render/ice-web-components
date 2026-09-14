/**
 * 键盘作用域 ↔ 引擎事件总线的适配层规格。
 *
 * 模型是纯逻辑的，真正「接上键盘」这一步在 `bindICEKeyScope(ice, model)`：
 * 订阅引擎的 `keydown`，把键交给作用域栈决定归属；被消费就 `preventDefault()`，
 * 没消费就原样放行（浏览器默认行为、输入框打字都不受影响）。
 * 返回解绑函数 —— 页面卸载/换模式时一定要能摘干净。
 */
import { ICEKeyScopeModel } from '../src/model/ICEKeyScopeModel';
import { bindICEKeyScope } from '../src/util/ICEKeyScope';

/** 假 evtBus：只实现 on/off/trigger 三件套。 */
const makeBus = () => {
  const handlers: Array<{ name: string; handler: any; ctx: any }> = [];
  return {
    handlers,
    on(name: string, handler: any, ctx?: any) {
      handlers.push({ name, handler, ctx });
    },
    off(name: string, handler: any) {
      const index = handlers.findIndex((item) => item.name === name && item.handler === handler);
      if (index !== -1) handlers.splice(index, 1);
    },
    trigger(name: string, evt: any) {
      handlers.filter((item) => item.name === name).forEach((item) => item.handler.call(item.ctx, evt));
    },
  };
};

const makeEvent = (key: string) => {
  let prevented = false;
  return {
    key,
    preventDefault() {
      prevented = true;
    },
    get prevented() {
      return prevented;
    },
  };
};

describe('bindICEKeyScope', () => {
  it('被作用域消费的键会 preventDefault；没消费的放行', () => {
    const ice: any = { evtBus: makeBus() };
    const scope = new ICEKeyScopeModel();
    scope.push('page');
    scope.bind({ scope: 'page', keys: ['p'], handler: () => true });
    bindICEKeyScope(ice, scope);

    const hit = makeEvent('p');
    ice.evtBus.trigger('keydown', hit);
    expect(hit.prevented).toBe(true);

    const miss = makeEvent('q');
    ice.evtBus.trigger('keydown', miss);
    expect(miss.prevented).toBe(false);
  });

  it('按键原样传进 handler（大写与小写都能命中，handler 收到归一化后的键）', () => {
    const ice: any = { evtBus: makeBus() };
    const scope = new ICEKeyScopeModel();
    const seen: string[] = [];
    scope.push('page');
    scope.bind({ scope: 'page', keys: ['r'], handler: (key) => { seen.push(key); return true; } });
    bindICEKeyScope(ice, scope);
    ice.evtBus.trigger('keydown', makeEvent('R'));
    expect(seen).toEqual(['r']);
  });

  it('解绑之后不再拦键（也不残留总线监听）', () => {
    const ice: any = { evtBus: makeBus() };
    const scope = new ICEKeyScopeModel();
    scope.push('page');
    scope.bind({ scope: 'page', keys: ['x'], handler: () => true });
    const off = bindICEKeyScope(ice, scope);
    expect(ice.evtBus.handlers).toHaveLength(1);
    off();
    expect(ice.evtBus.handlers).toHaveLength(0);
    const event = makeEvent('x');
    ice.evtBus.trigger('keydown', event);
    expect(event.prevented).toBe(false);
  });

  it('没有 evtBus 的宿主（比如单测里的裸对象）不炸，返回一个空解绑函数', () => {
    expect(() => bindICEKeyScope({} as any, new ICEKeyScopeModel())).not.toThrow();
    const off = bindICEKeyScope({} as any, new ICEKeyScopeModel());
    expect(typeof off).toBe('function');
    off();
  });
});
