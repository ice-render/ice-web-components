# 测试

两层：**单元测试**跑在 node 里（快、无浏览器），**浏览器 QA** 跑真实页面（慢、但能查外观与交互）。

## 单元测试（`npm test`）

`jest` + node 环境（没有 jsdom）。所以组件测试的套路是：**假 ICE + 真组件**。

```ts
const handlers: Record<string, Array<{ handler: any; ctx: any }>> = {};
const ice: any = {
  canvasWidth: 800, canvasHeight: 600, toolNodes: [], dirty: false,
  evtBus: {
    on(name, handler, ctx) { (handlers[name] = handlers[name] || []).push({ handler, ctx }); },
    off(name, handler) { handlers[name] = (handlers[name] || []).filter((e) => e.handler !== handler); },
    trigger(name, evt) { (handlers[name] || []).forEach((e) => e.handler.call(e.ctx, evt)); },
  },
  addTool(tool) { ice.toolNodes.push(tool); },
  removeTool(tool) { /* … */ },
  setFocusedComponent() {}, getFocusedComponent: () => null,
  screenToWorld: (x, y) => [x, y],
  getRenderViewport: () => ({ scale: 1, tx: 0, ty: 0 }),
};

const picker = new ICEDatePicker({ /* … */ });
(picker as any).ice = ice;            // 直接挂上假 ICE
(picker as any).afterAddHandler();    // 手动触发“加入场景”钩子，注册全局事件
```

覆盖范围（50 个 suite / 350+ 条）：

| 主题 | 例子 |
|---|---|
| 表单与校验 | 规则求值、异步校验短路、`submitAsync` 时序、错误态 |
| 浮层与定位 | `resolveICEOverlayPosition` 的翻转/夹取、关闭原因、动画帧推进 |
| 交互细节 | 表格排序/行悬停/行内按钮不触发行选中、菜单子项选中、树悬停、折叠箭头 |
| 键盘 | Tab 轮转、Enter 激活、Esc 关闭、方向键调值、下拉 ↑↓ |
| 数据组件 | 选择器过滤、级联路径、时间/日期取值、穿梭框搬运、上传校验 |
| 命名约定 | 导出与引擎零重名、类级导出必须 ICE 前缀、`id` 转发（`tests/exports.unique.test.ts`、`tests/ICEIdentity.test.ts`） |

### 写新组件的测试

1. 先写 `tests/ICEXxx.test.ts`，按“规格”列 bullet（这个仓库的习惯）；
2. 用上面的假 ICE 模板，覆盖：默认态、值变化、回调、禁用、表单取值、错误态；
3. 有全局事件的（`mousedown`/`keydown`/`wheel`）一定要测**组件被移出场景后不崩**（守卫）；
4. 有浮层的，断言「打开 / 关闭 / 关闭原因」。

## 浏览器 QA（`npm run qa:admin`）

```bash
npm run build
PLAYWRIGHT_PATH=/path/to/playwright npm run qa:admin    # 或不设，脚本会尝试解析
```

它会打开 `examples/admin.html` 并逐项断言（22 项，失败退出码非 0）：

* 五个页面「顶层元素两两相交」为 0，且首元素左上边距完全一致；
* 逐个弹出层：详情抽屉、删除确认弹窗、新建订单弹窗、通知/头像下拉、Tooltip、级联、日期、
  自动完成、二次确认气泡 —— 都能打开、都能 Esc 关闭；
* 点表格行内「详情」按钮**不会**触发行选中；
* 自动完成候选超过一屏时有滚动视口；
* 设置页三个 Tab 面板都能切换且有正常高度；
* 全程零 `console.error` / `pageerror`。

每个弹层会截图到 `/tmp/qa-*.png`，外观问题靠人眼看这批图。

## 示例页截图

`docs/images/` 里的图由一次性脚本生成（Playwright 打开示例页 → 逐页截图 → `sips` 压缩宽度）。
要更新时照着 `scripts/qa-admin.mjs` 的导航/裁剪逻辑改一版即可。
