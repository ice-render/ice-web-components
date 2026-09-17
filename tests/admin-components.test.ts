import {
  ICETextField,
  ICEAlert,
  ICETable,
  ICEMenu,
  ICEStatCard,
  ICEBadge,
  iceUIManager,
} from '../src';
import { ICE_LIGHT_THEME } from '../src';
import { resolvedStyleColor } from '../src/util/ICEStyle';

describe('admin UI components', () => {
  beforeEach(() => {
    iceUIManager.setTheme('light');
  });

  it('updates text field value and placeholder', () => {
    const input = new ICETextField({ value: 'hello', placeholder: 'Type...' });
    expect(input.getValue()).toBe('hello');
    input.setValue('world');
    expect(input.getValue()).toBe('world');
    input.setValue('');
    expect(input.childNodes[0].state.text).toBe('Type...');
  });

  it('limits text field maxLength', () => {
    const input = new ICETextField({ maxLength: 3 });
    input.setValue('abcdef');
    expect(input.getValue()).toBe('abc');
  });

  it('creates alert with title and message', () => {
    const alert = new ICEAlert({ type: 'success', title: 'Saved', message: 'All changes saved' });
    // 3 = 类型图标（默认显示，文字整体右移让位）+ 标题 + 正文
    expect(alert.childNodes).toHaveLength(3);
    expect(alert.getIconNode()!.getText()).toBe('✓');
    // 状态色表现在返回**主题引用**（热切换用），断言要解析一次
    expect(resolvedStyleColor(alert, 'fillStyle')).toBe(ICE_LIGHT_THEME.colors.successBg);
    alert.setTitle('Updated');
    alert.setMessage('Done');
    expect(alert.childNodes[1].state.text).toBe('Updated');
    expect(alert.childNodes[2].state.text).toBe('Done');
  });

  it('renders table columns and updates selection', () => {
    const table = new ICETable({
      width: 600,
      columns: [
        { key: 'name', title: 'Name', width: 200 },
        { key: 'status', title: 'Status', width: 120 },
      ],
      data: [
        { name: 'Order A', status: 'Paid' },
        { name: 'Order B', status: 'Pending' },
      ],
    });
    expect(table.childNodes.length).toBe(3);
    expect(table.childNodes[0].state.top).toBe(0);
    expect(table.childNodes[1].state.top).toBe(36);
    expect(table.childNodes[2].state.top).toBe(76);
    table.setSelectedRow(1);
    expect(table.getSelectedIndex()).toBe(1);
    table.setData([{ name: 'Only', status: 'Paid' }]);
    expect(table.childNodes.length).toBe(2);
    expect(table.getSelectedIndex()).toBe(-1);
  });

  it('keeps header and row cell x-alignment for right-aligned columns', () => {
    const table = new ICETable({
      width: 400,
      columns: [
        { key: 'label', title: 'Label', width: 200 },
        { key: 'amount', title: 'Amount', width: 200, align: 'right' },
      ],
      data: [{ label: 'Order', amount: '$1,240.00' }],
    });
    const headerCells = table.childNodes[0].childNodes.filter((node: any) => node.state.text);
    const rowCells = table.childNodes[1].childNodes.filter((node: any) => node.state.text);
    expect(headerCells[1].state.left).toBe(rowCells[1].state.left);
    expect(headerCells[1].state.width).toBe(rowCells[1].state.width);
  });

  it('selects menu items and reports selected key', () => {
    const menu = new ICEMenu({
      width: 240,
      items: [
        { key: 'dashboard', label: 'Dashboard', icon: '●' },
        { key: 'users', label: 'Users', icon: '▲' },
      ],
      selectedKey: 'users',
    });
    expect(menu.getSelectedKey()).toBe('users');
    menu.setSelectedKey('dashboard');
    expect(menu.getSelectedKey()).toBe('dashboard');
  });

  it('updates stat card content', () => {
    const card = new ICEStatCard({ title: 'Revenue', value: 1280, trend: '+12%' });
    card.setValue(3200);
    card.setTitle('Orders');
    card.setTrend('-3%');
    const texts = card.childNodes.map((node: any) => node.state.text);
    expect(texts).toContain('Orders');
    expect(texts).toContain('3200');
    expect(texts).toContain('-3%');
  });

  it('badge text is centered inside the pill (padding kept as an inset)', () => {
    const badge = new ICEBadge({ text: 'Paid', width: 86, height: 22, status: 'success' });
    const textNode = badge.childNodes[0];
    // 居中而不是左对齐：固定宽度的胶囊（表格状态列）左对齐会让短标签明显偏左
    // （实测 "Paid" 在 86px 胶囊里偏左 18.5px）。居中后宽度贴合文字的胶囊同样成立。
    expect(textNode.state.style.textAlign).toBe('center');
    expect(textNode.state.left).toBeGreaterThan(0);
    expect(textNode.state.width).toBeLessThan(badge.state.width);
  });
});
