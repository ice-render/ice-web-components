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

覆盖范围（80 个 suite / 520+ 条）：

| 主题 | 例子 |
|---|---|
| 表单与校验 | 规则求值、异步校验短路、`submitAsync` 时序、错误态 |
| 浮层与定位 | `resolveICEOverlayPosition` 的翻转/夹取、关闭原因、动画帧推进 |
| 交互细节 | 表格排序/行悬停/行内按钮不触发行选中、菜单子项选中、树悬停、折叠箭头 |
| 键盘 | Tab 轮转、Enter 激活、Esc 关闭、方向键调值、下拉 ↑↓ |
| 数据组件 | 选择器过滤、级联路径、时间/日期取值、穿梭框搬运、上传校验 |
| 图表/展示 | 统计格式化与倒计时、日历网格、水印平铺、排版折行省略 |
| 布局与骨架 | `ICESpace` / `ICEGrid` 24 栅格、`ICESplitter` 夹取与拖动、容器不参与命中 |
| 焦点细节 | 焦点环 `:focus-visible` 策略（鼠标不画 / 键盘画 / 文本类 always） |
| 命名约定 | 导出与引擎零重名、类级导出必须 ICE 前缀、`id` 转发（`tests/exports.unique.test.ts`、`tests/ICEIdentity.test.ts`） |

### 写新组件的测试

1. 先写 `tests/ICEXxx.test.ts`，按“规格”列 bullet（这个仓库的习惯）；
2. 用上面的假 ICE 模板，覆盖：默认态、值变化、回调、禁用、表单取值、错误态；
3. 有全局事件的（`mousedown`/`keydown`/`wheel`）一定要测**组件被移出场景后不崩**（守卫）；
4. 有浮层的，断言「打开 / 关闭 / 关闭原因」。

## 浏览器 QA（五套）

浏览器 QA 是「真开 Chromium 点一遍」的验收：慢，但能抓到单测抓不到的问题
（布局交叠、命中被挡、浮层外观、焦点环这种纯视觉行为）。

```bash
npm run build
PLAYWRIGHT_PATH=/path/to/playwright npm run qa:admin      # 或不设，脚本会尝试解析
PLAYWRIGHT_PATH=/path/to/playwright npm run qa:gallery
PLAYWRIGHT_PATH=/path/to/playwright npm run qa:workbench
PLAYWRIGHT_PATH=/path/to/playwright npm run qa:xp
PLAYWRIGHT_PATH=/path/to/playwright npm run qa:tetris
```

| 脚本 | 页面 | 项数 | 覆盖 |
|---|---|---|---|
| `qa:admin` | `examples/admin.html` | 44 | 6 个页面顶层零交叠 / 首元素边距一致；逐页新组件（面包屑、浮动按钮+引导、回到顶部、库存分页、履约分栏拖动与锚点、图片预览、订单多选与批量发货、跨字段校验、通知渠道上限）；全部弹层开关 + Esc；零 console error |
| `qa:gallery` | `examples/gallery.html` | 32 | 顶层零交叠；面包屑折叠、统计倒计时、单选/多选组、分栏拖动、水印、排版折行、锚点、日历、引导、图片预览、Space/Grid、表格换页、跨字段校验、**焦点环策略（拖手柄无环 / Tab 有环 / 文本框点击有环）** |
| `qa:workbench` | `examples/workbench.html` | 15 | 三栏零交叠、队列→档案联动、筛选（含骨架/空态）、回复发送、快捷回复模板、标签/评分/坐席状态、引导、回到顶部、分栏拖动 |
| `qa:xp` | `examples/windows-xp.html` | 35 | **开机画面 → 欢迎界面 → 点用户 → 密码页 → 真键盘输入 + 回车登录（开机音效确实触发）→ 注销回登录 → 关机 → 重新开机 → 点「登录」按钮二次登录**；桌面/任务栏零交叠；图标选中与双击开窗、拖动标题栏、最小化与任务栏恢复、开始菜单、托盘喇叭静音、扫雷（首点安全/插旗循环/难度/计时/胜利）、画图笔画、换壁纸、时钟、**IE 真抓网页 + 404 错误页 + 后退 + about:xp 表格 + 收藏夹** |
| `qa:tetris` | `examples/tetris.html` | 23 | 开局/零 error；真实按键驱动（← → 移动、↑ 旋转、↓ 软降、空格硬降、P 暂停且重力真的停、R 重开）；造题强制消行（分数/闪屏/HUD 同步）；一路硬降到 game over 并写入最高分；鼠标点 HUD 按钮与音效开关；棋盘在屏幕框内、面板不交叠 |

> `qa:xp` 会**自己起一个静态服务器用 http 打开页面**（而不是 `file://`）：XP 里的「IE」是真的会
> `fetch()` 的，而 `fetch` 在 `file://` 下不可用 —— 要演示真导航就必须走 http。用例还会故意访问
> 一个不存在的地址来验证错误页，那段时间里的 404 资源错误被加进 console 白名单。

失败时退出码非 0，并且会把现场截图落到 `/tmp/qa-*.png`（弹层是逐个截图），外观问题靠人眼看这批图。

### 写新用例时的三个工具

`qa-admin.mjs` / `qa-gallery.mjs` 里有几个现成帮手，新页面直接抄：

* `scrollIntoView(source)`：把节点滚进 `ICEScrollPane` 的内容视口 —— **页面里远离首屏的元素，
  必须先滚进视野再点**，否则 Playwright 的鼠标坐标落在窗口外（这是最常踩的一条）；
* `clickExpr('window.__result.xxx')` / `dragExpr(...)`：按表达式取节点 → 量世界坐标 → 真鼠标
  点击/拖动。示例页把关键句柄挂在 `window.__result`（页面再暴露 `state.xxx`）就是给它们用的；
  `qa:tetris` 挂的句柄叫 `window.__arcade`（`ice` / `model` / `buttons` / `nodes`）；
* `shotOverlay(name)`：把最上层浮层裁剪截图到 `/tmp/qa-<name>.png`。

> **输入文本请用 ASCII**：canvas 文本框目前只处理单字符 `keydown`，IME 组字（中文输入）
> 尚未接入，`page.keyboard.type('中文')` 不会产生按键事件。中文场景请用
> `control.setValue('中文')` 驱动，或用例里改成英文。

### 断言什么（经验）

* **布局**：顶层子节点两两不相交（留 1px 容差）；跨页比较“首元素边距”是否一致；
* **交互**：一律走真实鼠标/键盘（命中检测、焦点、浮层关闭策略都要经过）；
* **观感**：能用数值表达的尽量数值化（颜色 token、焦点环可见性、分栏尺寸），
  剩下的靠截图；
* **零容忍**：`console.error` / `pageerror` 出现即失败 —— 这条抓到过不少“静默失效”。
* **带随机性的场景先固定随机源**：`qa:tetris` 的消行用例一开始直接 `reset()` 碰运气，
  可方块是 S/Z 时天生跨两行、单独补不满一行，于是偶发失败；改成
  `reset({ random: () => 0 })`（洗牌确定 → 首块必是 O）再用 `getGhost()` 算缺口，才可复现。
  同理，别把「软降一定落一行」写成 `+1`：重力可能在同一瞬间也走了一格，断言要写成 `>`。
* **等页面就绪用 `waitForFunction`**，别写死 `waitForTimeout(900)`：UMD 包冷启动解析耗时浮动，
  `qa:tetris` 等的是 `window.__arcade` 这个句柄出现。

## 示例页截图

`docs/images/` 里的图由一次性脚本生成（Playwright 打开示例页 → 逐页截图 → 必要时缩放宽度）。
要更新时照着 `scripts/qa-admin.mjs` 的导航/裁剪逻辑改一版即可；组件总览那张是
「整页截图 + 0.64 缩放」，商品/后台各页是逐页 1:1 截图。
