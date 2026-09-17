/**
 * 主题引用棘轮（2026-09-17 立）：**构造期取色只许减，不许增**。
 *
 * ## 背景
 *
 * 组件样式的取色有两条路：
 *
 * | 写法 | 什么时候解析 | 换主题时 |
 * |---|---|---|
 * | `fillStyle: token('ui.colors.text')`（**主题引用**） | **paint 时**（引擎查 `semantic.ui`） | 标脏就换，**不用重建组件**（热切换） |
 * | `const c = theme.colors.text; … fillStyle: c`（构造期取色） | 构造那一刻 | 停在旧主题上 |
 *
 * 2026-09-17 分两批迁完：先是**直接进样式槽**的 238 处，再把**条件取色 / 状态色表 / 派生色**
 * 的 316 处一并迁成引用式（前后共 554 处），剩 9 处。
 *
 * ## 只剩的 9 处是什么
 *
 * 全部落在 `paint` 回调里（`ICEAvatar.paint` / `ICESkeleton.paint` / `ICEList.paintRows`）——
 * 那里的 `theme` 是**引擎每帧传进来的参数**，本来就跟着主题走；而且 `ctx.fillStyle` 必须拿到
 * **字符串**，塞引用反而画不出来。所以这 9 处不是债，是**唯一不能写成引用的形态**。
 *
 * 真实的覆盖面由 `e2e/theme-coverage.spec.ts` 卡（逐节点比对"画出来的颜色"变没变），
 * 这个单测只做**粗粒度**的源码侧守门：某个文件用量涨了 → 红。
 *
 * 预算表按文件记，**棘轮只进不退**：
 *
 * - 某个文件用量涨了 → 红（别再往里加构造期取色）；
 * - 降了 → 也红，提示你把预算调小（避免"改了却没登记"慢慢失效）。
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const SRC = path.resolve(__dirname, '..', 'src');

/**
 * 每个文件允许的 `theme.colors.*` 用量（**当前实测值**，只能下调）。
 *
 * 用法：把某个文件改成引用式之后，把它的数字改小；改到 0 就从表里删掉。
 */
const BUDGET: Record<string, number> = {
  // 下面三个都是 **paint 回调**里的读取（`theme` 是引擎每帧传的参数，`ctx.fillStyle` 只要字符串）
  'components/ICEList.ts': 5,
  'components/ICEAvatar.ts': 3,
  'components/ICESkeleton.ts': 1,
};


const walk = (dir: string, out: string[] = []): string[] => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.ts')) out.push(full);
  }
  return out;
};

/**
 * 每个文件的构造期取色用量（代理指标）。
 *
 * 两种写法都要数：`theme.colors.X`，以及 `iceUIManager.getTheme().colors.X`
 * —— 2026-09-17 真机探测（`e2e/theme-coverage.spec.ts`）就是靠"某个节点颜色没变"
 * 抓出了第二类漏网的（`ICEDescriptions` / `ICETree` 各一处，棘轮当时数不到）。
 */
function usages(): Record<string, number> {
  const found: Record<string, number> = {};
  for (const file of walk(SRC)) {
    const source = fs.readFileSync(file, 'utf8');
    const n =
      (source.match(/theme\.colors\.[A-Za-z]/g) || []).length +
      (source.match(/getTheme\(\)\.colors\.[A-Za-z]/g) || []).length;
    if (n) found[path.relative(SRC, file).split(path.sep).join('/')] = n;
  }
  return found;
}

describe('主题引用棘轮（构造期取色只许减）', () => {
  it('没有文件超出预算（新增构造期取色要改这里，并说明为什么不能写成引用）', () => {
    const current = usages();
    const over = Object.entries(current)
      .filter(([file, n]) => n > (BUDGET[file] ?? 0))
      .map(([file, n]) => `${file}: ${n} > 预算 ${BUDGET[file] ?? 0}`);
    expect(over).toEqual([]);
  });

  it('预算没有虚高（降下来的要登记，棘轮只进不退）', () => {
    const current = usages();
    const stale = Object.entries(BUDGET)
      .filter(([file, budget]) => (current[file] ?? 0) < budget)
      .map(([file, budget]) => `${file}: 预算 ${budget}，实测 ${current[file] ?? 0}（请调小）`);
    expect(stale).toEqual([]);
  });

  it('迁移进度（打印用：总用量与文件数，改完可以对着这个数看进展）', () => {
    const current = usages();
    const total = Object.values(current).reduce((sum, n) => sum + n, 0);
    // 起点 558 处 / 52 个文件 → 迁完只剩 paint 回调里的 9 处 / 3 个文件。数字只能往下走。
    expect(total).toBeLessThanOrEqual(9);
    expect(Object.keys(current).length).toBeLessThanOrEqual(3);
  });
});
