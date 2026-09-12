/**
 * ICEIconTile 规格（桌面图标 / 图标磁贴）：
 * - 结构：大图标字形 + 下方文字标签；
 * - 单击选中（标签底色变蓝、文字变白）；点击别处由调用方取消选中；
 * - 双击打开（`open` 事件 + onOpen）；Enter/Space 等价于双击；
 * - 选中态变化触发 `select` 事件与 onSelect。
 */
import { ICEIconTile } from '../src/components/ICEIconTile';

describe('ICEIconTile', () => {
  it('渲染图标与标签，双击触发 open', () => {
    const opened: string[] = [];
    const tile = new ICEIconTile({ icon: '🖥', label: '我的电脑', onOpen: (label: string) => opened.push(label) });
    expect(tile.getLabel()).toBe('我的电脑');
    const events: any[] = [];
    tile.on('open', (evt: any) => events.push(evt.param));
    tile.trigger('dblclick', null, {});
    expect(opened).toEqual(['我的电脑']);
    expect(events).toEqual([{ label: '我的电脑' }]);
  });

  it('单击选中，再点一下取消；select 事件带选中态', () => {
    const states: boolean[] = [];
    const tile = new ICEIconTile({ icon: '📁', label: '我的文档', onSelect: (v: boolean) => states.push(v) });
    expect(tile.isSelected()).toBe(false);
    tile.trigger('click', null, {});
    expect(tile.isSelected()).toBe(true);
    tile.trigger('click', null, {});
    expect(tile.isSelected()).toBe(false);
    expect(states).toEqual([true, false]);
  });

  it('Enter / Space 打开（键盘用户）', () => {
    let opened = 0;
    const tile = new ICEIconTile({ icon: '🎨', label: '画图', onOpen: () => (opened += 1) });
    tile.activate();
    expect(opened).toBe(1);
  });

  it('选中态给标签加蓝色高亮底（文字保持白色），setSelected 是程序式接口', () => {
    const tile = new ICEIconTile({ icon: '🌐', label: 'IE' });
    const before = tile.getLabelBackground();
    tile.setSelected(true);
    expect(tile.getLabelBackground()).not.toBe(before);
    expect(tile.getLabelBackground()).not.toBe('rgba(0,0,0,0)');
    expect(tile.getLabelColor()).toBe('#ffffff');
  });
});
