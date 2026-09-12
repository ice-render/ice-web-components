import {
  ICEWidget,
  ICEButton,
  ICELabel,
  ICEPanel,
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
  iceUIManager,
} from '../src';
import { ICEBoxLayout, ICEFlowLayout } from 'ice-render';
import { ICE_LIGHT_THEME } from '../src';

describe('ice-web-components component behavior', () => {
  beforeEach(() => {
    iceUIManager.setTheme('light');
  });

  describe('ICEWidget defaults', () => {
    it('disables drag and transform by default but stays interactive', () => {
      const component = new ICEWidget({ width: 100, height: 40 });
      expect(component.state.draggable).toBe(false);
      expect(component.state.transformable).toBe(false);
      expect(component.state.interactive).toBe(true);
    });

    it('syncs enabled state with interactive state', () => {
      const component = new ICEWidget();
      component.setEnabled(false);
      expect(component.isEnabled()).toBe(false);
      expect(component.state.interactive).toBe(false);
      component.setEnabled(true);
      expect(component.isEnabled()).toBe(true);
      expect(component.state.interactive).toBe(true);
    });

    it('supports hover state and ignores hover when disabled', () => {
      const component = new ICEWidget();
      component.setHovered(true);
      expect(component.isHovered()).toBe(true);
      component.setEnabled(false);
      component.setHovered(true);
      expect(component.isHovered()).toBe(false);
    });

    it('marks primitive children as non-interactive', () => {
      const label = new ICELabel({ text: 'hello' });
      const button = new ICEButton({ text: 'button' });
      const container = new ICEWidget({ width: 200, height: 80 });
      container.addChild(label);
      expect(label.state.interactive).toBe(true);
      expect(label.childNodes[0].state.interactive).toBe(false);
      expect(label.childNodes[0].state.draggable).toBe(false);
      expect(label.childNodes[0].state.transformable).toBe(false);

      const panel = new ICEPanel({ width: 300, height: 120 });
      panel.addChild(button);
      expect(button.state.interactive).toBe(true);
      expect(button.childNodes[0].state.interactive).toBe(false);
    });
  });

  describe('ICEButton', () => {
    it('updates text and applies primary hover colour', () => {
      const button = new ICEButton({ text: 'Start' });
      expect(button.getText()).toBe('Start');
      button.setText('Stop');
      expect(button.getText()).toBe('Stop');

      expect(button.state.style.fillStyle).toBe(ICE_LIGHT_THEME.colors.primary);
      button.setHovered(true);
      expect(button.state.style.fillStyle).toBe(ICE_LIGHT_THEME.colors.primaryHover);
      button.setHovered(false);
      expect(button.state.style.fillStyle).toBe(ICE_LIGHT_THEME.colors.primary);
    });

    it('applies pressed colour on mousedown and restores on mouseup', () => {
      const button = new ICEButton({ text: 'Go' });
      button.trigger('mousedown', {});
      expect(button.state.style.fillStyle).toBe(ICE_LIGHT_THEME.colors.primaryActive);
      button.trigger('mouseup', {});
      expect(button.state.style.fillStyle).toBe(ICE_LIGHT_THEME.colors.primary);
    });

    it('disables interactions and changes label colour', () => {
      const button = new ICEButton({ text: 'Disabled', variant: 'default' });
      const label = button.childNodes[0];
      expect(label.state.style.fillStyle).toBe(ICE_LIGHT_THEME.colors.text);
      button.setEnabled(false);
      expect(button.state.interactive).toBe(false);
      expect(label.state.style.fillStyle).toBe(ICE_LIGHT_THEME.colors.textDisabled);
    });
  });

  describe('display components', () => {
    it('creates badges and tags with status colours', () => {
      const badge = new ICEBadge({ text: '5', status: 'error' });
      // 默认实底（Bootstrap `.text-bg-*`），配白字
      expect(badge.state.style.fillStyle).toBe(ICE_LIGHT_THEME.colors.error);
      expect(badge.state.style.strokeStyle).toBe(ICE_LIGHT_THEME.colors.error);
      expect(badge.childNodes[0].state.style.fillStyle).toBe('#ffffff');
      badge.setText('8');
      expect(badge.childNodes[0].state.text).toBe('8');

      const tag = new ICETag({ text: 'Draft', status: 'warning' });
      // 亮黄实底配黑字（Bootstrap `.text-bg-warning`）
      expect(tag.state.style.fillStyle).toBe(ICE_LIGHT_THEME.colors.warning);
      expect(tag.state.style.strokeStyle).toBe(ICE_LIGHT_THEME.colors.warning);
      expect(tag.childNodes[0].state.style.fillStyle).toBe('#000000');
      tag.setText('Ready');
      expect(tag.childNodes[0].state.text).toBe('Ready');
    });

    it('badge / tag 支持 soft 变体（subtle 浅底 + 强调文字）', () => {
      const softBadge = new ICEBadge({ text: '5', status: 'error', variant: 'soft' });
      expect(softBadge.state.style.fillStyle).toBe(ICE_LIGHT_THEME.colors.errorBg);
      expect(softBadge.state.style.strokeStyle).toBe(ICE_LIGHT_THEME.colors.errorBorder);
      expect(softBadge.childNodes[0].state.style.fillStyle).toBe(ICE_LIGHT_THEME.colors.errorTextEmphasis);

      const softTag = new ICETag({ text: 'Draft', status: 'warning', variant: 'soft' });
      expect(softTag.state.style.fillStyle).toBe(ICE_LIGHT_THEME.colors.warningBg);
      expect(softTag.state.style.strokeStyle).toBe(ICE_LIGHT_THEME.colors.warningBorder);
      expect(softTag.childNodes[0].state.style.fillStyle).toBe(ICE_LIGHT_THEME.colors.warningTextEmphasis);
    });

    it('creates avatar and icon text nodes', () => {
      const avatar = new ICEAvatar({ text: 'A', size: 48 });
      expect(avatar.childNodes).toHaveLength(2);
      avatar.setText('B');
      expect(avatar.childNodes[1].state.text).toBe('B');

      const icon = new ICEIcon({ icon: '★' });
      icon.setIcon('✓');
      expect(icon.childNodes[0].state.text).toBe('✓');
    });

    it('creates a separator with border colour', () => {
      const separator = new ICESeparator({ width: 100, height: 1 });
      expect(separator.childNodes[0].state.style.fillStyle).toBe(ICE_LIGHT_THEME.colors.border);
    });
  });

  describe('selection controls', () => {
    it('toggles checkbox on mousedown and disables primitive interaction', () => {
      const checkbox = new ICECheckBox();
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
      const radio = new ICERadioButton();
      radio.trigger('mousedown', {});
      expect(radio.isSelected()).toBe(true);
      radio.trigger('mousedown', {});
      expect(radio.isSelected()).toBe(true);
    });

    it('toggles switch on mousedown and moves knob', () => {
      const toggle = new ICESwitch({ width: 52, height: 26 });
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
      const progress = new ICEProgressBar({ value: 40, min: 0, max: 100, width: 200, height: 10 });
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
      const slider = new ICESlider({ value: 30, min: 0, max: 100, width: 200, height: 18 });
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
      const card = new ICECard({ title: 'First', width: 260, height: 160 });
      card.setTitle('Second');
      expect(card.childNodes[0].state.text).toBe('Second');
    });

    it('tabs activate selected index and update child button label colour', () => {
      const tabs = new ICETabs({ tabs: ['A', 'B', 'C'], width: 300, height: 40 });
      expect(tabs.getActiveIndex()).toBe(0);
      tabs.setActiveIndex(2);
      expect(tabs.getActiveIndex()).toBe(2);
      const activeButton = tabs.childNodes[2] as ICEButton;
      expect(activeButton.state.style.fillStyle).toBe(ICE_LIGHT_THEME.colors.primary);
      expect(activeButton.childNodes[0].state.style.fillStyle).toBe(ICE_LIGHT_THEME.colors.primaryText);
    });

    it('positions box layout children with gaps', () => {
      const panel = new ICEPanel({ width: 320, height: 80 });
      panel.setLayout(new ICEBoxLayout({ axis: 'x', gap: 12 }));
      const first = new ICELabel({ text: 'a', width: 40, height: 20 });
      const second = new ICELabel({ text: 'b', width: 40, height: 20 });
      panel.addChildren([first, second]);
      expect(first.state.left).toBe(0);
      expect(second.state.left).toBe(52);
    });

    it('creates flow layout with left alignment', () => {
      const layout = new ICEFlowLayout({ gap: 8, align: 'left' });
      expect(layout).toBeTruthy();
    });
  });
});
