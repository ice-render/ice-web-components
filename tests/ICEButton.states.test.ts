/**
 * ICEButton 的提交态与图标（S2 第一批：把「每个页面都在用」的按钮补齐）。
 *
 * 这两件事以前都要调用方自己凑：
 * - **提交态**：`loading` 期间必须**挡住重复提交**（不只是换个样子），所以这段时间按钮不该被命中；
 * - **图标**：`icon` 只影响画出来的文字，**不能污染** `getText()` 与无障碍名 ——
 *   否则屏幕阅读器会把图标字形也念出来。
 */
import { ICEButton } from '../src';

describe('ICEButton 提交态 loading', () => {
  it('loading 期间不再参与命中（挡住重复提交），恢复后又能激活', () => {
    const button = new ICEButton({ text: '保存', width: 96, height: 32 });
    let clicks = 0;
    button.on('click', () => {
      clicks += 1;
    });
    expect(button.isLoading()).toBe(false);
    expect(button.state.interactive).toBe(true);

    button.setLoading(true);
    expect(button.isLoading()).toBe(true);
    expect(button.state.interactive).toBe(false); // 引擎的命中检测直接跳过它

    button.activate(); // 键盘激活也应被挡
    expect(clicks).toBe(0);

    button.setLoading(false);
    expect(button.state.interactive).toBe(true);
    button.activate();
    expect(clicks).toBe(1);
  });

  it('loading 与 disabled 正交：先禁用再解除 loading，仍然保持禁用', () => {
    const button = new ICEButton({ text: '提交', width: 96, height: 32 });
    button.setEnabled(false);
    button.setLoading(true);
    expect(button.isEnabled()).toBe(false);
    button.setLoading(false);
    expect(button.isEnabled()).toBe(false);
    // 注意：禁用**不**改 interactive —— 禁用的按钮仍然要能悬停（比如显示「为什么不可用」的提示），
    // 只是点不动。这条边界是有意保留的。
    expect(button.state.interactive).toBe(true);
  });
});

describe('ICEButton 图标', () => {
  it('icon 只出现在画面上：getText / 无障碍名保持纯文字', () => {
    const button = new ICEButton({ text: '新建', icon: '＋', width: 96, height: 32 });
    expect(button.getText()).toBe('新建');
    expect(button.childNodes[0].getText()).toBe('＋ 新建');
    expect(button.getAriaLabel()).toBe('新建');
  });

  it('setText / setIcon 之后两者都还在（互不覆盖）', () => {
    const button = new ICEButton({ text: '新建', width: 96, height: 32 });
    button.setIcon('↻');
    button.setText('刷新');
    expect(button.childNodes[0].getText()).toBe('↻ 刷新');
    button.setIcon('');
    expect(button.childNodes[0].getText()).toBe('刷新');
    expect(button.getText()).toBe('刷新');
  });
});
