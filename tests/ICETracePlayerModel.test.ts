/**
 * 「轨迹播放器」的纯逻辑规格。
 *
 * 算法可视化（排序、寻路、正则匹配、Diff…）都是同一个套路：**先把整段过程算成一串帧，
 * 再按时间回放**。播放/暂停/单步/调速/进度/到头停住这套逻辑跟具体算法无关，
 * 所以单独抽出来 —— 算法只负责产帧，播放器只负责「第几帧、要不要走」。
 *
 * 约定：
 * - `load(frames)` 从头开始（游标 0、暂停）；
 * - `tick(dt)` 只在播放态推进，按 `stepsPerSecond` 换算：一帧 = 1000/speed 毫秒；
 *   一帧最多推进一帧（帧再长也不会「跳帧跳过内容」得太夸张，画面看得清）；
 * - 走到最后一帧自动停（`isFinished()` 为真，再 `play()` 从头开始）；
 * - 变速夹在 1..60 步/秒之间，非法值忽略。
 */
import { ICETracePlayerModel } from '../src/model/ICETracePlayerModel';

const frames = ['a', 'b', 'c', 'd'];

describe('ICETracePlayerModel', () => {
  it('load：游标归零、暂停、帧数正确', () => {
    const player = new ICETracePlayerModel<string>();
    expect(player.getFrame()).toBe(null);
    expect(player.getFrameCount()).toBe(0);
    player.load(frames);
    expect(player.getFrameCount()).toBe(4);
    expect(player.getIndex()).toBe(0);
    expect(player.getFrame()).toBe('a');
    expect(player.isPlaying()).toBe(false);
    expect(player.isFinished()).toBe(false);
  });

  it('单步前进 / 后退都在边界处停住', () => {
    const player = new ICETracePlayerModel<string>();
    player.load(frames);
    expect(player.stepBackward()).toBe(false);
    expect(player.stepForward()).toBe(true);
    expect(player.getFrame()).toBe('b');
    expect(player.stepForward()).toBe(true);
    expect(player.stepForward()).toBe(true);
    expect(player.getFrame()).toBe('d');
    expect(player.isFinished()).toBe(true);
    expect(player.stepForward()).toBe(false);
    expect(player.stepBackward()).toBe(true);
    expect(player.getFrame()).toBe('c');
    expect(player.isFinished()).toBe(false);
  });

  it('tick：按速度推进（10 步/秒 → 100ms 一帧），攒够几帧走几帧', () => {
    const player = new ICETracePlayerModel<string>();
    player.load(frames);
    player.setSpeed(10);
    player.play();
    expect(player.isPlaying()).toBe(true);
    expect(player.getFrame()).toBe('a');
    player.tick(100);
    expect(player.getFrame()).toBe('b');
    player.tick(250); // 攒了 2.5 帧 → 走两帧到末尾（剩下的 50ms 不用了）
    expect(player.getFrame()).toBe('d');
    expect(player.isFinished()).toBe(true);
    expect(player.isPlaying()).toBe(false);
  });

  it('暂停之后 tick 不推进', () => {
    const player = new ICETracePlayerModel<string>();
    player.load(frames);
    player.setSpeed(10);
    player.play();
    player.tick(100);
    player.pause();
    player.tick(1000);
    expect(player.getFrame()).toBe('b');
    expect(player.isPlaying()).toBe(false);
  });

  it('走到最后一帧自动停；再 play 会从头重放', () => {
    const player = new ICETracePlayerModel<string>();
    player.load(frames);
    player.setSpeed(60);
    player.play();
    player.tick(1000);
    expect(player.getFrame()).toBe('d');
    expect(player.isFinished()).toBe(true);
    expect(player.isPlaying()).toBe(false);
    player.play();
    expect(player.getIndex()).toBe(0);
    expect(player.isPlaying()).toBe(true);
  });

  it('seek / reset：直接跳帧与回到开头', () => {
    const player = new ICETracePlayerModel<string>();
    player.load(frames);
    player.seek(2);
    expect(player.getFrame()).toBe('c');
    expect(player.seek(99)).toBe(false); // 越界不动
    player.seek(1);
    expect(player.getProgress()).toBeCloseTo(1 / 3, 5);
    player.reset();
    expect(player.getIndex()).toBe(0);
    expect(player.isPlaying()).toBe(false);
  });

  it('速度夹在 1..60 之间，非法值忽略', () => {
    const player = new ICETracePlayerModel<string>();
    expect(player.getSpeed()).toBe(6);
    player.setSpeed(30);
    expect(player.getSpeed()).toBe(30);
    player.setSpeed(0);
    expect(player.getSpeed()).toBe(1);
    player.setSpeed(999);
    expect(player.getSpeed()).toBe(60);
    player.setSpeed(Number.NaN);
    expect(player.getSpeed()).toBe(60);
  });

  it('空轨迹：不崩，play 之后立刻算「到头」', () => {
    const player = new ICETracePlayerModel<string>();
    expect(player.getFrame()).toBe(null);
    player.play();
    player.tick(1000);
    expect(player.getFrame()).toBe(null);
    expect(player.isFinished()).toBe(true);
    expect(player.getProgress()).toBe(1);
  });

  it('变更通知：load / 单步 / 播放状态变化都会通知，取消订阅后不再通知', () => {
    const player = new ICETracePlayerModel<string>();
    let count = 0;
    const off = player.addChangeListener(() => { count += 1; });
    player.load(frames);
    expect(count).toBe(1);
    player.stepForward();
    expect(count).toBe(2);
    const before = count;
    player.tick(100); // 暂停中：什么都没变，不通知
    expect(count).toBe(before);
    player.play();
    expect(count).toBe(before + 1);
    off();
    player.stepForward();
    expect(count).toBe(before + 1);
  });
});
