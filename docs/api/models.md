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
