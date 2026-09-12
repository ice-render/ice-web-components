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
