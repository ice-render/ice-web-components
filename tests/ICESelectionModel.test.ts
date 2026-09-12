/**
 * 选择模型单测（ICEList / ICETree / ICETransfer 共用）。
 *
 * 语义：
 * - single：select(key) 替换选择；再次点同一项保持选中（不取消，业界组件库/Swing 的列表语义）；
 * - multiple：toggle(key) 切换；select(key) 追加；
 * - setSelected 整体替换；clear() 清空；变更通知监听器（返回注销函数）。
 */
import { ICESelectionModel } from '../src/model/ICESelectionModel';

describe('ICESelectionModel', () => {
  it('single 模式：选择替换，重复选择同一项不重复通知', () => {
    const model = new ICESelectionModel({ mode: 'single' });
    const changes: string[][] = [];
    model.addChangeListener((m) => changes.push(m.getSelectedKeys()));

    model.select('a');
    expect(model.getSelectedKeys()).toEqual(['a']);
    model.select('b');
    expect(model.getSelectedKeys()).toEqual(['b']);
    model.select('b'); // 同一项 → 无变化
    expect(changes).toEqual([['a'], ['b']]);
    expect(model.isSelected('b')).toBe(true);
    expect(model.isSelected('a')).toBe(false);
  });

  it('multiple 模式：toggle 切换、select 追加', () => {
    const model = new ICESelectionModel({ mode: 'multiple', selected: ['a'] });
    expect(model.getSelectedKeys()).toEqual(['a']);
    model.toggle('b');
    expect(model.getSelectedKeys()).toEqual(['a', 'b']);
    model.toggle('a');
    expect(model.getSelectedKeys()).toEqual(['b']);
    model.select('c');
    model.select('c');
    expect(model.getSelectedKeys()).toEqual(['b', 'c']);
  });

  it('setSelected / clear / 注销监听器', () => {
    const model = new ICESelectionModel({ mode: 'multiple' });
    let count = 0;
    const off = model.addChangeListener(() => count++);
    model.setSelected(['x', 'y']);
    expect(model.getSelectedKeys()).toEqual(['x', 'y']);
    expect(count).toBe(1);
    model.clear();
    expect(model.getSelectedKeys()).toEqual([]);
    expect(count).toBe(2);
    off();
    model.select('z');
    expect(count).toBe(2);
  });

  it('single 模式下 setSelected 只保留最后一个', () => {
    const model = new ICESelectionModel({ mode: 'single' });
    model.setSelected(['a', 'b', 'c']);
    expect(model.getSelectedKeys()).toEqual(['c']);
  });
});
