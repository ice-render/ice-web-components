/**
 * UIList 单测。
 *
 * 规格：
 * - 行由 items 渲染，选中态高亮；单选替换、多选切换（走 UISelectionModel）；
 * - 点击行选中；disabled 行忽略；
 * - 键盘（焦点在列表上时）：↑/↓ 移动激活行（跳过 disabled），Enter/Space 选中当前激活行；
 * - 内容超出高度时套 UIScrollPane 承载（可滚动），否则不需要滚动条；
 * - onChange(keys) 回调。
 */
import { UIList } from '../src/components/UIList';
import { UIScrollPane } from '../src/components/UIScrollPane';

const items = [
  { key: 'a', label: '苹果' },
  { key: 'b', label: '香蕉' },
  { key: 'c', label: '橙子', disabled: true },
  { key: 'd', label: '葡萄' },
];

describe('UIList', () => {
  it('渲染行 + 单选：点击替换选中，onChange 回调', () => {
    const changes: string[][] = [];
    const list = new UIList({ left: 0, top: 0, width: 200, height: 160, items, onChange: (keys) => changes.push(keys) });
    expect(list.getRowNode('a')).toBeTruthy();
    expect(list.getSelectedKeys()).toEqual([]);

    list.getRowNode('a')!.trigger('click', null, {});
    expect(list.getSelectedKeys()).toEqual(['a']);
    list.getRowNode('b')!.trigger('click', null, {});
    expect(list.getSelectedKeys()).toEqual(['b']);
    expect(changes).toEqual([['a'], ['b']]);
  });

  it('多选：点击切换；disabled 行忽略', () => {
    const list = new UIList({ width: 200, height: 160, mode: 'multiple', items, value: [] });
    list.getRowNode('a')!.trigger('click', null, {});
    list.getRowNode('d')!.trigger('click', null, {});
    expect(list.getSelectedKeys()).toEqual(['a', 'd']);
    list.getRowNode('a')!.trigger('click', null, {});
    expect(list.getSelectedKeys()).toEqual(['d']);

    list.getRowNode('c')!.trigger('click', null, {});
    expect(list.getSelectedKeys()).toEqual(['d']);
  });

  it('键盘：↓/↑ 移动激活行（跳过 disabled），Enter 选中', () => {
    const list = new UIList({ width: 200, height: 160, items });
    const ice: any = {
      evtBus: { on() {}, off() {}, trigger() {} },
      dirty: false,
      screenToWorld: (x: number, y: number) => [x, y],
    };
    (list as any).ice = ice;
    list.setFocused(true); // 键盘只在焦点于列表时生效
    // 直接驱动内部键盘处理（真实运行里由总线派发）
    const press = (key: string) => (list as any).__onKeyDown({ key });
    press('ArrowDown');
    expect(list.getActiveIndex()).toBe(0);
    press('ArrowDown');
    expect(list.getActiveIndex()).toBe(1);
    press('ArrowDown');
    expect(list.getActiveIndex()).toBe(3); // 跳过 disabled 的 c
    press('ArrowUp');
    expect(list.getActiveIndex()).toBe(1);
    press('Enter');
    expect(list.getSelectedKeys()).toEqual(['b']);
  });

  it('内容超出高度时用 UIScrollPane 承载，否则不用', () => {
    const short = new UIList({ width: 200, height: 200, items });
    expect(short.getScrollPane()).toBeNull();

    const tall = new UIList({ width: 200, height: 80, items, itemHeight: 36 });
    const pane = tall.getScrollPane() as UIScrollPane | null;
    expect(pane).toBeTruthy();
    expect(pane!.getViewportSize()).toEqual([198, 78]); // 视口 = 列表尺寸减去 1px 内边距
    expect(pane!.getContentSize()[1]).toBe(4 * 36);
  });

  it('setItems / setSelectedKeys / getValue 语义', () => {
    const list = new UIList({ width: 200, height: 160, mode: 'multiple', items });
    list.setSelectedKeys(['a', 'b']);
    expect(list.getSelectedKeys()).toEqual(['a', 'b']);
    list.setItems([{ key: 'x', label: 'X' }, { key: 'y', label: 'Y' }]);
    expect(list.getRowNode('x')).toBeTruthy();
    expect(list.getSelectedKeys()).toEqual([]); // 数据换了，选择清空
  });
});
