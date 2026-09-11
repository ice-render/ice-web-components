import { UIButton, UILabel, UIPanel, UIBoxLayout, UIFlowLayout, uiManager } from '../src';

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
});
