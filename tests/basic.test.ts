// 布局类属于引擎（ice-render），本包不再重复导出 —— 这样两个包的导出集合零重叠
import { ICEBoxLayout, ICEFlowLayout } from 'ice-render';
import { ICEButton, ICELabel, ICEPanel, iceUIManager } from '../src';
import {
  ICEBadge,
  ICETag,
  ICEAvatar,
  ICEIcon,
  ICESeparator,
  ICECheckBox,
  ICERadioButton,
  ICESwitch,
  ICEProgressBar,
  ICESlider,
  ICECard,
  ICETabs,
} from '../src';

describe('ice-web-components core', () => {
  it('creates a label and updates text', () => {
    const label = new ICELabel({ text: 'hello' });
    expect(label.childNodes).toHaveLength(1);
    expect(label.getText()).toBe('hello');
    label.setText('world');
    expect(label.getText()).toBe('world');
  });

  it('creates a button and keeps Swing-like enabled state', () => {
    const button = new ICEButton({ text: 'Save' });
    expect(button.getText()).toBe('Save');
    expect(button.isEnabled()).toBe(true);
    button.setEnabled(false);
    expect(button.isEnabled()).toBe(false);
  });

  it('creates a panel and accepts layout managers', () => {
    const panel = new ICEPanel({ width: 320, height: 80 });
    panel.setLayout(new ICEBoxLayout({ axis: 'x', gap: 12 }));
    panel.addChild(new ICELabel({ text: 'a' }));
    panel.addChild(new ICELabel({ text: 'b' }));
    expect(panel.childNodes).toHaveLength(2);
    expect(panel.layoutManager).toBeTruthy();
  });

  it('creates flow layout', () => {
    const layout = new ICEFlowLayout({ gap: 8, align: 'left' });
    expect(layout).toBeTruthy();
  });

  it('switches theme', () => {
    iceUIManager.setTheme('dark');
    expect(iceUIManager.getThemeName()).toBe('dark');
    iceUIManager.setTheme('light');
  });

  it('creates common display components', () => {
    expect(new ICEBadge({ text: '9' }).childNodes.length).toBe(1);
    expect(new ICETag({ text: 'Tag' }).childNodes.length).toBe(1);
    // 头像的圆底 + 首字由 painter 画（Swing 的 UI delegate 位），不进 childNodes
    expect(new ICEAvatar({ text: 'A' }).childNodes.length).toBe(0);
    expect(new ICEIcon({ icon: '★' }).childNodes.length).toBe(1);
    expect(new ICESeparator({ width: 100 }).childNodes.length).toBe(1);
  });

  it('toggles checkbox, radio, and switch models', () => {
    const checkbox = new ICECheckBox();
    expect(checkbox.isSelected()).toBe(false);
    checkbox.setSelected(true);
    expect(checkbox.isSelected()).toBe(true);

    const radio = new ICERadioButton();
    radio.setSelected(true);
    expect(radio.isSelected()).toBe(true);

    const toggle = new ICESwitch();
    toggle.setSelected(true);
    expect(toggle.isSelected()).toBe(true);
  });

  it('updates progress and slider values', () => {
    const progress = new ICEProgressBar({ value: 40 });
    expect(progress.getValue()).toBe(40);
    progress.setValue(80);
    expect(progress.getValue()).toBe(80);

    const slider = new ICESlider({ value: 30 });
    expect(slider.getValue()).toBe(30);
    slider.setValue(75);
    expect(slider.getValue()).toBe(75);
  });

  it('creates card and tabs', () => {
    const card = new ICECard({ title: 'Card' });
    expect(card.childNodes.length).toBe(1);

    const tabs = new ICETabs({ tabs: ['A', 'B', 'C'] });
    expect(tabs.childNodes.length).toBe(3);
    tabs.setActiveIndex(2);
    expect(tabs.getActiveIndex()).toBe(2);
  });
});
