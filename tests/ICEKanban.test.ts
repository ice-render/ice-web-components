/**
 * 看板拖拽的纯逻辑规格（`moveKanbanCard`）。
 *
 * 看板与列表/树的区别：卡片有**两个维度** —— 换列（column）+ 列内插到第几位（index）。
 * 这里守住：
 * - 列内重排、跨列插入、插到列尾、插到空列；
 * - 卡片对象原样搬过去（引用不变，业务数据不丢）；
 * - 未知卡片 / 未知列 = 没动；位置没变（同列原位）= 没动；
 * - 返回新结构，原结构不动。
 */
import { moveKanbanCard } from '../src/util/ICEDragReorder';

const board = () => [
  { key: 'todo', title: '待办', cards: [{ key: 'a', title: 'A' }, { key: 'b', title: 'B' }] },
  { key: 'doing', title: '进行中', cards: [{ key: 'c', title: 'C' }] },
  { key: 'done', title: '已完成', cards: [] as Array<{ key: string; title: string }> },
];
const keysIn = (columns: any[], columnKey: string) => columns.find((column) => column.key === columnKey).cards.map((card: any) => card.key);

describe('moveKanbanCard', () => {
  it('列内重排：把第 0 张插到第 1 张之后', () => {
    const result = moveKanbanCard(board(), 'a', 'todo', 1);
    expect(result.moved).toBe(true);
    expect(keysIn(result.columns, 'todo')).toEqual(['b', 'a']);
    expect(result.columnKey).toBe('todo');
    expect(result.index).toBe(1);
  });

  it('跨列插入：插到目标列指定位置', () => {
    const result = moveKanbanCard(board(), 'b', 'doing', 0);
    expect(keysIn(result.columns, 'todo')).toEqual(['a']);
    expect(keysIn(result.columns, 'doing')).toEqual(['b', 'c']);
  });

  it('插到列尾 / 插到空列（index 超界自动收到末尾）', () => {
    expect(keysIn(moveKanbanCard(board(), 'a', 'doing', 99).columns, 'doing')).toEqual(['c', 'a']);
    expect(keysIn(moveKanbanCard(board(), 'a', 'done', 0).columns, 'done')).toEqual(['a']);
  });

  it('卡片对象原样搬过去（引用不变，业务字段不丢）', () => {
    const source = board();
    const card = source[0].cards[1];
    const result = moveKanbanCard(source, 'b', 'done', 0);
    expect(result.columns[2].cards[0]).toBe(card);
  });

  it('未知卡片 / 未知列 / 同列原位都算没动', () => {
    expect(moveKanbanCard(board(), 'nope', 'done', 0).moved).toBe(false);
    expect(moveKanbanCard(board(), 'a', 'nope', 0).moved).toBe(false);
    expect(moveKanbanCard(board(), 'a', 'todo', 0).moved).toBe(false);
  });

  it('返回新结构，原结构不动', () => {
    const source = board();
    const result = moveKanbanCard(source, 'a', 'done', 0);
    expect(keysIn(source, 'todo')).toEqual(['a', 'b']);
    expect(keysIn(result.columns, 'todo')).toEqual(['b']);
  });
});
