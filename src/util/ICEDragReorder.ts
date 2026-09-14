/**
 * 拖拽排序的纯逻辑（表格行 / 树节点 / 看板卡共用）。
 *
 * 交互里最容易错的两件事——「指针落在第几行的上/下半格」和「移动之后数组长什么样」——
 * 都在这里用纯函数解决，交互层只负责读指针、画指示线、松手时调用 `moveItem`。
 */

/** 落点：插到第 `index` 行的之前 / 之后。 */
export interface ICEDropTarget {
  index: number;
  position: 'before' | 'after';
}

export interface ICEDropTargetOptions {
  /** 指针相对列表内容顶部的纵坐标（已减去滚动偏移） */
  pointerY: number;
  itemHeight: number;
  itemCount: number;
}

/**
 * 指针坐标 → 落点。
 *
 * - 上半格 = `before`，下半格 = `after`（正好压在分界线算 after，边界行为稳定）；
 * - 拖到列表上下方会夹到首尾，不会给出越界下标；
 * - 空列表或非法行高返回 `null`（调用方据此不画指示线）。
 */
export function computeDropTarget(options: ICEDropTargetOptions): ICEDropTarget | null {
  const itemHeight = Math.floor(Number(options.itemHeight) || 0);
  const itemCount = Math.max(0, Math.floor(Number(options.itemCount) || 0));
  if (itemHeight <= 0 || itemCount <= 0) return null;
  const rawY = Number(options.pointerY);
  const pointerY = Number.isFinite(rawY) ? rawY : 0;
  if (pointerY < 0) return { index: 0, position: 'before' };
  if (pointerY >= itemCount * itemHeight) return { index: itemCount - 1, position: 'after' };
  const index = Math.min(itemCount - 1, Math.floor(pointerY / itemHeight));
  const offsetInItem = pointerY - index * itemHeight;
  return { index, position: offsetInItem < itemHeight / 2 ? 'before' : 'after' };
}

export interface ICEMoveResult<T> {
  items: T[];
  /** 移动后的新下标 */
  to: number;
  /** 是否真的移动了（拖回原位 / 相邻等价位置都算没动） */
  moved: boolean;
}

/**
 * 把第 `from` 项移到落点处，返回新数组。
 *
 * - 不改原数组（返回的是浅拷贝）；
 * - 落点换算成「移除后数组里的插入下标」，所以往回拖不会错一位；
 * - 拖到自己身上、或拖到与自己相邻的等价位置，一律 `moved: false`；
 * - 任一下标越界也当作没动。
 */
export function moveItem<T>(items: T[], from: number, target: ICEDropTarget): ICEMoveResult<T> {
  const source = Array.isArray(items) ? items : [];
  const count = source.length;
  const fromIndex = Math.floor(Number(from));
  if (!Number.isFinite(fromIndex) || fromIndex < 0 || fromIndex >= count) {
    return { items: source.slice(), to: -1, moved: false };
  }
  const targetIndex = Math.floor(Number(target && target.index));
  if (!Number.isFinite(targetIndex) || targetIndex < 0 || targetIndex >= count) {
    return { items: source.slice(), to: -1, moved: false };
  }
  const position: 'before' | 'after' = target && target.position === 'after' ? 'after' : 'before';
  const next = source.slice();
  const [moved] = next.splice(fromIndex, 1);
  let insertIndex = targetIndex + (position === 'after' ? 1 : 0);
  if (fromIndex < insertIndex) insertIndex -= 1;
  next.splice(insertIndex, 0, moved);
  return { items: next, to: insertIndex, moved: insertIndex !== fromIndex };
}

/** 树拖拽的落点：`inside` = 放进节点里当子节点。 */
export interface ICETreeDropTarget {
  index: number;
  position: 'before' | 'inside' | 'after';
}

export interface ICETreeDropTargetOptions {
  /** 指针相对**内容顶部**的纵坐标（已减去滚动偏移） */
  pointerY: number;
  itemHeight: number;
  itemCount: number;
}

/**
 * 树的行内三分法：上 1/3 插到前面、中 1/3 放进去当子节点、下 1/3 插到后面。
 *
 * 为什么是三分而不是列表的两分：树拖拽必须能表达「成为它的子节点」这件事，
 * 只用上下两半就只能同级移动了。三分法也是各家树控件的通行做法（手感最好）。
 */
export function computeTreeDropTarget(options: ICETreeDropTargetOptions): ICETreeDropTarget | null {
  const itemHeight = Math.floor(Number(options.itemHeight) || 0);
  const itemCount = Math.max(0, Math.floor(Number(options.itemCount) || 0));
  if (itemHeight <= 0 || itemCount <= 0) return null;
  const rawY = Number(options.pointerY);
  const pointerY = Number.isFinite(rawY) ? rawY : 0;
  if (pointerY < 0) return { index: 0, position: 'before' };
  if (pointerY >= itemCount * itemHeight) return { index: itemCount - 1, position: 'after' };
  const index = Math.min(itemCount - 1, Math.floor(pointerY / itemHeight));
  const ratio = (pointerY - index * itemHeight) / itemHeight;
  const position: ICETreeDropTarget['position'] = ratio < 1 / 3 ? 'before' : ratio < 2 / 3 ? 'inside' : 'after';
  return { index, position };
}

export interface ICETreeNodeLike {
  key: string;
  children?: ICETreeNodeLike[];
  [key: string]: any;
}

export interface ICETreeMoveResult<T> {
  nodes: T[];
  moved: boolean;
  /** 移动后的父节点 key（根级为 null） */
  parentKey: string | null;
}

/** 深拷贝一棵树（结构小，直接递归复制，避免外部改动互相影响）。 */
function cloneTree<T extends ICETreeNodeLike>(nodes: T[], childrenKey: string): T[] {
  return (nodes || []).map((node) => {
    const copy: any = { ...node };
    if (Array.isArray(node[childrenKey])) {
      copy[childrenKey] = cloneTree(node[childrenKey] as any, childrenKey);
    }
    return copy;
  });
}

/** 从树里摘掉一个节点，返回 [新树, 被摘下的节点]。 */
function detachNode(nodes: any[], key: string, childrenKey: string, keyField: string = 'key'): { nodes: any[]; detached: any | null } {
  const next: any[] = [];
  let detached: any | null = null;
  (nodes || []).forEach((node) => {
    if (node[keyField] === key) {
      detached = node;
      return;
    }
    const copy: any = { ...node };
    if (Array.isArray(node[childrenKey])) {
      const result = detachNode(node[childrenKey], key, childrenKey, keyField);
      copy[childrenKey] = result.nodes;
      if (result.detached) detached = result.detached;
    }
    next.push(copy);
  });
  return { nodes: next, detached };
}

/** key 是否在（子）树里。 */
function containsKey(nodes: any[], key: string, childrenKey: string, keyField: string = 'key'): boolean {
  return (nodes || []).some(
    (node) =>
      node[keyField] === key ||
      (Array.isArray(node[childrenKey]) && containsKey(node[childrenKey], key, childrenKey, keyField)),
  );
}

/** 在树里按 key 找到节点。 */
function findNode(nodes: any[], key: string, childrenKey: string, keyField: string = 'key'): any {
  for (const node of nodes || []) {
    if (node[keyField] === key) return node;
    if (Array.isArray(node[childrenKey])) {
      const found = findNode(node[childrenKey], key, childrenKey, keyField);
      if (found) return found;
    }
  }
  return null;
}

/**
 * 把 `dragKey` 节点移到 `targetKey` 的 before / inside / after。
 *
 * - 返回**新树**（不改原数组/原节点）；
 * - **不能拖进自己的后代**（那样整棵子树会凭空消失）—— 直接 `moved: false`；
 * - 位置没变（例如同级 before 到紧邻的下一项）也算没动；
 * - `before/after` 是插到目标的**同级**，`inside` 则成为目标的最后一个子节点。
 */
export function moveTreeNode<T extends ICETreeNodeLike>(
  nodes: T[],
  dragKey: string,
  targetKey: string,
  position: ICETreeDropTarget['position'],
  childrenKey: string = 'children',
  keyField: string = 'key',
): ICETreeMoveResult<T> {
  const source = Array.isArray(nodes) ? nodes : [];
  const unchanged = { nodes: source.slice(), moved: false, parentKey: null };
  if (!dragKey || !targetKey || dragKey === targetKey) return unchanged;
  const dragged = findNode(source, dragKey, childrenKey, keyField);
  const target = findNode(source, targetKey, childrenKey, keyField);
  if (!dragged || !target) return unchanged;
  if (Array.isArray(dragged[childrenKey]) && containsKey(dragged[childrenKey], targetKey, childrenKey, keyField)) {
    return unchanged; // 拖进自己的后代：拒绝
  }
  const work = cloneTree(source, childrenKey);
  const detached = detachNode(work, dragKey, childrenKey, keyField);
  if (!detached.detached) return unchanged;
  const moving = detached.detached;
  let inserted = false;
  let parentKey: string | null = null;
  const insertInto = (list: any[], parent: string | null): void => {
    const index = list.findIndex((node) => node[keyField] === targetKey);
    if (index >= 0) {
      const at = position === 'after' ? index + 1 : index;
      if (position === 'inside') {
        const host = list[index];
        host[childrenKey] = Array.isArray(host[childrenKey]) ? host[childrenKey].concat([moving]) : [moving];
        parentKey = host[keyField];
      } else {
        list.splice(at, 0, moving);
        parentKey = parent;
      }
      inserted = true;
      return;
    }
    list.forEach((node) => {
      if (inserted || !Array.isArray(node[childrenKey])) return;
      insertInto(node[childrenKey], node[keyField]);
    });
  };
  insertInto(detached.nodes as any[], null);
  if (!inserted) return unchanged;
  // 位置没变：同级 before/after 落到原位（前后紧邻）时视作没动
  const beforeOrder = structureSignature(source, childrenKey, keyField);
  const afterOrder = structureSignature(detached.nodes, childrenKey, keyField);
  if (beforeOrder === afterOrder) return unchanged;
  return { nodes: detached.nodes as T[], moved: true, parentKey };
}

/**
 * 结构签名（含层级），用于判断「位置有没有变」。
 *
 * 为什么不是「拉平后的 key 顺序」：把 b 拖进 a 当最后一个子节点，拉平顺序可能一模一样，
 * 但结构已经变了 —— 只看顺序会把这次移动误判成「没动」。
 */
function structureSignature(nodes: ICETreeNodeLike[], childrenKey: string, keyField: string = 'key'): string {
  return (nodes || [])
    .map((node) => {
      const children = Array.isArray(node[childrenKey])
        ? `(${structureSignature(node[childrenKey] as any, childrenKey, keyField)})`
        : '';
      return `${(node as any)[keyField]}${children}`;
    })
    .join(',');
}

/** 看板列（结构最小化：只要 key + cards）。 */
export interface ICEKanbanColumnLike<T = any> {
  key: string;
  cards: T[];
  [field: string]: any;
}

export interface ICEKanbanMoveResult<C> {
  columns: C[];
  moved: boolean;
  /** 移动后所在的列 */
  columnKey: string | null;
  /** 移动后在列内的下标 */
  index: number;
}

/**
 * 看板卡片移动：从原列取出，插到目标列的 `index` 位置。
 *
 * - 卡片对象**引用不变**地搬过去（业务字段不丢）；
 * - `index` 超界收到末尾（插到列尾 / 空列都是合法落点）；
 * - 未知卡片 / 未知列 / 同列原位（移动前后下标相同）都返回 `moved: false` 且结构不变；
 * - 返回新结构（浅拷贝列数组 + 新卡片数组），原结构不动。
 */
export function moveKanbanCard<C extends ICEKanbanColumnLike>(
  columns: C[],
  cardKey: string,
  targetColumnKey: string,
  index: number,
): ICEKanbanMoveResult<C> {
  const source = Array.isArray(columns) ? columns : [];
  const unchanged = { columns: source.slice(), moved: false, columnKey: null, index: -1 };
  const targetColumn = source.find((column) => column.key === targetColumnKey);
  if (!targetColumn) return unchanged;
  let fromColumn: C | null = null;
  let fromIndex = -1;
  source.forEach((column) => {
    const found = (column.cards || []).findIndex((card) => card && card.key === cardKey);
    if (found >= 0) {
      fromColumn = column;
      fromIndex = found;
    }
  });
  if (!fromColumn || fromIndex < 0) return unchanged;
  const targetLength = (targetColumn.cards || []).length;
  const insertAt = Math.min(Math.max(Math.floor(Number(index) || 0), 0), fromColumn === targetColumn ? targetLength - 1 : targetLength);
  if (fromColumn === targetColumn && fromIndex === insertAt) return unchanged;
  const nextColumns = source.map((column) => ({ ...column, cards: (column.cards || []).slice() })) as C[];
  const nextFrom = nextColumns.find((column) => column.key === fromColumn!.key) as C;
  const [card] = nextFrom.cards.splice(fromIndex, 1);
  const nextTarget = nextColumns.find((column) => column.key === targetColumnKey) as C;
  const at = Math.min(Math.max(Math.floor(Number(index) || 0), 0), nextTarget.cards.length);
  nextTarget.cards.splice(at, 0, card);
  return { columns: nextColumns, moved: true, columnKey: targetColumnKey, index: at };
}
