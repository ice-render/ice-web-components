# 模型

纯逻辑、不碰 canvas：状态与校验规则集中在这里，组件只负责「画出来」。

## `ICEButtonModel`

源码：[`src/model/ICEButtonModel.ts`](../../src/model/ICEButtonModel.ts)

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `isEnabled()` | `boolean` |  |
| `setEnabled(enabled: boolean)` | `this` |  |
| `isPressed()` | `boolean` |  |
| `setPressed(pressed: boolean)` | `this` |  |
| `addChangeListener(listener: ICEButtonModelListener)` | `this` |  |
| `removeChangeListener(listener: ICEButtonModelListener)` | `this` |  |

## `ICEToggleModel`

源码：[`src/model/ICEToggleModel.ts`](../../src/model/ICEToggleModel.ts)

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `isSelected()` | `boolean` |  |
| `setSelected(selected: boolean)` | `this` |  |
| `toggle()` | `this` |  |
| `addChangeListener(listener: ICEToggleModelListener)` | `this` |  |
| `removeChangeListener(listener: ICEToggleModelListener)` | `this` |  |

## `ICEBoundedRangeModel`

源码：[`src/model/ICEBoundedRangeModel.ts`](../../src/model/ICEBoundedRangeModel.ts)

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `getValue()` | `number` |  |
| `getMinimum()` | `number` |  |
| `getMaximum()` | `number` |  |
| `setValue(value: number)` | `this` |  |
| `addChangeListener(listener: ICEBoundedRangeModelListener)` | `this` |  |
| `removeChangeListener(listener: ICEBoundedRangeModelListener)` | `this` |  |

## `ICESelectionModel`

选择模型：列表 / 树 / 穿梭框共用的选择状态。  与其它模型（ICEButtonModel / ICEToggleModel / ICEBoundedRangeModel）同风格： 纯状态 + 监听器，UI 组件只负责把状态画出来。

源码：[`src/model/ICESelectionModel.ts`](../../src/model/ICESelectionModel.ts)

**构造参数** `ICESelectionModelOptions`

| 参数 | 类型 | 说明 |
|---|---|---|
| `mode?` | `ICESelectionMode` |  |
| `selected?` | `string[]` |  |

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `getMode()` | `ICESelectionMode` |  |
| `setMode(mode: ICESelectionMode)` | `this` |  |
| `getSelectedKeys()` | `string[]` |  |
| `isSelected(key: string)` | `boolean` |  |
| `select(key: string)` | `this` | 选中（single 替换；multiple 追加，已选中则不变）。 |
| `toggle(key: string)` | `this` | 切换选中状态（点一下选中、再点取消）。 |
| `setSelected(keys: string[])` | `this` |  |
| `clear()` | `this` |  |
| `addChangeListener(listener: ICESelectionListener)` | `() => void` |  |

## `ICEFormModel`

表单校验模型：字段值 + 规则 + 错误 + 变更通知。  纯逻辑、不碰 canvas —— UI 层（ICEFormItem / ICEForm）只负责把值与错误**画出来**。 规则语义：一条规则失败即停止（取第一条错误信息）。

源码：[`src/model/ICEFormModel.ts`](../../src/model/ICEFormModel.ts)

**构造参数** `ICEFormModelOptions`

| 参数 | 类型 | 说明 |
|---|---|---|
| `validateTrigger?` | `'change' \| 'none'` | 改值时是否自动重算该字段（默认 change；'none' 表示只在手动校验时算） |
| `locale?` | `string` | 内置校验文案的语言（未传则跟随当前语言）；字段规则里的 `message` 仍可逐条覆盖 |

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `addField(options: ICEFormFieldOptions)` | `this` |  |
| `removeField(name: string)` | `this` |  |
| `getField(name: string)` | `ICEFormField \| undefined` |  |
| `getFieldNames()` | `string[]` |  |
| `getDependents(name: string)` | `string[]` | 直接依赖 `name` 的字段（反向查询）。 |
| `getLabel(name: string)` | `string` |  |
| `getValue(name: string)` | `any` |  |
| `getValues()` | `Record<string, any>` |  |
| `setValue(name: string, value: any, options: { silent?: boolean })` | `this` | 设置字段值。默认按 `validateTrigger` 决定是否立刻重算该字段（默认重算）， |
| `setValues(values: Record<string, any>, options: { silent?: boolean })` | `this` |  |
| `getError(name: string)` | `string \| null \| undefined` |  |
| `getErrors()` | `Record<string, string>` | 只返回有错误的字段（无错误时为空对象） |
| `hasErrors()` | `boolean` |  |
| `validateField(name: string, options: { silent?: boolean })` | `string \| null` | 校验单个字段并写回错误；返回错误文案（null 表示通过）。 |
| `validate()` | `boolean` | 校验全部字段并返回是否全部通过。 |
| `isValidating(name: string)` | `boolean` | 该字段是否正在异步校验中（UI 可显示「校验中…」）。 |
| `validateFieldAsync(name: string)` | `Promise<string \| null>` | 单字段异步校验：先跑同步规则（失败即短路、不发请求），再依次跑异步校验器。 |
| `validateAsync()` | `Promise<boolean>` | 校验全部字段（同步 + 异步），返回是否全部通过。 |
| `reset()` | `this` | 回到初始值并清空错误。 |
| `addChangeListener(listener: ICEFormModelListener)` | `() => void` |  |

## `ICEBiosModel`

掌机 BIOS 的纯逻辑（不碰 canvas、不碰 DOM）。  掌机开机先跑一段「自检 → 菜单」的引导，然后才把控制权交给卡带： 自检**按时序推进**（页面每帧调 `tick(dt)`），菜单是**光标 + 确认**的老式控制台交互。 页面只负责把 `getSteps()` / `getMenuEntries()` 画成文字，并执行 `confirm()` 返回的动作 —— 状态机与渲染分开，所以「自检要跑多久、菜单怎么绕、设置存到哪」都能在 node 里单测。  约定：

- 自检项由 `steps` 注入（默认 5 项：CPU / RAM / VRAM / SOUND / CART），每项有自己的耗时；
- 相位机：`post`（自检中）→ `menu`（启动菜单）或 `boot`（直接启动，快速启动开着时）； `settings`（设置页）从菜单进、`back()` 回菜单；
- 菜单光标上下**循环**（到头绕回去，老式 BIOS 都这样），进设置前记下位置、回来还停在那儿；
- 设置（快速启动 / 默认卡带）落到注入的存储里；坏数据、写盘失败一律降级，绝不抛。

源码：[`src/model/ICEBiosModel.ts`](../../src/model/ICEBiosModel.ts)

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `getPhase()` | `ICEBiosPhase` |  |
| `getCartridges()` | `ICEBiosCartridge[]` |  |
| `getPostElapsed()` | `number` |  |
| `getPostDuration()` | `number` | 自检总时长（毫秒）。 |
| `getPostProgress()` | `number` | 自检进度 0..1（按时间算，页面拿它画进度条）。 |
| `getSteps()` | `ICEBiosStepState[]` | 自检项与它们此刻的状态（当前项 running、前面的 ok）。 |
| `getMenuEntries()` | `ICEBiosMenuEntry[]` | 菜单项：卡带列表 + 设置 + 退出并启动。 |
| `getCursor()` | `number` |  |
| `getSelectedEntry()` | `ICEBiosMenuEntry \| null` |  |
| `getSettings()` | `ICEBiosSettings` |  |
| `isQuickBoot()` | `boolean` |  |
| `getDefaultCartridge()` | `string` |  |
| `tick(delta: number)` | `boolean` | 推进自检（页面每帧调用），返回是否发生了变化。 |
| `moveCursor(delta: number)` | `void` |  |
| `setCursor(index: number)` | `void` |  |
| `confirm()` | `ICEBiosAction` | 确认当前项：只返回动作，执行动作是页面的事（好测）。 |
| `back()` | `void` | 返回上一层（设置 → 菜单）。 |
| `openMenu()` | `void` | 从游戏里回到 BIOS 菜单（掌机的「复位」）。 |
| `restart()` | `void` | 重新跑一遍自检（再开一次机）。 |
| `toggleQuickBoot()` | `boolean` |  |
| `setDefaultCartridge(key: string)` | `void` |  |
| `addChangeListener(listener: ICEBiosListener)` | `() => void` |  |

### `ICE_BIOS_DEFAULT_STEPS` — 常量

默认自检项：每一项都是一句「老式 BIOS 会印在屏幕上的话」。

源码：`src/model/ICEBiosModel.ts`

## `ICEHistoryModel`

撤销 / 重做栈（纯逻辑，泛型）。  不是给某个画板专用的：任何「编辑 → 提交 → 后悔」的界面都能用（像素画板、看板、 表格编辑、表单草稿…），所以它只认泛型快照，不认识 canvas、颜色和数据结构。  约定：

- `push(state)` 入栈并**清空 redo 栈** —— 从历史中间改一下，原来那条「未来」就作废了；
- `undo()` / `redo()` 返回目标快照，到边界返回 `null`（调用方据此把按钮置灰）；
- 超过 `limit` 丢**最旧**的一条（默认 50：够用，且内存不会无限涨）；
- 变更通知带 `reason`（push / undo / redo / clear），页面按需刷新按钮态；
- 快照的存取由调用方负责 `slice()` / 深拷贝 —— 栈只存引用，不做深拷贝（性能）。

源码：[`src/model/ICEHistoryModel.ts`](../../src/model/ICEHistoryModel.ts)

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `getLimit()` | `number` |  |
| `getCurrent()` | `T \| null` |  |
| `canUndo()` | `boolean` |  |
| `canRedo()` | `boolean` |  |
| `getDepth()` | `{ undo: number; redo: number }` | 栈深：undo = 还能撤销几步，redo = 还能重做几步。 |
| `push(state: T)` | `void` |  |
| `undo()` | `T \| null` |  |
| `redo()` | `T \| null` |  |
| `clear(initial?: T)` | `void` |  |
| `addChangeListener(listener: ICEHistoryListener<T>)` | `() => void` |  |

## `ICETracePlayerModel`

「轨迹播放器」：把一串预先算好的帧按时间回放（纯逻辑，不碰 canvas）。  算法可视化（排序、寻路、正则匹配、Diff…）都是同一个套路：**先把整段过程算成一串帧， 再按时间回放**。播放 / 暂停 / 单步 / 调速 / 进度 / 到头停住这套逻辑跟具体算法无关， 所以单独抽出来 —— 算法只负责产帧（`ICESortModel` / `ICEMazeModel`），播放器只管「第几帧、要不要走」。  约定：

- `load(frames)` 从头开始（游标 0、暂停）；帧是只读的，播放器不复制、不改写；
- `tick(dt)` 只在播放态推进，按 `stepsPerSecond` 换算（一帧 = 1000 / speed 毫秒）： 攒够几帧就走几帧（页面每帧调一次，所以正常就是每帧一帧；卡顿后不会「欠着时间」）；
- 走到最后一帧自动停（`isFinished()`），此时再 `play()` 会从头重放；
- 速度夹在 1..60 步/秒，非法值忽略（NaN / 0 / 负数都当没调用）。

源码：[`src/model/ICETracePlayerModel.ts`](../../src/model/ICETracePlayerModel.ts)

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `getFrameCount()` | `number` |  |
| `getIndex()` | `number` |  |
| `getFrame()` | `T \| null` |  |
| `getFrames()` | `T[]` |  |
| `isPlaying()` | `boolean` |  |
| `getSpeed()` | `number` |  |
| `getProgress()` | `number` |  |
| `isFinished()` | `boolean` | 已经走到（或停在）最后一帧。 |
| `load(frames: T[])` | `void` |  |
| `play()` | `void` |  |
| `pause()` | `void` |  |
| `togglePlay()` | `void` |  |
| `stepForward()` | `boolean` |  |
| `stepBackward()` | `boolean` |  |
| `seek(index: number)` | `boolean` |  |
| `reset()` | `void` |  |
| `setSpeed(stepsPerSecond: number)` | `void` |  |
| `tick(delta: number)` | `boolean` | 播放中按真实时间推进（页面每帧调用）。 |
| `addChangeListener(listener: ICETraceListener)` | `() => void` |  |

## `ICESortModel`

排序轨迹（纯逻辑，不碰 canvas）。  它只做一件事：**把排序算法跑一遍，把过程录成一串帧**。回放交给 `ICETracePlayerModel`， 画柱子交给页面（`examples/algorithm-sandbox.html` 里用一张 ICETileMap 画）。  一帧里带四样东西，正好对应可视化要画的四样：

- `values`：当前数组（柱子高度）；
- `compare`：正在比较的下标（黄色）；
- `swap`：刚刚交换 / 写入的下标（红色）；
- `sortedFrom`：从这里往后已经就位（绿色）。 再带上 `comparisons` / `swaps` 两个计数 —— 页面上当「代价」展示，也是算法的客观指标。 为什么「先录轨迹、再回放」而不是「一边算一边画」： 1. 算法本身能被单测（最终升序、每帧只是重排、比较次数上界）； 2. 回放可以随便暂停、单步、倒带、变速，算法不用知道「现在第几帧」； 3. 同一段轨迹可以换任意渲染方式（柱子 / 数字 / 音效），互不影响。

源码：[`src/model/ICESortModel.ts`](../../src/model/ICESortModel.ts)

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `getSize()` | `number` |  |
| `getMax()` | `number` |  |
| `getArray()` | `number[]` |  |
| `getAlgorithms()` | `ICESortAlgorithm[]` |  |
| `setArray(values: number[])` | `void` | 直接给一组数据（会取整、夹到 1..max）。 |
| `randomize()` | `void` | 换一批新数据（1..max 的随机数）。 |
| `shuffle()` | `void` | 洗牌：把**当前这批数字**重新打乱（同一批数据换个顺序，方便对比不同算法）。 |
| `run(algorithm: string)` | `ICESortFrame[]` | 跑一遍算法，返回整段轨迹。 |

### `ICE_SORT_ALGORITHMS` — 常量

源码：`src/model/ICESortModel.ts`

## `ICEMazeModel`

源码：[`src/model/ICEMazeModel.ts`](../../src/model/ICEMazeModel.ts)

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `getRows()` | `number` |  |
| `getCols()` | `number` |  |
| `getStart()` | `[number, number]` |  |
| `getGoal()` | `[number, number]` |  |
| `getAlgorithms()` | `ICEMazeAlgorithm[]` |  |
| `getCells()` | `number[]` | 可视化用的网格状态（起点/终点/墙）。 |
| `getCell(row: number, col: number)` | `number` |  |
| `isWall(row: number, col: number)` | `boolean` |  |
| `setWall(row: number, col: number, wall: boolean)` | `boolean` |  |
| `toggleWall(row: number, col: number)` | `boolean` |  |
| `clearWalls()` | `void` |  |
| `randomWalls(density: number)` | `void` | 按密度随机撒墙（起点终点永远不盖）。 |
| `setStart(row: number, col: number)` | `boolean` |  |
| `setGoal(row: number, col: number)` | `boolean` |  |
| `solve(algorithm: string)` | `ICEMazeFrame[]` |  |

### `ICE_MAZE_ALGORITHMS` — 常量

源码：`src/model/ICEMazeModel.ts`

### `ICE_MAZE_CELL` — 常量

迷宫寻路轨迹（纯逻辑，不碰 canvas）。  和排序那边同一套路：**先算完整段过程录成一串帧**，回放交给 `ICETracePlayerModel`， 画面由页面用一张 ICETileMap 画（每格一个状态）。  网格是「行优先的一维数组」，每格一个状态（空 / 墙 / 起点 / 终点 / 已访问 / 边界 / 路径）。 四种算法在无权网格上每步代价都是 1，区别只在**怎么挑下一个格子**：

源码：`src/model/ICEMazeModel.ts`

## `ICEDosModel`

DOS 终端（虚拟文件系统 + 命令解释器，纯逻辑，不碰 DOM）。  页面只做三件事：把 `run()` 返回的行画成文字、把键盘输入交给模型、按 `effect` 做副作用 （`cls` 清屏 / `exit` 退出）。所以「命令怎么解析、路径怎么算、文件怎么改」全都能在 node 里断言。  约定：

- 路径分隔符 `\` 与 `/` 等价；支持绝对（`\GAMES`）、相对（`GAMES`）、`.`、`..`；
- 命令大小写不敏感（`DIR` = `dir`），参数里的文件名也大小写不敏感；
- `run()` 从不抛：任何坏输入都变成一行 `error`，终端不会因为打错字崩掉；
- `echo x > a.txt` / `echo x >> a.txt` 也是模型的一部分（重定向在解析层处理掉）；
- 历史和 Tab 补全归模型管（真终端也有这两个），页面只管按键。

源码：[`src/model/ICEDosModel.ts`](../../src/model/ICEDosModel.ts)

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `getCwd()` | `string` |  |
| `getPrompt()` | `string` |  |
| `getBanner()` | `string[]` |  |
| `getHistory()` | `string[]` |  |
| `run(input: string)` | `ICEDosResult` | 执行一行命令。永不抛：坏输入变成一行 error。 |
| `historyPrev()` | `string` |  |
| `historyNext()` | `string` |  |
| `complete(input: string)` | `string` | Tab 补全：命令名补到唯一前缀（带空格），路径按当前目录补（目录名不带空格，方便继续往下打）。 |

## `ICEKeyScopeModel`

键盘作用域（纯逻辑）：把「这个键归谁」变成声明式 + 可诊断。  为什么需要它：键盘冲突已经咬过两次 —— 掌机里「卡带要拿 R 当机器键」和「外壳用 R 重开」撞车； 终端里 Tab 既是补全又被焦点管理器当成轮转焦点，回车还会落到按钮上。这都不是打字错误， 而是**没人能回答「这个键归谁」**。  画布体系里这件事比 DOM 好办：组件树是我们自己的，键盘也从同一条总线出来 —— 于是可以做成一个**作用域栈 + 声明式键位**的模型：

- 内层（后 push 的）优先；同层按 `priority` 降序，再按注册顺序**倒序**（后注册的先接）；
- `keys: ['*']` 表示这一层要吃掉所有键（终端、全屏菜单）；
- 单字符键大小写不敏感；功能键（`ArrowLeft` / `Enter` / `Escape`）原样比较；
- `detectConflicts()` 把「同一个键被多处声明」列出来 —— 冲突可见，而不是靠猜；
- handler 抛错不炸分发：记进 `lastError`，当作「没处理」继续往下找。 模型不认识 DOM、不碰 evtBus；把引擎的事件接进来的是 `bindICEKeyScope()`（见 util）。

源码：[`src/model/ICEKeyScopeModel.ts`](../../src/model/ICEKeyScopeModel.ts)

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `push(scope: string)` | `this` |  |
| `pop(scope?: string)` | `this` |  |
| `getActiveScopes()` | `string[]` | 栈顶在前（越靠前越内层）。 |
| `setEnabled(scope: string, enabled: boolean)` | `this` |  |
| `isEnabled(scope: string)` | `boolean` |  |
| `bind(binding: ICEKeyBinding)` | `() => void` |  |
| `dispatch(key: string, event?: any)` | `ICEKeyDispatchResult` | 按「内层 → 外层、同层 priority 降序、同 priority 后注册先接」的顺序找人消费。 |
| `detectConflicts()` | `ICEKeyConflict[]` | 同一个键被多处声明 → 列出来（内层作用域排在前面）。 |
| `getDiagnostics()` | `ICEKeyScopeDiagnostics` |  |
| `addChangeListener(listener: ICEKeyScopeListener)` | `() => void` |  |

## `ICEDateRangeModel`

区间日期模型（纯逻辑，不碰 canvas）。  区间选择的难点全在规则上，所以先把规则钉死，界面（日历面板 + 快捷项）只负责画：

- 用户先点结束再点开始 → **自动交换**（操作顺序不该被惩罚）；
- 只点了一头 → 「进行中」，`isComplete()` 为假（界面据此不触发「确定」）；
- 时间部分**归一化到当天零点**（同一天的两个时刻不该被判成非法区间）；
- 快捷项（今天 / 近 7 天 / 近 30 天 / 本月 / 上月）按注入的 `now` 解析，测试可复现；
- `matchPreset()` 认出「当前区间正好等于某个快捷项」，页面据此高亮那一条。

源码：[`src/model/ICEDateRangeModel.ts`](../../src/model/ICEDateRangeModel.ts)

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `getStart()` | `Date \| null` |  |
| `getEnd()` | `Date \| null` |  |
| `getValue()` | `[Date \| null, Date \| null]` |  |
| `isComplete()` | `boolean` | 两端都有才算「完整区间」。 |
| `getPresets()` | `Array<{ key: string; label: string }>` |  |
| `setValue(start: Date \| null, end: Date \| null, options: { silent?: boolean })` | `this` | 设值：自动排序（先点结束再点开始也成立）、归一化到当天零点。 |
| `applyPreset(key: string)` | `[Date, Date]` | 点快捷项：解析成区间并写回（返回值就是写进去的那一对）。 |
| `matchPreset()` | `string \| null` | 当前区间正好等于某个快捷项 → 返回它的 key（页面据此高亮）。 |
| `addChangeListener(listener: ICEDateRangeListener)` | `() => void` |  |

### `ICE_DATE_RANGE_PRESETS` — 常量

源码：`src/model/ICEDateRangeModel.ts`

## `ICEMinesweeperModel`

扫雷的纯逻辑模型（不碰 canvas）。  规则按 Windows XP 扫雷：

- **首次点击安全**：第一次掀开格子时才布雷，且排除该格及其 8 邻域（空间够时）—— 所以第一下永远不会炸，也常常一下展开一片；
- **揭示**：相邻雷数为 0 时洪水填充展开整片空白；
- **插旗循环**：无 → 🚩 → ❓ → 无（`questionMarks: false` 时只有旗）；
- **chord**（双击数字）：周围旗数等于数字时，掀开其余未插旗的邻格（可能炸）；
- **胜负**：掀开所有非雷格 = 胜；掀开雷 = 负（把所有雷亮出来）；
- **计时**：由调用方 `tick()`（每秒一次）驱动；**只有 playing 才累加**（XP 的计时从第一次点击开始）， 结束或还没开始都不动 —— 测试里可直接手动推进。 布雷用注入的 `random`（默认 `Math.random`），测试传固定序列即可复现棋局。

源码：[`src/model/ICEMinesweeperModel.ts`](../../src/model/ICEMinesweeperModel.ts)

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `getRows()` | `number` |  |
| `getCols()` | `number` |  |
| `getMineCount()` | `number` |  |
| `getState()` | `ICEMinesweeperState` |  |
| `isWon()` | `boolean` |  |
| `isLost()` | `boolean` |  |
| `isOver()` | `boolean` |  |
| `getElapsed()` | `number` |  |
| `getFlags()` | `number` |  |
| `getMinesLeft()` | `number` | 剩余雷数 = 总雷数 - 已插旗数（可能为负，和 XP 一样显示负数）。 |
| `getRevealedCount()` | `number` |  |
| `getCells()` | `ICEMinesweeperCell[]` |  |
| `getCell(row: number, col: number)` | `ICEMinesweeperCell \| null` |  |
| `areMinesPlaced()` | `boolean` | 雷是否已经布好（首点安全时，第一次 reveal 之后才会布）。 |
| `neighbors(row: number, col: number)` | `Array<[number, number]>` | 相邻 8 格的坐标。 |
| `reveal(row: number, col: number)` | `this` | 掀开格子（插旗的会被忽略）。首次掀开时布雷（首点安全）。 |
| `toggleFlag(row: number, col: number)` | `this` | 右键：无 → 旗 → 问号 → 无。 |
| `chord(row: number, col: number)` | `this` | 双击已掀开的数字：周围旗数够时掀开其余邻格。 |
| `tick()` | `this` | 计时 +1 秒（调用方按秒驱动）。只有 `playing` 才累加： |
| `reset(options: ICEMinesweeperOptions)` | `this` | 重开（可顺带换难度）。 |
| `addChangeListener(listener: ICEMinesweeperListener)` | `() => void` |  |

### `ICE_MINESWEEPER_DIFFICULTIES` — 常量

XP 扫雷的三档标准难度。

源码：`src/model/ICEMinesweeperModel.ts`

## `ICETetrisModel`

七种方块。

源码：[`src/model/ICETetrisModel.ts`](../../src/model/ICETetrisModel.ts)

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `getRows()` | `number` |  |
| `getCols()` | `number` |  |
| `getBoard()` | `ICETetrisCell[][]` |  |
| `getCurrent()` | `ICETetrisPiece` |  |
| `getNextQueue()` | `ICETetrominoType[]` | 预览队列（下一个方块在 `[0]`）。 |
| `isGameOver()` | `boolean` |  |
| `isPaused()` | `boolean` |  |
| `getScore()` | `number` |  |
| `getLines()` | `number` |  |
| `getLastClearedLines()` | `number` | 上一次锁定消掉了几行（0 表示没消；UI 用它做特效/连击提示）。 |
| `getLevel()` | `number` | 每 10 行升一级，从 1 开始。 |
| `getDropInterval()` | `number` | 当前等级下的自动下落间隔（毫秒），等级越高越短。 |
| `getGhost()` | `ICETetrisOffset[]` | 当前方块笔直落下去会停在哪（画幽灵投影用）。 |
| `addChangeListener(listener: ICETetrisListener)` | `() => void` |  |
| `moveLeft()` | `boolean` |  |
| `moveRight()` | `boolean` |  |
| `rotateCW()` | `boolean` | 顺时针旋转（带上踢墙）。 |
| `rotateCCW()` | `boolean` | 逆时针旋转（带上踢墙）。 |
| `tick()` | `boolean` | 重力：下落一行；到底就锁定。 |
| `softDrop()` | `boolean` | 软降：下落一行并 +1 分；到底就锁定。 |
| `hardDrop()` | `boolean` | 硬降：一步落到底、锁定，按落下的格数 +2 分/格。 |
| `pause()` | `void` |  |
| `resume()` | `void` |  |
| `reset(options: ICETetrisOptions)` | `void` | 重置：可只覆盖部分选项（行列、随机源），其余沿用构造时的配置。 |
| `setCellForTest(row: number, col: number, type: ICETetrominoType \| null)` | `void` | 直接摆一格（造题、读档、UI demo 都用得上）。 |
| `setLinesForTest(lines: number)` | `void` | 直接改累计消行数（测试升级曲线用）。 |

### `ICE_TETROMINOES` — 常量

七种方块 × 4 个旋转状态。 旋转在固定的方阵内进行（不做归一化），因此 O 转完还是 O、I 会躺平/立起来。

源码：`src/model/ICETetrisModel.ts`

### `ICE_TETRIS_LINE_SCORES` — 常量

消 1/2/3/4 行的基础分（再乘等级），经典数值。

源码：`src/model/ICETetrisModel.ts`

## `ICESnakeModel`

四个方向。

源码：[`src/model/ICESnakeModel.ts`](../../src/model/ICESnakeModel.ts)

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `getRows()` | `number` |  |
| `getCols()` | `number` |  |
| `getBody()` | `ICESnakePoint[]` | 蛇身（头在最前）。 |
| `getHead()` | `ICESnakePoint` | 头的坐标。 |
| `getLength()` | `number` |  |
| `getFood()` | `ICESnakePoint \| null` |  |
| `getDirection()` | `ICESnakeDirection` |  |
| `getPendingDirections()` | `ICESnakeDirection[]` | 排队中的转向（UI 可以拿它显示「已接收输入」）。 |
| `getScore()` | `number` |  |
| `getEaten()` | `number` | 已经吃掉的food个数。 |
| `getLevel()` | `number` | 每 5 个食物升一级，从 1 开始。 |
| `getTickInterval()` | `number` | 当前等级下的步进间隔（毫秒），等级越高越短，下限 70ms。 |
| `isGameOver()` | `boolean` |  |
| `isPaused()` | `boolean` |  |
| `addChangeListener(listener: ICESnakeListener)` | `() => void` |  |
| `setDirection(direction: ICESnakeDirection)` | `boolean` | 掉头请求会被忽略并返回 `false`；重复的「当前方向」算接受（`true`）但不占队列； |
| `tick()` | `boolean` | 前进一步；撞墙 / 撞自己则进入 game over 并返回 false。 |
| `pause()` | `void` |  |
| `resume()` | `void` |  |
| `reset(options: ICESnakeOptions)` | `void` | 重置：可只覆盖部分选项（行列、随机源、穿墙、初始长度）。 |
| `setBodyForTest(cells: ICESnakePoint[], direction?: ICESnakeDirection)` | `void` | 直接摆一条蛇（造题、读档、UI demo 都用得上）。 |
| `setFoodForTest(row: number, col: number)` | `void` | 直接摆一个食物。 |

### `ICE_SNAKE_DIRECTIONS` — 常量

按上、右、下、左顺序排列的方向表（UI 画方向盘可以直接用）。

源码：`src/model/ICESnakeModel.ts`

## `ICEHighScoreModel`

排行榜的纯逻辑模型（不碰 canvas，也不直接依赖 localStorage）。

- `add(score)` 插入后按**分数降序**排，并列时保持先来后到，超过 `maxEntries` 截断；
- `getBest()` 给最高分（空榜 0）；`isInTop(score)` 判断「这一局值不值得炫耀」；
- 存储通过构造函数注入（默认 `globalThis.localStorage`）：key 按卡带隔离；
- 存档损坏（非法 JSON / 结构不对 / 里层字段不合法）一律降级成空榜，绝不抛；
- 写盘失败（隐私模式、配额满）不影响内存里的成绩。

源码：[`src/model/ICEHighScoreModel.ts`](../../src/model/ICEHighScoreModel.ts)

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `getKey()` | `string` |  |
| `getStorageKey()` | `string` |  |
| `getMaxEntries()` | `number` |  |
| `getScores()` | `ICEHighScoreEntry[]` | 榜单拷贝（降序）。 |
| `getBest()` | `number` | 最高分（空榜为 0）。 |
| `isInTop(score: number)` | `boolean` | 这个分数能不能进榜（榜没满一律能进；并列最小分也算能进）。 |
| `add(score: number, options: { label?: string; at?: number })` | `ICEHighScoreEntry[]` | 记一笔成绩，返回更新后的榜单。非法分数直接忽略。 |
| `clear()` | `void` |  |
| `reload()` | `ICEHighScoreEntry[]` | 从存储重新读一遍（多标签页/多窗口场景）。 |

## `ICEChip8Model`

状态变化通知（掌机外壳拿它驱动重绘，和另外三个游戏模型是同一套契约）。

源码：[`src/model/ICEChip8Model.ts`](../../src/model/ICEChip8Model.ts)

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `getPC()` | `number` |  |
| `getI()` | `number` |  |
| `getV(index: number)` | `number` |  |
| `getDisplay()` | `Uint8Array` |  |
| `getPixel(row: number, col: number)` | `number` |  |
| `getDelayTimer()` | `number` |  |
| `getSoundTimer()` | `number` |  |
| `getCycles()` | `number` |  |
| `isWaitingForKey()` | `boolean` |  |
| `memoryRead(address: number)` | `number` |  |
| `isKeyDown(index: number)` | `boolean` |  |
| `isPaused()` | `boolean` | 暂停中（调试/切走标签页）：`step()` 与 `tickTimers()` 都不推进。 |
| `isGameOver()` | `boolean` | VM 没有"输赢"，但掌机外壳按统一契约询问，这里老实回答"没结束"。 |
| `pause()` | `void` |  |
| `resume()` | `void` |  |
| `addChangeListener(listener: ICEChip8Listener)` | `() => void` | 订阅状态变化：显存画了新东西、按键变了、定时器走了、机器复位了都会通知。 |
| `loadProgram(bytes: ArrayLike<number>, address: number)` | `void` |  |
| `memoryWrite(address: number, value: number)` | `void` |  |
| `setKey(index: number, down: boolean)` | `void` |  |
| `clearKeys()` | `void` | 清掉所有按键（切卡带/失焦时用）。 |
| `setVForTest(index: number, value: number)` | `void` |  |
| `reset()` | `void` |  |
| `tickTimers()` | `void` | 60Hz：递减延时/声音定时器。 |
| `step()` | `void` | 执行一条指令（FX0A 等按键时 PC 不动，直接返回）。 |

### `ICE_CHIP8_KEYS` — 常量

CHIP-8 虚拟机（纯逻辑，不碰 canvas）。  掌机的第四块卡带用它：前三个模型是"某款游戏的规则"，这是一个**真的微处理器模拟器**—— 4KB 内存、16 个 8 位寄存器、16 位地址寄存器 I、64×32 单色显存、两个 60Hz 定时器、16 键键盘。 画面交给 `ICETileMap`（2048 格仍然只有 1 个节点）画，音效走掌机那套 WebAudio。  支持指令（跑 demo / 小 ROM 足够）：00E0 / 00EE / 1NNN / 2NNN / 3XNN / 4XNN / 5XY0 / 9XY0 / 6XNN / 7XNN / 8XY0-8XYE / 9XY0 / ANNN / BNNN / CXNN / DXYN / EX9E / EXA1 / FX07 / FX0A / FX15 / FX18 / FX1E / FX29 / FX33 / FX55 / FX65。

源码：`src/model/ICEChip8Model.ts`

## `ICE2048Model`

四个方向。

源码：[`src/model/ICE2048Model.ts`](../../src/model/ICE2048Model.ts)

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `getRows()` | `number` |  |
| `getCols()` | `number` |  |
| `getCells()` | `ICE2048Cell[]` | 一维盘面（行优先），空格是 null。 |
| `getCell(row: number, col: number)` | `ICE2048Cell` |  |
| `getScore()` | `number` |  |
| `getMoves()` | `number` |  |
| `getTarget()` | `number` |  |
| `getBestTile()` | `number` | 盘面上最大的块（空盘为 0）。 |
| `isWon()` | `boolean` |  |
| `isGameOver()` | `boolean` |  |
| `isPaused()` | `boolean` |  |
| `getLastMerged()` | `Array<[number, number]>` | 上一次移动发生合并的格子（`[row, col]`）；没合并就是空数组。 |
| `pause()` | `void` | 暂停：棋盘类页面（掌机）共用同一套 pause/resume 契约，这里暂停只挡输入。 |
| `resume()` | `void` |  |
| `canMove()` | `boolean` | 还有没有任何一个方向推得动。 |
| `addChangeListener(listener: ICE2048Listener)` | `() => void` |  |
| `move(direction: ICE2048Direction)` | `boolean` | 往一个方向推；推得动才返回 true（并计一步、生成新块）。 |
| `reset(options: ICE2048Options)` | `void` | 重置：可只覆盖部分选项。 |
| `setCellsForTest(cells: ICE2048Cell[])` | `void` | 直接摆盘（长度必须等于 rows*cols，否则抛）。 |

### `ICE_2048_DIRECTIONS` — 常量

按上、右、下、左顺序排列（UI 画方向提示可以直接用）。

源码：`src/model/ICE2048Model.ts`

## `ICEPixelModel`

源码：[`src/model/ICEPixelModel.ts`](../../src/model/ICEPixelModel.ts)

**构造参数** `ICEPixelModelOptions`

| 参数 | 类型 | 说明 |
|---|---|---|
| `rows?` | `number` | 行数 |
| `cols?` | `number` |  |
| `palette?` | `string[]` | 调色板（`#rgb` / `#rrggbb`），下标就是画布上存的值；不传给一组默认色 |
| `background?` | `number` | 背景色下标，默认 0 |
| `limit?` | `number` | 最多能撤销几步，默认 50 |

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `getRows()` | `number` |  |
| `getCols()` | `number` |  |
| `getPalette()` | `string[]` |  |
| `getBackground()` | `number` |  |
| `getCells()` | `number[]` | 画布副本（行优先）。 |
| `getPixel(row: number, col: number)` | `number` |  |
| `isDirty()` | `boolean` | 有没提交的改动（页面据此把「保存 / 导出」按钮点亮）。 |
| `canUndo()` | `boolean` |  |
| `canRedo()` | `boolean` |  |
| `getHistoryDepth()` | `{ undo: number; redo: number }` |  |
| `setPixel(row: number, col: number, color: number)` | `boolean` | 画一个像素。返回「真的改了」—— 越界、颜色非法、值没变都返回 false， |
| `drawLine(row0: number, col0: number, row1: number, col1: number, color: number)` | `boolean` | Bresenham 直线（铅笔拖动、直线工具都走它）。 |
| `getLineCells(row0: number, col0: number, row1: number, col1: number)` | `Array<[number, number]>` | 直线经过的格子坐标（Bresenham）。 |
| `getRectCells(row0: number, col0: number, row1: number, col1: number)` | `Array<[number, number]>` | 矩形**描边**经过的格子坐标（和 drawRect 同一套口径，供预览用）。 |
| `drawRect(row0: number, col0: number, row1: number, col1: number, color: number)` | `boolean` | 矩形描边（只画框，不填内部）。 |
| `fill(row: number, col: number, color: number)` | `boolean` | 四邻域油漆桶（迭代版，不用递归 —— 大画布上递归会爆栈）。 |
| `clear(color?: number)` | `boolean` | 整块刷成某个颜色（清空 / 填充背景）。 |
| `resize(rows: number, cols: number)` | `void` | 换尺寸：重新铺一块空画布（旧内容不留，历史也重开）。 |
| `commit()` | `boolean` | 把当前画布落一次历史（一次笔画 / 一次图形操作调用一次）。返回是否真的入了栈。 |
| `undo()` | `boolean` |  |
| `redo()` | `boolean` |  |
| `toSVG(options: ICEPixelSVGOptions)` | `string` |  |
| `toRGBA(scale: number)` | `Uint8ClampedArray` | 给 `new ImageData(rgba, cols * scale, rows * scale)` 用的 RGBA 数组。 |
| `toJSON()` | `string` |  |
| `addChangeListener(listener: ICEPixelListener)` | `() => void` |  |

### `ICE_PIXEL_DEFAULT_PALETTE` — 常量

默认调色板：Bootstrap 语义色 + 黑白灰（够画像素画，也不刺眼）。

源码：`src/model/ICEPixelModel.ts`

### `icePixelParseColor` — 函数

`#rgb` / `#rrggbb` → [r, g, b]；认不出来当黑色（画布上永远有个确定的结果）。

```ts
icePixelParseColor(color: string): [number, number, number]
```

## `ICEGeometryAudit`

画布几何审计（纯逻辑，不碰 DOM、不碰 ctx）。  为什么值得单独做一件这样的事：这几轮反复咬人的 bug 都是**几何类**的 —— 「自动宽标签的盒子停在兜底测量出的假尺寸上，把邻居挤错位」「一次性布局不重排， 提示文字被按钮切掉」「顶栏面包屑的盒子伸到搜索框底下」。它们的共同点是： **肉眼要盯很久，机器一眼能算出来。**  这正是画布相对 DOM 的天然优势：整棵组件树、每个节点的世界矩形都在内存里 —— 不需要 `getBoundingClientRect()`、不触发重排、不受 CSS 与层叠上下文影响。 于是同一份判据可以：

- 在 node 里喂假组件树跑单测（毫秒级、可穷举边界）；
- 在真实浏览器里喂真组件树（同一函数、同一阈值），两边结论一致。 判定规则（策略由调用方注入，核心保持中性）：
- `overlap`：同父兄弟、互不包含、重叠面积 ≥ 较小者 `overlapRatio`（默认 15%）；
- `size-mismatch`：**自动尺寸**的容器（`props.width/height` 未给出、或等于默认值 10） 与它唯一子节点的内容尺寸不一致（超过 `tolerance`）——「盒子与内容对不上」这一整类；
- `escape`：子节点超出父容器（父容器开 `clipChildren` 时天然豁免：滚出去是被裁掉的）；
- `budget`：可见节点数超过 `nodeBudget`（防止「一格一个组件」被写回来）。 坐标系：按 `state.left/top` 累加父链得到世界矩形。这与这些示例的用法一致； 父链上有旋转/缩放时请改用引擎的 `getWorldBox()`（本工具不处理变换）。

源码：[`src/util/ICEGeometryAudit.ts`](../../src/util/ICEGeometryAudit.ts)

**构造参数** `ICEGeometryAuditOptions`

| 参数 | 类型 | 说明 |
|---|---|---|
| `nodeBudget?` | `number` | 可见节点预算；不传则不做预算检查。 |
| `tolerance?` | `number` | 尺寸比较容差（px），默认 1。 |
| `overlapRatio?` | `number` | 交叠面积占较小者的比例阈值，默认 0.15。 |

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `run(root: ICEGeometryNode)` | `ICEGeometryIssue[]` | 走一遍树，返回全部问题（没问题就是空数组）。 |
| `count(root: ICEGeometryNode)` | `number` | 可见节点数（隐藏子树整棵不算）。 |
| `box(node: ICEGeometryNode)` | `ICEGeometryBox` | 节点的世界矩形（按 state.left/top 累加父链）。 |
| `label(node: ICEGeometryNode)` | `string` | 节点的可读名：id 优先，其次文本，最后类名。 |

### `bindICEKeyScope` — 函数

把键盘接进作用域模型。

```ts
bindICEKeyScope(ice: any, model: ICEKeyScopeModel, options: ICEKeyScopeBindingOptions): () => void
```
