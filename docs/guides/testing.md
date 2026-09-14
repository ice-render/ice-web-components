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

覆盖范围（107 个 suite / 825 条）：

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

## 浏览器 QA（八套 / 284 项）

> 各套的断言数与合计**由脚本统计**：`npm run qa:counts`（写文档用 `npm run qa:counts:write`）。
> `npm run verify` 末尾会跑 `--check`，手写的数字对不上会直接失败 —— 数字只有这一个来源。

浏览器 QA 是「真开 Chromium 点一遍」的验收：慢，但能抓到单测抓不到的问题
（布局交叠、命中被挡、浮层外观、焦点环这种纯视觉行为）。

```bash
npm run build
PLAYWRIGHT_PATH=/path/to/playwright npm run qa:admin      # 或不设，脚本会尝试解析
PLAYWRIGHT_PATH=/path/to/playwright npm run qa:gallery
PLAYWRIGHT_PATH=/path/to/playwright npm run qa:workbench
PLAYWRIGHT_PATH=/path/to/playwright npm run qa:xp
PLAYWRIGHT_PATH=/path/to/playwright npm run qa:arcade
PLAYWRIGHT_PATH=/path/to/playwright npm run qa:pixel
PLAYWRIGHT_PATH=/path/to/playwright npm run qa:algo
PLAYWRIGHT_PATH=/path/to/playwright npm run qa:dos
```

| 脚本 | 页面 | 项数 | 覆盖 |
|---|---|---|---|
| `qa:admin` | `examples/admin.html` | 54 | 6 个页面顶层零交叠 / 首元素边距一致；逐页新组件（面包屑、浮动按钮+引导、回到顶部、库存分页、履约分栏拖动与锚点、图片预览、订单多选与批量发货、跨字段校验、通知渠道上限）；全部弹层开关 + Esc；**文本输入：原生替身挂载/中文 insertText/IME 组字/失焦收起**；**交互后几何：提示盒=文字实测宽度 / 提示与按钮不重叠且按钮左缘可点 / 清空选择换长文案后仍不重叠 / 搜索框左下角可聚焦**；零 console error |
| `qa:gallery` | `examples/gallery.html` | 49 | 顶层零交叠；面包屑折叠、统计倒计时、单选/多选组、分栏拖动、水印、排版折行、锚点、日历、引导、图片预览、Space/Grid、表格换页、跨字段校验、**焦点环策略（拖手柄无环 / Tab 有环 / 文本框点击有环）**、**虚拟列表（一万行只渲染可视区 / 滚轮换窗口 / scrollToIndex 跳末尾）**、**表格拖表头缩列（+60 后自动列重分 / 最小宽度夹取）**、**宽表（一万行 × 20 列：虚拟行 / 滚轮换窗口 / 横向同步 / 固定列冻结）**、**表格拖行排序（拖动中出现落点指示 / 松手顺序真的变 / 抛出 rowreorder）**、**无障碍镜像（语义元素数量 / 点镜像按钮激活画布组件 / DOM 焦点映射回组件）**、**i18n（切英文后内置文案跟着变、切回中文恢复）**、**树节点拖拽（拖拽态 / 落点 / 新顺序 / nodedrop 事件）**、**看板卡片跨列拖拽（落点跟手 / 数据真的搬过去 / cardmove 事件）** |
| `qa:workbench` | `examples/workbench.html` | 15 | 三栏零交叠、队列→档案联动、筛选（含骨架/空态）、回复发送、快捷回复模板、标签/评分/坐席状态、引导、回到顶部、分栏拖动 |
| `qa:xp` | `examples/windows-xp.html` | 40 | **开机画面 → 欢迎界面 → 点用户 → 密码页 → 真键盘输入 + 回车登录（开机音效确实触发）→ 注销回登录 → 关机 → 重新开机 → 点「登录」按钮二次登录**；桌面/任务栏零交叠；图标选中与双击开窗、拖动标题栏、最小化与任务栏恢复、开始菜单、托盘喇叭静音、扫雷（首点安全/插旗循环/难度/计时/胜利）、画图笔画、换壁纸、时钟、**IE 真抓网页 + 404 错误页 + 后退 + about:xp 表格 + 收藏夹**、**ICE Arcade 窗口（单节点自绘棋盘 / 键盘路由 / 暂停 / 切卡带 / 关窗收尾）** |
| `qa:arcade` | `examples/arcade.html` | 71 | **BIOS 开机**：自检界面先于卡带出现（5 项按时序推进、450ms 后通过项变多、HUD 换成 POST 文案）、按键跳过自检后快速启动交棒；俄罗斯方块卡带：真实按键驱动（← → 移动、↑ 旋转、↓ 软降、空格硬降、P 暂停且重力真的停、R 重开）、造题强制消行、一路硬降到 game over 并写入最高分；**换卡带到贪吃蛇**：棋盘/HUD 卡片换掉、真实方向键入队、喂食长身子、撞墙结束并记最高分、暂停时 tick 无效、R 重开；**2048**：4×4 单节点棋盘 + 标签层、← 合并同值块、合并脉冲亮起再淡出、推不动判负、合并出 2048 获胜、R 重开；**CHIP-8**：64×32 单节点显存 + 单节点机器键盘、自写 demo ROM 在跑（8×8 笑脸 26 个像素、撞边反弹不裂到对边、不残留）、真实键盘 `w` 按下/松开点亮机器键 5、`R` 归机器键盘（键 7）不触发外壳重开、P 暂停冻住指令流 + 提示底板与文字都出来、重开按钮复位、没有排行榜的卡带点「排行榜」只提示不报错；**BIOS 菜单**：F2 回菜单（卡带先卸掉、默认卡带打星、光标停在它上面）、↑ 循环到最后一项、菜单里选 CHIP-8 真的启动、设置页三行、快速启动开关与默认卡带落盘、Esc 回菜单、**刷新页面后设置还在**（快速启动关 → 自检完停菜单）；鼠标点 HUD 按钮与音效开关；四块卡带的棋盘都在屏幕框内、卡带行 5 格等缝不越界、面板不交叠 |
| `qa:pixel` | `examples/pixel-editor.html` | 24 | 开局（32×32 空画布 / 画板与色板各是单节点 / 5 工具 / 12 色）；**真实鼠标**：点一格上色、按住拖过 11 格只占一次撤销、撤销与重做（按钮 + Ctrl+Z / Ctrl+Y）、矩形框（描边 24 像素）、油漆桶（框内 25 格灌满、框外不动）、直线工具（拖动时 11 格高亮预览**且画布没变**，松手才落笔，预览收干净）、橡皮擦回纸色、点色板换色（高亮与落笔颜色都跟着走）、清空 + 可撤销、示例图案（26 像素笑脸）；**导出**：SVG 字符串（viewBox 512×512、同色横向合并后 20 个 rect）、PNG data URL（解 IHDR 得到 512×512）；换尺寸 16×16（棋盘与格子大小同步换、历史清空）；四块面板零交叠 |
| `qa:algo` | `examples/algorithm-sandbox.html` | 14 | 开局（排序模式 / 24 根柱子画在单节点网格上 / 轨迹已录好 / 统计面板）；回放（点播放帧前进、暂停真的停、→ 与 ← 单步、**点空白清焦点后**空格播放/暂停）；跑到底（最后一帧升序 + 已结束）；切算法（快速排序：轨迹重录、帧号归零、复杂度换成 O(n log n)）；寻路（切模式换网格、A* 与 BFS 同最短路但访问更少、**真实鼠标在确定空地**上拖动画墙、轨迹作废）；四块面板零交叠 |
| `qa:dos` | `examples/dos-terminal.html` | 17 | 开机（横幅 / 提示符 C:\>）；命令（DIR 输出含文件与目录、CD 后提示符跟着变、TYPE 走 `..\` 跨目录）；编辑（TAB 补全命令名与**当前目录**里的文件名、Backspace、↑ 历史、未知命令一行 error）；重定向（echo hello > note.txt 后 type 得回 hello）；副作用（Ctrl+L 清屏、exit 进退出态、任意键重新开机、「重新开机」按钮）；输出变长后**自动滚到底**；终端窗口与提示栏零交叠 |

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
  `qa:arcade` 挂的句柄叫 `window.__arcade`（`ice` / `game` / `model` / `buttons` / `nodes`）；
* `shotOverlay(name)`：把最上层浮层裁剪截图到 `/tmp/qa-<name>.png`。

> **输入文本可以直接打中文了**：聚焦文本框时组件会挂一个透明原生 `<input>`（见
> `ICENativeInput`），`page.keyboard.insertText('中文')` / `page.keyboard.type('中文')`
> 都能直接落字；要模拟输入法组字，就派发 `compositionstart` / `compositionupdate` /
> `compositionend`（`qa:admin` 里三条断言就是这两种打法）。只有在没有 `document` 的运行时
> （Node 单测）才退回单字符 `keydown` 路径。

### 断言什么（经验）

* **布局**：顶层子节点两两不相交（留 1px 容差）；跨页比较“首元素边距”是否一致；
* **交互**：一律走真实鼠标/键盘（命中检测、焦点、浮层关闭策略都要经过）；
* **观感**：能用数值表达的尽量数值化（颜色 token、焦点环可见性、分栏尺寸），
  剩下的靠截图；
* **零容忍**：`console.error` / `pageerror` 出现即失败 —— 这条抓到过不少“静默失效”。
* **带随机性的场景先固定随机源**：`qa:arcade` 的消行用例一开始直接 `reset()` 碰运气，
  可方块是 S/Z 时天生跨两行、单独补不满一行，于是偶发失败；改成
  `reset({ random: () => 0 })`（洗牌确定 → 首块必是 O）再用 `getGhost()` 算缺口，才可复现。
  同理，别把「软降一定落一行」写成 `+1`：重力可能在同一瞬间也走了一格，断言要写成 `>`。
* **等页面就绪用 `waitForFunction`**，别写死 `waitForTimeout(900)`：UMD 包冷启动解析耗时浮动，
  `qa:arcade` 等的是 `window.__arcade` 这个句柄出现。

## 示例页截图

`docs/images/` 里的图由一次性脚本生成（Playwright 打开示例页 → 逐页截图 → 必要时缩放宽度）。
要更新时照着 `scripts/qa-admin.mjs` 的导航/裁剪逻辑改一版即可；组件总览那张是
「整页截图 + 0.64 缩放」，商品/后台各页是逐页 1:1 截图。

<!-- qa-counts:start -->
<!-- 由 scripts/lib/qa-counts.mjs 生成，请勿手改：八套合计 284 项 -->
| 脚本 | 断言数 |
|---|---|
| `qa:admin` | 54 |
| `qa:algo` | 14 |
| `qa:arcade` | 71 |
| `qa:dos` | 17 |
| `qa:gallery` | 49 |
| `qa:pixel` | 24 |
| `qa:workbench` | 15 |
| `qa:xp` | 40 |
| **合计** | **284** |
<!-- qa-counts:end -->
