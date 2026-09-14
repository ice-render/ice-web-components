/**
 * 画布几何审计（纯逻辑）规格。
 *
 * 为什么要有这个东西：这几轮反复咬人的 bug 都是**几何类**的 ——
 * 「自动宽标签的盒子停在 DOM 兜底的假尺寸上，把邻居挤错位」「一次性布局不重排，
 * 提示文字被按钮切掉」「顶栏面包屑的盒子伸到搜索框底下」。它们的共同点是：
 * **肉眼要盯很久，但机器一眼能算出来。**
 *
 * 这正是 Canvas 相对 DOM 的天然优势：整棵组件树、每个节点的世界矩形都在内存里，
 * 不需要 `getBoundingClientRect()`、不触发重排、不受 CSS 影响 —— 所以审计可以：
 *   - 在 node 里用假组件树跑单测（毫秒级、可穷举）；
 *   - 在真实浏览器里对**同一个函数**喂真组件树（同一份判据，两边一致）。
 *
 * 判定规则（都由调用方给策略，核心保持中性）：
 * - `overlap`：同父兄弟、互不包含、重叠面积 ≥ 较小者 15% —— 最典型的「压住了」；
 * - `size-mismatch`：自动尺寸的容器与它唯一子节点的实测尺寸差超过容差
 *   （`props.width/height` 未指定时的约定见 ICELabel：默认值 10 视为「未设置」）；
 * - `escape`：子节点超出父容器边界（父容器 `clipChildren` 时天然豁免：滚出去是被裁的）；
 * - `budget`：可见节点总数超过给定预算（防止有人把「一格一个组件」写回来）。
 */
import { ICEGeometryAudit, type ICEGeometryNode } from '../src/util/ICEGeometryAudit';

/** 造一个最小可用的假组件树节点。 */
const node = (id: string, props: any = {}, children: ICEGeometryNode[] = []): ICEGeometryNode => {
  const self: any = {
    state: {
      id,
      left: props.left || 0,
      top: props.top || 0,
      width: props.width === undefined ? 10 : props.width,
      height: props.height === undefined ? 10 : props.height,
      display: props.display !== false,
      zIndex: props.zIndex || 0,
      clipChildren: props.clipChildren === true,
    },
    props,
    childNodes: children,
  };
  // 世界坐标靠父链累加 —— 夹具必须把链接上，否则子节点会被误判成「越界」
  children.forEach((child: any) => {
    child.parentNode = self;
  });
  return self;
};

const audit = (root: ICEGeometryNode, options: any = {}) => new ICEGeometryAudit(options).run(root);

describe('交叠检测', () => {
  it('两个兄弟实打实压住彼此 → 报 overlap，带重叠面积', () => {
    const a = node('a', { left: 0, top: 0, width: 100, height: 40 });
    const b = node('b', { left: 60, top: 0, width: 100, height: 40 });
    const root = node('root', { width: 300, height: 100, clipChildren: true }, [a, b]);
    const issues = audit(root).filter((issue) => issue.kind === 'overlap');
    expect(issues).toHaveLength(1);
    expect(issues[0].a).toBe('a');
    expect(issues[0].b).toBe('b');
    expect(issues[0].overlapArea).toBe(40 * 40);
  });

  it('一个完全包住另一个 → 不报（图标叠在按钮里、文字在卡片里都是设计使然）', () => {
    const inner = node('icon', { left: 10, top: 10, width: 16, height: 16 });
    const button = node('button', { left: 0, top: 0, width: 80, height: 36 }, [inner]);
    const root = node('root', { width: 200, height: 100, clipChildren: true }, [button]);
    expect(audit(root).filter((issue) => issue.kind === 'overlap')).toHaveLength(0);
  });

  it('只擦到一点点（<15% 小者面积）不报：圆角、阴影这种边角接触不算错位', () => {
    const a = node('a', { left: 0, top: 0, width: 100, height: 40 });
    const b = node('b', { left: 96, top: 0, width: 100, height: 40 });
    const root = node('root', { width: 400, height: 100, clipChildren: true }, [a, b]);
    expect(audit(root).filter((issue) => issue.kind === 'overlap')).toHaveLength(0);
  });

  it('调用方可以声明「这一对是故意的」（滑轨 × 滑块、堆叠头像…）', () => {
    const track = node('track', { left: 0, top: 18, width: 200, height: 4 });
    const thumb = node('thumb', { left: 90, top: 10, width: 20, height: 20 });
    const root = node('root', { width: 300, height: 60, clipChildren: true }, [track, thumb]);
    const auditWithPolicy = new ICEGeometryAudit({
      allowOverlap: (a: any, b: any) => a.state.id === 'track' && b.state.id === 'thumb',
    });
    expect(auditWithPolicy.run(root).filter((issue) => issue.kind === 'overlap')).toHaveLength(0);
    expect(audit(root).filter((issue) => issue.kind === 'overlap')).toHaveLength(1); // 不声明就照报
  });

  it('隐藏的兄弟不参与检测（display:false 的浮层不该算错位）', () => {
    const a = node('a', { left: 0, top: 0, width: 100, height: 40 });
    const hidden = node('hidden', { left: 0, top: 0, width: 100, height: 40, display: false });
    const root = node('root', { width: 200, height: 100, clipChildren: true }, [a, hidden]);
    expect(audit(root)).toHaveLength(0);
  });
});

describe('尺寸一致性（自动盒 = 内容实测）', () => {
  it('自动宽高的容器与内层实测尺寸不一致 → 报 size-mismatch', () => {
    // 复刻那个真 bug：包装盒停在 418，内层文字实测 228
    const text: any = node('text', { left: 0, top: 0, width: 228, height: 20 });
    text.measureText = () => undefined;
    // 自动盒：props 里**没有**给尺寸（给了就不是自动盒了），但 state 停在旧值上
    const label: any = node('label', { left: 0, top: 0 }, [text]);
    label.state.width = 418;
    label.state.height = 20;
    const root = node('root', { width: 500, height: 60, clipChildren: true }, [label]);
    const issues = audit(root).filter((issue) => issue.kind === 'size-mismatch');
    expect(issues).toHaveLength(1);
    expect(issues[0].detail).toContain('228');
    expect(issues[0].detail).toContain('418');
  });

  it('显式给了宽高的容器不检查（那是调用方的排版意图）', () => {
    const text: any = node('text', { left: 0, top: 0, width: 228, height: 20 });
    text.measureText = () => undefined;
    const label: any = node('label', { left: 0, top: 0, width: 400, height: 20 }, [text]);
    label.props = { width: 400, height: 20 };
    const root = node('root', { width: 500, height: 60, clipChildren: true }, [label]);
    expect(audit(root).filter((issue) => issue.kind === 'size-mismatch')).toHaveLength(0);
  });

  it('多子节点容器不参与这条检查（它本来就该比内容大）', () => {
    const a = node('a', { left: 0, top: 0, width: 20, height: 20 });
    const b = node('b', { left: 30, top: 0, width: 20, height: 20 });
    const row = node('row', { left: 0, top: 0, width: 80, height: 30 }, [a, b]);
    const root = node('root', { width: 200, height: 80, clipChildren: true }, [row]);
    expect(audit(root).filter((issue) => issue.kind === 'size-mismatch')).toHaveLength(0);
  });
});

describe('越界与预算', () => {
  it('子节点超出父容器 → 报 escape（父容器开了 clipChildren 则豁免）', () => {
    const child = node('child', { left: 180, top: 0, width: 60, height: 20 });
    const panel = node('panel', { width: 200, height: 60 }, [child]);
    const root = node('root', { width: 400, height: 100, clipChildren: true }, [panel]);
    const issues = audit(root).filter((issue) => issue.kind === 'escape');
    expect(issues).toHaveLength(1);
    expect(issues[0].a).toBe('child');
    expect(issues[0].detail).toContain('panel');

    const clipped = node('panel2', { width: 200, height: 60, clipChildren: true }, [node('c2', { left: 180, top: 0, width: 60, height: 20 })]);
    const root2 = node('root2', { width: 400, height: 100, clipChildren: true }, [clipped]);
    expect(audit(root2).filter((issue) => issue.kind === 'escape')).toHaveLength(0);
  });

  it('调用方可以豁免特定子树（浮层挂在页面根上、按需要溢出）', () => {
    const child = node('popup', { left: 180, top: 0, width: 60, height: 20 });
    const panel = node('panel', { width: 200, height: 60 }, [child]);
    const root = node('root', { width: 400, height: 100, clipChildren: true }, [panel]);
    const auditWithPolicy = new ICEGeometryAudit({ allowEscape: (n: any) => n.state.id === 'popup' });
    expect(auditWithPolicy.run(root).filter((issue) => issue.kind === 'escape')).toHaveLength(0);
  });

  it('节点总数超过预算 → 报 budget（防止「一格一个组件」被写回来）', () => {
    const cells = Array.from({ length: 20 }, (_v, i) => node(`cell-${i}`, { left: i * 10, top: 0, width: 8, height: 8 }));
    const board = node('board', { width: 200, height: 20 }, cells);
    const root = node('root', { width: 400, height: 100, clipChildren: true }, [board]);
    const report = audit(root, { nodeBudget: 5 });
    const budget = report.filter((issue) => issue.kind === 'budget');
    expect(budget).toHaveLength(1);
    expect(budget[0].detail).toContain('22'); // root + board + 20 格
  });

  it('报告里带可见节点数，便于 QA 断言「没暴涨」', () => {
    const tree = node('root', { width: 100, height: 100, clipChildren: true }, [
      node('a', { width: 10, height: 10 }),
      node('b', { width: 10, height: 10, display: false }),
      node('c', { width: 10, height: 10, left: 20 }, [node('d', { width: 10, height: 10 })]),
    ]);
    const report = audit(tree);
    expect(report.length).toBe(0);
    expect(new ICEGeometryAudit().count(tree)).toBe(4); // 隐藏的 b 不算
  });
});
