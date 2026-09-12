/**
 * ICECarousel 单测（轮播）。
 *
 * 规格：
 * - 一次只露出一屏：轨道 left = -index * width，幻灯片横向排列；
 * - goTo / next / prev 切换；loop:false 时到边界不再动、不回调；
 * - 箭头按钮与圆点都能切换；圆点数量 = 幻灯片数量；
 * - 过渡用可注入 frame driver 的补间，duration:0 时同步落位（测试确定性）；
 * - 自动播放走可注入的调度器，play/pause 可控。
 */
import { ICECarousel, ICECarouselScheduler, ICECarouselFrameDriver } from '../src/components/ICECarousel';
import { ICEWidget } from '../src/core/ICEWidget';

function makeSlides(count: number): ICEWidget[] {
  return Array.from({ length: count }, (_, i) => new ICEWidget({ width: 200, height: 100, id: `slide-${i}` }));
}

function makeScheduler() {
  const tasks = new Map<any, () => void>();
  let handle = 0;
  const scheduler: ICECarouselScheduler = {
    setInterval(handler: () => void) {
      handle += 1;
      tasks.set(handle, handler);
      return handle;
    },
    clearInterval(id: any) {
      tasks.delete(id);
    },
  };
  return {
    scheduler,
    tick() {
      Array.from(tasks.values()).forEach((handler) => handler());
    },
    get size() {
      return tasks.size;
    },
  };
}

function makeDriver() {
  let pending: Array<(time: number) => void> = [];
  let time = 0;
  const driver: ICECarouselFrameDriver = {
    request(callback) {
      pending.push(callback);
      return pending.length;
    },
    cancel() {
      pending = [];
    },
  };
  return {
    driver,
    step(ms: number) {
      time += ms;
      const running = pending;
      pending = [];
      running.forEach((callback) => callback(time));
    },
  };
}

describe('ICECarousel', () => {
  it('初始化与 goTo：轨道位移 = -index * width，onChange 回调', () => {
    const changes: number[] = [];
    const carousel = new ICECarousel({
      width: 200,
      height: 100,
      slides: makeSlides(3),
      duration: 0,
      onChange: (index: number) => changes.push(index),
    });
    expect(carousel.getCount()).toBe(3);
    expect(carousel.getIndex()).toBe(0);
    expect(carousel.getTrackNode()!.state.left).toBe(0);

    carousel.goTo(2);
    expect(carousel.getIndex()).toBe(2);
    expect(carousel.getTrackNode()!.state.left).toBe(-400);
    expect(changes).toEqual([2]);

    carousel.goTo(2);
    expect(changes).toEqual([2]); // 同 index 不重复回调
    expect(carousel.getSlideNode(1)).not.toBeNull();
    expect(carousel.getSlideNode(1)!.state.left).toBe(200);
  });

  it('next / prev 循环；loop:false 到边界停住', () => {
    const changes: number[] = [];
    const carousel = new ICECarousel({
      width: 200,
      height: 100,
      slides: makeSlides(3),
      duration: 0,
      onChange: (index: number) => changes.push(index),
    });
    carousel.prev();
    expect(carousel.getIndex()).toBe(2); // 循环回末尾
    carousel.next();
    expect(carousel.getIndex()).toBe(0);

    const strict = new ICECarousel({ width: 200, height: 100, slides: makeSlides(3), duration: 0, loop: false });
    strict.prev();
    expect(strict.getIndex()).toBe(0);
    strict.goTo(2);
    strict.next();
    expect(strict.getIndex()).toBe(2);
  });

  it('箭头与圆点可切换；圆点数量 = 幻灯片数量', () => {
    const carousel = new ICECarousel({ width: 200, height: 100, slides: makeSlides(3), duration: 0 });
    expect(carousel.getDotNode(0)).not.toBeNull();
    expect(carousel.getDotNode(2)).not.toBeNull();
    expect(carousel.getDotNode(3)).toBeNull();

    carousel.getNextButton()!.trigger('click', null, {});
    expect(carousel.getIndex()).toBe(1);
    carousel.getPrevButton()!.trigger('click', null, {});
    expect(carousel.getIndex()).toBe(0);

    carousel.getDotNode(2)!.trigger('click', null, {});
    expect(carousel.getIndex()).toBe(2);
  });

  it('过渡补间：中间态在两端之间，结束落到目标', () => {
    const { driver, step } = makeDriver();
    const carousel = new ICECarousel({
      width: 200,
      height: 100,
      slides: makeSlides(3),
      duration: 200,
      driver,
    });
    carousel.goTo(2);
    expect(carousel.getTrackNode()!.state.left).toBe(0); // 还没走帧
    step(16); // 第一帧只用来建立起始时间
    expect(carousel.getTrackNode()!.state.left).toBe(0);
    step(100);
    const mid = carousel.getTrackNode()!.state.left;
    expect(mid).toBeLessThan(0);
    expect(mid).toBeGreaterThan(-400);
    step(120);
    expect(carousel.getTrackNode()!.state.left).toBe(-400);
  });

  it('自动播放：play 按间隔推进、pause 停止', () => {
    const fake = makeScheduler();
    const carousel = new ICECarousel({
      width: 200,
      height: 100,
      slides: makeSlides(3),
      duration: 0,
      autoplay: 1000,
      scheduler: fake.scheduler,
    });
    expect(carousel.isPlaying()).toBe(false);
    carousel.play();
    expect(carousel.isPlaying()).toBe(true);
    expect(fake.size).toBe(1);
    fake.tick();
    expect(carousel.getIndex()).toBe(1);
    fake.tick();
    expect(carousel.getIndex()).toBe(2);
    carousel.pause();
    expect(carousel.isPlaying()).toBe(false);
    expect(fake.size).toBe(0);
  });

  it('setSlides 重建；空列表不崩', () => {
    const carousel = new ICECarousel({ width: 200, height: 100, slides: makeSlides(2), duration: 0 });
    carousel.setSlides(makeSlides(4));
    expect(carousel.getCount()).toBe(4);
    expect(carousel.getDotNode(3)).not.toBeNull();
    carousel.setSlides([]);
    expect(carousel.getCount()).toBe(0);
    carousel.next();
    expect(carousel.getIndex()).toBe(0);
  });
});
