import {
  UIComponent,
  UIButton,
  UILabel,
  UIPanel,
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
  UIBoxLayout,
  UIFlowLayout,
  uiManager,
} from '../src';
import { UI_LIGHT_THEME } from '../src';

describe('ice-web-components component behavior', () => {
  beforeEach(() => {
    uiManager.setTheme('light');
  });

  describe('UIComponent defaults', () => {
    it('disables drag and transform by default but stays interactive', () => {
      const component = new UIComponent({ width: 100, height: 40 });
      expect(component.state.draggable).toBe(false);
      expect(component.state.transformable).toBe(false);
      expect(component.state.interactive).toBe(true);
    });

    it('syncs enabled state with interactive state', () => {
      const component = new UIComponent();
      component.setEnabled(false);
      expect(component.isEnabled()).toBe(false);
      expect(component.state.interactive).toBe(false);
      component.setEnabled(true);
      expect(component.isEnabled()).toBe(true);
      expect(component.state.interactive).toBe(true);
    });

    it('supports hover state and ignores hover when disabled', () => {
      const component = new UIComponent();
      component.setHovered(true);
      expect(component.isHovered()).toBe(true);
      component.setEnabled(false);
      component.setHovered(true);
      expect(component.isHovered()).toBe(false);
    });

    it('marks primitive children as non-interactive', () => {
      const label = new UILabel({ text: 'hello' });
      const button = new UIButton({ text: 'button' });
      const container = new UIComponent({ width: 200, height: 80 });
      container.addChild(label);
      expect(label.state.interactive).toBe(true);
      expect(label.childNodes[0].state.interactive).toBe(false);
      expect(label.childNodes[0].state.draggable).toBe(false);
      expect(label.childNodes[0].state.transformable).toBe(false);

      const panel = new UIPanel({ width: 300, height: 120 });
      panel.addChild(button);
      expect(button.state.interactive).toBe(true);
      expect(button.childNodes[0].state.interactive).toBe(false);
    });
  });

  describe('UIButton', () => {
    it('updates text and applies primary hover colour', () => {
      const button = new UIButton({ text: 'Start' });
      expect(button.getText()).toBe('Start');
      button.setText('Stop');
      expect(button.getText()).toBe('Stop');

      expect(button.state.style.fillStyle).toBe(UI_LIGHT_THEME.colors.primary);
      button.setHovered(true);
      expect(button.state.style.fillStyle).toBe(UI_LIGHT_THEME.colors.primaryHover);
      button.setHovered(false);
      expect(button.state.style.fillStyle).toBe(UI_LIGHT_THEME.colors.primary);
    });

    it('applies pressed colour on mousedown and restores on mouseup', () => {
      const button = new UIButton({ text: 'Go' });
      button.trigger('mousedown', {});
      expect(button.state.style.fillStyle).toBe(UI_LIGHT_THEME.colors.primaryActive);
      button.trigger('mouseup', {});
      expect(button.state.style.fillStyle).toBe(UI_LIGHT_THEME.colors.primary);
    });

    it('disables interactions and changes label colour', () => {
      const button = new UIButton({ text: 'Disabled', variant: 'default' });
      const label = button.childNodes[0];
      expect(label.state.style.fillStyle).toBe(UI_LIGHT_THEME.colors.text);
      button.setEnabled(false);
      expect(button.state.interactive).toBe(false);
      expect(label.state.style.fillStyle).toBe(UI_LIGHT_THEME.colors.textDisabled);
    });
  });

  describe('display components', () => {
    it('creates badges and tags with status colours', () => {
      const badge = new UIBadge({ text: '5', status: 'error' });
      expect(badge.state.style.fillStyle).toBe(UI_LIGHT_THEME.colors.errorBg);
      expect(badge.state.style.strokeStyle).toBe(UI_LIGHT_THEME.colors.errorBorder);
      badge.setText('8');
      expect(badge.childNodes[0].state.text).toBe('8');

      const tag = new UITag({ text: 'Draft', status: 'warning' });
      expect(tag.state.style.fillStyle).toBe(UI_LIGHT_THEME.colors.warningBg);
      expect(tag.state.style.strokeStyle).toBe(UI_LIGHT_THEME.colors.warningBorder);
      tag.setText('Ready');
      expect(tag.childNodes[0].state.text).toBe('Ready');
    });

    it('creates avatar and icon text nodes', () => {
      const avatar = new UIAvatar({ text: 'A', size: 48 });
      expect(avatar.childNodes).toHaveLength(2);
      avatar.setText('B');
      expect(avatar.childNodes[1].state.text).toBe('B');

      const icon = new UIIcon({ icon: '★' });
      icon.setIcon('✓');
      expect(icon.childNodes[0].state.text).toBe('✓');
    });

    it('creates a separator with border colour', () => {
      const separator = new UISeparator({ width: 100, height: 1 });
      expect(separator.childNodes[0].state.style.fillStyle).toBe(UI_LIGHT_THEME.colors.border);
    });
  });

  describe('selection controls', () => {
    it('toggles checkbox on mousedown and disables primitive interaction', () => {
      const checkbox = new UICheckBox();
      expect(checkbox.isSelected()).toBe(false);
      checkbox.trigger('mousedown', {});
      expect(checkbox.isSelected()).toBe(true);
      checkbox.trigger('mousedown', {});
      expect(checkbox.isSelected()).toBe(false);
      checkbox.childNodes.forEach((child: any) => {
        expect(child.state.interactive).toBe(false);
      });
    });

    it('selects radio on mousedown', () => {
      const radio = new UIRadioButton();
      radio.trigger('mousedown', {});
      expect(radio.isSelected()).toBe(true);
      radio.trigger('mousedown', {});
      expect(radio.isSelected()).toBe(true);
    });

    it('toggles switch on mousedown and moves knob', () => {
      const toggle = new UISwitch({ width: 52, height: 26 });
      const initialLeft = toggle.childNodes[1].state.left;
      toggle.trigger('mousedown', {});
      expect(toggle.isSelected()).toBe(true);
      expect(toggle.childNodes[1].state.left).not.toBe(initialLeft);
      toggle.trigger('mousedown', {});
      expect(toggle.isSelected()).toBe(false);
    });
  });

  describe('range components', () => {
    it('clamps progress value and updates fill width', () => {
      const progress = new UIProgressBar({ value: 40, min: 0, max: 100, width: 200, height: 10 });
      const fill = progress.childNodes[1];
      expect(fill.state.width).toBe(80);
      progress.setValue(120);
      expect(progress.getValue()).toBe(100);
      expect(fill.state.width).toBe(200);
      progress.setValue(-20);
      expect(progress.getValue()).toBe(0);
      expect(fill.state.width).toBe(0);
    });

    it('clamps slider value and updates thumb position', () => {
      const slider = new UISlider({ value: 30, min: 0, max: 100, width: 200, height: 18 });
      const thumb = slider.childNodes[2];
      slider.setValue(200);
      expect(slider.getValue()).toBe(100);
      expect(thumb.state.left).toBeGreaterThan(0);
      slider.setValue(0);
      expect(thumb.state.left).toBeLessThan(0);
    });
  });

  describe('containers and layout', () => {
    it('sets card title', () => {
      const card = new UICard({ title: 'First', width: 260, height: 160 });
      card.setTitle('Second');
      expect(card.childNodes[0].state.text).toBe('Second');
    });

    it('tabs activate selected index and update child button label colour', () => {
      const tabs = new UITabs({ tabs: ['A', 'B', 'C'], width: 300, height: 40 });
      expect(tabs.getActiveIndex()).toBe(0);
      tabs.setActiveIndex(2);
      expect(tabs.getActiveIndex()).toBe(2);
      const activeButton = tabs.childNodes[2] as UIButton;
      expect(activeButton.state.style.fillStyle).toBe(UI_LIGHT_THEME.colors.primary);
      expect(activeButton.childNodes[0].state.style.fillStyle).toBe(UI_LIGHT_THEME.colors.primaryText);
    });

    it('positions box layout children with gaps', () => {
      const panel = new UIPanel({ width: 320, height: 80 });
      panel.setUILayout(new UIBoxLayout({ axis: 'x', gap: 12 }));
      const first = new UILabel({ text: 'a', width: 40, height: 20 });
      const second = new UILabel({ text: 'b', width: 40, height: 20 });
      panel.addChildren([first, second]);
      expect(first.state.left).toBe(0);
      expect(second.state.left).toBe(52);
    });

    it('creates flow layout with left alignment', () => {
      const layout = new UIFlowLayout({ gap: 8, align: 'left' });
      expect(layout).toBeTruthy();
    });
  });
});
