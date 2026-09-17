# 应用层：一个页面怎么写

> 这份指南讲**在 `ICEContainer` 之上写应用页面**的约定，全家族一致。
> 组件库本身不提供页面 / 路由 / 激活概念（见 [画布内布局](./layout.md) 第六节）—— 下面这些是
> **应用层**的自律条款，不是库的能力；库只是把它们收成了唯一入口。
>
> 为什么值得写下来：这一层以前靠口口相传，12 个页面能写出 12 种结构。2026-09-17 家族把应用层
> 统一到「一页 = 一个类」并加了棘轮（各仓 `tests/**/*onvention*.test.ts`），这份是那份契约的正文。

## 一、一条主链：宿主怎么驱动页面

```
宿主                                          页面（ICEContainer 子类）
────────────────────────────────────────────────────────────────────────
shell.show(key)  → 切 display             →   onShow()   ← 只做"我显示了"这类自己的事
                 → onPageShow(key)        →   （宿主在这里重算业务数据，domain 纯函数）
shell.refresh()  → page.onUpdate()        ←   ★ 页面在这里把新数据写上画面
                 → page.statusTags()      ←   声明式，宿主取一次
                 → ice.dirty = true       ←   引擎只负责重绘
```

四条条款（每一条都是实测换来的）：

1. **不要在 `onShow()` 里读数据自更新** —— 那一刻 `display` 刚翻过来，业务数据还是上一轮的
   （`onPageShow` 跑在 `show()` 的**末尾**）。要在"显示时"做事，用宿主给的 `onPageShow`。
2. **`onUpdate()` 的调用时机由宿主决定**：宿主在"数据已经换成新的"之后调它。页面**不判断**
   "什么算数据变了"，也不自己在 `setInterval` / 事件回调里调 `onUpdate()`。
3. **交互引起的局部变化由页面自己处理**（表格排序、选中、展开、翻页），不推给宿主；
   宿主只负责"数据换新"这一类。
4. **页面不回调宿主**：要宿主做事就**声明**（`statusTags()` / `headerActions()` / `islandSpecs()`），
   宿主在切页与刷新时各取一次。页面因此能脱离宿主单测，页面之间也能互相读。

## 二、页面自己要守的六条

| 条款 | 要求 | 谁在管 |
|---|---|---|
| 一页一类 | 一个页面文件一个类、**文件名 = 类名**（大驼峰） | 各仓写法棘轮 |
| 构造期建树 | 构造结束即树建好；**树只建一次**，不随数据重建 | 棘轮（无模块级 `function` / `let`）+ 评审 |
| 更新入口唯一 | `onUpdate()` 是**唯一**改值入口，取代各页自带的 `refresh()` 闭包 | 棘轮（老的 `buildXxxPage` / `refresh()` 一律红） |
| 稳定结构不进 `onUpdate` | 卡片 / 表格 / 字段这类稳定结构在构造期建；`onUpdate` 只改名值、换数据 | 评审（见 §六 第 1 条） |
| 重建前先清空 | 数量不定的内容（审计列表 0~N 条）允许整段重建，但**必须先 `removeChildren`** | 库里踩过：不清会新旧文字叠在一起 |
| 成员顺序 | `static 常量/字段 → static 方法 → 实例字段 → 构造函数 → 访问器 / 实例方法`（正则 `S*T*F*C*(A|M)*`） | 各仓写法棘轮 |

**示例页（纯用户驱动）是这条规则的例外**：没有宿主推数据，刷新入口就是用户动作本身，所以
**不加** `onUpdate()`（家族里两类的分界是"谁的数据变了"，见 `ice-entity-designer/AGENTS.md`
的示例页写法）。

## 三、状态放哪：domain 与页面的分工

- **业务算法一律在 `src/domain/`（纯函数）**，页面只负责显示。算法写在页面里 = 同一口径两处
  实现，改一处漂一处。（`ice-smart-water` 就是这么划的，守恒关系有单测钉住。）
- **页面的可变状态只放"页面的"东西**：当前选中、当前筛选、分页游标、临时输入。
  数据本身来自宿主注入（构造参数）或宿主推。
- **不许有模块级可变状态**（文件顶层 `let`）：一页开两个实例就串数据 —— 棘轮已经管住这条。

## 四、该用哪一层（入口决策表）

| 你要做的东西 | 用哪一层 | 从哪抄 |
|---|---|---|
| 叶子控件（按钮 / 输入 / 表格 / 弹窗 / 日期…） | `ice-web-components`（`ICEWidget` 子类） | [写一个自己的组件](./custom-components.md)、`examples/custom-component.html` |
| 整页结构（顶栏 / 侧栏 / 卡片 / 多个控件） | `ICEContainer` 子类 —— **本指南** | `ice-smart-water/src/view/pages/*.ts`（12 页） |
| 画布上的自由图形（流程图 / ER / 工艺图 / 甘特 / 状态机） | `ice-entity-designer`（设计器 + 域包） | `ice-entity-designer/examples/*.html`（11 页） |
| 数据可视化（折线 / 柱 / 饼 / 桑基 / 箱线…） | `ice-chart`（需要 agent 生成时加 `ice-chart-dsl`） | `ice-chart/examples/*.html`（30 页） |
| 一个小游戏页面 | `ice-game` 的 `GamePage` | `ice-game/src/games/breakout/main.ts` |
| **让 agent 直接生成界面** | 对应 DSL（JSON 文档 + 结构化诊断，校验器永不抛） | 各 DSL 仓的 `skills/*/SKILL.md` |
| `new ICE().init()` + `addChild` 直接用引擎原语 | **只有写库 / 写组件时**才用；应用页面不要 | 引擎仓文档 |

一句话判据：**能声明就别命令** —— 能用组件的别用原语，能让 agent 出 JSON 的别让它写代码。

## 五、改完怎么验收

```bash
npm run types:check
npm test                 # 含写法棘轮：一页一类 / 成员顺序 / 示例页写法
npx playwright test      # 真机 e2e：canvas 页面要断言"有落墨"，不是"元素存在"
```

- 家族写法棘轮（新页面自动进闸门）：`ice-smart-water/tests/view/pageConvention.test.ts`、
  `ice-entity-designer/tests/examplesConvention.test.ts`、`ice-game/tests/games/convention.test.ts`、
  `ice-agent-console/tests/pageConvention.test.ts`、四个 DSL 仓的 `tests/examplesConvention.test.ts`、
  `ice-web-components/tests/layoutConvention.test.ts`。
- e2e 全程 **console / pageerror 必须为 0** —— 漏了这条最容易"看着没问题"。
- 画布类断言用**落墨量 / 着墨包围盒**，不用"有没有 canvas 元素"。

## 六、常见坑（每一条都踩过）

1. **`onShow()` 里自更新** → 拿到的是上一轮数据（顺序见 §一）。要么宿主在 `onPageShow` 里推，
   要么页面等 `onUpdate()`。
2. **整段重建没先 `removeChildren`** → 新旧文字叠在一起（不是"看起来脏"，是真的叠）。
3. **页面回调宿主 / 拿宿主闭包** → 页面之间无法互读、没法单独测；改成声明式访问器
   （`statusTags()` / `headerActions()` / `islandSpecs()`）。
4. **业务算法写在页面里** → 同一口径两处实现；算法进 `src/domain/`。
5. **模块级状态** → 一页两个实例串数据（棘轮已拦）。
