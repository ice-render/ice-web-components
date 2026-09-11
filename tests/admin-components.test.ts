import {
  UITextField,
  UIAlert,
  UITable,
  UIMenu,
  UIStatCard,
  uiManager,
} from '../src';
import { UI_LIGHT_THEME } from '../src';

describe('admin UI components', () => {
  beforeEach(() => {
    uiManager.setTheme('light');
  });

  it('updates text field value and placeholder', () => {
    const input = new UITextField({ value: 'hello', placeholder: 'Type...' });
    expect(input.getValue()).toBe('hello');
    input.setValue('world');
    expect(input.getValue()).toBe('world');
    input.setValue('');
    expect(input.childNodes[0].state.text).toBe('Type...');
  });

  it('limits text field maxLength', () => {
    const input = new UITextField({ maxLength: 3 });
    input.setValue('abcdef');
    expect(input.getValue()).toBe('abc');
  });

  it('creates alert with title and message', () => {
    const alert = new UIAlert({ type: 'success', title: 'Saved', message: 'All changes saved' });
    expect(alert.childNodes).toHaveLength(2);
    expect(alert.state.style.fillStyle).toBe(UI_LIGHT_THEME.colors.successBg);
    alert.setTitle('Updated');
    alert.setMessage('Done');
    expect(alert.childNodes[0].state.text).toBe('Updated');
    expect(alert.childNodes[1].state.text).toBe('Done');
  });

  it('renders table columns and updates selection', () => {
    const table = new UITable({
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

  it('selects menu items and reports selected key', () => {
    const menu = new UIMenu({
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
    const card = new UIStatCard({ title: 'Revenue', value: 1280, trend: '+12%' });
    card.setValue(3200);
    card.setTitle('Orders');
    card.setTrend('-3%');
    const texts = card.childNodes.map((node: any) => node.state.text);
    expect(texts).toContain('Orders');
    expect(texts).toContain('3200');
    expect(texts).toContain('-3%');
  });
});
