/**
 * 「组件内部零件跟随自身尺寸」棘轮（2026-09-15 立）。
 *
 * 背景：一批组件在**构造期**按当时的 `state.width/height` 算好内部零件的坐标/尺寸，
 * 之后被父层布局改尺寸时零件不跟着走 —— 零件比组件宽就溢出盖住邻居。
 * 业务侧踩到过两次：`ice-smart-water` 的等分网格统计卡（`ICEStatCard`）与
 * 「1×/2×/4×」分段控件（`ICEButton`）。
 *
 * 判定口径（关键，别退化成"谁跑到盒子外"）：
 *   A 实例：400x260 建出来，再 `setState` 缩到 200x130；
 *   B 实例：**一开始就**用 200x130 建出来。
 * 两者内部零件几何**必须一致** —— 因为"组件在某个尺寸下该长什么样"只应由尺寸决定，
 * 与"它是怎么到达这个尺寸的"无关。
 *
 * 为什么不看"谁跑到盒子外"：文字比盒子宽（`ICELabel` 的自然宽文本）、
 * 滚动内容比视口大（`ICEScrollPane`）本来就会越界，那是语义不是缺陷，
 * 用 B 实例当参照能自动把这类情形排除掉。
 *
 * 修复入口：`ICEWidget.__syncInternalLayout()`（尺寸变化时由基类自动分发）。
 */
import * as lib from '../src/index';

/** 每个组件的最小可用构造参数（选项类的必须给）。 */
const PROPS: Record<string, any> = {
  ICEAutoComplete: { options: ['a', 'b'] },
  ICECascader: { options: [{ value: 'a', label: 'A' }] },
  ICECheckboxGroup: { options: [{ value: 'a', label: 'A' }] },
  ICEColorPicker: { colors: ['#fff', '#000'] },
  ICEKanban: { columns: [{ key: 'todo', title: '待办', cards: [] }] },
  ICEList: { items: ['a', 'b', 'c'] },
  ICEMenu: { items: [{ key: 'a', label: 'A' }] },
  ICEPagination: { total: 100, pageSize: 10 },
  ICERadioGroup: { options: [{ value: 'a', label: 'A' }] },
  ICESegmented: { options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] },
  ICESelect: { options: [{ value: 'a', label: 'A' }] },
  ICESteps: { items: [{ title: '一' }, { title: '二' }], current: 0 },
  ICETable: { columns: [{ title: '列', dataIndex: 'a' }], dataSource: [{ a: 1 }] },
  ICETabs: { items: [{ key: 'a', label: 'A' }] },
  ICETimeline: { items: [{ title: 't', content: 'c' }] },
  ICETransfer: { dataSource: [{ key: 'a', title: 'A' }], targetKeys: [] },
  ICETree: { nodes: [{ key: 'a', label: 'A' }] },
  ICETreeSelect: { nodes: [{ key: 'a', label: 'A' }] },
  ICEAnchor: { items: [{ title: 'a', top: 0 }] },
  ICEBreadcrumb: { items: [{ title: 'a' }] },
  ICECollapse: { items: [{ key: 'a', title: 'A', content: 'x' }] },
  ICEDescriptions: { items: [{ label: 'a', value: 'b' }] },
  ICEForm: { items: [] },
  ICEGrid: { children: [] },
  ICEWatermark: { text: 'x' },
  ICEUpload: {},
  ICEDropdown: { items: [{ key: 'a', label: 'A' }] },
  ICEInputNumber: { value: 1 },
  ICETextField: { value: 'text' },
  ICETextArea: { value: 'text' },
  ICEStatCard: { title: '进水流量', value: '1.2' },
  ICEButton: { text: '提交' },
  ICEDatePicker: {},
  ICEDateRangePicker: {},
  ICETimePicker: {},
  ICEAlert: { message: '提示' },
  ICEEmpty: {},
  ICEResult: {},
  ICEImageView: {},
  ICETypography: { text: '文本' },
  ICEStatistic: { title: 't', value: 1 },
  ICEIconTile: { icon: 'x' },
  ICESwitch: {},
  ICESlider: {},
  ICEProgressBar: { value: 50 },
  ICESeparator: {},
  ICECheckBox: { label: 'a' },
  ICERadioButton: { label: 'a' },
  ICELabel: { text: '文本' },
  ICEBadge: { text: '9' },
  ICETag: { text: '标签' },
  ICEPasswordField: { value: 'v' },
  ICECarousel: {},
  ICECalendar: {},
  ICEWindow: { title: '窗' },
};

/**
 * 浮层 / 自身就带滚动语义的组件：内部零件本来就该比盒子大，不适用本判定。
 * 逐个写明原因，避免这份名单变成"随手加一个"的垃圾桶。
 */
const EXEMPT_BY_DESIGN = new Set([
  'ICEScrollPane', // contentBox 负偏移 + 比视口大 = 滚动语义
  'ICEVirtualList', // 同上，且可见项按滚动位置切窗
  'ICETooltip', // 浮层：展开时本来就画在盒子外
  'ICEPopover', // 浮层
  'ICEDropdown', // 浮层
  'ICEModal', // 浮层
  'ICEDrawer', // 浮层
  'ICETour', // 浮层
  'ICEImagePreview', // 浮层
  'ICEUpload', // 内部是原生 input 替身，几何由 DOM 侧管
]);

/**
 * **待修清单**（棘轮）：2026-09-15 已清零 —— 40 个受影响的组件全部改成跟随自身尺寸。
 *
 * 留着这个空集合是为了保留机制：以后确实需要"先准入、再修"时往这里加一个**带原因**的条目，
 * 下面那条测试会双向校验 —— 清单里"其实已经跟随"的必须删掉，清单外"其实不跟随"的必须补上，
 * 所以这份名单只会变短，新组件想蒙混过关是不可能的。
 */
const NOT_FOLLOWING_YET = new Set<string>([]);

function descendants(root: any, out: any[] = []): any[] {
  for (const c of root.childNodes || []) {
    out.push(c);
    descendants(c, out);
  }
  return out;
}

/** 相对父节点的方位 + 自身尺寸 —— 「内部零件摆在哪、多大」的全部信息。 */
function geom(node: any): number[] {
  return [node.state?.left, node.state?.top, node.state?.width, node.state?.height].map((v) => Number(v) || 0);
}

function nameOf(node: any): string {
  return node.constructor?.name || node.typeId || '?';
}

const BIG: [number, number] = [400, 260];
const SMALL: [number, number] = [200, 130];

/** 缩尺寸后内部零件与"一开始就这么小"的偏差（0 = 跟随正确）。 */
function driftAfterShrink(Ctor: any, props: any): { worst: number; count: number; who: string } | null {
  let wide: any;
  let ref: any;
  try {
    wide = new Ctor({ ...props, width: BIG[0], height: BIG[1] });
    ref = new Ctor({ ...props, width: SMALL[0], height: SMALL[1] });
  } catch {
    return null; // 构造不了（需要 ICE 实例 / 必要参数），不适用
  }
  if (typeof wide.setState !== 'function' || !Array.isArray(wide.childNodes)) return null;
  if (wide.childNodes.length === 0) return null; // 没有内部零件，无从"不跟随"

  wide.setState({ width: SMALL[0], height: SMALL[1] });
  wide.doLayout();
  ref.doLayout();

  const a = descendants(wide);
  const b = descendants(ref);
  if (a.length === 0 || a.length !== b.length) return null; // 结构不同，不可比

  let worst = 0;
  let count = 0;
  let who = '';
  for (let i = 0; i < a.length; i++) {
    const ga = geom(a[i]);
    const gb = geom(b[i]);
    const d = Math.max(...ga.map((v, k) => Math.abs(v - gb[k])));
    if (d <= 1) continue; // 1px 容差：浮点位与取整
    count += 1;
    if (d > worst) {
      worst = d;
      who = `${nameOf(a[i])} 缩后=${JSON.stringify(ga.map(Math.round))} 原生=${JSON.stringify(gb.map(Math.round))}`;
    }
  }
  return { worst, count, who };
}

/** 扫描全部组件，返回"缩尺寸后内部零件不跟随"的组件名 → 最坏偏差描述。 */
function scanNotFollowing(): Map<string, { worst: number; count: number; who: string }> {
  const found = new Map<string, { worst: number; count: number; who: string }>();
  const names = Object.keys(lib as any).filter(
    (k) => /^ICE/.test(k) && typeof (lib as any)[k] === 'function'
  );
  for (const name of names) {
    if (EXEMPT_BY_DESIGN.has(name)) continue;
    const drift = driftAfterShrink((lib as any)[name], PROPS[name] || {});
    if (drift && drift.count > 0) found.set(name, drift);
  }
  return found;
}

describe('组件内部零件跟随自身尺寸', () => {
  const notFollowing = scanNotFollowing();

  it('棘轮：待修清单与实测完全一致（修好一个就删一个，别让新组件蒙混过关）', () => {
    const actual = [...notFollowing.keys()].sort();
    const listed = [...NOT_FOLLOWING_YET].sort();
    const fixedButStillListed = listed.filter((n) => !actual.includes(n));
    const failingButNotListed = actual.filter((n) => !listed.includes(n));

    console.log(
      `\n不跟随的组件 ${actual.length} 个；待修清单 ${listed.length} 个。\n` +
        (fixedButStillListed.length
          ? `  已修好但还留在清单里（请删掉）：${fixedButStillListed.join(', ')}\n`
          : '') +
        (failingButNotListed.length
          ? `  实测不跟随但不在清单里（请补上或修掉）：${failingButNotListed.join(', ')}\n`
          : '')
    );

    expect({ fixedButStillListed, failingButNotListed }).toEqual({
      fixedButStillListed: [],
      failingButNotListed: [],
    });
  });

  it('已修的组件逐个点名：内部零件铺满/贴齐新盒子', () => {
    // ICEButton 是第一个修好的（同一类缺陷的首个实例），留在测试里当范例锚点。
    const button: any = new lib.ICEButton({ text: '提交', width: 96, height: 32 } as any);
    const label = button.childNodes[0];
    expect([label.state.width, label.state.height]).toEqual([96, 32]);

    button.setState({ width: 74.67, height: 28 });
    expect(label.state.width).toBeCloseTo(74.67, 5);
    expect([label.state.left, label.state.top, label.state.height]).toEqual([0, 0, 28]);
  });
});
