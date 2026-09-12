import { ICEButtonModel, ICEToggleModel, ICEBoundedRangeModel } from '../src';

describe('UI models', () => {
  it('notifies button model changes', () => {
    const model = new ICEButtonModel();
    const listener = jest.fn();
    model.addChangeListener(listener);
    model.setPressed(true);
    model.setEnabled(false);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(model.isPressed()).toBe(true);
    expect(model.isEnabled()).toBe(false);
  });

  it('toggles boolean model without duplicate notifications', () => {
    const model = new ICEToggleModel();
    const listener = jest.fn();
    model.addChangeListener(listener);
    model.setSelected(true);
    model.setSelected(true);
    expect(model.isSelected()).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('clamps bounded range model values', () => {
    const model = new ICEBoundedRangeModel({ value: 20, min: 0, max: 100 });
    expect(model.getValue()).toBe(20);
    model.setValue(140);
    expect(model.getValue()).toBe(100);
    model.setValue(-10);
    expect(model.getValue()).toBe(0);
  });
});
