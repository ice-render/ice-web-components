/**
 * 浏览器侧的几何审计封装（给各示例的 QA 复用）。
 *
 * 判据本身是库里的 `ICEGeometryAudit`（纯逻辑，有 12 条单测）——这里只做三件事：
 * 1. 在页面里把它指向真实的组件树（默认 `window.__result.shell`）；
 * 2. 用**注册表反查真实类型名**（UMD 是压缩过的，`constructor.name` 只剩 `ne`/`it` 这种短名，
 *    直接拿来判类型会全部失灵），据此给出「设计使然」的豁免：徽标叠锚点、堆叠头像、
 *    滑轨上的滑块、密码框里的眼睛按钮叠占位文字；
 * 3. 返回结构化报告（问题列表 + 可见节点数），让 QA 断言「零交叠 / 节点数没暴涨」。
 */

/** 在页面里跑一次几何审计。 */
export async function auditGeometry(page, options = {}) {
  const rootExpr = options.rootExpr || 'window.__result.shell';
  const nodeBudget = options.nodeBudget === undefined ? 4000 : options.nodeBudget;
  return page.evaluate(
    ({ rootExpr: expr, nodeBudget: budget }) => {
      // eslint-disable-next-line no-eval
      const root = eval(expr);
      const Audit = window.ICEWEB && window.ICEWEB.ICEGeometryAudit;
      if (!root || !Audit) return { issues: [{ kind: 'error', a: 'audit', detail: '找不到根节点或 ICEGeometryAudit' }], nodeCount: 0 };

      const registry = new Map();
      [window.ICEWEB, window.ICE].filter(Boolean).forEach((mod) => {
        Object.keys(mod).forEach((key) => {
          const value = mod[key];
          if (typeof value === 'function' && !registry.has(value)) registry.set(value, key);
        });
      });
      const typeName = (node) => registry.get(node && node.constructor) || '';
      const hasAncestor = (node, type) => {
        let cursor = node;
        while (cursor && cursor.state) {
          if (typeName(cursor) === type) return true;
          cursor = cursor.parentNode;
        }
        return false;
      };
      const textOf = (node) => String(node && node.getText ? node.getText() : '');

      const audit = new Audit({
        nodeBudget: budget,
        allowOverlap: (a, b) => {
          const ta = typeName(a);
          const tb = typeName(b);
          if (ta === 'ICEBadge' || tb === 'ICEBadge') return true; // 小红点叠锚点
          if (hasAncestor(a, 'ICEAvatarGroup') && hasAncestor(b, 'ICEAvatarGroup')) return true; // 堆叠头像
          const thinRect = (x, y) => typeName(x) === 'ICERect' && Number(x.state.height || 99) <= 8 && typeName(y) === 'ICECircle';
          if (thinRect(a, b) || thinRect(b, a)) return true; // 滑轨 × 滑块
          const eye = (node) => /^\s*👁/.test(textOf(node));
          const hint = (node) => /密码|再输一次|≥/.test(textOf(node));
          return (eye(a) && hint(b)) || (eye(b) && hint(a)); // 密码框里的眼睛压着占位文字
        },
        allowEscape: (node) => hasAncestor(node, 'ICEModal') || hasAncestor(node, 'ICEDrawer') || hasAncestor(node, 'ICETooltip'),
      });
      const issues = audit.run(root);
      return {
        nodeCount: audit.count(root),
        issues: issues.map((issue) => ({ kind: issue.kind, a: issue.a, b: issue.b, detail: issue.detail })),
      };
    },
    { rootExpr, nodeBudget },
  );
}

/** 把报告整理成一行可读文本（失败时贴进 QA 输出用）。 */
export function formatGeometryIssues(report, limit = 3) {
  if (!report || !report.issues || !report.issues.length) return '干净';
  const head = report.issues.slice(0, limit).map((issue) => `${issue.kind}: ${issue.detail}`);
  const more = report.issues.length > limit ? ` …还有 ${report.issues.length - limit} 条` : '';
  return head.join(' | ') + more;
}
