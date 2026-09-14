/**
 * 画布几何审计（纯逻辑，不碰 DOM、不碰 ctx）。
 *
 * 为什么值得单独做一件这样的事：这几轮反复咬人的 bug 都是**几何类**的 ——
 * 「自动宽标签的盒子停在兜底测量出的假尺寸上，把邻居挤错位」「一次性布局不重排，
 * 提示文字被按钮切掉」「顶栏面包屑的盒子伸到搜索框底下」。它们的共同点是：
 * **肉眼要盯很久，机器一眼能算出来。**
 *
 * 这正是画布相对 DOM 的天然优势：整棵组件树、每个节点的世界矩形都在内存里 ——
 * 不需要 `getBoundingClientRect()`、不触发重排、不受 CSS 与层叠上下文影响。
 * 于是同一份判据可以：
 *   - 在 node 里喂假组件树跑单测（毫秒级、可穷举边界）；
 *   - 在真实浏览器里喂真组件树（同一函数、同一阈值），两边结论一致。
 *
 * 判定规则（策略由调用方注入，核心保持中性）：
 * - `overlap`：同父兄弟、互不包含、重叠面积 ≥ 较小者 `overlapRatio`（默认 15%）；
 * - `size-mismatch`：**自动尺寸**的容器（`props.width/height` 未给出、或等于默认值 10）
 *   与它唯一子节点的内容尺寸不一致（超过 `tolerance`）——「盒子与内容对不上」这一整类；
 * - `escape`：子节点超出父容器（父容器开 `clipChildren` 时天然豁免：滚出去是被裁掉的）；
 * - `budget`：可见节点数超过 `nodeBudget`（防止「一格一个组件」被写回来）。
 *
 * 坐标系：按 `state.left/top` 累加父链得到世界矩形。这与这些示例的用法一致；
 * 父链上有旋转/缩放时请改用引擎的 `getWorldBox()`（本工具不处理变换）。
 */

export interface ICEGeometryNode {
  state: Record<string, any>;
  props?: Record<string, any>;
  childNodes?: ICEGeometryNode[];
  isEffectivelyVisible?: () => boolean;
  measureText?: (...args: any[]) => any;
  getText?: () => string;
}

export interface ICEGeometryBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export type ICEGeometryIssueKind = 'overlap' | 'size-mismatch' | 'escape' | 'budget';

export interface ICEGeometryIssue {
  kind: ICEGeometryIssueKind;
  /** 问题节点（overlap 里是左边那个） */
  a: string;
  /** 与之冲突的节点（overlap 才有） */
  b?: string;
  detail: string;
  /** 重叠面积（overlap 才有，单位 px²） */
  overlapArea?: number;
}

export interface ICEGeometryAuditOptions {
  /** 设计使然的交叠豁免（滑轨 × 滑块、堆叠头像…）。返回 true 则跳过这一对。 */
  allowOverlap?(a: ICEGeometryNode, b: ICEGeometryNode, parent: ICEGeometryNode): boolean;
  /** 允许溢出的子树（浮层挂在根上、故意出血的装饰）。 */
  allowEscape?(node: ICEGeometryNode, parent: ICEGeometryNode): boolean;
  /** 可见节点预算；不传则不做预算检查。 */
  nodeBudget?: number;
  /** 尺寸比较容差（px），默认 1。 */
  tolerance?: number;
  /** 交叠面积占较小者的比例阈值，默认 0.15。 */
  overlapRatio?: number;
}

/** 组件的默认尺寸哨兵：调用方没给尺寸时 ICEWidget 会把 width/height 填成 10。 */
const DEFAULT_SIZE = 10;

export class ICEGeometryAudit {
  private options: ICEGeometryAuditOptions;

  constructor(options: ICEGeometryAuditOptions = {}) {
    this.options = options;
  }

  /** 走一遍树，返回全部问题（没问题就是空数组）。 */
  public run(root: ICEGeometryNode): ICEGeometryIssue[] {
    const issues: ICEGeometryIssue[] = [];
    const tolerance = this.options.tolerance === undefined ? 1 : Number(this.options.tolerance);
    const ratio = this.options.overlapRatio === undefined ? 0.15 : Number(this.options.overlapRatio);
    const nodeCount = this.count(root);

    const visit = (parent: ICEGeometryNode) => {
      const kids = (parent.childNodes || []).filter((child) => this.__visible(child));
      // ① 尺寸一致性：自动盒 vs 内容实测
      if (kids.length === 1) {
        const only = kids[0];
        if (this.__isAutoBox(parent) && typeof only.measureText === 'function') {
          const outer = this.box(parent);
          const inner = this.box(only);
          if (Math.abs(outer.width - inner.width) > tolerance || Math.abs(outer.height - inner.height) > tolerance) {
            issues.push({
              kind: 'size-mismatch',
              a: this.label(parent),
              detail:
                `${this.label(parent)} 的盒子 ${Math.round(outer.width)}×${Math.round(outer.height)} ` +
                `与内容实测 ${Math.round(inner.width)}×${Math.round(inner.height)} 不一致（自动尺寸应与内容一致）`,
            });
          }
        }
      }
      // ② 兄弟交叠 + ③ 越界
      for (let i = 0; i < kids.length; i += 1) {
        const child = boxOfSafe(this, kids[i]);
        if (!child) continue;
        const outer = this.box(parent);
        const escapes =
          child.left < outer.left - tolerance ||
          child.top < outer.top - tolerance ||
          child.left + child.width > outer.left + outer.width + tolerance ||
          child.top + child.height > outer.top + outer.height + tolerance;
        if (
          escapes &&
          parent !== root &&
          parent.state.clipChildren !== true &&
          !(this.options.allowEscape && this.options.allowEscape(kids[i], parent))
        ) {
          issues.push({
            kind: 'escape',
            a: this.label(kids[i]),
            detail: `${this.label(kids[i])} 超出父容器 ${this.label(parent)} 的边界`,
          });
        }
        for (let j = i + 1; j < kids.length; j += 1) {
          const a = boxOfSafe(this, kids[i]);
          const b = boxOfSafe(this, kids[j]);
          if (!a || !b || !a.width || !a.height || !b.width || !b.height) continue;
          const ox = Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left);
          const oy = Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top);
          if (ox <= tolerance || oy <= tolerance) continue;
          const overlapArea = ox * oy;
          const smaller = Math.min(a.width * a.height, b.width * b.height);
          if (smaller <= 0 || overlapArea / smaller < ratio) continue;
          if (contains(a, b) || contains(b, a)) continue; // 装饰性嵌套：图标叠在按钮里
          if (this.options.allowOverlap && this.options.allowOverlap(kids[i], kids[j], parent)) continue;
          issues.push({
            kind: 'overlap',
            a: this.label(kids[i]),
            b: this.label(kids[j]),
            overlapArea: Math.round(overlapArea),
            detail: `${this.label(kids[i])} 与 ${this.label(kids[j])} 重叠 ${Math.round(ox)}×${Math.round(oy)}`,
          });
        }
      }
      kids.forEach(visit);
    };
    if (this.__visible(root)) {
      // 根节点的越界检查没有意义（它没有父容器），其余照常
      visit(root);
    }

    if (this.options.nodeBudget !== undefined && nodeCount > Number(this.options.nodeBudget)) {
      issues.push({
        kind: 'budget',
        a: this.label(root),
        detail: `可见节点 ${nodeCount} 个，超过预算 ${this.options.nodeBudget} 个`,
      });
    }
    return issues;
  }

  /** 可见节点数（隐藏子树整棵不算）。 */
  public count(root: ICEGeometryNode): number {
    if (!this.__visible(root)) return 0;
    let total = 1;
    (root.childNodes || []).forEach((child) => {
      total += this.count(child);
    });
    return total;
  }

  /** 节点的世界矩形（按 state.left/top 累加父链）。 */
  public box(node: ICEGeometryNode): ICEGeometryBox {
    let left = 0;
    let top = 0;
    let cursor: any = node;
    while (cursor && cursor.state) {
      left += Number(cursor.state.left) || 0;
      top += Number(cursor.state.top) || 0;
      cursor = cursor.parentNode;
    }
    return {
      left,
      top,
      width: Number(node.state.width) || 0,
      height: Number(node.state.height) || 0,
    };
  }

  // ------------------------------------------------------------------ 内部
  /** 节点的可读名：id 优先，其次文本，最后类名。 */
  public label(node: ICEGeometryNode): string {
    const id = node && node.state ? node.state.id : '';
    const text = typeof node.getText === 'function' ? String(node.getText() || '') : '';
    const cls = (node && node.constructor && node.constructor.name) || 'node';
    // 匿名对象（测试夹具）与压缩后的类名没有信息量 —— 只用 id / 文本；真组件才带类名
    const prefix = cls && cls !== 'Object' ? cls : '';
    const name = `${prefix}${id ? (prefix ? '#' : '') + id : ''}${text ? '「' + text.slice(0, 14) + '」' : ''}`;
    return name || cls || 'node';
  }

  private __visible(node: ICEGeometryNode): boolean {
    if (!node || !node.state || node.state.display === false) return false;
    if (typeof node.isEffectivelyVisible === 'function') return node.isEffectivelyVisible();
    return true;
  }

  /** 自动盒：调用方没给尺寸（或给了默认哨兵 10）。 */
  private __isAutoBox(node: ICEGeometryNode): boolean {
    const props = node.props || {};
    const auto = (value: any) => value === undefined || Number(value) === DEFAULT_SIZE;
    return auto(props.width) || auto(props.height);
  }
}

/** 世界矩形（父链由调用方保证已挂好；拿不到父链时退化成局部坐标）。 */
function boxOfSafe(audit: ICEGeometryAudit, node: ICEGeometryNode): ICEGeometryBox | null {
  const box = audit.box(node);
  return box;
}

/** a 是否完全包含 b（带 0.5px 容差：浮点排版不该被判成「没包住」）。 */
function contains(a: ICEGeometryBox, b: ICEGeometryBox): boolean {
  return (
    a.left <= b.left + 0.5 &&
    a.top <= b.top + 0.5 &&
    a.left + a.width >= b.left + b.width - 0.5 &&
    a.top + a.height >= b.top + b.height - 0.5
  );
}

export default ICEGeometryAudit;
