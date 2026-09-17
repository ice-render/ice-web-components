import { ICEPanel } from './ICEPanel';
import { ICELabel } from './ICELabel';
import { ICEWidget } from '../core/ICEWidget';
import { ICETextField } from './ICETextField';
import { ICEScrollPane } from './ICEScrollPane';
import { iceUIManager } from '../core/ICEManager';
import { ICEOverlayManager, ICEOverlayHandle, getICEOverlayManager } from '../core/ICEOverlayManager';
import { token } from 'ice-render';

/**
 * 自动完成：文本输入 + 候选下拉。
 *
 * - 组合 `ICETextField`（输入与取值/表单语义）与浮层里的候选列表；
 * - 输入即过滤（label/value 包含匹配，忽略大小写），无候选时下拉收起；
 * - 点击候选写入输入框并回调 onSelect；键盘 ↑/↓ 移动高亮、Enter 选中、Esc 关闭。
 */
export interface ICEAutoCompleteOptions {
  /** 组件 id（引擎会用它做唯一标识，e2e/调试时可按 id 定位） */
  id?: string;
  options: string[];
  value?: string;
  placeholder?: string;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  optionHeight?: number;
  onSelect?: (value: string) => void;
  onChange?: (text: string) => void;
  /** 复用外部浮层管理器（测试注入） */
  manager?: ICEOverlayManager;
}

export class ICEAutoComplete extends ICEWidget {
  private allOptions: string[];
  private field: ICETextField;
  private manager: ICEOverlayManager | null;
  private handle: ICEOverlayHandle | null = null;
  private panel: ICEPanel | null = null;
  private visibleOptions: string[] = [];
  private optionNodes = new Map<string, ICEWidget>();
  private activeIndex = 0;
  private optionHeight: number;
  private onSelectCallback: ((value: string) => void) | null;
  private onChangeCallback: ((text: string) => void) | null;
  private running = false;
  /** 程序化写值期间置位：让 field 的 change 回调不要展开候选 */
  private __silentWrite = false;
  private __panelBound = false;

  constructor(props: ICEAutoCompleteOptions) {
    const theme = iceUIManager.getTheme();
    const width = props.width ?? 200;
    const height = props.height ?? theme.control.height;
    super({
      id: props.id,
      fill: false, stroke: false, left: props.left, top: props.top, width, height ,
    });
    this.allOptions = (props.options || []).slice();
    this.optionHeight = props.optionHeight ?? 32;
    this.manager = props.manager || null;
    this.onSelectCallback = typeof props.onSelect === 'function' ? props.onSelect : null;
    this.onChangeCallback = typeof props.onChange === 'function' ? props.onChange : null;

    this.field = new ICETextField({
      left: 0,
      top: 0,
      width,
      height,
      value: props.value ?? '',
      placeholder: props.placeholder ?? '',
    });
    // 兜底：某些路径下点击会被派发给锚点（输入框）而不是浮层里的候选行，
    // 这里按指针位置再判一次，保证两种派发都能选中
    this.field.on('click', (evt: any) => this.__onAnchorClick(evt));
    this.field.on('change', () => {
      // 程序化回填（setFormValue）期间不要展开候选：那是表单在写值，不是用户在打字
      this.__refresh(this.field.getValue(), !this.__silentWrite);
      if (this.onChangeCallback) {
        this.onChangeCallback(this.field.getValue());
      }
    });
    this.addChild(this.field, false);
    this.focusable = true;
    // 文本类控件：鼠标点进去也要有「正在输入」的焦点反馈（:focus 语义）
    this.focusRingMode = 'always';
  }

  protected afterAddHandler(): void {
    super.afterAddHandler();
    if (!this.running) {
      if (!this.manager && this.ice) {
        this.manager = getICEOverlayManager(this.ice);
      }
      if (this.ice && this.ice.evtBus && typeof this.ice.evtBus.on === 'function') {
        this.ice.evtBus.on('keydown', this.__onKeyDown, this);
        this.ice.evtBus.on('mousedown', this.__onGlobalMouseDown, this);
      }
      this.running = true;
    }
  }

  /**
   * 尺寸变化时让内部输入框铺满新盒子（`ICEWidget.__syncInternalLayout()`）。
   *
   * 构造期把 `props.width/height` 直接给了内部 `ICETextField`，之后父层布局改尺寸时
   * 外层变了、内层没变 —— 输入框的边框与文字都还按旧尺寸画（自动完成被拉窄后文字画到框外）。
   * 内层自己已会在尺寸变化时重排文字盒，这里只要把尺寸传下去。
   */
  protected __syncInternalLayout(): void {
    const width = Number(this.state.width) || 0;
    const height = Number(this.state.height) || 0;
    if (!(width > 0) || !(height > 0) || !this.field) {
      return;
    }
    this.field.setState({ left: 0, top: 0, width, height });
  }

  public getValue(): string {
    return this.field.getValue();
  }

  public setValue(value: string): this {
    const next = String(value ?? '');
    this.field.setValue(next);
    // 语义 = 「像用户输入了一样」：过滤候选并展开（既有测试与输入路径都依赖它）
    this.__refresh(next, true);
    return this;
  }

  public getFormValue(): any {
    return this.getValue();
  }

  public setFormValue(value: any): void {
    const next = String(value ?? '');
    // 表单回填 / 重置：**不该弹开候选面板**（否则一次 setValues 会弹出一堆下拉），
    // 而 field.setValue 会同步触发 change → 用一个标志让那次回调闭嘴
    this.__silentWrite = true;
    try {
      this.field.setValue(next);
    } finally {
      this.__silentWrite = false;
    }
    this.__refresh(next, false);
  }

  public getFieldText(): string {
    return this.field.getFieldText();
  }

  public setValidateStatus(status: any): this {
    this.field.setValidateStatus(status);
    return this;
  }

  public getValidateStatus(): any {
    return this.field.getValidateStatus();
  }

  public isOpen(): boolean {
    return !!this.handle && this.handle.isOpen();
  }

  public getVisibleOptions(): string[] {
    return this.visibleOptions.slice();
  }

  public getActiveIndex(): number {
    return this.activeIndex;
  }

  public getOptionNode(value: string): ICEWidget | null {
    return this.optionNodes.get(value) || null;
  }

  /** 当前候选浮层（未打开时为 null）。 */
  public getPanel(): ICEPanel | null {
    return this.panel;
  }

  public activate(): void {
    this.__refresh(this.getValue());
  }

  private __overlayManager(): ICEOverlayManager {
    if (!this.manager) {
      if (!this.ice) {
        throw new Error('ICEAutoComplete 需要先加入 ICE 场景');
      }
      this.manager = getICEOverlayManager(this.ice);
    }
    return this.manager;
  }

  /** 按当前文本刷新候选与下拉。 */
  private __refresh(text: string, open: boolean = true): void {
    const query = String(text ?? '').trim().toLowerCase();
    this.visibleOptions = this.allOptions.filter((option) => !query || option.toLowerCase().indexOf(query) !== -1);
    this.activeIndex = 0;
    if (!open) {
      this.close();
      return;
    }
    if (!this.visibleOptions.length) {
      this.close();
      return;
    }
    if (!this.isOpen()) {
      this.panel = this.__createPanel();
      this.__panelBound = false;
      this.handle = this.__overlayManager().open({
        anchor: this,
        content: this.panel,
        placement: 'bottomLeft',
        offset: 4,
        enterAnimation: 'scale',
        exitAnimation: 'fade',
        keyboardCaptured: true,
        // 点外关闭由本组件自己处理：浮层的命中盒判定会在 click 派发前关闭浮层，
        // 导致候选行永远收不到点击（实测踩到过）
        closeOnOutsideClick: false,
      });
    }
    this.__buildOptions();
  }

  public close(): this {
    if (this.handle) {
      this.handle.close();
      this.handle = null;
    }
    this.panel = null;
    this.optionNodes.clear();
    return this;
  }

  /** 点外关闭：点在输入框（本组件）与候选面板之外就收起下拉。 */
  /** 点击落在候选面板上（但事件被派发给了锚点）时，按位置选中。 */
  private __onAnchorClick(evt: any): void {
    if (!this.isOpen() || !evt || typeof evt.offsetX !== 'number' || typeof evt.offsetY !== 'number') {
      return;
    }
    if (!this.ice || typeof this.ice.screenToWorld !== 'function') {
      return;
    }
    const [wx, wy] = this.ice.screenToWorld(evt.offsetX, evt.offsetY);
    const box = this.__worldBox(this.panel);
    if (wx < box.left || wx > box.left + box.width || wy < box.top || wy > box.top + box.height) {
      return;
    }
    const index = Math.floor((wy - box.top - 4) / this.optionHeight);
    const option = this.visibleOptions[index];
    if (option) {
      this.__pick(option);
    }
  }

  private __onGlobalMouseDown(evt: any): void {
    if (!this.isOpen() || !evt || typeof evt.offsetX !== 'number' || typeof evt.offsetY !== 'number') {
      return;
    }
    if (!this.ice || typeof this.ice.screenToWorld !== 'function') {
      return;
    }
    const [wx, wy] = this.ice.screenToWorld(evt.offsetX, evt.offsetY);
    const insideBox = (box: any) => wx >= box.left && wx <= box.left + box.width && wy >= box.top && wy <= box.top + box.height;
    if (!insideBox(this.__worldBox(this)) && !insideBox(this.__worldBox(this.panel))) {
      this.close();
    }
  }

  private __onKeyDown(evt: any): void {
    if (!this.isOpen()) {
      return;
    }
    const raw = evt && (evt.originalEvent || evt);
    const key = raw && (raw.key || raw.code);
    if (key === 'Escape') {
      this.close();
      return;
    }
    if (key === 'ArrowDown' || key === 'ArrowUp') {
      const step = key === 'ArrowDown' ? 1 : -1;
      this.activeIndex = (this.activeIndex + step + this.visibleOptions.length) % this.visibleOptions.length;
      this.__buildOptions();
      return;
    }
    if (key === 'Enter') {
      const option = this.visibleOptions[this.activeIndex];
      if (option) {
        this.__pick(option);
      }
    }
  }

  private __onPanelClick(evt: any): void {
    if (!evt || typeof evt.offsetX !== 'number' || typeof evt.offsetY !== 'number') {
      return;
    }
    const box = this.__worldBox(this.panel);
    const index = Math.floor((evt.offsetY - box.top - 4) / this.optionHeight);
    const option = this.visibleOptions[index];
    if (option) {
      this.__pick(option);
    }
  }

  private __worldBox(node: any): { left: number; top: number; width: number; height: number } {
    let left = 0;
    let top = 0;
    let current = node;
    while (current && current.state) {
      left += Number(current.state.left) || 0;
      top += Number(current.state.top) || 0;
      current = current.parentNode;
    }
    return { left, top, width: Number(node && node.state && node.state.width) || 0, height: Number(node && node.state && node.state.height) || 0 };
  }

  private __pick(option: string): void {
    this.field.setValue(option);
    this.close();
    if (this.onSelectCallback) {
      this.onSelectCallback(option);
    }
  }

  private __createPanel(): ICEPanel {
    const theme = iceUIManager.getTheme();
    const width = Number(this.state.width) || 200;
    return new ICEPanel({
      width,
      height: Math.min(6, this.visibleOptions.length) * this.optionHeight + 8,
      radius: theme.radius.md,
      style: { fillStyle: token('ui.colors.surface'), strokeStyle: token('ui.colors.border'), shadow: 'md' },
    });
  }

  private __buildOptions(): void {
    const panel = this.panel;
    if (!panel) {
      return;
    }
    const theme = iceUIManager.getTheme();
    panel.removeChildren([...panel.childNodes]);
    this.optionNodes.clear();
    const width = Number(panel.state.width) || Number(this.state.width) || 200;
    // 候选超过一屏时套滚动视口：否则多出来的候选会画到面板外面（无裁剪、看着像穿帮）
    const viewportHeight = Math.min(6, this.visibleOptions.length) * this.optionHeight;
    const pane = new ICEScrollPane({
      left: 4,
      top: 4,
      width: width - 8,
      height: viewportHeight,
      fill: false,
      stroke: false,
      style: { fillStyle: 'rgba(0,0,0,0)', strokeStyle: 'rgba(0,0,0,0)' },
    });
    const content = new ICEWidget({
      left: 0,
      top: 0,
      width: width - 8,
      height: Math.max(viewportHeight, this.visibleOptions.length * this.optionHeight),
      fill: false,
      stroke: false,
    });
    this.visibleOptions.forEach((option, index) => {
      const active = index === this.activeIndex;
      const row = new ICEWidget({
        left: 0,
        top: index * this.optionHeight,
        width: width - 8,
        height: this.optionHeight,
        radius: theme.radius.sm,
        fill: true,
        stroke: false,
        style: { fillStyle: active ? token('ui.colors.background') : 'rgba(0,0,0,0)' },
      });
      row.setState({ interactive: true });
      row.on('click', () => this.__pick(option));
      row.addChild(
        new ICELabel({
          interactive: false,
          left: 10,
          top: 0,
          height: this.optionHeight,
          verticalAlign: 'middle',
          text: option,
          style: { fontSize: 13, fillStyle: token('ui.colors.text') },
        }),
        false,
      );
      content.addChild(row, false);
      this.optionNodes.set(option, row);
    });
    pane.setContent(content);
    panel.addChild(pane, false);
    // 键盘上下键移动高亮时，把当前项滚进视野
    if (this.activeIndex >= 0) {
      const top = this.activeIndex * this.optionHeight;
      if (top < pane.getScroll()[1] || top + this.optionHeight > pane.getScroll()[1] + viewportHeight) {
        pane.setScroll(0, Math.max(0, top - (viewportHeight - this.optionHeight) / 2));
      }
    }
    panel.setState({ height: viewportHeight + 8 });
    // 点击由面板统一处理：候选行在过滤时会重建，逐行监听会丢点击
    panel.setState({ interactive: true });
    if (!this.__panelBound) {
      panel.on('click', (evt: any) => this.__onPanelClick(evt));
      this.__panelBound = true;
    }
    if (this.ice && this.ice.dirty !== undefined) {
      this.ice.dirty = true;
    }
  }
}
