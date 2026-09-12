/**
 * 撤销/重做栈（纯逻辑）规格。
 *
 * 不是为像素画板专用写的：任何「编辑 → 提交 → 后悔」的界面都能用它
 * （画板、看板、表格编辑、表单草稿…），所以它只认泛型快照，不认识 canvas 和颜色。
 *
 * 约定：
 * - `push(state)` 入栈，并**清空 redo 栈**（从历史中间改一下，原来那条「未来」就作废了）；
 * - `undo()` / `redo()` 返回目标快照，到边界返回 null（调用方据此决定按钮灰不灰）；
 * - 超过 `limit` 丢最旧的一条（默认 50，够用又不吃内存）；
 * - 变更通知带 `reason`：push / undo / redo / clear，页面按需刷新按钮态。
 */
import { ICEHistoryModel } from '../src/model/ICEHistoryModel';

describe('ICEHistoryModel', () => {
  it('初始：一层空的栈，undo / redo 都没有去处', () => {
    const history = new ICEHistoryModel<string>();
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(false);
    expect(history.getCurrent()).toBe(null);
    expect(history.undo()).toBe(null);
    expect(history.redo()).toBe(null);
  });

  it('push / undo / redo：来回走一圈回到同一个状态', () => {
    const history = new ICEHistoryModel<string>();
    history.push('a');
    history.push('b');
    expect(history.getCurrent()).toBe('b');
    expect(history.canUndo()).toBe(true);
    expect(history.canRedo()).toBe(false);

    expect(history.undo()).toBe('a');
    expect(history.getCurrent()).toBe('a');
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(true);

    expect(history.redo()).toBe('b');
    expect(history.getCurrent()).toBe('b');
    expect(history.canRedo()).toBe(false);
  });

  it('从历史中间 push 会丢掉 redo 分支（“未来”作废）', () => {
    const history = new ICEHistoryModel<string>();
    history.push('a');
    history.push('b');
    history.undo();
    expect(history.canRedo()).toBe(true);

    history.push('c');
    expect(history.canRedo()).toBe(false);
    expect(history.getCurrent()).toBe('c');
    expect(history.undo()).toBe('a');
  });

  it('limit = 最多能撤销几步；超了丢最旧的快照（内存不会无限涨）', () => {
    const history = new ICEHistoryModel<number>({ limit: 3 });
    [1, 2, 3, 4, 5].forEach((value) => history.push(value));
    expect(history.getCurrent()).toBe(5);
    expect(history.getDepth()).toEqual({ undo: 3, redo: 0 });
    expect(history.undo()).toBe(4);
    expect(history.undo()).toBe(3);
    expect(history.undo()).toBe(2);
    expect(history.undo()).toBe(null); // 1 已经被丢掉
  });

  it('clear() 清空两栈，可以带一个新的当前值', () => {
    const history = new ICEHistoryModel<string>();
    history.push('a');
    history.push('b');
    history.undo();
    history.clear('reset');
    expect(history.getCurrent()).toBe('reset');
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(false);
  });

  it('变更通知带 reason，取消订阅之后不再收到', () => {
    const history = new ICEHistoryModel<string>();
    const reasons: string[] = [];
    const off = history.addChangeListener((_model, reason) => reasons.push(String(reason)));
    history.push('a');
    history.push('b');
    history.undo();
    history.redo();
    history.clear();
    expect(reasons).toEqual(['push', 'push', 'undo', 'redo', 'clear']);

    off();
    history.push('c');
    expect(reasons).toEqual(['push', 'push', 'undo', 'redo', 'clear']);
  });
});
