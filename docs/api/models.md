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
