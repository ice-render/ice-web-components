import { UIButton, UILabel, UIPanel, UIBoxLayout, UIFlowLayout, uiManager } from '../src';
import {
  UIBadge,
  UITag,
  UIAvatar,
  UIIcon,
  UISeparator,
  UICheckBox,
  UIRadioButton,
  UISwitch,
  UIProgressBar,
  UISlider,
  UICard,
  UITabs,
} from '../src';

describe('ice-web-components core', () => {
  it('creates a label and updates text', () => {
    const label = new UILabel({ text: 'hello' });
    expect(label.childNodes).toHaveLength(1);
    expect(label.getText()).toBe('hello');
    label.setText('world');
    expect(label.getText()).toBe('world');
  });

  it('creates a button and keeps Swing-like enabled state', () => {
    const button = new UIButton({ text: 'Save' });
    expect(button.getText()).toBe('Save');
    expect(button.isEnabled()).toBe(true);
    button.setEnabled(false);
    expect(button.isEnabled()).toBe(false);
  });

  it('creates a panel and accepts layout managers', () => {
    const panel = new UIPanel({ width: 320, height: 80 });
    panel.setUILayout(new UIBoxLayout({ axis: 'x', gap: 12 }));
    panel.addChild(new UILabel({ text: 'a' }));
    panel.addChild(new UILabel({ text: 'b' }));
    expect(panel.childNodes).toHaveLength(2);
    expect(panel.layoutManager).toBeTruthy();
  });

  it('creates flow layout', () => {
    const layout = new UIFlowLayout({ gap: 8, align: 'left' });
    expect(layout).toBeTruthy();
  });

  it('switches theme', () => {
    uiManager.setTheme('dark');
    expect(uiManager.getThemeName()).toBe('dark');
    uiManager.setTheme('light');
  });

  it('creates common display components', () => {
    expect(new UIBadge({ text: '9' }).childNodes.length).toBe(1);
    expect(new UITag({ text: 'Tag' }).childNodes.length).toBe(1);
    expect(new UIAvatar({ text: 'A' }).childNodes.length).toBe(2);
    expect(new UIIcon({ icon: '★' }).childNodes.length).toBe(1);
    expect(new UISeparator({ width: 100 }).childNodes.length).toBe(1);
  });

  it('toggles checkbox, radio, and switch models', () => {
    const checkbox = new UICheckBox();
    expect(checkbox.isSelected()).toBe(false);
    checkbox.setSelected(true);
    expect(checkbox.isSelected()).toBe(true);

    const radio = new UIRadioButton();
    radio.setSelected(true);
    expect(radio.isSelected()).toBe(true);

    const toggle = new UISwitch();
    toggle.setSelected(true);
    expect(toggle.isSelected()).toBe(true);
  });

  it('updates progress and slider values', () => {
    const progress = new UIProgressBar({ value: 40 });
    expect(progress.getValue()).toBe(40);
    progress.setValue(80);
    expect(progress.getValue()).toBe(80);

    const slider = new UISlider({ value: 30 });
    expect(slider.getValue()).toBe(30);
    slider.setValue(75);
    expect(slider.getValue()).toBe(75);
  });

  it('creates card and tabs', () => {
    const card = new UICard({ title: 'Card' });
    expect(card.childNodes.length).toBe(1);

    const tabs = new UITabs({ tabs: ['A', 'B', 'C'] });
    expect(tabs.childNodes.length).toBe(3);
    tabs.setActiveIndex(2);
    expect(tabs.getActiveIndex()).toBe(2);
  });
});
