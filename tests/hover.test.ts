import { EventBus } from 'ice-render';
import { UIHoverManager } from '../src';

function hoverComponent(id: string, zIndex: number, contains: (x: number) => boolean) {
  return {
    state: { id, zIndex, interactive: true },
    childNodes: [],
    setHovered: jest.fn(),
    containsPoint: (x: number) => contains(x),
  };
}

describe('UIHoverManager', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('tracks the topmost hovered component on mousemove', () => {
    const bus = new EventBus();
    const left = hoverComponent('left', 1, (x) => x < 10);
    const right = hoverComponent('right', 2, (x) => x >= 10);
    const ice = {
      evtBus: bus,
      childNodes: [left, right],
      canvasEl: null,
      root: {},
      screenToWorld: (x: number, y: number) => [x, y],
    };

    const manager = new UIHoverManager(ice).start();
    bus.trigger('mousemove', { offsetX: 5, offsetY: 5 });
    jest.advanceTimersByTime(20);

    expect(left.setHovered).toHaveBeenCalledWith(true);
    expect(right.setHovered).not.toHaveBeenCalledWith(true);

    bus.trigger('mousemove', { offsetX: 15, offsetY: 5 });
    jest.advanceTimersByTime(20);

    expect(left.setHovered).toHaveBeenCalledWith(false);
    expect(right.setHovered).toHaveBeenCalledWith(true);
    manager.stop();
  });

  it('clears hover when stopped', () => {
    const bus = new EventBus();
    const target = hoverComponent('target', 1, () => true);
    const ice = {
      evtBus: bus,
      childNodes: [target],
      canvasEl: null,
      root: {},
      screenToWorld: (x: number, y: number) => [x, y],
    };

    const manager = new UIHoverManager(ice).start();
    bus.trigger('mousemove', { offsetX: 3, offsetY: 3 });
    jest.advanceTimersByTime(20);
    expect(target.setHovered).toHaveBeenCalledWith(true);

    manager.stop();
    expect(target.setHovered).toHaveBeenCalledWith(false);
  });
});
