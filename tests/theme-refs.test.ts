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
 * 2026-09-17 把**直接进样式槽**的 238 处迁成了引用式（`e2e/theme-hot-switch.spec.ts` 真机钉住）。
 * 剩下这些是**派生色**：`mix` / `shade` / alpha / 状态色表 / 条件取色 —— 它们没法写成一条引用，
 * 要跟随就得实现 `ICEWidget.onThemeChange()`（钩子已经在了）。这是**已知的、分期的**工作量，
 * 所以这里不像别的棘轮那样直接禁止，而是按文件记**预算**：
 *
 * - 某个文件用量涨了 → 红（别再往里加构造期取色）；
 * - 降了 → 也红，提示你把预算调小（**棘轮只进不退**，避免"改了却没登记"慢慢失效）。
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
  'util/ICEStyle.ts': 31,
  'components/ICEMenu.ts': 24,
  'components/ICEDateRangePicker.ts': 22,
  'components/ICEButton.ts': 17,
  'components/ICETransfer.ts': 16,
  'components/ICESelect.ts': 14,
  'components/ICETable.ts': 14,
  'components/ICERadioButton.ts': 12,
  'components/ICESwitch.ts': 12,
  'components/ICEUpload.ts': 12,
  'components/ICEDatePicker.ts': 11,
  'components/ICECascader.ts': 10,
  'components/ICECheckBox.ts': 10,
  'components/ICETextField.ts': 9,
  'components/ICETimePicker.ts': 9,
  'components/ICEFloatButton.ts': 8,
  'components/ICESteps.ts': 8,
  'components/ICETabs.ts': 8,
  'components/ICETreeSelect.ts': 8,
  'components/ICETypography.ts': 8,
  'components/ICETree.ts': 7,
  'components/ICEDropdown.ts': 6,
  'components/ICEInputNumber.ts': 6,
  'components/ICEColorPicker.ts': 5,
  'components/ICEList.ts': 5,
  'core/ICEMessageManager.ts': 5,
  'components/ICEBreadcrumb.ts': 4,
  'components/ICECalendar.ts': 4,
  'components/ICECarousel.ts': 4,
  'components/ICECollapse.ts': 4,
  'components/ICEResult.ts': 4,
  'components/ICESlider.ts': 4,
  'components/ICEAnchor.ts': 3,
  'components/ICEAvatar.ts': 3,
  'components/ICEProgressBar.ts': 3,
  'components/ICEBackTop.ts': 2,
  'components/ICECheckboxGroup.ts': 2,
  'components/ICELayout.ts': 2,
  'components/ICERadioGroup.ts': 2,
  'components/ICERate.ts': 2,
  'components/ICESplitter.ts': 2,
  'components/ICEStatCard.ts': 2,
  'components/ICEAutoComplete.ts': 1,
  'components/ICEComment.ts': 1,
  'components/ICEIcon.ts': 1,
  'components/ICEImageView.ts': 1,
  'components/ICESkeleton.ts': 1,
  'components/ICESpin.ts': 1,
  'components/ICEStatistic.ts': 1,
  'components/ICESvgIcon.ts': 1,
  'components/ICETag.ts': 1,
  'components/ICETimeline.ts': 1,
};

const walk = (dir: string, out: string[] = []): string[] => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.ts')) out.push(full);
  }
  return out;
};

/** 每个文件的 `theme.colors.*` 用量（构造期取色的代理指标）。 */
function usages(): Record<string, number> {
  const found: Record<string, number> = {};
  for (const file of walk(SRC)) {
    const source = fs.readFileSync(file, 'utf8');
    const n = (source.match(/theme\.colors\.[A-Za-z]/g) || []).length;
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
    // 2026-09-17 起点：592 处 / 52 个文件（迁移 238 处样式槽之后剩这些派生色）
    expect(total).toBeLessThanOrEqual(354);
    expect(Object.keys(current).length).toBeLessThanOrEqual(52);
  });
});
