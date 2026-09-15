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
]);

/** 待迁：豁免清单（每条必须写原因；迁完从这张表挪进 MIGRATED）。 */
const PENDING = new Map<string, string>([
  ['ICEGrid', '24 栅格：按 span 的分数列宽 + 跨行自动换行，引擎 GridLayout 表达不了（track 见 ROADMAP）'],
  ['ICEGridCol', '同上（栅格的一列）'],
  ['ICEMenu', '菜单项 + 子菜单浮层 + 选中/hover 语义：自持策略时要处理浮层节点不参与流式排布'],
]);

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

  it('豁免清单里不允许空原因（豁免必须写清楚为什么）', () => {
    PENDING.forEach((reason, name) => {
      expect(`${name}: ${reason}`.length).toBeGreaterThan(name.length + 8);
    });
  });
});
