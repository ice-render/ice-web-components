import { ICEWidget } from '../core/ICEWidget';
import { ICEFrameDriver, tween, ICETweenHandle } from '../util/ICEAnimation';

/**
 * 格子图（tile map）：**一个节点画完整块网格**。
 *
 * 棋盘类界面（俄罗斯方块 / 贪吃蛇 / 扫雷 / 座位图 / 热力图 / 仓库货位图）如果「一格一个
 * 组件」，200 格就是 200 个节点、每次变化全量 setState —— 脏矩形再聪明也架不住节点多。
 * 这个组件把整块网格收进一个组件的 `doRender()`：底板由 ICEWidget 自己画（它继承的是矩形
 * 容器），格子和高亮由这里用引擎的 ctx 直接绘制。
 *
 * 约定：
 * - `setTiles` 的长度不对**直接抛**（这是编程错误，不该静默画错图）；
 * - 数据没变不置 dirty —— 游戏每帧调它也不会白刷；
 * - 未知调色板 key 不画（留空），所以用 `null` 表示空格最省事；
 * - `pulse()` 用 tween 把透明度从 1 拉到 0，消行 / 吃到食物这种「闪一下」直接用它。
 */

/** 单个格子的绘制样式。 */
export interface ICETileMapCellStyle {
  fillStyle: string;
  strokeStyle?: string;
  lineWidth?: number;
  radius?: number;
  /** 有标签时用来画格子里的数字 / 文字（不填就用组件默认值） */
  fontSize?: number;
  fontWeight?: string;
  fontFamily?: string;
  textColor?: string;
}

/** 调色板：key → 样式。 */
export type ICETileMapPalette = Record<string, ICETileMapCellStyle>;

/** 常驻高亮（描边层，比如幽灵落点）。 */
export interface ICETileMapHighlight {
  row: number;
  col: number;
  fillStyle?: string;
  strokeStyle?: string;
  lineWidth?: number;
  radius?: number;
}

/** 瞬时脉冲（填充层，跟随 tween 淡出）。 */
export interface ICETileMapPulse {
  row: number;
  col: number;
  /** 覆盖脉冲颜色（默认取 `pulseColor` 选项） */
  color?: string;
}

export interface ICETileMapOptions {
  id?: string;
  left?: number;
  top?: number;
  rows: number;
  cols: number;
  /** 每格边长（含间隙），默认 20 */
  cellSize?: number;
  /** 格子之间的间隙，默认 2（均分在格子两边） */
  gap?: number;
  /** 格子圆角默认值，默认 4 */
  cellRadius?: number;
  /** 整块棋盘的宽高（默认 cols*cellSize / rows*cellSize；给大了就留白，便于居中摆放） */
  width?: number;
  height?: number;
  palette?: ICETileMapPalette;
  /** 脉冲默认颜色 */
  pulseColor?: string;
  /** 高亮默认描边色 */
  highlightColor?: string;
  /** 标签默认字号 / 颜色（格子样式里可以逐项覆盖） */
  labelFontSize?: number;
  labelColor?: string;
  [key: string]: any;
}

/** 圆角矩形路径：手写 arcTo（不依赖较新的 roundRect，老环境也能跑）。 */
function roundRectPath(ctx: any, x: number, y: number, width: number, height: number, radius: number): void {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  ctx.beginPath();
  if (r <= 0) {
    ctx.rect(x, y, width, height);
    return;
  }
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.arcTo(x + width, y, x + width, y + r, r);
  ctx.lineTo(x + width, y + height - r);
  ctx.arcTo(x + width, y + height, x + width - r, y + height, r);
  ctx.lineTo(x + r, y + height);
  ctx.arcTo(x, y + height, x, y + height - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

export class ICETileMap extends ICEWidget {
  private rows: number;
  private cols: number;
  private cellSize: number;
  private gap: number;
  private cellRadius: number;
  private palette: ICETileMapPalette = {};
  private tiles: Array<string | null> = [];
  /** 标签层：和 tiles 一一对应的文字（2048 的数字、扫雷的雷数都靠它） */
  private labels: Array<string | null> = [];
  /** 数据签名：用来跳过「值没变」的重复设置 */
  private tileKey = '';
  private labelKey = '';
  private highlights: ICETileMapHighlight[] = [];
  private pulses: ICETileMapPulse[] = [];
  private pulseAlpha = 0;
  private pulseHandle: ICETweenHandle | null = null;
  private pulseColor: string;
  private highlightColor: string;
  private labelFontSize: number;
  private labelColor: string;
  /** 自绘流程执行次数（浏览器里由 render() 驱动；单测可直接调 paintBoard()） */
  private paintCount = 0;

  constructor(props: ICETileMapOptions) {
    const rows = Math.max(1, Math.floor(props.rows || 1));
    const cols = Math.max(1, Math.floor(props.cols || 1));
    const cellSize = Math.max(2, Math.floor(props.cellSize || 20));
    const gap = Math.max(0, Math.floor(props.gap || 0));
    super({
      fill: false,
      stroke: false,
      ...props,
      width: props.width || cols * cellSize,
      height: props.height || rows * cellSize,
    });
    this.rows = rows;
    this.cols = cols;
    this.cellSize = cellSize;
    this.gap = gap;
    this.cellRadius = Math.max(0, Number(props.cellRadius === undefined ? 4 : props.cellRadius));
    this.pulseColor = props.pulseColor || 'rgba(255, 255, 255, 0.42)';
    this.highlightColor = props.highlightColor || 'rgba(255, 255, 255, 0.45)';
    this.labelFontSize = Math.max(6, Number(props.labelFontSize === undefined ? 12 : props.labelFontSize));
    this.labelColor = props.labelColor || '#ffffff';
    this.tiles = new Array(rows * cols).fill(null);
    this.labels = new Array(rows * cols).fill(null);
    this.setPalette(props.palette || {});
  }

  // ---------------------------------------------------------------- 几何

  public getRows(): number {
    return this.rows;
  }

  public getCols(): number {
    return this.cols;
  }

  public getCellSize(): number {
    return this.cellSize;
  }

  public getGap(): number {
    return this.gap;
  }

  /** 格子在组件内的矩形（gap 均分在两边）。 */
  public getCellRect(row: number, col: number): { left: number; top: number; width: number; height: number } {
    const inset = this.gap / 2;
    return {
      left: col * this.cellSize + inset,
      top: row * this.cellSize + inset,
      width: Math.max(1, this.cellSize - this.gap),
      height: Math.max(1, this.cellSize - this.gap),
    };
  }

  /** 组件内坐标 → 格子（边界外返回 null；落在间隙里算最近的格子）。 */
  public getCellAt(x: number, y: number): { row: number; col: number } | null {
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0) return null;
    const col = Math.floor(x / this.cellSize);
    const row = Math.floor(y / this.cellSize);
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return null;
    return { row, col };
  }

  // ---------------------------------------------------------------- 数据

  /** 设置格子数据：一维（长度 = rows*cols）或二维（rows 行）；数字会被当成字符串 key。 */
  public setTiles(tiles: Array<string | number | null> | Array<Array<string | number | null>>): this {
    const flat = this.__normalize(tiles).map((item) => (item === null || item === undefined ? null : String(item)));
    const key = flat.map((item) => (item === null || item === undefined ? '\u0000' : String(item))).join('\u0001');
    if (key === this.tileKey) return this;
    this.tileKey = key;
    this.tiles = flat;
    this.requestPaint();
    return this;
  }

  public getTiles(): Array<string | null> {
    return this.tiles.slice();
  }

  /** 设置标签层（和 tiles 一样长度，值可以是任意字符串）。 */
  public setLabels(labels: Array<string | number | null> | Array<Array<string | number | null>>): this {
    const flat = this.__normalize(labels).map((item) => (item === null || item === undefined ? null : String(item)));
    const key = flat.map((item) => (item === null ? '\u0000' : item)).join('\u0001');
    if (key === this.labelKey) return this;
    this.labelKey = key;
    this.labels = flat;
    this.requestPaint();
    return this;
  }

  public getLabels(): Array<string | null> {
    return this.labels.slice();
  }

  public setPalette(palette: ICETileMapPalette): this {
    const next: ICETileMapPalette = {};
    Object.keys(palette || {}).forEach((key) => {
      next[key] = { ...palette[key] };
    });
    this.palette = next;
    this.requestPaint();
    return this;
  }

  /** 调色板拷贝（改返回值不会影响组件内部）。 */
  public getPalette(): ICETileMapPalette {
    const copy: ICETileMapPalette = {};
    Object.keys(this.palette).forEach((key) => {
      copy[key] = { ...this.palette[key] };
    });
    return copy;
  }

  /** 某个 key 对应的样式（未知 key 返回 null = 不绘制）。 */
  public resolveCellStyle(key: string | null): ICETileMapCellStyle | null {
    if (key === null || key === undefined) return null;
    const style = this.palette[key];
    return style ? { ...style } : null;
  }

  // ---------------------------------------------------------------- 高亮 / 脉冲

  public setHighlights(highlights: ICETileMapHighlight[]): this {
    this.highlights = (highlights || []).map((item) => ({ ...item }));
    this.requestPaint();
    return this;
  }

  public getHighlights(): ICETileMapHighlight[] {
    return this.highlights.map((item) => ({ ...item }));
  }

  /** 闪一下（消行 / 吃到食物）：用 tween 把 alpha 从 1 拉到 0，结束后自动清空。 */
  public pulse(
    cells: ICETileMapPulse[],
    options: { duration?: number; color?: string; driver?: ICEFrameDriver } = {},
  ): this {
    if (!cells || !cells.length) return this;
    if (this.pulseHandle) this.pulseHandle.cancel();
    this.pulses = cells.map((cell) => ({ ...cell }));
    this.pulseAlpha = 1;
    this.requestPaint();
    if (options.color) this.pulseColor = options.color;
    this.pulseHandle = tween({
      from: 1,
      to: 0,
      duration: options.duration === undefined ? 260 : options.duration,
      // 线性：单测能算出「一半时间 = 一半透明度」，浏览器里再换缓动也不影响调用方
      easing: 'linear',
      driver: options.driver,
      onUpdate: (value) => {
        this.pulseAlpha = value;
        this.requestPaint();
      },
      onFinish: () => {
        this.pulseAlpha = 0;
        this.pulses = [];
        this.pulseHandle = null;
        this.requestPaint();
      },
    });
    return this;
  }

  public getPulses(): ICETileMapPulse[] {
    return this.pulses.map((item) => ({ ...item }));
  }

  public getPulseAlpha(): number {
    return this.pulses.length ? this.pulseAlpha : 0;
  }

  public getPaintCount(): number {
    return this.paintCount;
  }

  // ---------------------------------------------------------------- 绘制

  /** 自绘整块网格。浏览器里由 `doRender()` 自动调用；单测可以直接调来数自绘次数。 */
  public paintBoard(): void {
    this.paintCount += 1;
    const ctx = this.ctx;
    if (!ctx) return;
    for (let row = 0; row < this.rows; row += 1) {
      for (let col = 0; col < this.cols; col += 1) {
        const index = row * this.cols + col;
        const style = this.resolveCellStyle(this.tiles[index] || null);
        if (!style) continue;
        this.__drawRect(row, col, style, 1);
        const label = this.labels[index];
        if (label !== null && label !== undefined && label !== '') {
          this.__drawLabel(row, col, label, style);
        }
      }
    }
    const alpha = this.getPulseAlpha();
    if (alpha > 0) {
      this.pulses.forEach((cell) => {
        this.__drawRect(cell.row, cell.col, { fillStyle: cell.color || this.pulseColor }, alpha);
      });
    }
    this.highlights.forEach((cell) => {
      this.__drawRect(
        cell.row,
        cell.col,
        {
          fillStyle: cell.fillStyle || 'rgba(0,0,0,0)',
          strokeStyle: cell.strokeStyle || this.highlightColor,
          lineWidth: cell.lineWidth === undefined ? 1.5 : cell.lineWidth,
          radius: cell.radius,
        },
        1,
      );
    });
  }

  protected doRender(): void {
    // 先让 ICEWidget 画底板（它继承的是矩形容器：fill / stroke / radius 都在那里）
    super.doRender();
    // ！！关键：`ICEComponent.doRender()` 会把 CTM 换成「世界 → 设备」去画调试包围盒，
    // 所以 super 之后必须把**本渲染通道的完整变换**取回来，否则自绘的坐标会跑到画面左上角
    // （引擎在 ICEComponent 里专门留了 applyActiveTransform() 给这种「super 之后再画」的场景）。
    this.applyActiveTransform();
    this.paintBoard();
  }

  protected initEvents(): void {
    super.initEvents();
    this.on('click', (evt: any) => {
      const cell = this.__cellFromEvent(evt);
      if (cell) this.trigger('cellclick', null, cell);
    });
  }

  // ---------------------------------------------------------------- 内部

  /**
   * 请求重画。
   *
   * 只置组件自己的 `dirty` 是**不够的**：引擎的渲染循环看的是 `ice.dirty`
   * （`CanvasRenderer.frameEvtHandler` 里 `if (this.ice.dirty)` 才排队），组件的 `dirty`
   * 只决定「这一趟要不要重画我」。自绘动画（比如 `pulse` 的 tween 每帧回调）如果只置自己的
   * dirty，画面根本不会逐帧更新 —— 表现为白色脉冲**卡在格子上不动**，直到下一次别的原因触发重绘。
   */
  private requestPaint(): void {
    this.dirty = true;
    if (this.ice) this.ice.dirty = true;
  }

  private __normalize(tiles: Array<string | number | null> | Array<Array<string | number | null>>): Array<string | number | null> {
    const flat: Array<string | number | null> = [];
    if (!tiles) return flat;
    const is2D = Array.isArray(tiles[0]);
    if (is2D) {
      (tiles as Array<Array<string | null>>).forEach((line) => {
        (line || []).forEach((item) => flat.push(item === undefined ? null : item));
      });
    } else {
      (tiles as Array<string | null>).forEach((item) => flat.push(item === undefined ? null : item));
    }
    const expected = this.rows * this.cols;
    if (flat.length !== expected) {
      throw new Error(`ICETileMap: setTiles 需要 ${expected} 个格子（${this.rows}×${this.cols}），实际 ${flat.length} 个`);
    }
    return flat;
  }

  /** 把标签居中画在格子里（字体 / 颜色优先取格子样式，其次取组件默认）。 */
  private __drawLabel(row: number, col: number, text: string, style: ICETileMapCellStyle): void {
    const ctx = this.ctx;
    if (!ctx || typeof ctx.fillText !== 'function') return;
    const rect = this.getCellRect(row, col);
    const originX = Number(this.state.localOrigin && this.state.localOrigin[0]) || 0;
    const originY = Number(this.state.localOrigin && this.state.localOrigin[1]) || 0;
    const size = style.fontSize === undefined ? this.labelFontSize : Number(style.fontSize);
    const weight = style.fontWeight || '700';
    const family = style.fontFamily || 'Tahoma, "Microsoft YaHei", sans-serif';
    const color = style.textColor || this.labelColor;
    const canSave = typeof ctx.save === 'function' && typeof ctx.restore === 'function';
    if (canSave) ctx.save();
    ctx.font = `${weight} ${size}px ${family}`;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, rect.left - originX + rect.width / 2, rect.top - originY + rect.height / 2);
    if (canSave) ctx.restore();
  }

  private __drawRect(
    row: number,
    col: number,
    style: { fillStyle?: string; strokeStyle?: string; lineWidth?: number; radius?: number },
    alphaScale: number,
  ): void {
    const ctx = this.ctx;
    if (!ctx || row < 0 || row >= this.rows || col < 0 || col >= this.cols) return;
    const rect = this.getCellRect(row, col);
    // 引擎的局部坐标系原点在组件中心（`state.localOrigin` 默认是 localCenter），
    // 而 `getCellRect` 给的是「组件左上角为原点」的矩形 —— 这里必须减掉 localOrigin。
    const originX = Number(this.state.localOrigin && this.state.localOrigin[0]) || 0;
    const originY = Number(this.state.localOrigin && this.state.localOrigin[1]) || 0;
    const radius = style.radius === undefined ? this.cellRadius : style.radius;
    const needsAlpha = alphaScale < 1 && typeof ctx.save === 'function';
    if (needsAlpha) {
      ctx.save();
      ctx.globalAlpha = (Number(ctx.globalAlpha) || 1) * Math.max(0, alphaScale);
    }
    roundRectPath(ctx, rect.left - originX, rect.top - originY, rect.width, rect.height, radius);
    if (style.fillStyle) {
      ctx.fillStyle = style.fillStyle;
      ctx.fill();
    }
    if (style.strokeStyle) {
      ctx.lineWidth = style.lineWidth === undefined ? 1 : style.lineWidth;
      ctx.strokeStyle = style.strokeStyle;
      ctx.stroke();
    }
    if (needsAlpha && typeof ctx.restore === 'function') ctx.restore();
  }

  private __cellFromEvent(evt: any): { row: number; col: number } | null {
    if (!evt || typeof evt.offsetX !== 'number' || typeof evt.offsetY !== 'number') return null;
    if (!this.ice || typeof this.ice.screenToWorld !== 'function') return null;
    const [wx, wy] = this.ice.screenToWorld(evt.offsetX, evt.offsetY);
    const box = this.getMinBoundingBox(true);
    if (!box) return null;
    return this.getCellAt(wx - box.tl[0], wy - box.tl[1]);
  }
}
