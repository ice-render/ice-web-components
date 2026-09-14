/**
 * Tabs 的形态补齐（S2 第一批第三件）：卡片式 `type: 'card'`、可关闭 `closable`、右侧扩展区 `extra`。
 *
 * 以前只有一种「实心药丸」形态：详情页要的是**文件袋式**（选中页贴在内容上、未选中页留在背景里），
 * 多页签编辑器要的是**能关**，工具栏要的是**页签右边挂操作**。这三件都收进组件，
 * 而不是让每个页面在 Tab 旁边自己贴按钮。
 */
import { ICEButton, ICELabel, ICETabs } from '../src';

describe('type: card（文件袋式）', () => {
  it('未选中页不画底色（留在背景里），选中页用卡片配色 + 描边', () => {
    const tabs: any = new ICETabs({ width: 360, tabs: ['概览', '明细', '设置'], type: 'card' });
    const [first, second] = tabs.childNodes.filter((node: any) => node instanceof ICEButton);
    expect(tabs.getType()).toBe('card');
    expect(first.state.style.fillStyle).not.toBe(second.state.style.fillStyle);
    expect(String(second.state.style.fillStyle)).toContain('rgba(0,0,0,0)'); // 未选中：透明
  });

  it('默认仍是 line（实心药丸），不传 type 的页面行为不变', () => {
    const tabs: any = new ICETabs({ width: 360, tabs: ['A', 'B'] });
    expect(tabs.getType()).toBe('line');
    const [first, second] = tabs.childNodes.filter((node: any) => node instanceof ICEButton);
    expect(first.state.style.fillStyle).not.toBe(second.state.style.fillStyle); // 选中/未选中仍然有区别
  });
});

describe('closable：能关页签', () => {
  it('每个页签多一个关闭钮；closeTab 之后页签没了、onClose 收到名字、激活下标被夹住', () => {
    const closed: string[] = [];
    const tabs: any = new ICETabs({
      width: 360,
      tabs: ['概览', '明细', '设置'],
      closable: true,
      onClose: (name: string) => closed.push(name),
    });
    const buttons = tabs.childNodes.filter((node: any) => node instanceof ICEButton);
    expect(buttons.every((button: any) => button.childNodes.length === 2)).toBe(true); // 文字 + ✕

    tabs.setActiveIndex(2);
    tabs.closeTab(1); // 关掉中间那个
    expect(tabs.getTabs()).toEqual(['概览', '设置']);
    expect(closed).toEqual(['明细']);
    expect(tabs.getActiveIndex()).toBe(1); // 原来是 2，夹到最后一位
  });

  it('没开 closable 时不出现关闭钮（保持原样）', () => {
    const tabs: any = new ICETabs({ width: 360, tabs: ['A', 'B'] });
    const buttons = tabs.childNodes.filter((node: any) => node instanceof ICEButton);
    expect(buttons.every((button: any) => button.childNodes.length === 1)).toBe(true);
    expect(tabs.isClosable()).toBe(false);
  });
});

describe('extra：页签右侧的扩展区', () => {
  it('extra 节点挂在页签之后，随组件一起参与布局', () => {
    const action = new ICEButton({ text: '新建', width: 80, height: 32 });
    const tabs: any = new ICETabs({ width: 420, tabs: ['概览', '明细'], extra: action });
    const kids = tabs.childNodes as any[];
    expect(kids.indexOf(action)).toBeGreaterThan(kids.findIndex((node) => node instanceof ICEButton));
    expect(tabs.getExtra()).toEqual([action]);
    // 位置由流式布局在真实场景里算（node 环境没有 ctx，量不到就排不了），这里只守「挂在了页签之后」
  });

  it('标签也能当 extra（详情页右上角经常是说明文字）', () => {
    const note = new ICELabel({ text: '最近更新 2 分钟前', width: 160, height: 20 });
    const tabs: any = new ICETabs({ width: 420, tabs: ['概览'], extra: [note] });
    expect(tabs.getExtra()).toEqual([note]);
  });
});
