import { ICEWidget } from '../core/ICEWidget';
import { ICELabel } from './ICELabel';
import { ICEPanel } from './ICEPanel';
import { iceUIManager } from '../core/ICEManager';
import { ICEOverlayManager, ICEOverlayHandle, getICEOverlayManager } from '../core/ICEOverlayManager';
import { estimateTextWidth } from '../util/ICEStyle';
import { ICEScrollPane } from './ICEScrollPane';
import { computeVirtualRange } from './ICEVirtualList';
import { token } from 'ice-render';

/**
 * 选择器：输入框外观 + 下拉选项（单选 / 多选 / 搜索过滤）。
 *
 * - 字段区自绘（选中标签或 placeholder + 下拉箭头），错误态边框标红；
 * - 下拉走 `ICEOverlayManager`（工具层、点外关闭、Esc、入场动画），并声明 `keyboardCaptured`，
 *   打开期间方向键/Enter/字符输入由本组件处理（搜索过滤）；
 * - 可聚焦（Tab 可达），`activate()`（Enter/Space）打开下拉开；
 * - 表单集成：`getFormValue` / `setFormValue` 与 ICETextField 同语义。
 */

export interface ICESelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface ICESelectOptions {
  /** 组件 id（引擎会用它做唯一标识，e2e/调试时可按 id 定位） */
  id?: string;
  options: ICESelectOption[];
  value?: string | string[];
  /**
   * `single` 单选；`multiple` 多选；`tags` 多选 + 可以**创造**候选里没有的取值
   * （输入后回车，或点候选列表顶部的「创建」那一行）。
   */
  mode?: 'single' | 'multiple' | 'tags';
  showSearch?: boolean;
  /** 字段区最多画几个标签片，超出的折叠成 `+M`（只影响显示，取值始终是全量） */
  maxTagCount?: number;
  /** 候选区高度（默认 6 行）；候选比它高时候选区自己滚动 */
  listHeight?: number;
  /** 条数达到这个阈值就只渲染可视窗口（默认 100） */
  virtualThreshold?: number;
  placeholder?: string;
  disabled?: boolean;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  optionHeight?: number;
  onChange?: (value: any, option: any) => void;
  /** 是否参与键盘焦点轮转（默认 true，禁用时自动不可聚焦） */
  focusable?: boolean;
  manager?: ICEOverlayManager;
}

export class ICESelect extends ICEWidget {
  private options: ICESelectOption[];
  private mode: 'single' | 'multiple' | 'tags';
  private showSearch: boolean;
  private placeholder: string;
  private disabled: boolean;
  private selected: string[];
  private optionHeight: number;
  private onChange: ((value: any, option: any) => void) | null;
  private manager: ICEOverlayManager | null;
  private handle: ICEOverlayHandle | null = null;
  private fieldLabel: ICELabel | null = null;
  private panel: ICEPanel | null = null;
  private optionNodes = new Map<string, ICEWidget>();
  private visible: ICESelectOption[] = [];
  private query = '';
  private activeIndex = 0;
  private maxTagCount: number | null;
  private fieldText = '';
  private tagNodes: Array<{ value: string; label: string; node: any; close: any }> = [];
  private overflowCount = 0;
  private listHeight: number;
  private virtualThreshold: number;
  private virtual = false;
  private listScrollTop = 0;
  private listPane: ICEScrollPane | null = null;
  private listContent: any = null;
  private windowRange: { start: number; end: number; count: number } = { start: 0, end: 0, count: 0 };
  private running = false;

  constructor(props: ICESelectOptions) {
    const theme = iceUIManager.getTheme();
    const width = props.width ?? 200;
    const height = props.height ?? theme.control.height;
    super({
      id: props.id,
      fill: true,
      stroke: true,
      left: props.left,
      top: props.top,
      width,
      height,
      radius: theme.radius.md,
      style: {
        fillStyle: token('ui.colors.surface'),
        strokeStyle: token('ui.colors.border'),
        lineWidth: theme.control.lineWidth,
      },
    });
    this.options = (props.options || []).slice();
    this.mode = props.mode || 'single';
    this.maxTagCount = Number.isFinite(Number(props.maxTagCount)) ? Math.max(0, Math.floor(Number(props.maxTagCount))) : null;
    this.showSearch = props.showSearch === true;
    // tags 模式本质是多选 + 可创建：没有搜索行就没法输入，自动补上
    if (this.mode === 'tags') {
      this.showSearch = true;
    }
    this.placeholder = props.placeholder || '';
    this.disabled = props.disabled === true;
    this.optionHeight = props.optionHeight ?? 34;
    this.listHeight = Math.max(this.optionHeight, Math.floor(Number(props.listHeight) || this.optionHeight * 6));
    this.virtualThreshold = Math.max(1, Math.floor(Number(props.virtualThreshold) || 100));
    this.onChange = typeof props.onChange === 'function' ? props.onChange : null;
    // 构造期组件还没入场景（this.ice 为空），浮层管理器延迟到 afterAddHandler / open 再解析
    this.manager = props.manager || null;
    this.selected = this.__normalizeValue(props.value);
    this.focusable = props.focusable !== false && !this.disabled;
    // 文本类控件：鼠标点进去也要有「正在输入」的焦点反馈（:focus 语义）
    this.focusRingMode = 'always';
    this.__syncField();
  }

  protected afterAddHandler(): void {
    super.afterAddHandler();
    if (!this.running) {
      if (!this.manager && this.ice) {
        this.manager = getICEOverlayManager(this.ice);
      }
      if (this.ice && this.ice.evtBus && typeof this.ice.evtBus.on === 'function') {
        this.ice.evtBus.on('keydown', this.__onKeyDown, this);
      }
      // 鼠标点击开关下拉（键盘走 activate()）
      this.on('click', this.__onClick, this);
      this.running = true;
    }
  }

  /** 供测试/外部注入浮层管理器 */
  public setOverlayManager(manager: ICEOverlayManager): this {
    this.manager = manager;
    return this;
  }

  private __overlayManager(): ICEOverlayManager {
    if (!this.manager) {
      if (!this.ice) {
        throw new Error('ICESelect 需要先加入 ICE 场景（或显式 setOverlayManager）');
      }
      this.manager = getICEOverlayManager(this.ice);
    }
    return this.manager;
  }

  public getValue(): any {
    if (this.mode === 'multiple' || this.mode === 'tags') {
      return this.selected.slice();
    }
    return this.selected.length ? this.selected[0] : undefined;
  }

  public setValue(value: any): this {
    this.selected = this.__normalizeValue(value);
    this.__syncField();
    return this;
  }

  public getFormValue(): any {
    return this.getValue();
  }

  public setFormValue(value: any): void {
    this.setValue(value);
  }

  public isOpen(): boolean {
    return !!this.handle && this.handle.isOpen();
  }

  public getFieldLabel(): string {
    return this.fieldLabel ? this.fieldLabel.getText() : this.fieldText;
  }

  /** 字段区画出来的标签片（单选模式为空）。 */
  public getTagNodes(): Array<{ value: string; label: string; node: any; close: any }> {
    return this.tagNodes.map((tag) => ({ value: tag.value, label: tag.label, node: tag.node, close: tag.close }));
  }

  /** 被折叠成 `+M` 的标签数量。 */
  public getOverflowCount(): number {
    return this.overflowCount;
  }

  public getOverflowLabel(): string {
    return this.overflowCount > 0 ? `+${this.overflowCount}` : '';
  }

  /** 删掉一个标签（标签片上的 ✕、空查询时按 Backspace 都走这里）。 */
  public removeTag(value: string): this {
    const index = this.selected.indexOf(value);
    if (index === -1) {
      return this;
    }
    this.selected.splice(index, 1);
    this.__syncField();
    if (this.isOpen()) {
      this.__buildPanel();
    }
    if (this.onChange) {
      this.onChange(this.getValue(), null);
    }
    return this;
  }

  public getQuery(): string {
    return this.query;
  }

  public getVisibleOptions(): ICESelectOption[] {
    return this.visible.slice();
  }

  public getOptionNode(value: string): ICEWidget | null {
    return this.optionNodes.get(value) || null;
  }

  public setOptions(options: ICESelectOption[]): this {
    this.options = (options || []).slice();
    if (this.isOpen()) {
      this.__buildPanel();
    }
    return this;
  }

  public activate(): void {
    this.toggle();
  }

  public toggle(): this {
    return this.isOpen() ? this.close() : this.open();
  }

  private __onClick(): void {
    if (this.disabled) {
      return;
    }
    this.toggle();
  }

  public open(): this {
    if (this.disabled || this.isOpen()) {
      return this;
    }
    const manager = this.__overlayManager();
    this.panel = this.__createPanel();
    this.__buildPanel();
    this.handle = manager.open({
      anchor: this,
      content: this.panel,
      placement: 'bottomLeft',
      offset: 4,
      enterAnimation: 'scale',
      exitAnimation: 'fade',
      keyboardCaptured: true,
    });
    return this;
  }

  public close(): this {
    if (this.handle) {
      this.handle.close();
      this.handle = null;
    }
    this.panel = null;
    this.optionNodes.clear();
    this.query = '';
    this.visible = [];
    return this;
  }

  /** 键盘（打开期间）：搜索字符 / Backspace / ↑↓ / Enter / Esc。 */
  private __onKeyDown(evt: any): void {
    if (!this.isOpen()) {
      return;
    }
    const raw = evt && (evt.originalEvent || evt);
    const key = raw && (raw.key || raw.code);
    if (key === 'Escape' || key === 'Esc') {
      this.close();
      return;
    }
    if (key === 'ArrowDown' || key === 'ArrowUp') {
      this.__moveActive(key === 'ArrowDown' ? 1 : -1);
      return;
    }
    if (key === 'Enter') {
      const option = this.visible[this.activeIndex];
      if (option) {
        this.__pick(option);
      } else if (this.mode === 'tags' && this.query.trim()) {
        // tags：候选里没有就创造一个（这就是 tags 与 multiple 的唯一区别）
        this.__pick({ value: this.query.trim(), label: this.query.trim() });
      }
      return;
    }
    if (!this.showSearch || typeof key !== 'string') {
      return;
    }
    if (key === 'Backspace') {
      // 查询为空时，Backspace 删的是最后一个标签（输入法之外的常见手势）
      if (!this.query && (this.mode === 'multiple' || this.mode === 'tags') && this.selected.length) {
        this.removeTag(this.selected[this.selected.length - 1]);
        return;
      }
      this.__setQuery(this.query.slice(0, -1));
    } else if (key.length === 1 && !raw.metaKey && !raw.ctrlKey) {
      this.__setQuery(this.query + key);
    }
  }

  private __moveActive(step: number): void {
    const count = this.visible.length;
    if (!count) {
      return;
    }
    let index = this.activeIndex;
    for (let i = 0; i < count; i++) {
      index = (index + step + count) % count;
      if (!this.visible[index].disabled) {
        this.activeIndex = index;
        this.__buildPanel();
        this.__ensureActiveVisible();
        return;
      }
    }
  }

  private __setQuery(query: string): void {
    this.query = query;
    this.activeIndex = 0;
    this.__buildPanel();
  }

  private __pick(option: ICESelectOption): void {
    if (!option || option.disabled) {
      return;
    }
    if (this.mode === 'multiple' || this.mode === 'tags') {
      const index = this.selected.indexOf(option.value);
      if (index === -1) {
        this.selected.push(option.value);
      } else {
        this.selected.splice(index, 1);
      }
      this.__syncField();
      this.__buildPanel();
      // 创建完把查询清掉（否则下一个标签会被上一段文字干扰）
      if (this.mode === 'tags') {
        this.__setQuery('');
      }
      if (this.onChange) {
        this.onChange(this.getValue(), option);
      }
      return;
    }
    this.selected = [option.value];
    this.__syncField();
    this.close();
    if (this.onChange) {
      this.onChange(option.value, option);
    }
  }

  private __normalizeValue(value: any): string[] {
    if (this.mode === 'multiple' || this.mode === 'tags') {
      if (Array.isArray(value)) {
        return value.map(String);
      }
      return value === undefined || value === null || value === '' ? [] : [String(value)];
    }
    return value === undefined || value === null || value === '' ? [] : [String(value)];
  }

  /** 字段区：标签文本 / placeholder + 下拉箭头；同时处理错误态边框。 */
  /**
   * 尺寸变化时重排内部零件（`ICEWidget.__syncInternalLayout()`）。
   *
   * `__syncField()` 本来就是**从 `this.state.width/height` 现算**的（外框、文字盒、
   * 下拉箭头、清除按钮的位置全在里面），所以这里只需在尺寸变化时叫它跑一遍 ——
   * 以前它只挂在交互 / 取值路径上：父层布局把控件拉窄之后内部零件还停在构造期的尺寸，
   * 文字与箭头直接画到框外（等分网格里的下拉框必现）。
   */
  protected __syncInternalLayout(): void {
    this.__syncField();
  }

  private __syncField(): void {
    const theme = iceUIManager.getTheme();
    const width = Number(this.state.width) || 200;
    const height = Number(this.state.height) || 32;
    const borderColor =
      this.validateStatus === 'error' ? theme.colors.error : this.disabled ? theme.colors.borderSecondary : theme.colors.border;
    this.setState({
      style: {
        ...this.state.style,
        fillStyle: this.disabled ? theme.colors.disabled : theme.colors.surface,
        strokeStyle: borderColor,
      },
    });
    this.removeChildren([...this.childNodes]);
    this.tagNodes = [];
    this.overflowCount = 0;
    const labels = this.selected.map((value) => {
      const option = this.options.find((item) => item.value === value);
      return { value, label: option ? option.label : value };
    });
    const label = labels.map((item) => item.label).join('、');
    this.fieldText = label;

    // 多选 / tags：字段画成一串标签片（放不下或超过 maxTagCount 折叠成 +M）
    if (this.mode === 'multiple' || this.mode === 'tags') {
      this.fieldLabel = null;
      if (labels.length) {
        this.__renderTags(labels, width, height);
        return;
      }
    }
    this.fieldLabel = new ICELabel({
      interactive: false,
      left: 10,
      top: 0,
      width: Math.max(0, width - 34),
      height,
      verticalAlign: 'middle',
      text: label || this.placeholder,
      style: {
        fontSize: 13,
        fillStyle: label ? theme.colors.text : theme.colors.textTertiary,
      },
    });
    this.addChild(this.fieldLabel, false);
    this.addChild(
      new ICELabel({
        interactive: false,
        left: width - 22,
        top: 0,
        width: 14,
        height,
        verticalAlign: 'middle',
        align: 'center',
        text: '▾',
        style: { fontSize: 12, fillStyle: token('ui.colors.textTertiary') },
      }),
      false,
    );
  }

  /** 标签片布局：从左往右摆，装不下（或超过 maxTagCount）就折叠成 +M。 */
  private __renderTags(labels: Array<{ value: string; label: string }>, width: number, height: number): void {
    const theme = iceUIManager.getTheme();
    const limit = this.maxTagCount === null ? labels.length : Math.min(this.maxTagCount, labels.length);
    const available = width - 10 - 24; // 左边距 + 右侧箭头
    const tagHeight = Math.max(16, height - 10);
    const gap = 6;
    let left = 10;
    let used = 0;
    for (let index = 0; index < labels.length; index += 1) {
      const item = labels[index];
      const textWidth = estimateTextWidth(item.label, 12);
      const tagWidth = textWidth + 34; // 文字 + 左右内边距 + ✕
      const remaining = labels.length - index - 1;
      // 还要给后面的标签留一个 +M 的位置：宁可少画一个，也别把最后一个挤成半截
      const needOverflow = remaining > 0;
      const overflowWidth = needOverflow ? estimateTextWidth(`+${remaining + 1}`, 12) + 16 : 0;
      if (index >= limit || used + tagWidth + (needOverflow ? overflowWidth + gap : 0) > available) {
        this.overflowCount = labels.length - index;
        break;
      }
      used += tagWidth + gap;
      const chip = new ICEWidget({
        left,
        top: (height - tagHeight) / 2,
        width: tagWidth,
        height: tagHeight,
        radius: theme.radius.sm,
        fill: true,
        stroke: false,
        style: { fillStyle: token('ui.colors.primaryBg') },
      });
      chip.addChild(
        new ICELabel({
          interactive: false,
          left: 8,
          top: 0,
          width: textWidth,
          height: tagHeight,
          verticalAlign: 'middle',
          text: item.label,
          style: { fontSize: 12, fillStyle: token('ui.colors.link') },
        }),
        false,
      );
      const close = new ICEWidget({
        left: tagWidth - 20,
        top: 0,
        width: 16,
        height: tagHeight,
        fill: false,
        stroke: false,
        interactive: true,
      });
      close.addChild(
        new ICELabel({
          interactive: false,
          left: 0,
          top: 0,
          width: 16,
          height: tagHeight,
          align: 'center',
          verticalAlign: 'middle',
          text: '✕',
          style: { fontSize: 10, fillStyle: token('ui.colors.link') },
        }),
        false,
      );
      close.on('click', () => this.removeTag(item.value), this);
      chip.addChild(close, false);
      this.addChild(chip, false);
      this.tagNodes.push({ value: item.value, label: item.label, node: chip, close });
      left += tagWidth + gap;
    }
    if (this.overflowCount > 0) {
      const text = this.getOverflowLabel();
      this.addChild(
        new ICELabel({
          interactive: false,
          left,
          top: 0,
          width: 40,
          height,
          verticalAlign: 'middle',
          text,
          style: { fontSize: 12, fillStyle: token('ui.colors.textTertiary') },
        }),
        false,
      );
    }
    this.addChild(
      new ICELabel({
        interactive: false,
        left: width - 22,
        top: 0,
        width: 14,
        height,
        align: 'center',
        verticalAlign: 'middle',
        text: '▾',
        style: { fontSize: 12, fillStyle: token('ui.colors.textTertiary') },
      }),
      false,
    );
  }

  private __createPanel(): ICEPanel {
    const theme = iceUIManager.getTheme();
    const width = Number(this.state.width) || 200;
    const searchHeight = this.showSearch ? 30 : 0;
    return new ICEPanel({
      width,
      height: searchHeight + Math.min(6, this.options.length) * this.optionHeight + 8,
      radius: theme.radius.md,
      style: { fillStyle: token('ui.colors.surface'), strokeStyle: token('ui.colors.border'), shadow: 'md' },
    });
  }

  /** 重建下拉内容（搜索行 + 过滤后的选项）。 */
  private __buildPanel(): void {
    const panel = this.panel;
    if (!panel) {
      return;
    }
    const theme = iceUIManager.getTheme();
    panel.removeChildren([...panel.childNodes]);
    this.optionNodes.clear();
    const width = Number(panel.state.width) || Number(this.state.width) || 200;
    const searchHeight = this.showSearch ? 30 : 0;
    const query = this.query.trim().toLowerCase();
    this.visible = this.options.filter(
      (option) => !query || option.label.toLowerCase().indexOf(query) !== -1 || option.value.toLowerCase().indexOf(query) !== -1,
    );
    if (this.activeIndex >= this.visible.length) {
      this.activeIndex = 0;
    }

    if (this.showSearch) {
      panel.addChild(
        new ICELabel({
          interactive: false,
          left: 10,
          top: 0,
          width: width - 20,
          height: searchHeight,
          verticalAlign: 'middle',
          text: this.query ? this.query + '|' : '搜索…',
          style: { fontSize: 12, fillStyle: this.query ? theme.colors.text : theme.colors.textTertiary },
        }),
        false,
      );
    }

    // tags：查询词在候选里找不到时，给一行「创建」；它不进 `visible`（那一份永远是真实候选）
    const trimmed = this.query.trim();
    const canCreate =
      this.mode === 'tags' &&
      !!trimmed &&
      !this.options.some((option) => option.value === trimmed || option.label === trimmed);
    const createOffset = canCreate ? this.optionHeight : 0;
    if (canCreate) {
      const createRow = new ICEWidget({
        left: 4,
        top: 6 + searchHeight,
        width: width - 8,
        height: this.optionHeight,
        radius: theme.radius.sm,
        fill: true,
        stroke: false,
        style: { fillStyle: 'rgba(0,0,0,0)' },
      });
      createRow.addChild(
        new ICELabel({
          interactive: false,
          left: 10,
          top: 0,
          height: this.optionHeight,
          verticalAlign: 'middle',
          text: `创建「${trimmed}」`,
          style: { fontSize: 13, fillStyle: token('ui.colors.link') },
        }),
        false,
      );
      createRow.on('click', () => this.__pick({ value: trimmed, label: trimmed }));
      panel.addChild(createRow, false);
      this.optionNodes.set(trimmed, createRow);
    }

    // 候选区：比 listHeight 高就自己滚动；条数多到阈值以上只渲染可视窗口
    const listTop = 6 + searchHeight + createOffset;
    const contentHeight = this.visible.length * this.optionHeight;
    const viewportHeight = Math.min(this.listHeight, Math.max(this.optionHeight, contentHeight));
    const scrollable = contentHeight > this.listHeight;
    this.virtual = scrollable && this.visible.length >= this.virtualThreshold;
    this.listPane = null;
    this.listContent = null;
    if (scrollable) {
      // 视口滚的是「一个高等于总条数的空白内容盒」，行按窗口摆进去（与表格虚拟行同一套算法）
      this.listContent = new ICEWidget({
        left: 0,
        top: 0,
        width: width,
        height: contentHeight,
        fill: false,
        stroke: false,
        interactive: false,
      });
      this.listPane = new ICEScrollPane({
        left: 0,
        top: listTop,
        width,
        height: viewportHeight,
        scrollbar: true,
      });
      this.listPane.setContent(this.listContent);
      this.listPane.setContentSize(width, contentHeight);
      this.listPane.on('scroll', (evt: any) => {
        this.listScrollTop = evt && evt.param ? Number(evt.param.y) || 0 : 0;
        this.__syncWindow();
      });
      panel.addChild(this.listPane, false);
      this.setListScroll(this.listScrollTop);
    } else {
      this.listScrollTop = 0;
      this.visible.forEach((option, index) => {
        this.__renderOptionRow(panel, option, index, width, listTop + index * this.optionHeight);
      });
    }
    panel.setState({ height: listTop + viewportHeight + 6 });
    if (this.ice && this.ice.dirty !== undefined) {
      this.ice.dirty = true;
    }
  }

  /** 建一行候选（虚拟窗口与普通列表共用）。 */
  private __renderOptionRow(parent: any, option: ICESelectOption, index: number, width: number, top: number): void {
    const theme = iceUIManager.getTheme();
    const selected = this.selected.indexOf(option.value) !== -1;
    const active = index === this.activeIndex;
    const row = new ICEWidget({
      left: 4,
      top,
      width: width - 8,
      height: this.optionHeight,
      radius: theme.radius.sm,
      fill: true,
      stroke: false,
      style: {
        fillStyle: selected ? theme.colors.primaryBg : active ? theme.colors.background : 'rgba(0,0,0,0)',
      },
    });
    row.setState({ interactive: !option.disabled });
    const color = option.disabled
      ? theme.colors.textDisabled
      : selected
      ? theme.colors.primary
      : theme.colors.text;
    row.addChild(
      new ICELabel({
        interactive: false,
        left: 10,
        top: 0,
        height: this.optionHeight,
        verticalAlign: 'middle',
        text: option.label,
        style: { fontSize: 13, fillStyle: color },
      }),
      false,
    );
    if (selected) {
      row.addChild(
        new ICELabel({
          interactive: false,
          left: width - 32,
          top: 0,
          width: 16,
          height: this.optionHeight,
          verticalAlign: 'middle',
          text: '✓',
          style: { fontSize: 12, fillStyle: token('ui.colors.link') },
        }),
        false,
      );
    }
    if (!option.disabled) {
      row.on('click', () => this.__pick(option));
    }
    parent.addChild(row, false);
    this.optionNodes.set(option.value, row);
  }

  /** 按当前滚动位置重算可视窗口（非虚拟时就是全部）。 */
  private __syncWindow(): void {
    const content = this.listContent;
    if (!content || !this.listPane) {
      return;
    }
    const width = Number(this.listPane.state.width) || Number(this.state.width) || 200;
    const total = this.visible.length;
    const range = this.virtual
      ? computeVirtualRange({
          scrollTop: this.listScrollTop,
          viewportHeight: this.listPane.getViewportSize()[1],
          itemHeight: this.optionHeight,
          itemCount: total,
          buffer: 2,
        })
      : { start: 0, end: total, count: total };
    this.windowRange = range;
    content.removeChildren([...content.childNodes]);
    // 只清掉「属于候选窗口」的那批节点：tags 的「创建」行挂在面板上，不该被滚掉
    Array.from(this.optionNodes.keys()).forEach((value) => {
      const node = this.optionNodes.get(value);
      if (node && node.parentNode === content) {
        this.optionNodes.delete(value);
      }
    });
    for (let index = range.start; index < range.end; index += 1) {
      this.__renderOptionRow(content, this.visible[index], index, width, index * this.optionHeight);
    }
    if (this.ice && this.ice.dirty !== undefined) {
      this.ice.dirty = true;
    }
  }

  // ---- 大列表：滚动 / 虚拟窗口（测试与 e2e 用） ----

  public isVirtual(): boolean {
    return this.virtual;
  }

  public isListScrollable(): boolean {
    return !!this.listPane;
  }

  public getListScroll(): number {
    return this.listScrollTop;
  }

  public setListScroll(y: number): this {
    if (this.listPane) {
      this.listPane.setScroll(0, Number(y) || 0);
      const [x, actual] = this.listPane.getScroll();
      this.listScrollTop = actual;
      this.__syncWindow();
    }
    return this;
  }

  public getListContentHeight(): number {
    return this.visible.length * this.optionHeight;
  }

  /** 当前真的画出来的候选值（虚拟时就是那个窗口）。 */
  public getRenderedOptionValues(): string[] {
    if (!this.listPane) {
      return this.visible.map((option) => option.value);
    }
    return this.visible.slice(this.windowRange.start, this.windowRange.end).map((option) => option.value);
  }

  public getSelectedOptionValues(): string[] {
    return this.selected.slice();
  }

  public getActiveIndex(): number {
    return this.activeIndex;
  }

  /** 把 active 行滚进窗口（键盘走到看不见的地方是最烦人的一类 bug）。 */
  private __ensureActiveVisible(): void {
    if (!this.listPane) {
      return;
    }
    const top = this.activeIndex * this.optionHeight;
    const viewportHeight = this.listPane.getViewportSize()[1];
    const current = this.listScrollTop;
    if (top < current) {
      this.setListScroll(top);
    } else if (top + this.optionHeight > current + viewportHeight) {
      this.setListScroll(top + this.optionHeight - viewportHeight);
    }
  }

}
