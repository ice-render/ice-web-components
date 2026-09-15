/**
 * 布局约定**棘轮**（2026-09-15 确立）。
 *
 * 约定：**容器型组件的排布交给引擎布局器**（`setLayout(new ICEXxxLayout(...))`）。
 * 组件自己只保留"组件级策略"（高度=内容高度、按内容自适应、段宽估算…），
 * 不再在组件里写一套 `left/top` 推导 —— 那是 2026-09-15 之前的历史包袱，
 * 直接后果是「给容器挂布局」和「组件自己摆」两套坐标模型互相打架，应用层越多越乱。
 *
 * 这个测试是**棘轮**：`src/components` 里每个容器类必须出现在下面两张表之一 ——
 * - `MIGRATED`：已迁到引擎布局器（或自持 `ICELayoutManager` 子类）；
 * - `PENDING`：明确豁免并写清原因（大多是"内容与可交互装饰混在一起"，见各条注释）。
 *
 * 新增容器忘了做决定 → 这里红（逼迫作者二选一，而不是默默再抄一套手写坐标）。
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const COMPONENTS_DIR = join(__dirname, '../src/components');

/** 已迁：排布由引擎布局器负责。 */
const MIGRATED = new Set([
  'ICEPanel', // 纯容器（调用方自己 addChild + setLayout）
  'ICECard',
  'ICEStatCard',
  'ICELayout', // → ICEBorderLayout
  'ICEForm', // → ICEBoxLayout(axis y, stretch)
  'ICESpace', // → ICEBoxLayout / ICEFlowLayout（按形态）
  'ICESegmented', // → ICEGridLayout(equal) / ICEBoxLayout
  'ICEScrollPane', // → 自持 ICEScrollPaneLayout（Swing ScrollPaneLayout 位：内容盒 + 两条滚动条）
  'ICETabs', // → 自持 ICETabsLayout（Swing JTabbedPane 位：四方位 + overflow 箭头/条带）
  'ICEPagination', // → ICEBoxLayout(axis x)（页码行；顺手收敛了 76px 文案占位魔数）
  'ICEGrid', // → 自持 ICEGridLayout（24 栅格：等列宽 + 行高按内容 + 自动高度 + offset）
  'ICEGridCol', // 同上（栅格的一列，由行策略调用 applyLayout 摆位/撑宽）
  'ICEMenu', // → 自持 ICEMenuLayout（树形竖排带缩进 / 收起态竖排 / 顶栏横排；动画改走 transform.translate）
]);

/** 待迁：豁免清单（每条必须写原因；迁完从这张表挪进 MIGRATED）。 */
const PENDING = new Map<string, string>([
]);

/**
 * **复合叶子**（`ICEWidget` 子类，但自己建了结构化子节点并摆位）—— 不在上面的容器棘轮里，
 * 单独登记，同样"要么已迁移、要么写清原因"。
 *
 * 2026-09-15 复核时发现的一致性缺口：容器家族有棘轮管着，这批复合叶子没有，
 * 于是 `ICEWindow` / `ICESplitter` 至今仍是一套手写坐标。
 */
const COMPOSITE_MIGRATED = new Set([
  'ICEFormItem', // → 自持 ICEFormItemLayout（水平/垂直两形态）
  'ICEList', // → 行由 painter 画 + 点击几何反查
  'ICEVirtualList', // → 行由 painter 画（renderItem 给行矩形）
  'ICEAvatar', // → 圆底与首字由 painter 画
  'ICESkeleton', // → 占位条由 painter 画
  'ICESplitter', // → 自持 ICESplitterLayout（JSplitPane 位：两栏 + 分隔条，尺寸由拖拽驱动）
  'ICEWindow', // → 自持 ICEWindowLayout（JInternalFrame 位：底板/标题栏/按钮/客户区/缩放角）
]);

const COMPOSITE_PENDING = new Map<string, string>([
  ['ICEImageView', 'cover/contain 的裁剪几何（自绘 image 的落墨矩形），不是子节点布局，**不属于本次口径**'],
]);

/**
 * **复合控件决策表**（2026-09-15 第二轮排查：逐个手写布局点判语义）。
 *
 * 上面的两张表管的是「容器类」与「八个复合叶子」，但组件库里还有一批 `ICEWidget` 子类
 * 自己建了**结构化子节点**并按序号/游标推导位置（`top: index * itemHeight`、
 * `left = cursor`、`row * columnWidth` …）。它们是同一个问题的第二形态：
 * 容器家族有棘轮管着，这批没有 —— 于是新组件照样能再抄一套手写坐标。
 *
 * 口径（判的不是"用没用布局器"，而是**语义**）：
 * - `engine`   —— 排布已经由引擎布局器 / 自持 `ICELayoutManager` 子类负责（这类类本身就是策略本体）；
 * - `canvas`   —— 几何是**画布/表格/滚动语义**：行号 × 行高再叠滚动偏移、按日期算格子、
 *                  按当前页平移轨道、背景平铺……位置是内容的一部分，还要能反查命中，保留手写；
 * - `anatomy`  —— 固定构件的解剖几何（标题栏色带、头像叠放、多行文本行盒），与子项数量无关；
 * - `derived`  —— **派生排列仍然手写**（N 个子项等距/网格排），判定为**待迁**，理由写在值里。
 *
 * 新增一个会自建子节点的组件 → 这里红，逼作者先做决定（迁 / 归到 canvas·anatomy 并写清为什么）。
 */
const COMPOUND_DECIDED = new Map<string, string>([
  // —— 布局策略本体（自己就是"怎么排"的实现）——
  ['ICEMenuLayout', 'engine：`ICEMenuLayout` 本体（自持布局管理器），内部按行算 cursor 是它的实现，不是漏网的手写坐标'],
  ['ICETabsLayout', 'engine：`ICETabsLayout` 本体（四方位 + overflow 条带）'],
  ['ICEGridLayout', 'engine：24 栅格布局器本体（行策略在 `ICEGridCol` 里调用它摆位/撑宽）'],
  ['ICESegmented', 'engine：已迁 `ICEGridLayout(equal)` / `ICEBoxLayout`（见 MIGRATED），命中另读子项盒子'],

  // —— 画布 / 表格 / 滚动语义：位置是内容，且命中要按几何反查 ——
  ['ICETable', 'canvas：行面板 = index × rowHeight − 滚动偏移，列宽/冻结列/汇总行都是表格几何（对齐 Swing JTable 的"单元格自绘 + 行盒"口径）'],
  ['ICETree', 'canvas：行按 index × itemHeight − 滚动偏移摆，缩进与拖拽落点都靠行号反查'],
  ['ICEList', 'canvas：行由 painter 画，点击几何反查行号'],
  ['ICESelect', 'canvas：下拉选项行位在滚动窗口里（虚拟化窗口 + 命中反查行号）'],
  ['ICEAutoComplete', 'canvas：同 `ICESelect` —— 下拉选项行位在滚动窗口里，命中按行号反查'],
  ['ICETransfer', 'canvas：两侧列表都是滚动列表（行位 = index × rowHeight − 偏移）'],
  ['ICECalendar', 'canvas：格子几何 = 按日期算「第几周 / 星期几」，命中要反查日期'],
  ['ICEDatePicker', 'canvas：同 `ICECalendar` —— 日历格几何按日期算，另有滚动时分列'],
  ['ICEDateRangePicker', 'canvas：同 `ICECalendar` —— 日历格几何按日期算，另有预设区间列与头部'],
  ['ICETimePicker', 'canvas：时分秒三列 + 列内滚动选项行，位置即"选中值"'],
  ['ICECarousel', 'canvas：轨道 left = −当前页 × 宽（位移就是"第几页"语义）；指示点行同属该几何'],
  ['ICEWatermark', 'canvas：背景平铺网格（row/col 铺满，与命中无关）'],

  // —— 固定构件的解剖几何 ——
  ['ICEWindowButton', 'anatomy：标题栏色带/按钮在标题栏里的相对几何（与子项数量无关）'],
  ['ICEComment', 'anatomy：头像 + 作者 + 正文的相对偏移（`cursor` 是块内固定节奏）'],
  ['ICEAvatarGroup', 'anatomy：头像叠放（index × step 就是叠放深度）'],
  ['ICETypography', 'anatomy：多行文本的行盒（行号 × lineHeight），不是子项排布'],

  // —— 派生排列仍手写：待迁（按收益排序）——
  ['ICEAnchor', 'derived：条目是"一行一项"的等距列表（index × itemHeight），可交纵向 BoxLayout；当前还叠着独立的高亮块，迁移时一并收进内容宿主'],
  ['ICESteps', 'derived：横向步骤（index × slot）——进度连线与圆圈直径绑定，迁移要连"连接线宽度"一起算，排在中优先级'],
  ['ICETimeline', 'derived：纵向条目（index × itemHeight），条目内还有节点与内容两列'],
  ['ICERate', 'derived：一行星星（i × (size + 4)），与 RadioGroup 同形，迁移成本最低'],
  ['ICEResult', 'derived：底部按钮行（宽度不一 + 固定缝），与 RadioGroup 的行同理'],
  ['ICEBreadcrumb', 'derived：横向项 + 分隔符靠 `cursor` 累计，项宽随文本变 —— 正是 FlowLayout 的位置'],
  ['ICEBreadcrumbItemNode', 'derived：同上（`ICEBreadcrumb.ts` 里先声明的项节点类，摆位由上层 cursor 推导）'],
  ['ICEDescriptions', 'derived：两列表格（row × columnWidth / line × itemHeight），是"行 × 列"的派生网格'],
  ['ICEFormList', 'derived：动态行列表（index × (rowHeight + gap)），行内还有删除按钮'],
  ['ICEUpload', 'derived：文件行列表（index × rowHeight）'],
  ['ICECascader', 'derived：级联列（level × COLUMN_WIDTH）+ 列内选项行'],
  ['ICEColorPicker', 'derived：色板是「色相带 + 色块格子」的派生网格，可交引擎网格布局器'],
]);

/**
 * 「会自建子节点 + 按序号/游标推导位置」的复合控件。
 *
 * 判据放在源码上（不读类继承），因为要抓的正是"组件自己在 render 里摆位"这件事：
 * ① 有 `this.addChild(`；② 有 `left/top/x/y/cursor` 的位置推导行里出现 index/row/col/cursor 等序号量。
 */
function collectCompoundClasses(): Map<string, string> {
  const found = new Map<string, string>();
  for (const file of readdirSync(COMPONENTS_DIR)) {
    if (!file.endsWith('.ts')) {
      continue;
    }
    const source = readFileSync(join(COMPONENTS_DIR, file), 'utf8');
    const classMatch = /class\s+([A-Za-z0-9_]+)\s+extends\s+[A-Za-z0-9_.]+/.exec(source);
    if (!classMatch || !/this\.addChild\(/.test(source)) {
      continue;
    }
    const derivesFromIndex = source
      .split('\n')
      .some(
        (line) =>
          (/(const|let)\s+(left|top|x|y|cursor|row|col)\s*=/.test(line) || /^\s*(left|top)\s*:/.test(line)) &&
          /index|\brow\b|\bcol\b|\bcursor\b|\bi \*|\*\s*cell|\*\s*rowHeight|\*\s*itemHeight|Math\.floor\(/.test(line)
      );
    if (derivesFromIndex) {
      found.set(classMatch[1], file);
    }
  }
  return found;
}

/** 从源码里找出所有"容器型"类名（extends ICEContainer / ICEPanel / ICECard / ICEStatCard）。 */
function collectContainerClasses(): Map<string, string> {
  const found = new Map<string, string>();
  for (const file of readdirSync(COMPONENTS_DIR)) {
    if (!file.endsWith('.ts')) {
      continue;
    }
    const source = readFileSync(join(COMPONENTS_DIR, file), 'utf8');
    const re = /class\s+([A-Za-z0-9_]+)\s+extends\s+(ICEContainer|ICEPanel|ICECard|ICEStatCard)\b/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(source)) !== null) {
      found.set(match[1], file);
    }
  }
  return found;
}

describe('布局约定棘轮：容器型组件的排布必须走引擎布局器', () => {
  it('每个容器类要么已迁移、要么在豁免清单里（新增容器必须二选一）', () => {
    const containers = collectContainerClasses();
    expect(containers.size).toBeGreaterThan(8); // 自检：正则没匹配到就得先修这个测试

    const undecided: string[] = [];
    containers.forEach((_file, name) => {
      if (!MIGRATED.has(name) && !PENDING.has(name)) {
        undecided.push(name);
      }
    });
    expect(undecided).toEqual([]);
  });

  it('已迁移的容器确实挂了布局（不是只写在清单里）', () => {
    const containers = collectContainerClasses();
    const missing: string[] = [];
    MIGRATED.forEach((name) => {
      const file = containers.get(name);
      if (!file) {
        return; // 类没了（改名/删除）→ 由上面那条用例兜住
      }
      const source = readFileSync(join(COMPONENTS_DIR, file), 'utf8');
      // 「挂布局」的两种写法：自己 setLayout(引擎布局)，或由子类/基类代挂（ICEPanel 家族）
      const hooksLayout = /setLayout\(/.test(source) || name === 'ICEPanel' || name === 'ICECard' || name === 'ICEStatCard';
      if (!hooksLayout) {
        missing.push(name);
      }
    });
    expect(missing).toEqual([]);
  });

  it('复合叶子同样二选一（当前已全部决定：六个已迁移 + ICEImageView 明确排除）', () => {
    const composites = ['ICEFormItem', 'ICEList', 'ICEVirtualList', 'ICEAvatar', 'ICESkeleton', 'ICESplitter', 'ICEWindow', 'ICEImageView'];
    const undecided = composites.filter((name) => !COMPOSITE_MIGRATED.has(name) && !COMPOSITE_PENDING.has(name));
    expect(undecided).toEqual([]);
    // 自检：上次复核的缺口（ICEWindow / ICESplitter）已迁完，不该再留在豁免里
    expect(COMPOSITE_PENDING.has('ICEWindow')).toBe(false);
    expect(COMPOSITE_PENDING.has('ICESplitter')).toBe(false);
  });

  it('豁免清单里不允许空原因（豁免必须写清楚为什么）', () => {
    PENDING.forEach((reason, name) => {
      expect(`${name}: ${reason}`.length).toBeGreaterThan(name.length + 8);
    });
  });

  it('复合控件：会自建子节点并按序号摆位的类，必须逐条做决定（engine / canvas / anatomy / derived）', () => {
    const compounds = collectCompoundClasses();
    expect(compounds.size).toBeGreaterThan(15); // 自检：判据没匹配到就得先修这个测试

    const undecided: string[] = [];
    compounds.forEach((_file, name) => {
      if (!COMPOUND_DECIDED.has(name)) {
        undecided.push(name);
      }
    });
    expect(undecided).toEqual([]);
  });

  it('复合控件决策表的取值只有四种口径，且每条都写清了理由', () => {
    const KINDS = ['engine：', 'canvas：', 'anatomy：', 'derived：'];
    COMPOUND_DECIDED.forEach((reason, name) => {
      expect(KINDS.some((kind) => reason.startsWith(kind))).toBe(true);
      expect(reason.length).toBeGreaterThan(name.length + 12);
    });
  });

  it('derived 清单与代码同步：已经挂上布局器的类必须改判成 engine（否则表格与代码脱节）', () => {
    // 清单里 derived 的类，若哪天源码里出现 `setLayout(`，说明迁完了 —— 就该把这条
    // 从 `derived：` 改成 `engine：` 并写清新口径，而不是让表格一直挂着过期结论。
    const migratedAway: string[] = [];
    COMPOUND_DECIDED.forEach((reason, name) => {
      if (!reason.startsWith('derived：')) {
        return;
      }
      const file = join(COMPONENTS_DIR, `${name}.ts`);
      let source = '';
      try {
        source = readFileSync(file, 'utf8');
      } catch (err) {
        return; // 文件名与类名不一致（同文件多类）→ 由上面那条用例兜住
      }
      if (/setLayout\(/.test(source)) {
        migratedAway.push(name);
      }
    });
    expect(migratedAway).toEqual([]);
  });
});
