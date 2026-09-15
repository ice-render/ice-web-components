import { ICEWidget } from '../core/ICEWidget';
import { ICELabel } from './ICELabel';
import { iceUIManager } from '../core/ICEManager';
import { computeDropTarget, moveKanbanCard } from '../util/ICEDragReorder';

/**
 * 看板：列 + 卡片，卡片可以**跨列拖拽**（CRM / 项目管理最常见的那块界面）。
 *
 * 结构很直白：
 * ```
 * ICEKanban
 *   ├── column[todo]   ← 列标题 + 卡片（等距竖排）
 *   ├── column[doing]
 *   └── column[done]
 * ```
 *
 * 拖拽的「落点」复用列表那套：列由指针的 **x** 决定，列内插入位置由 **y** 决定
 * （`computeDropTarget` 的上下半格语义），真正的数据搬运交给纯函数 `moveKanbanCard`。
 */

export interface ICEKanbanCard {
  key: string;
  title: string;
  [field: string]: any;
}

export interface ICEKanbanColumn {
  key: string;
  title: string;
  cards: ICEKanbanCard[];
  [field: string]: any;
}

export interface ICEKanbanDropTarget {
  columnKey: string;
  index: number;
  position: 'before' | 'after';
}

export interface ICEKanbanOptions {
  id?: string;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  columns: ICEKanbanColumn[];
  columnWidth?: number;
  cardHeight?: number;
  gap?: number;
  draggable?: boolean;
  onCardMove?: (info: { cardKey: string; columnKey: string; index: number; columns: ICEKanbanColumn[] }) => void;
  [key: string]: any;
}

const HEADER_HEIGHT = 30;
const CARD_GAP = 8;

export class ICEKanban extends ICEWidget {
  private columns: ICEKanbanColumn[];
  private columnWidth: number;
  private cardHeight: number;
  private gap: number;
  private draggable: boolean;
  private onCardMove: ICEKanbanOptions['onCardMove'] | null;
  private cardNodes = new Map<string, ICEWidget>();
  private columnNodes = new Map<string, ICEWidget>();
  private dragState: { cardKey: string; target: ICEKanbanDropTarget | null; indicator: any } | null = null;
  private __bound = false;
  private running = false;

  constructor(props: ICEKanbanOptions) {
    super({
      fill: false,
      stroke: false,
      width: props.width || 640,
      height: props.height || 260,
      ...props,
    });
    this.columns = (props.columns || []).map((column) => ({ ...column, cards: (column.cards || []).slice() }));
    this.columnWidth = Math.max(80, Math.floor(Number(props.columnWidth) || 200));
    this.cardHeight = Math.max(28, Math.floor(Number(props.cardHeight) || 56));
    this.gap = Math.max(4, Math.floor(Number(props.gap) || 12));
    this.draggable = props.draggable === true;
    this.onCardMove = typeof props.onCardMove === 'function' ? props.onCardMove : null;
    this.__render();
  }

  protected afterAddHandler(): void {
    super.afterAddHandler();
    if (this.running || !this.ice || !this.ice.evtBus) return;
    this.running = true;
    this.ice.evtBus.on('mousedown', this.__onMouseDown, this);
    this.ice.evtBus.on('mousemove', this.__onMouseMove, this);
    this.ice.evtBus.on('mouseup', this.__onMouseUp, this);
  }

  // ---------------------------------------------------------------- 查询

  public getColumns(): ICEKanbanColumn[] {
    return this.columns.map((column) => ({ ...column, cards: column.cards.slice() }));
  }

  public getCardNode(key: string): ICEWidget | null {
    return this.cardNodes.get(key) || null;
  }

  public getColumnNode(key: string): ICEWidget | null {
    return this.columnNodes.get(key) || null;
  }

  public isDraggable(): boolean {
    return this.draggable;
  }

  public isDragging(): boolean {
    return !!this.dragState;
  }

  public getDropTarget(): ICEKanbanDropTarget | null {
    return this.dragState ? this.dragState.target : null;
  }

  // ---------------------------------------------------------------- 移动

  /** 把卡片移到目标列的指定位置；真的动了才返回 true（判定见纯函数 `moveKanbanCard`）。 */
  public moveCard(cardKey: string, columnKey: string, index: number): boolean {
    const result = moveKanbanCard(this.columns, cardKey, columnKey, index);
    if (!result.moved) return false;
    this.columns = result.columns;
    this.__render();
    const info = { cardKey, columnKey: result.columnKey as string, index: result.index, columns: this.getColumns() };
    this.trigger('cardmove', null, info);
    if (this.onCardMove) this.onCardMove(info);
    return true;
  }

  // ---------------------------------------------------------------- 渲染

  private __columnX(index: number): number {
    return index * (this.columnWidth + this.gap);
  }

  private __cardY(index: number): number {
    return HEADER_HEIGHT + 6 + index * (this.cardHeight + CARD_GAP);
  }

  /**
   * 尺寸变化时整段重排内部零件（`ICEWidget.__syncInternalLayout()`）。
   *
   * 本组件的内部构图（子项尺寸、居中偏移、分栏/分行）**本身就是宽高的函数**，
   * 所以按本库既有惯例直接重跑构造期那段 `__render()`：它内部 `removeChildren` 重建，
   * 不会留下停在旧尺寸的零件（子项的事件在构造函数里重挂）。
   */
  protected __syncInternalLayout(): void {
    this.__render();
  }

  private __render(): void {
    const theme = iceUIManager.getTheme();
    this.removeChildren([...this.childNodes]);
    this.cardNodes.clear();
    this.columnNodes.clear();
    this.columns.forEach((column, columnIndex) => {
      const panel = new ICEWidget({
        id: `kanban-col-${column.key}`,
        left: this.__columnX(columnIndex),
        top: 0,
        width: this.columnWidth,
        height: Number(this.state.height) || 0,
        radius: theme.radius.md,
        fill: true,
        stroke: true,
        interactive: false,
        style: { fillStyle: theme.colors.background, strokeStyle: theme.colors.border, lineWidth: 1 },
      });
      panel.addChild(
        new ICELabel({
          interactive: false,
          left: 10,
          top: 0,
          width: this.columnWidth - 20,
          height: HEADER_HEIGHT,
          text: `${column.title} · ${column.cards.length}`,
          verticalAlign: 'middle',
          style: { fontSize: 13, fontWeight: theme.font.weightSemibold, fillStyle: theme.colors.text },
        }),
        false,
      );
      column.cards.forEach((card, cardIndex) => {
        const node = new ICEWidget({
          id: `kanban-card-${card.key}`,
          left: 8,
          top: this.__cardY(cardIndex),
          width: this.columnWidth - 16,
          height: this.cardHeight,
          radius: theme.radius.sm,
          fill: true,
          stroke: true,
          // 卡片必须是可交互节点：引擎的指针拖拽只会打到可交互目标上，
          // 拿根节点当拖拽目标时后续 mousemove 的坐标不会跟着指针走（实测踩到）
          interactive: true,
          style: { fillStyle: theme.colors.surface, strokeStyle: theme.colors.border, lineWidth: 1, ...theme.shadows.sm },
        });
        node.addChild(
          new ICELabel({
            interactive: false,
            left: 10,
            top: 0,
            width: this.columnWidth - 36,
            height: this.cardHeight,
            text: card.title,
            verticalStyle: undefined,
            verticalAlign: 'middle',
            style: { fontSize: 13, fillStyle: theme.colors.text },
          }),
          false,
        );
        panel.addChild(node, false);
        this.cardNodes.set(card.key, node);
      });
      // 落点指示线（inside 那套看板用不上：卡片只有「插到第几张」）
      const indicator = new ICEWidget({
        left: 6,
        top: 0,
        width: this.columnWidth - 12,
        height: 2,
        fill: true,
        stroke: false,
        display: false,
        interactive: false,
        style: { fillStyle: theme.colors.primary },
      });
      panel.addChild(indicator, false);
      panel.setState({ indicator });
      this.columnNodes.set(column.key, panel);
      this.addChild(panel, false);
    });
    if (this.ice && this.ice.dirty !== undefined) this.ice.dirty = true;
  }

  // ---------------------------------------------------------------- 拖拽

  private __localPoint(evt: any): { x: number; y: number } | null {
    if (!evt || typeof evt.offsetX !== 'number' || !this.ice || typeof this.ice.screenToWorld !== 'function') return null;
    const [wx, wy] = this.ice.screenToWorld(evt.offsetX, evt.offsetY);
    const box = this.getMinBoundingBox(true);
    return { x: wx - box.tl[0], y: wy - box.tl[1] };
  }

  private __columnIndexAt(localX: number): number {
    const step = this.columnWidth + this.gap;
    return Math.min(Math.max(Math.floor(localX / step), 0), Math.max(0, this.columns.length - 1));
  }

  /** 指针 → 落点：x 定列，y 定列内插入位置（上下半格沿用列表那套）。 */
  private __targetAt(localX: number, localY: number): ICEKanbanDropTarget | null {
    if (!this.columns.length) return null;
    const column = this.columns[this.__columnIndexAt(localX)];
    if (!column) return null;
    const pointerY = localY - HEADER_HEIGHT - 6;
    const target = computeDropTarget({
      pointerY,
      itemHeight: this.cardHeight + CARD_GAP,
      itemCount: column.cards.length || 1,
    });
    if (!target) return { columnKey: column.key, index: 0, position: 'before' };
    return { columnKey: column.key, index: target.index, position: target.position };
  }

  private __onMouseDown(evt: any): void {
    if (!this.draggable) return;
    const point = this.__localPoint(evt);
    if (!point) return;
    const box = this.getMinBoundingBox(true);
    if (point.x < 0 || point.y < 0 || point.x > box.br[0] - box.tl[0] || point.y > box.br[1] - box.tl[1]) return;
    // 命中哪张卡片：先定列，再按 y 找卡片
    const column = this.columns[this.__columnIndexAt(point.x)];
    if (!column) return;
    const cardIndex = Math.floor((point.y - HEADER_HEIGHT - 6) / (this.cardHeight + CARD_GAP));
    const card = column.cards[cardIndex];
    if (!card) return;
    this.dragState = { cardKey: card.key, target: null, indicator: this.columnNodes.get(column.key) };
    this.__updateDrag(point.x, point.y);
  }

  private __onMouseMove(evt: any): void {
    const point = this.__localPoint(evt);
    if (!point) return;
    if (!this.dragState) return;
    this.__updateDrag(point.x, point.y);
  }

  private __onMouseUp(): void {
    const drag = this.dragState;
    if (!drag) return;
    this.dragState = null;
    this.__hideIndicators();
    if (drag.target) this.moveCard(drag.cardKey, drag.target.columnKey, drag.target.index);
    this.trigger('dragend', null, { cardKey: drag.cardKey, target: drag.target });
  }

  private __hideIndicators(): void {
    this.columnNodes.forEach((panel: any) => {
      if (panel.state && panel.state.indicator) panel.state.indicator.setState({ display: false });
    });
  }

  private __updateDrag(localX: number, localY: number): void {
    if (!this.dragState) return;
    const target = this.__targetAt(localX, localY);
    this.dragState.target = target;
    this.__hideIndicators();
    if (!target) return;
    const panel: any = this.columnNodes.get(target.columnKey);
    if (!panel || !panel.state || !panel.state.indicator) return;
    const column = this.columns.find((item) => item.key === target.columnKey);
    const cardCount = column ? column.cards.length : 0;
    const insertAt = Math.min(target.index + (target.position === 'after' ? 1 : 0), Math.max(0, cardCount));
    panel.state.indicator.setState({ display: true, top: Math.max(HEADER_HEIGHT, this.__cardY(insertAt) - CARD_GAP / 2) });
  }
}
