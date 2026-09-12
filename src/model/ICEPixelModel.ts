/**
 * 像素画布的纯逻辑模型（不碰 canvas）。
 *
 * 用途：像素编辑器（`examples/pixel-editor.html`）—— 模型只管「一格一格的调色板索引 +
 * 历史 + 导出」，页面负责把它画成节点、把导出结果变成下载文件。
 *
 * 约定：
 * - 画布是 `rows × cols` 的一维数组（行优先），存**调色板下标**，不是颜色字符串；
 *   `getCells()` 返回副本，页面怎么折腾都不会改到模型内部；
 * - `setPixel` / `drawLine` / `drawRect` / `fill` / `clear` 都是**实时改动**，
 *   改完由调用方 `commit()` 落一次历史 —— 一次拖动笔画 = 一次 commit = 一次撤销，
 *   而不是每个像素一次（1024 格画布上这区别就是「能用」和「不能用」）；
 * - `undo()` / `redo()` 回放**已提交**的快照；没提交的实时改动会被丢掉（编辑器常规语义）；
 * - `toSVG()` 把同色横向连续像素合并成一个 `<rect>`（run-length）：1024 格也不会吐出 1024 个元素；
 * - `toRGBA(scale)` 直接喂 `ImageData`（PNG 导出），纯函数、可单测。
 */
import { ICEHistoryModel } from './ICEHistoryModel';

export interface ICEPixelModelOptions {
  rows?: number;
  cols?: number;
  /** 调色板（`#rgb` / `#rrggbb`），下标就是画布上存的值；不传给一组默认色 */
  palette?: string[];
  /** 背景色下标，默认 0 */
  background?: number;
  /** 最多能撤销几步，默认 50 */
  limit?: number;
}

export interface ICEPixelSVGOptions {
  /** 每个像素在 SVG 里占多少单位，默认 16 */
  cellSize?: number;
  /** 是否画一层背景矩形，默认 true */
  background?: boolean;
}

export type ICEPixelListener = (model: ICEPixelModel) => void;

/** 默认调色板：Bootstrap 语义色 + 黑白灰（够画像素画，也不刺眼）。 */
export const ICE_PIXEL_DEFAULT_PALETTE = [
  '#ffffff',
  '#212529',
  '#adb5bd',
  '#dc3545',
  '#fd7e14',
  '#ffc107',
  '#198754',
  '#20c997',
  '#0dcaf0',
  '#0d6efd',
  '#6f42c1',
  '#d63384',
];

const COLOR_PATTERN = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** `#rgb` / `#rrggbb` → [r, g, b]；认不出来当黑色（画布上永远有个确定的结果）。 */
export function icePixelParseColor(color: string): [number, number, number] {
  const value = String(color || '').trim();
  if (!COLOR_PATTERN.test(value)) {
    return [0, 0, 0];
  }
  const hex = value.slice(1);
  const full = hex.length === 3 ? hex.split('').map((char) => char + char).join('') : hex;
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}

export class ICEPixelModel {
  private rows: number;
  private cols: number;
  private palette: string[];
  private background: number;
  private cells: number[];
  private history: ICEHistoryModel<number[]>;
  private listeners: ICEPixelListener[] = [];
  private dirty = false;

  constructor(options: ICEPixelModelOptions = {}) {
    this.rows = Math.max(1, Math.floor(options.rows === undefined ? 32 : options.rows));
    this.cols = Math.max(1, Math.floor(options.cols === undefined ? 32 : options.cols));
    this.palette = (options.palette && options.palette.length ? options.palette : ICE_PIXEL_DEFAULT_PALETTE).map((color) => String(color));
    this.background = this.__normalizeColor(options.background === undefined ? 0 : options.background);
    this.cells = new Array(this.rows * this.cols).fill(this.background);
    this.history = new ICEHistoryModel<number[]>({ limit: options.limit === undefined ? 50 : options.limit, initial: this.cells.slice() });
  }

  // ------------------------------------------------------------------ 查询
  public getRows(): number { return this.rows; }
  public getCols(): number { return this.cols; }
  public getPalette(): string[] { return this.palette.slice(); }
  public getBackground(): number { return this.background; }
  /** 画布副本（行优先）。 */
  public getCells(): number[] { return this.cells.slice(); }
  public getPixel(row: number, col: number): number {
    if (!this.__inside(row, col)) return this.background;
    return this.cells[row * this.cols + col];
  }
  /** 有没提交的改动（页面据此把「保存 / 导出」按钮点亮）。 */
  public isDirty(): boolean { return this.dirty; }
  public canUndo(): boolean { return this.history.canUndo(); }
  public canRedo(): boolean { return this.history.canRedo(); }
  public getHistoryDepth(): { undo: number; redo: number } { return this.history.getDepth(); }

  // ------------------------------------------------------------------ 编辑
  /**
   * 画一个像素。返回「真的改了」—— 越界、颜色非法、值没变都返回 false，
   * 这样页面可以放心地在拖动回调里调用它（不会刷出一堆无意义的重绘）。
   */
  public setPixel(row: number, col: number, color: number): boolean {
    if (!this.__inside(row, col)) return false;
    const value = this.__normalizeColor(color);
    const index = row * this.cols + col;
    if (this.cells[index] === value) return false;
    this.cells[index] = value;
    this.dirty = true;
    this.notify();
    return true;
  }

  /** Bresenham 直线（铅笔拖动、直线工具都走它）。 */
  public drawLine(row0: number, col0: number, row1: number, col1: number, color: number): boolean {
    let changed = false;
    this.getLineCells(row0, col0, row1, col1).forEach(([row, col]) => {
      changed = this.setPixel(row, col, color) || changed;
    });
    return changed;
  }

  /**
   * 直线经过的格子坐标（Bresenham）。
   * 单独暴露出来是给**预览**用的：拖直线 / 拖矩形时先拿坐标点亮高亮层，松手才真正落笔。
   */
  public getLineCells(row0: number, col0: number, row1: number, col1: number): Array<[number, number]> {
    const cells: Array<[number, number]> = [];
    let row = Math.floor(row0);
    let col = Math.floor(col0);
    const endRow = Math.floor(row1);
    const endCol = Math.floor(col1);
    const deltaCol = Math.abs(endCol - col);
    const deltaRow = Math.abs(endRow - row);
    const stepCol = col < endCol ? 1 : -1;
    const stepRow = row < endRow ? 1 : -1;
    let error = deltaCol - deltaRow;
    // 循环上界防御：即使调用方传了 NaN 也不会转不出来
    for (let guard = 0; guard < deltaCol + deltaRow + 2; guard += 1) {
      cells.push([row, col]);
      if (row === endRow && col === endCol) break;
      const doubled = error * 2;
      if (doubled > -deltaRow) {
        error -= deltaRow;
        col += stepCol;
      }
      if (doubled < deltaCol) {
        error += deltaCol;
        row += stepRow;
      }
    }
    return cells;
  }

  /** 矩形**描边**经过的格子坐标（和 drawRect 同一套口径，供预览用）。 */
  public getRectCells(row0: number, col0: number, row1: number, col1: number): Array<[number, number]> {
    const top = Math.min(Math.floor(row0), Math.floor(row1));
    const bottom = Math.max(Math.floor(row0), Math.floor(row1));
    const left = Math.min(Math.floor(col0), Math.floor(col1));
    const right = Math.max(Math.floor(col0), Math.floor(col1));
    const seen = new Set<string>();
    const cells: Array<[number, number]> = [];
    [
      ...this.getLineCells(top, left, top, right),
      ...this.getLineCells(bottom, left, bottom, right),
      ...this.getLineCells(top, left, bottom, left),
      ...this.getLineCells(top, right, bottom, right),
    ].forEach(([row, col]) => {
      const key = `${row},${col}`;
      if (seen.has(key)) return;
      seen.add(key);
      cells.push([row, col]);
    });
    return cells;
  }

  /** 矩形描边（只画框，不填内部）。 */
  public drawRect(row0: number, col0: number, row1: number, col1: number, color: number): boolean {
    let changed = false;
    this.getRectCells(row0, col0, row1, col1).forEach(([row, col]) => {
      changed = this.setPixel(row, col, color) || changed;
    });
    return changed;
  }

  /**
   * 四邻域油漆桶（迭代版，不用递归 —— 大画布上递归会爆栈）。
   * 目标和填充色相同、或起点越界时返回 false。
   */
  public fill(row: number, col: number, color: number): boolean {
    if (!this.__inside(row, col)) return false;
    const startRow = Math.floor(row);
    const startCol = Math.floor(col);
    const target = this.cells[startRow * this.cols + startCol];
    const value = this.__normalizeColor(color);
    if (target === value) return false;

    const stack: number[] = [startRow * this.cols + startCol];
    while (stack.length) {
      const index = stack.pop() as number;
      if (this.cells[index] !== target) continue;
      this.cells[index] = value;
      this.dirty = true;
      const currentRow = Math.floor(index / this.cols);
      const currentCol = index % this.cols;
      if (currentRow > 0) stack.push(index - this.cols);
      if (currentRow < this.rows - 1) stack.push(index + this.cols);
      if (currentCol > 0) stack.push(index - 1);
      if (currentCol < this.cols - 1) stack.push(index + 1);
    }
    this.notify();
    return true;
  }

  /** 整块刷成某个颜色（清空 / 填充背景）。 */
  public clear(color?: number): boolean {
    const value = this.__normalizeColor(color === undefined ? this.background : color);
    if (this.cells.every((cell) => cell === value)) return false;
    this.cells.fill(value);
    this.dirty = true;
    this.notify();
    return true;
  }

  /** 换尺寸：重新铺一块空画布（旧内容不留，历史也重开）。 */
  public resize(rows: number, cols: number): void {
    const nextRows = Math.max(1, Math.floor(rows));
    const nextCols = Math.max(1, Math.floor(cols));
    this.rows = nextRows;
    this.cols = nextCols;
    this.cells = new Array(nextRows * nextCols).fill(this.background);
    this.dirty = false;
    this.history.clear(this.cells.slice());
    this.notify();
  }

  // ------------------------------------------------------------------ 历史
  /** 把当前画布落一次历史（一次笔画 / 一次图形操作调用一次）。返回是否真的入了栈。 */
  public commit(): boolean {
    if (!this.dirty) return false;
    this.history.push(this.cells.slice());
    this.dirty = false;
    this.notify();
    return true;
  }

  public undo(): boolean {
    const snapshot = this.history.undo();
    if (!snapshot) return false;
    this.__restore(snapshot);
    return true;
  }

  public redo(): boolean {
    const snapshot = this.history.redo();
    if (!snapshot) return false;
    this.__restore(snapshot);
    return true;
  }

  // ------------------------------------------------------------------ 导出
  public toSVG(options: ICEPixelSVGOptions = {}): string {
    const cellSize = Math.max(1, Math.floor(options.cellSize === undefined ? 16 : options.cellSize));
    const width = this.cols * cellSize;
    const height = this.rows * cellSize;
    const parts: string[] = [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges">`,
    ];
    if (options.background !== false) {
      parts.push(`<rect x="0" y="0" width="${width}" height="${height}" fill="${this.palette[this.background]}"/>`);
    }
    for (let row = 0; row < this.rows; row += 1) {
      let col = 0;
      while (col < this.cols) {
        const value = this.cells[row * this.cols + col];
        let end = col;
        while (end + 1 < this.cols && this.cells[row * this.cols + end + 1] === value) {
          end += 1;
        }
        if (value !== this.background || options.background === false) {
          parts.push(
            `<rect x="${col * cellSize}" y="${row * cellSize}" width="${(end - col + 1) * cellSize}" height="${cellSize}" fill="${this.palette[value]}"/>`,
          );
        }
        col = end + 1;
      }
    }
    parts.push('</svg>');
    return parts.join('\n');
  }

  /** 给 `new ImageData(rgba, cols * scale, rows * scale)` 用的 RGBA 数组。 */
  public toRGBA(scale: number = 1): Uint8ClampedArray {
    const factor = Math.max(1, Math.floor(scale));
    const width = this.cols * factor;
    const height = this.rows * factor;
    const data = new Uint8ClampedArray(width * height * 4);
    const colors = this.palette.map((color) => icePixelParseColor(color));
    for (let row = 0; row < height; row += 1) {
      const sourceRow = Math.floor(row / factor);
      for (let col = 0; col < width; col += 1) {
        const sourceCol = Math.floor(col / factor);
        const value = this.cells[sourceRow * this.cols + sourceCol] || 0;
        const [r, g, b] = colors[value] || [0, 0, 0];
        const offset = (row * width + col) * 4;
        data[offset] = r;
        data[offset + 1] = g;
        data[offset + 2] = b;
        data[offset + 3] = 255;
      }
    }
    return data;
  }

  public toJSON(): string {
    return JSON.stringify({ rows: this.rows, cols: this.cols, palette: this.palette, background: this.background, cells: this.cells });
  }

  /** 反序列化；坏数据抛错而不是静默给一块白板（导入失败得让人看见）。 */
  public static fromJSON(json: string): ICEPixelModel {
    let parsed: any;
    try {
      parsed = JSON.parse(json);
    } catch (error) {
      throw new Error('ICEPixelModel: 像素画布数据不是合法 JSON');
    }
    const rows = Number(parsed && parsed.rows);
    const cols = Number(parsed && parsed.cols);
    const cells = parsed && parsed.cells;
    if (!Number.isFinite(rows) || !Number.isFinite(cols) || rows <= 0 || cols <= 0 || !Array.isArray(cells) || cells.length !== rows * cols) {
      throw new Error('ICEPixelModel: 像素画布数据缺字段或尺寸对不上');
    }
    const model = new ICEPixelModel({
      rows,
      cols,
      palette: Array.isArray(parsed.palette) ? parsed.palette : undefined,
      background: parsed.background,
    });
    model.cells = cells.map((value: unknown) => model.__normalizeColor(value));
    model.history.clear(model.cells.slice());
    return model;
  }

  public addChangeListener(listener: ICEPixelListener): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index !== -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  // ------------------------------------------------------------------ 内部
  private __inside(row: number, col: number): boolean {
    return Number.isFinite(row) && Number.isFinite(col) && row >= 0 && col >= 0 && row < this.rows && col < this.cols;
  }

  /** 非法下标一律当背景：画布上永远只有调色板里真实存在的颜色。 */
  private __normalizeColor(color: unknown): number {
    const value = Math.floor(Number(color));
    if (!Number.isFinite(value) || value < 0 || value >= this.palette.length) {
      return this.background;
    }
    return value;
  }

  private __restore(snapshot: number[]): void {
    this.cells = snapshot.slice();
    this.dirty = false;
    this.notify();
  }

  private notify(): void {
    [...this.listeners].forEach((listener) => listener(this));
  }
}

export default ICEPixelModel;
