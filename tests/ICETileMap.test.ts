/**
 * ICETileMap 规格（自绘棋盘组件：一个节点画完整块网格）。
 *
 * 为什么要有它：棋盘类界面（俄罗斯方块 / 贪吃蛇 / 扫雷 / 座位图 / 热力图）如果「一格一个
 * 组件」，200 格就是 200 个节点、每次变化全量 setState。这个组件把整块网格收进**一个**
 * 组件的 `doRender()` 里，用引擎的 ctx 直接画 —— 节点数从 N 降到 1。
 *
 * 规格：
 * - 尺寸：默认 `cols * cellSize` × `rows * cellSize`，可用 width/height 覆盖；
 * - 几何：`getCellRect` 给出格子的内缩矩形（gap 均分在两边），`getCellAt` 是其反查；
 * - 数据：`setTiles` 接受一维 / 二维数组，长度必须等于 rows*cols（错了直接抛，属于编程错误）；
 *   未知调色板 key 不画；**数据没变就不置 dirty**（脏矩形模式下这很关键）；
 * - 高亮：`setHighlights` 是常驻描边层（幽灵落点用），`pulse` 是用 tween 淡出的瞬时层；
 * - `getPaintCount()` 记录自绘次数，用来证明「真的是自绘」而不是堆子节点。
 */
import { ICETileMap } from '../src/components/ICETileMap';

/** 手动推进的 frame driver（和 ICEAnimation 单测同一套路，不依赖真实 rAF）。 */
function makeDriver() {
  let queue: Array<(time: number) => void> = [];
  return {
    driver: {
      request(callback: (time: number) => void) {
        queue.push(callback);
        return queue.length;
      },
      cancel(handle: any) {
        queue.splice(Number(handle) - 1, 1);
      },
    },
    step(time: number) {
      const pending = queue;
      queue = [];
      pending.forEach((callback) => callback(time));
    },
  };
}

const makeMap = (options: any = {}) => new ICETileMap({ rows: 4, cols: 5, cellSize: 20, gap: 2, ...options });

describe('尺寸与几何', () => {
  it('默认尺寸 = cols × rows 个格子，不产生任何子节点', () => {
    const map = makeMap();
    expect(map.getRows()).toBe(4);
    expect(map.getCols()).toBe(5);
    expect(map.getCellSize()).toBe(20);
    expect(map.state.width).toBe(100);
    expect(map.state.height).toBe(80);
    expect(map.childNodes).toHaveLength(0);
  });

  it('显式 width/height 覆盖默认尺寸，几何仍按 cellSize 排', () => {
    const map = makeMap({ width: 400, height: 400 });
    expect([map.state.width, map.state.height]).toEqual([400, 400]);
    expect(map.getCellRect(0, 0)).toEqual({ left: 1, top: 1, width: 18, height: 18 });
    // 格子只占 cols/cellSize 那么大，多出来的空间留着（组件可居中摆放在里面）
    expect(map.getCellRect(3, 4)).toEqual({ left: 81, top: 61, width: 18, height: 18 });
  });

  it('getCellAt 是 getCellRect 的反查（含边界与越界）', () => {
    const map = makeMap();
    expect(map.getCellAt(1, 1)).toEqual({ row: 0, col: 0 });
    expect(map.getCellAt(19, 19)).toEqual({ row: 0, col: 0 });
    expect(map.getCellAt(21, 41)).toEqual({ row: 2, col: 1 });
    expect(map.getCellAt(-1, 5)).toBeNull();
    expect(map.getCellAt(5, -1)).toBeNull();
    expect(map.getCellAt(100, 5)).toBeNull(); // 正好在右边界外（col 5 不存在）
    expect(map.getCellAt(5, 80)).toBeNull();
  });
});

describe('数据与调色板', () => {
  const PALETTE = {
    a: { fillStyle: '#111111', strokeStyle: '#000000' },
    b: { fillStyle: '#222222' },
  };

  it('setTiles 支持一维与二维，getTiles 永远返回一维', () => {
    const map = makeMap({ rows: 2, cols: 2 });
    map.setTiles(['a', null, 'b', null]);
    // 长度不足 → 抛错（编程错误要早点炸）
    expect(() => map.setTiles(['a'])).toThrow();
    map.setTiles([
      ['a', 'b'],
      [null, 'a'],
    ]);
    expect(map.getTiles()).toHaveLength(4);
    expect(map.getTiles()).toEqual(['a', 'b', null, 'a']);
  });

  it('setPalette / getPalette 返回拷贝，未知 key 解析为「不画」', () => {
    const map = makeMap({ palette: PALETTE });
    expect(map.resolveCellStyle('a')).toEqual(PALETTE.a);
    expect(map.resolveCellStyle('nope')).toBeNull();
    map.setPalette({ c: { fillStyle: '#333333' } });
    const palette = map.getPalette();
    palette.c = { fillStyle: '#999999' } as any;
    expect(map.resolveCellStyle('c')).toEqual({ fillStyle: '#333333' });
  });

  it('数据没变就不置 dirty（脏矩形模式下别白刷）', () => {
    const map = makeMap({ rows: 2, cols: 2, palette: PALETTE });
    map.setTiles(['a', null, 'b', null]);
    map.dirty = false;
    map.setTiles(['a', null, 'b', null]);
    expect(map.dirty).toBe(false);
    map.setTiles(['a', 'b', 'b', null]);
    expect(map.dirty).toBe(true);
  });

  it('设置数据会置 dirty，并且自绘次数随重绘增加', () => {
    const map = makeMap({ rows: 1, cols: 1, palette: PALETTE });
    map.dirty = false;
    map.setTiles(['a']);
    expect(map.dirty).toBe(true);
    expect(map.getPaintCount()).toBe(0);
    // 单测里没有渲染管线，直接调一次内部绘制入口（浏览器里由 render() 驱动）
    map.paintBoard();
    map.paintBoard();
    expect(map.getPaintCount()).toBe(2);
  });

  it('自绘坐标要减掉 localOrigin（引擎的局部原点是组件中心）', () => {
    const map = makeMap({ rows: 1, cols: 1, cellSize: 20, gap: 2, cellRadius: 0, palette: { a: { fillStyle: '#ff0000' } } });
    const calls: any[] = [];
    map.ctx = {
      beginPath() {},
      rect(x: number, y: number, w: number, h: number) {
        calls.push(['rect', x, y, w, h]);
      },
      moveTo() {},
      lineTo() {},
      arcTo() {},
      closePath() {},
      fill() {
        calls.push(['fill']);
      },
      stroke() {
        calls.push(['stroke']);
      },
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      globalAlpha: 1,
    } as any;
    // 渲染管线在 applyTransformToCtx 里算好 localOrigin（默认 localCenter = 宽高的一半）
    map.state.localOrigin = [10, 10];
    map.setTiles(['a']);
    map.paintBoard();
    // 格子内缩后的矩形是 (1,1,18,18)，减掉 localOrigin(10,10) → (-9,-9,18,18)
    expect(calls[0]).toEqual(['rect', -9, -9, 18, 18]);
  });
});

describe('高亮与脉冲', () => {
  it('setHighlights 置 dirty、返回拷贝，可清空', () => {
    const map = makeMap();
    map.dirty = false;
    map.setHighlights([{ row: 1, col: 2, fillStyle: 'rgba(255,255,255,0.2)' }]);
    expect(map.dirty).toBe(true);
    const list = map.getHighlights();
    expect(list).toHaveLength(1);
    list.push({ row: 0, col: 0 });
    expect(map.getHighlights()).toHaveLength(1);
    map.setHighlights([]);
    expect(map.getHighlights()).toHaveLength(0);
  });

  it('pulse：用注入的 driver 推进，alpha 1 → 0，结束后清掉', () => {
    const map = makeMap();
    const { driver, step } = makeDriver();
    expect(map.getPulseAlpha()).toBe(0);
    map.pulse([{ row: 0, col: 1 }], { duration: 100, driver, color: '#ffffff' });
    step(0);
    expect(map.getPulseAlpha()).toBe(1);
    step(50);
    expect(map.getPulseAlpha()).toBeCloseTo(0.5, 2);
    step(100);
    expect(map.getPulseAlpha()).toBe(0);
    expect(map.getPulses()).toHaveLength(0);
  });
});

describe('标签层（2048 这类要显示数字的棋盘）', () => {
  /** 记录 fillText 的假 ctx。 */
  const makeTextCtx = () => {
    const calls: any[] = [];
    const ctx = {
      beginPath() {},
      rect() {},
      moveTo() {},
      lineTo() {},
      arcTo() {},
      closePath() {},
      fill() {},
      stroke() {},
      save() {},
      restore() {},
      fillText(text: string, x: number, y: number) {
        calls.push({ text, x, y, font: ctx.font, fillStyle: ctx.fillStyle, align: ctx.textAlign, baseline: ctx.textBaseline });
      },
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      globalAlpha: 1,
      font: '',
      textAlign: 'start',
      textBaseline: 'alphabetic',
    } as any;
    return { ctx, calls };
  };

  const PALETTE = {
    '2': { fillStyle: '#eee4da', fontSize: 28, fontWeight: '700', textColor: '#776e65' },
    '4': { fillStyle: '#ede0c8', fontSize: 28, fontWeight: '700', textColor: '#776e65' },
  };

  it('setLabels 支持一维 / 二维，长度不对会抛；返回的是拷贝', () => {
    const map = makeMap({ rows: 2, cols: 2 });
    map.setLabels([
      ['2', null],
      [null, '4'],
    ]);
    expect(map.getLabels()).toEqual(['2', null, null, '4']);
    const copy = map.getLabels();
    copy[0] = 'x';
    expect(map.getLabels()[0]).toBe('2');
    expect(() => map.setLabels(['2'])).toThrow();
  });

  it('标签没变不置 dirty，变了才置', () => {
    const map = makeMap({ rows: 1, cols: 2 });
    map.setLabels(['2', null]);
    map.dirty = false;
    map.setLabels(['2', null]);
    expect(map.dirty).toBe(false);
    map.setLabels(['4', null]);
    expect(map.dirty).toBe(true);
  });

  it('自绘时把标签居中画在格子里（字体 / 颜色取调色板），空格不画', () => {
    const map = makeMap({ rows: 1, cols: 2, cellSize: 20, gap: 2, cellRadius: 0, palette: PALETTE });
    const { ctx, calls } = makeTextCtx();
    map.ctx = ctx;
    map.state.localOrigin = [20, 10];
    map.setTiles(['2', '4']);
    map.setLabels(['2', null]);
    map.paintBoard();
    expect(calls).toHaveLength(1);
    expect(calls[0].text).toBe('2');
    // 格子内缩后是 (1,1,18,18)，中心 (10,10)，减掉 localOrigin(20,10) → (-10, 0)
    expect([calls[0].x, calls[0].y]).toEqual([-10, 0]);
    expect(calls[0].align).toBe('center');
    expect(calls[0].baseline).toBe('middle');
    expect(calls[0].font).toContain('28px');
    expect(calls[0].font).toContain('700');
    expect(calls[0].fillStyle).toBe('#776e65');
  });

  it('没有调色板项的空格（null）照常不画，标签也不会画', () => {
    const map = makeMap({ rows: 1, cols: 2, cellSize: 20, gap: 2, palette: PALETTE });
    const { ctx, calls } = makeTextCtx();
    map.ctx = ctx;
    map.state.localOrigin = [20, 10];
    map.setTiles([null, '4']);
    map.setLabels(['9', '4']);
    map.paintBoard();
    expect(calls).toHaveLength(1);
    expect(calls[0].text).toBe('4');
  });
});
