import { ICEButton } from './ICEButton';
import { ICEContainer } from '../core/ICEContainer';
import { ICELayoutManager, token } from 'ice-render';
import { iceUIManager } from '../core/ICEManager';

/**
 * 标签页：一组互斥按钮，`onChange` 通知切换（程序式 `setActiveIndex` 不触发回调）。
 */

/**
 * 页签条的自持策略（Swing 的 `JTabbedPane` + `BasicTabbedPaneUI` 位）。
 *
 * 四种方位（上/下/左/右）与 overflow 形态（两端箭头 + 可滚动的条带）都在这里摆位；
 * 组件只保留策略：有哪些页签、要不要溢出、滚到哪。**结构**（条带 / 箭头 / 把按钮塞进条带）
 * 仍归组件 —— 布局策略只摆位置，不重建树（引擎的约定）。
 */
class ICETabsLayout extends ICELayoutManager {
  layoutContainer(container: any): void {
    const input = container.__getTabsLayoutInput();
    const { placement, overflow, width, height, gap, rowHeight, tabWidth, scrollOffset, buttons, extraNodes } = input;

    if (overflow) {
      // 顶部横向滚动形态：箭头贴两侧、条带居中并带负偏移（偏移量 = 滚动量）
      const arrowWidth = 24;
      if (input.prevButton) {
        input.prevButton.setState({ left: 0, top: 1, width: arrowWidth, height: height - 2 });
      }
      if (input.nextButton) {
        input.nextButton.setState({ left: width - arrowWidth, top: 1, width: arrowWidth, height: height - 2 });
      }
      if (input.strip) {
        input.strip.setState({
          left: arrowWidth - scrollOffset,
          top: 0,
          width: Math.max(0, width - arrowWidth * 2),
          height,
        });
      }
      const boxes: Array<{ left: number; width: number }> = [];
      let left = 0;
      buttons.forEach((button: any) => {
        button.setState({ left, top: 0, width: tabWidth, height });
        boxes.push({ left, width: tabWidth });
        left += tabWidth + 8;
      });
      container.__setTabBoxes(boxes);
      return;
    }

    container.__setTabBoxes([]);

    if (placement === 'left' || placement === 'right') {
      // 竖向：一列排下来，整条宽度 = 容器宽（保持既有几何）
      buttons.forEach((button: any, index: number) => {
        button.setState({ left: 0, top: index * rowHeight, width, height: rowHeight - gap });
      });
      return;
    }

    // 横向（上 / 下）：页签 + extra 依次排
    //  - 上方：行高就是页签行高（老行为是流式布局，按钮高度不动）
    //  - 下方：整体贴底、按钮高度收到「容器高 - 6」（老行为的口径）
    const isBottom = placement === 'bottom';
    const itemsHeight = isBottom ? Math.max(20, height - 6) : rowHeight;
    const rowTop = isBottom ? Math.max(0, height - itemsHeight) : 0;
    let cursor = 0;
    const place = (node: any, stretchHeight: boolean) => {
      const nodeHeight = stretchHeight ? itemsHeight : Number(node.state.height) || itemsHeight;
      node.setState({
        left: cursor,
        top: rowTop + Math.max(0, (itemsHeight - nodeHeight) / 2),
        ...(stretchHeight ? { height: itemsHeight } : {}),
      });
      cursor += (Number(node.state.width) || 0) + gap;
    };
    buttons.forEach((button: any) => place(button, isBottom));
    if (placement === 'top') {
      // 顶部形态下 extra 跟着页签一起流式排（老行为就是流式布局把它们排在一行）
      extraNodes.forEach((node: any) => place(node, false));
    }
  }

  /** 内部策略：不进文档（`null` = 由 `ICETabs` 构造时重建，页签几何由 state 决定）。 */
  public toJSON(): any {
    return null;
  }
}
export class ICETabs extends ICEContainer {
  private buttons: ICEButton[] = [];
  private activeIndex = 0;
  private tabs: string[] = [];
  private onChangeCallback: ((index: number, tab: string) => void) | null = null;
  /** 形态：line = 实心药丸（默认，行为与以前一致）；card = 文件袋式（未选中页不画底色） */
  private type: 'line' | 'card' = 'line';
  private closable = false;
  private closeCallback: ((tab: string, index: number) => void) | null = null;
  private extraNodes: any[] = [];
  /** 溢出滚动：页签多到装不下时按自然宽度排，用左右箭头翻 */
  private scrollOffset = 0;
  private overflow = false;
  private tabWidthValue = 96;
  private strip: any = null;
  private prevButton: ICEButton | null = null;
  private nextButton: ICEButton | null = null;
  private tabBoxes: Array<{ left: number; width: number }> = [];
  /** 方位：上/下（横向条）与左/右（竖向条） */
  private placement: 'top' | 'bottom' | 'left' | 'right' = 'top';
  private itemGap = 8;
  /** 拖动排序：按住页签拖到别的槽位松手 */
  private draggable = false;
  private dragState: { from: number; to: number } | null = null;
  private reorderCallback: ((from: number, to: number, tabs: string[]) => void) | null = null;
  private heightValue = 32;
  private declaredWidth = 0;
  private minTabWidth = 64;
  private extraSource: any[] = [];
  private scrollableProp: boolean | undefined;
  private __bound = false;

  constructor(props: any = {}) {
    const theme = iceUIManager.getTheme();
    const height = props.height || theme.control.height;
    super({
      fill: false,
      stroke: false,
      ...props,
    });
    const tabs: string[] = props.tabs || [];
    this.tabs = tabs.slice();
    this.heightValue = height;
    this.onChangeCallback = typeof props.onChange === 'function' ? props.onChange : null;
    this.type = props.type === 'card' ? 'card' : 'line';
    this.placement = props.placement === 'bottom' || props.placement === 'left' || props.placement === 'right' ? props.placement : 'top';
    this.draggable = props.draggable === true;
    this.reorderCallback = typeof props.onReorder === 'function' ? props.onReorder : null;
    this.itemGap = Math.max(0, Math.floor(Number(props.itemGap) || 8));
    this.closable = props.closable === true;
    this.closeCallback = typeof props.onClose === 'function' ? props.onClose : null;
    this.tabWidthValue = Math.max(48, Math.floor(Number(props.tabWidth) || 96));
    this.declaredWidth = Number(props.width) || tabs.length * 90;
    this.minTabWidth = Math.max(40, Math.floor(Number(props.minTabWidth) || 64));
    this.scrollableProp = props.scrollable;
    this.extraSource = props.extra === undefined || props.extra === null ? [] : Array.isArray(props.extra) ? props.extra : [props.extra];
    // 排布交给自持策略（四种方位 + overflow 都在里面），组件只决定"结构"
    this.setLayout(new ICETabsLayout());
    this.__render();
  }

  /** 重建页签（构造与拖动排序后都走这里）。 */
  private __render(): void {
    this.removeChildren([...this.childNodes]);
    this.buttons = [];
    this.extraNodes = [];
    this.strip = null;
    this.prevButton = null;
    this.nextButton = null;
    this.scrollOffset = 0;
    const gap = this.itemGap;
    const totalGap = Math.max(0, this.tabs.length - 1) * gap;
    const autoWidth = this.declaredWidth ? (this.declaredWidth - totalGap) / Math.max(1, this.tabs.length) : 90;
    // 只有「等宽排也会挤到小于 minTabWidth」时才切滚动形态：几个页签的小组件保持老行为，
    // 页签多到装不下才出现箭头（默认 64 是「还能看清文字」的底线）
    const fitWidth = (this.declaredWidth - totalGap) / Math.max(1, this.tabs.length);
    this.overflow = this.scrollableProp === true || (this.scrollableProp !== false && fitWidth < this.minTabWidth);
    this.tabs.forEach((text, index) => {
      const button = new ICEButton({
        text,
        width: Math.max(64, autoWidth),
        height: this.heightValue,
        variant: index === 0 ? 'primary' : 'default',
      });
      this.buttons.push(button);
      this.addChild(button, false);
      if (this.closable) this.__attachCloseButton(button, index);
    });
    if (this.overflow) {
      this.__ensureOverflowStructure();
    }
    this.extraSource.forEach((node: any) => {
      if (!node) return;
      this.extraNodes.push(node);
      this.addChild(node, false);
    });
    this.buttons.forEach((button, index) => {
      button.on('mousedown', () => this.__activate(index), this);
    });
    // 拖动排序后重建时保留原来的选中项（构造期本来就是 0）
    this.setActiveIndex(Math.min(Math.max(0, this.activeIndex), Math.max(0, this.tabs.length - 1)));
    if (this.placement === 'left' || this.placement === 'right') {
      // 竖向形态的高度 = 页签数 × 行高（组件级策略），再统一排一次
      this.setState({ height: this.tabs.length * this.heightValue });
    }
    this.doLayout();
  }

  public getPlacement(): 'top' | 'bottom' | 'left' | 'right' {
    return this.placement;
  }

  public isReordering(): boolean {
    return !!this.dragState;
  }

  public getActiveLabel(): string {
    return this.tabs[this.activeIndex] || '';
  }

  /** 自持策略需要的输入（节点 + 当前策略值）。 */
  public __getTabsLayoutInput(): {
    placement: 'top' | 'bottom' | 'left' | 'right';
    overflow: boolean;
    width: number;
    height: number;
    gap: number;
    /** 单个页签的行高（竖向排列与上方形态都用它）。 */
    rowHeight: number;
    tabWidth: number;
    scrollOffset: number;
    buttons: ICEButton[];
    extraNodes: any[];
    strip: any;
    prevButton: ICEButton | null;
    nextButton: ICEButton | null;
  } {
    return {
      placement: this.placement,
      overflow: this.overflow,
      width: Number(this.state.width) || 300,
      height: Number(this.state.height) || 32,
      gap: this.itemGap,
      rowHeight: this.heightValue,
      tabWidth: this.tabWidthValue,
      scrollOffset: this.scrollOffset,
      buttons: this.buttons,
      extraNodes: this.extraNodes,
      strip: this.strip,
      prevButton: this.prevButton,
      nextButton: this.nextButton,
    };
  }

  /** overflow 形态下由策略回填的"页签逻辑盒子"（不含滚动偏移）。 */
  public __setTabBoxes(boxes: Array<{ left: number; width: number }>): void {
    this.tabBoxes = boxes;
  }

  protected afterAddHandler(): void {
    super.afterAddHandler();
    this.__bindDragEvents();
  }

  private __bindDragEvents(): void {
    if (this.__bound || !this.ice || !this.ice.evtBus) {
      return;
    }
    this.__bound = true;
    this.ice.evtBus.on('mousedown', this.__onGlobalMouseDown, this);
    this.ice.evtBus.on('mousemove', this.__onGlobalMouseMove, this);
    this.ice.evtBus.on('mouseup', this.__onGlobalMouseUp, this);
  }

  private __onGlobalMouseDown(evt: any): void {
    if (!this.draggable || !evt || typeof evt.offsetX !== 'number') {
      return;
    }
    const index = this.__tabIndexAt(evt.offsetX, evt.offsetY);
    if (index < 0) {
      return;
    }
    this.dragState = { from: index, to: index };
  }

  private __onGlobalMouseMove(evt: any): void {
    if (!this.dragState || !evt) {
      return;
    }
    const index = this.__tabIndexAt(evt.offsetX, evt.offsetY);
    if (index >= 0) {
      this.dragState.to = index;
    }
  }

  private __onGlobalMouseUp(): void {
    if (!this.dragState) {
      return;
    }
    const { from, to } = this.dragState;
    this.dragState = null;
    if (from === to) {
      return;
    }
    this.__moveTab(from, to);
  }

  /** 指针落在第几个页签上（按方位取横/纵坐标）。 */
  private __tabIndexAt(x: number, y: number): number {
    const boxes = this.getTabBoxes();
    const vertical = this.placement === 'left' || this.placement === 'right';
    const probe = vertical ? Number(y) || 0 : Number(x) || 0;
    for (let index = 0; index < boxes.length; index += 1) {
      const box = boxes[index];
      const start = vertical ? box.top : box.left;
      const size = vertical ? box.height : box.width;
      if (probe >= start && probe <= start + size) {
        return index;
      }
    }
    return boxes.length ? (probe < 0 ? 0 : boxes.length - 1) : -1;
  }

  /** 换位置：页签顺序、选中下标（跟着页签走）与回调。 */
  private __moveTab(from: number, to: number): void {
    const next = this.tabs.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    const activeLabel = this.tabs[this.activeIndex];
    this.tabs = next;
    this.activeIndex = Math.max(0, next.indexOf(activeLabel));
    this.__render();
    if (this.reorderCallback) {
      this.reorderCallback(from, to, next.slice());
    }
  }

  public getActiveIndex(): number {
    return this.activeIndex;
  }

  public setActiveIndex(index: number): this {
    return this.__applyActive(index);
  }

  public getTabs(): string[] {
    return this.tabs.slice();
  }

  public getType(): 'line' | 'card' {
    return this.type;
  }

  public isClosable(): boolean {
    return this.closable;
  }

  public getExtra(): any[] {
    return this.extraNodes.slice();
  }

  // ---------------------------------------------------------------- 溢出滚动

  public isOverflow(): boolean {
    return this.overflow;
  }

  public getScrollOffset(): number {
    return this.scrollOffset;
  }

  public getViewportWidth(): number {
    return (Number(this.state.width) || 0) - (this.overflow ? 48 : 0);
  }

  public getMaxScroll(): number {
    if (!this.overflow) {
      return 0;
    }
    const contentWidth = this.tabBoxes.reduce((max, box) => Math.max(max, box.left + box.width), 0);
    return Math.max(0, contentWidth - this.getViewportWidth());
  }

  /** 按固定偏移滚动（自动夹取）。 */
  public setScrollOffset(offset: number): this {
    if (!this.overflow) {
      return this;
    }
    const next = Math.min(Math.max(0, Math.round(Number(offset) || 0)), this.getMaxScroll());
    if (next === this.scrollOffset) {
      return this;
    }
    this.scrollOffset = next;
    // 滚动位置变了：让策略重摆条带（不自己算 left）
    this.doLayout();
    return this;
  }

  public scrollBy(delta: number): this {
    return this.setScrollOffset(this.scrollOffset + (Number(delta) || 0));
  }

  /** 把某一页滚进可视区（点被裁掉的页签时用）。 */
  public scrollIntoView(index: number): this {
    if (!this.overflow) {
      return this;
    }
    const box = this.tabBoxes[index];
    if (!box) {
      return this;
    }
    const viewport = this.getViewportWidth();
    if (box.left < this.scrollOffset) {
      return this.setScrollOffset(box.left);
    }
    if (box.left + box.width > this.scrollOffset + viewport) {
      return this.setScrollOffset(box.left + box.width - viewport);
    }
    return this;
  }

  public getPrevButton(): ICEButton | null {
    return this.prevButton;
  }

  public getNextButton(): ICEButton | null {
    return this.nextButton;
  }

  /** 页签当前的盒子（相对组件；含滚动偏移）。 */
  public getTabBoxes(): Array<{ left: number; top: number; width: number; height: number }> {
    if (!this.overflow) {
      return this.buttons.map((button) => ({
        left: Number(button.state.left) || 0,
        top: Number(button.state.top) || 0,
        width: Number(button.state.width) || 0,
        height: Number(button.state.height) || 0,
      }));
    }
    return this.tabBoxes.map((box) => ({
      left: box.left - this.scrollOffset,
      top: 0,
      width: box.width,
      height: Number(this.state.height) || 32,
    }));
  }

  /**
   * 溢出形态的**结构**：页签放进可裁剪的条带里，两端各一个箭头。
   *
   * 只建结构、不摆位置 —— 位置由 `ICETabsLayout`（本组件的自持策略）算。
   */
  private __ensureOverflowStructure(): void {
    const theme = iceUIManager.getTheme();
    const width = Number(this.state.width) || 300;
    const height = Number(this.state.height) || 32;
    const arrowWidth = 24;
    if (!this.strip) {
      this.strip = new ICEContainer({
        left: arrowWidth,
        top: 0,
        width: Math.max(0, width - arrowWidth * 2),
        height,
        fill: false,
        stroke: false,
        clipChildren: true,
      });
      this.addChild(this.strip, false);
      this.buttons.forEach((button) => {
        this.removeChild(button);
        this.strip.addChild(button, false);
      });
      const arrow = (text: string, left: number, delta: number, key: 'prev' | 'next') => {
        const button = new ICEButton({
          left,
          top: 1,
          width: arrowWidth,
          height: height - 2,
          text,
          size: 'small',
          variant: 'text',
        });
        button.on('click', () => this.scrollBy(delta), this);
        this.addChild(button, false);
        if (key === 'prev') {
          this.prevButton = button;
        } else {
          this.nextButton = button;
        }
        return button;
      };
      arrow('‹', 0, -this.tabWidthValue, 'prev');
      arrow('›', width - arrowWidth, this.tabWidthValue, 'next');
      this.strip.setState({ style: { ...this.strip.state.style, fillStyle: token('ui.colors.background') } });
    }
    if (this.ice) {
      this.ice.dirty = true;
    }
  }

  /**
   * 关掉某个页签：移除按钮与标签、通知 `onClose`、把激活下标夹回合法范围。
   * 关闭钮与被调用的地方走的是同一条路径（行为只有一份）。
   */
  public closeTab(index: number): this {
    if (index < 0 || index >= this.buttons.length) return this;
    const [tab] = this.tabs.splice(index, 1);
    const [button] = this.buttons.splice(index, 1);
    if (button) this.removeChild(button);
    if (this.closeCallback) this.closeCallback(tab, index);
    if (this.buttons.length) {
      const next = Math.min(this.activeIndex >= index ? this.activeIndex - 1 : this.activeIndex, this.buttons.length - 1);
      this.__applyActive(Math.max(0, next));
    } else {
      this.activeIndex = 0;
    }
    this.revalidate();
    return this;
  }

  /** 给页签挂一个关闭钮（✕）：点击 = closeTab。 */
  private __attachCloseButton(button: ICEButton, index: number): void {
    const theme = this.theme();
    const close = new ICEButton({
      text: '✕',
      width: 18,
      height: 18,
      variant: 'text',
      size: 'small',
      focusable: false,
      style: { fontSize: 10 },
    });
    close.setState({ left: Math.max(0, (Number(button.state.width) || 80) - 22), top: 4 });
    close.on('click', () => {
      const live = this.buttons.indexOf(button);
      if (live >= 0) this.closeTab(live);
    });
    button.addChild(close, false);
    void theme;
    void index;
  }

  /** 用户点击切页（`setActiveIndex` 是程序式设置，不触发 onChange）。 */
  private __activate(index: number): void {
    const changed = index !== this.activeIndex;
    this.__applyActive(index);
    // 点到被裁掉的页签时自己滚进视野（否则用户点了却看不见选中态）
    this.scrollIntoView(index);
    if (changed && this.onChangeCallback) {
      this.onChangeCallback(index, this.tabs[index]);
    }
  }

  private __applyActive(index: number): this {
    if (index < 0 || index >= this.buttons.length) {
      return this;
    }
    this.activeIndex = index;
    this.buttons.forEach((button, i) => {
      const theme = this.theme();
      const active = i === index;
      /**
       * 形态差异只体现在**底色与描边**上：
       * - `line`（默认）：选中实心主色、未选中浅底 —— 与以前完全一致；
       * - `card`（文件袋式）：选中页贴在内容上（卡片底色 + 描边），未选中页留在背景里（透明）。
       */
      const isCard = this.type === 'card';
      button.setState({
        style: isCard
          ? {
              ...button.state.style,
              fillStyle: active ? theme.colors.surface : 'rgba(0,0,0,0)',
              strokeStyle: active ? theme.colors.border : 'rgba(0,0,0,0)',
              shadow: active ? theme.shadows.sm : undefined,
            }
          : {
              ...button.state.style,
              fillStyle: active ? theme.colors.primary : theme.colors.surface,
              strokeStyle: active ? theme.colors.primary : theme.colors.border,
              ...(active ? theme.shadows.sm : {}),
            },
      });
      button.setState({ fill: isCard ? active : true, stroke: isCard ? active : true });
      const label = button.childNodes && button.childNodes[0];
      if (label && label.setState) {
        label.setState({
          style: {
            fillStyle: active ? theme.colors.primaryText : theme.colors.text,
            fontFamily: theme.font.family,
            fontSize: theme.font.size,
            fontWeight: theme.font.weightMedium,
            textAlign: 'center',
            textBaseline: 'middle',
          },
        });
      }
    });
    this.revalidate();
    return this;
  }
}
