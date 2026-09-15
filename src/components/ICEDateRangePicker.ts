import { rotatedWeekdayKeys } from './ICECalendar';
import { ICELabel } from './ICELabel';
import { ICEPanel } from './ICEPanel';
import { ICEWidget } from '../core/ICEWidget';
import { iceUIManager } from '../core/ICEManager';
import { ICEOverlayManager, ICEOverlayHandle, getICEOverlayManager } from '../core/ICEOverlayManager';
import type { ICELocalizedProps } from '../i18n/ICEI18n';
import { ICE_DEFAULT_WEEK_START, resolveWeekStart } from '../i18n/ICEI18n';
import { readHovered } from '../util/ICEStyle';
import { ICEDateRangeModel, ICEDateRangePreset, ICE_DATE_RANGE_PRESETS } from '../model/ICEDateRangeModel';

/**
 * 区间日期选择器。
 *
 * - 字段分成两半（起 / 止），各有自己的占位文案：只选了起，止那一半还留着提示，
 *   用户一眼能看出「还差一下」；
 * - 浮层左边是快捷项列（今天 / 近 7 天 / 近 30 天 / 本月 / 上月），右边是单月网格，
 *   两列各占各的横向空间、互不交叠（`getPanelLayout()` 把这份版式暴露出来给测试与几何审计）；
 * - 区间要点两次：第一下定起点（进行中，浮层不关、不回调），第二下收口 —— 先点后用**自动排序**，
 *   所以「先点 20 再点 10」得到的是 10 → 20；
 * - 网格按区间着色：两端用主色实心，中间整段用主色浅底（区间是连续的一段，不是一个点）；
 * - 值统一是 `[起, 止]` 的 `YYYY-MM-DD` 字符串（可直接进表单），只选一头时另一头是 `null`。
 *
 * 规则全在 `ICEDateRangeModel`（纯逻辑）里，本组件只负责「画」与「把点击翻译成模型调用」。
 */

export type ICEDateRangePickerPlacement = 'bottomLeft' | 'bottomRight';

export interface ICEDateRangePickerOptions extends ICELocalizedProps {
  id?: string;
  /** 初始区间：`[起, 止]`，允许 `null`（只给一头 = 进行中） */
  value?: [string | null, string | null];
  /** 两半的占位文案，默认取内置词条（开始日期 / 结束日期） */
  placeholder?: [string, string];
  /** 一周首日（0=周日 … 6=周六）；缺省按 locale 推导 */
  weekStart?: number;
  disabled?: boolean;
  /** 注入「今天」（快捷项解析与今天高亮都用它），便于测试与演示 */
  today?: string;
  /** 时间源（快捷项用），默认取系统时间 */
  now?: () => Date;
  /** 自定义快捷项；不传用内置五项 */
  presets?: ICEDateRangePreset[];
  /** 是否显示左侧快捷项列（默认 true） */
  showPresets?: boolean;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  cellSize?: number;
  placement?: ICEDateRangePickerPlacement;
  /** 只有区间**完整**时才回调（进行中不回调） */
  onChange?: (value: [string, string]) => void;
  /** 清空（两头都抹掉）时回调 */
  onClear?: () => void;
  manager?: ICEOverlayManager;
}

export interface ICEDateRangeCell {
  date: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  /** 落在 [起, 止] 内（含两端）；只选了起时，起点本身也算 */
  inRange: boolean;
  isRangeStart: boolean;
  isRangeEnd: boolean;
}

export interface ICEDateRangeBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface ICEDateRangePanelLayout {
  panel: { width: number; height: number };
  presets: ICEDateRangeBox;
  calendar: ICEDateRangeBox;
}

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

function toDateString(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseDateString(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  const [year, month, day] = String(value).split('-').map((part) => Number(part));
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }
  return new Date(year, month - 1, day);
}

/** 面板版式的固定尺寸（左边快捷项列 + 右边单月网格），布局与渲染共用一份数字。 */
const PANEL_PADDING = 8;
const PRESET_WIDTH = 88;
const PRESET_ITEM_HEIGHT = 26;
const PRESET_ITEM_GAP = 2;
const COLUMN_GAP = 12;
const CALENDAR_INNER_PADDING = 8;
const HEADER_HEIGHT = 36;
const WEEKDAY_HEIGHT = 18;
const GRID_TOP = 56;
const FOOTER_HEIGHT = 26;

export class ICEDateRangePicker extends ICEWidget {
  private model: ICEDateRangeModel;
  private placeholder: [string, string];
  private disabled: boolean;
  private showPresets: boolean;
  private cellSize: number;
  private weekStart: number = ICE_DEFAULT_WEEK_START;
  private today: string;
  private placement: ICEDateRangePickerPlacement;
  private manager: ICEOverlayManager | null;
  private onChangeCallback: ((value: [string, string]) => void) | null;
  private onClearCallback: (() => void) | null;
  private handle: ICEOverlayHandle | null = null;
  private panel: ICEPanel | null = null;
  private startLabel: ICELabel | null = null;
  private endLabel: ICELabel | null = null;
  private monthLabel: ICELabel | null = null;
  private clearNode: ICEWidget | null = null;
  private dayNodes = new Map<string, ICEWidget>();
  private presetNodes = new Map<string, ICEWidget>();
  private viewYear = 1970;
  private viewMonth = 1;
  private running = false;

  constructor(props: ICEDateRangePickerOptions = {}) {
    const theme = iceUIManager.getTheme();
    const width = props.width ?? 240;
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
        fillStyle: theme.colors.surface,
        strokeStyle: theme.colors.border,
        lineWidth: theme.control.lineWidth,
      },
    });
    this.setLocale(props.locale);
    this.weekStart = resolveWeekStart(props.locale, props.weekStart);
    this.disabled = props.disabled === true;
    this.showPresets = props.showPresets !== false;
    this.cellSize = props.cellSize ?? 30;
    this.today = props.today || toDateString(new Date());
    this.placement = props.placement || 'bottomLeft';
    this.manager = props.manager || null;
    this.onChangeCallback = typeof props.onChange === 'function' ? props.onChange : null;
    this.onClearCallback = typeof props.onClear === 'function' ? props.onClear : null;
    this.placeholder = Array.isArray(props.placeholder)
      ? [String(props.placeholder[0]), String(props.placeholder[1])]
      : [this.t('dateRange.start'), this.t('dateRange.end')];
    this.model = new ICEDateRangeModel({ now: props.now, presets: props.presets });
    if (props.value) {
      this.model.setValue(parseDateString(props.value[0]), parseDateString(props.value[1]), { silent: true });
    }
    this.focusable = !this.disabled;
    this.focusRingMode = 'always';
    this.__setViewFromModel();
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
        this.ice.evtBus.on('mousedown', this.__onGlobalMouseDown, this);
      }
      this.on('click', this.__onClick, this);
      this.running = true;
    }
  }

  // ---- 取值 ----

  public getValue(): [string | null, string | null] {
    return [this.__toText(this.model.getStart()), this.__toText(this.model.getEnd())];
  }

  public setValue(start: string | null, end: string | null, options: { silent?: boolean } = {}): this {
    this.model.setValue(parseDateString(start), parseDateString(end), { silent: true });
    if (!options.silent) {
      this.__afterValueChanged();
    }
    this.__syncField();
    return this;
  }

  public isComplete(): boolean {
    return this.model.isComplete();
  }

  public getFormValue(): [string | null, string | null] {
    return this.getValue();
  }

  public setFormValue(value: any): void {
    if (!value) {
      this.setValue(null, null, { silent: true });
      return;
    }
    if (Array.isArray(value)) {
      this.setValue(value[0] ?? null, value[1] ?? null, { silent: true });
      return;
    }
    // 传字符串时按「起 = 止」的单日区间处理，兼容粗心的调用方
    this.setValue(String(value), String(value), { silent: true });
  }

  public clear(): this {
    this.model.setValue(null, null, { silent: true });
    this.__syncField();
    if (this.isOpen()) {
      this.__renderPanel();
    }
    if (this.onClearCallback) {
      this.onClearCallback();
    }
    return this;
  }

  // ---- 字段文本 ----

  public getFieldParts(): { start: string; end: string } {
    return {
      start: this.startLabel ? this.startLabel.getText() : this.placeholder[0],
      end: this.endLabel ? this.endLabel.getText() : this.placeholder[1],
    };
  }

  public getFieldText(): string {
    const parts = this.getFieldParts();
    return `${parts.start} → ${parts.end}`;
  }

  public getPlaceholder(): [string, string] {
    return [this.placeholder[0], this.placeholder[1]];
  }

  // ---- 开合 ----

  public isOpen(): boolean {
    return !!this.handle && this.handle.isOpen();
  }

  public getPanel(): ICEPanel | null {
    return this.panel;
  }

  public activate(): void {
    this.toggle();
  }

  public toggle(): this {
    return this.isOpen() ? this.close() : this.open();
  }

  public open(): this {
    if (this.disabled || this.isOpen()) {
      return this;
    }
    if (!this.manager) {
      if (!this.ice) {
        throw new Error('ICEDateRangePicker 需要先加入 ICE 场景');
      }
      this.manager = getICEOverlayManager(this.ice);
    }
    const layout = this.__computeLayout();
    const theme = iceUIManager.getTheme();
    const panel = new ICEPanel({
      width: layout.panel.width,
      height: layout.panel.height,
      radius: theme.radius.md,
      style: { fillStyle: theme.colors.surface, strokeStyle: theme.colors.border, shadow: 'md' },
    });
    this.panel = panel;
    this.__renderPanel();
    this.handle = this.manager.open({
      anchor: this,
      content: panel,
      placement: this.placement,
      offset: 4,
      enterAnimation: 'scale',
      exitAnimation: 'fade',
      keyboardCaptured: true,
      closeOnOutsideClick: false,
    });
    return this;
  }

  public close(): this {
    if (this.handle) {
      this.handle.close();
      this.handle = null;
    }
    this.panel = null;
    this.monthLabel = null;
    this.clearNode = null;
    this.dayNodes.clear();
    this.presetNodes.clear();
    return this;
  }

  // ---- 视图月份 ----

  public getViewMonth(): { year: number; month: number } {
    return { year: this.viewYear, month: this.viewMonth };
  }

  public setViewMonth(year: number, month: number): this {
    this.viewYear = Number(year);
    this.viewMonth = Math.min(12, Math.max(1, Number(month)));
    if (this.isOpen()) {
      this.__renderPanel();
    }
    return this;
  }

  public prevMonth(): this {
    const month = this.viewMonth - 1;
    return month < 1 ? this.setViewMonth(this.viewYear - 1, 12) : this.setViewMonth(this.viewYear, month);
  }

  public nextMonth(): this {
    const month = this.viewMonth + 1;
    return month > 12 ? this.setViewMonth(this.viewYear + 1, 1) : this.setViewMonth(this.viewYear, month);
  }

  // ---- 网格 ----

  public getDayCells(): ICEDateRangeCell[] {
    const first = new Date(this.viewYear, this.viewMonth - 1, 1);
    const weekday = (first.getDay() - this.weekStart + 7) % 7;
    const start = new Date(this.viewYear, this.viewMonth - 1, 1 - weekday);
    const rangeStart = this.model.getStart();
    const rangeEnd = this.model.getEnd();
    const at = (date: Date) => date.getTime();
    const from = rangeStart ? at(rangeStart) : null;
    const to = rangeEnd ? at(rangeEnd) : null;
    const cells: ICEDateRangeCell[] = [];
    for (let i = 0; i < 42; i++) {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const value = toDateString(date);
      const time = at(date);
      const lower = from !== null && to !== null ? Math.min(from, to) : from;
      const upper = from !== null && to !== null ? Math.max(from, to) : to;
      const isRangeStart = from !== null && time === from;
      const isRangeEnd = to !== null && time === to;
      const inRange =
        (lower !== null && upper !== null && time >= lower && time <= upper) ||
        (from !== null && to === null && time === from);
      cells.push({
        date: value,
        day: date.getDate(),
        inMonth: date.getMonth() === this.viewMonth - 1 && date.getFullYear() === this.viewYear,
        isToday: value === this.today,
        inRange,
        isRangeStart,
        isRangeEnd,
      });
    }
    return cells;
  }

  public getDayNode(date: string): ICEWidget | null {
    return this.dayNodes.get(date) || null;
  }

  // ---- 快捷项 ----

  public getPresetKeys(): string[] {
    return this.showPresets ? this.model.getPresets().map((item) => item.key) : [];
  }

  public getPresetNode(key: string): ICEWidget | null {
    return this.presetNodes.get(key) || null;
  }

  public getActivePresetKey(): string | null {
    return this.model.matchPreset();
  }

  public applyPreset(key: string): this {
    const [from, to] = this.model.applyPreset(key);
    this.viewYear = from.getFullYear();
    this.viewMonth = from.getMonth() + 1;
    this.__syncField();
    if (this.isOpen()) {
      this.__renderPanel();
    }
    if (this.onChangeCallback) {
      this.onChangeCallback([toDateString(from), toDateString(to)]);
    }
    return this;
  }

  // ---- 清空 ----

  public getClearNode(): ICEWidget | null {
    return this.clearNode;
  }

  public isClearVisible(): boolean {
    return !!this.clearNode;
  }

  // ---- 版式（测试与几何审计用） ----

  public getPanelLayout(): ICEDateRangePanelLayout | null {
    if (!this.panel) {
      return null;
    }
    return this.__computeLayout();
  }

  public getPresetBoxes(): ICEDateRangeBox[] {
    const layout = this.__computeLayout();
    return this.showPresets
      ? this.getPresetKeys().map((key, index) => ({
          left: layout.presets.left,
          top: layout.presets.top + index * (PRESET_ITEM_HEIGHT + PRESET_ITEM_GAP),
          width: PRESET_WIDTH,
          height: PRESET_ITEM_HEIGHT,
        }))
      : [];
  }

  // ---- 内部 ----

  private __toText(date: Date | null): string | null {
    return date ? toDateString(date) : null;
  }

  private __computeLayout(): ICEDateRangePanelLayout {
    const presetsWidth = this.showPresets ? PRESET_WIDTH : 0;
    const calendarLeft = PANEL_PADDING + presetsWidth + (this.showPresets ? COLUMN_GAP : 0);
    const gridWidth = CALENDAR_INNER_PADDING * 2 + this.cellSize * 7;
    const gridHeight = this.cellSize * 6;
    const footerTop = GRID_TOP + gridHeight + 6;
    const panelHeight = footerTop + FOOTER_HEIGHT + PANEL_PADDING;
    const panelWidth = calendarLeft + gridWidth + PANEL_PADDING;
    return {
      panel: { width: panelWidth, height: panelHeight },
      presets: {
        left: PANEL_PADDING,
        top: PANEL_PADDING,
        width: presetsWidth,
        height: panelHeight - PANEL_PADDING * 2,
      },
      calendar: {
        left: calendarLeft,
        top: GRID_TOP,
        width: gridWidth,
        height: gridHeight,
      },
    };
  }

  private __setViewFromModel(): void {
    const start = this.model.getStart() || parseDateString(this.today);
    if (start) {
      this.viewYear = start.getFullYear();
      this.viewMonth = start.getMonth() + 1;
    }
  }

  private __afterValueChanged(): void {
    if (this.isOpen()) {
      this.__renderPanel();
    }
  }

  private __pick(date: string): void {
    const target = parseDateString(date) as Date;
    if (this.model.isComplete() || !this.model.getStart()) {
      // 上一轮已收口（或空手）→ 这一下是新的起点
      this.model.setValue(target, null, { silent: true });
      this.__syncField();
      if (this.isOpen()) {
        this.__renderPanel();
      }
      return;
    }
    this.model.setValue(this.model.getStart(), target, { silent: true });
    this.__syncField();
    const value = this.getValue() as [string, string];
    this.close();
    if (this.onChangeCallback) {
      this.onChangeCallback(value);
    }
  }

  private __onClick(): void {
    if (this.disabled) {
      return;
    }
    this.toggle();
  }

  private __onKeyDown(evt: any): void {
    if (!this.isOpen()) {
      return;
    }
    const raw = evt && (evt.originalEvent || evt);
    const key = raw && (raw.key || raw.code);
    if (key === 'Escape' || key === 'Esc') {
      this.close();
    } else if (key === 'ArrowLeft') {
      this.prevMonth();
    } else if (key === 'ArrowRight') {
      this.nextMonth();
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
    const inside = (box: { left: number; top: number; width: number; height: number }) =>
      wx >= box.left && wx <= box.left + box.width && wy >= box.top && wy <= box.top + box.height;
    if (!inside(this.__worldBox(this)) && !inside(this.__worldBox(this.panel))) {
      this.close();
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
    return {
      left,
      top,
      width: Number(node && node.state && node.state.width) || 0,
      height: Number(node && node.state && node.state.height) || 0,
    };
  }

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
    const width = Number(this.state.width) || 240;
    const height = Number(this.state.height) || 32;
    const borderColor = this.validateStatus === 'error' ? theme.colors.error : theme.colors.border;
    this.setState({
      style: {
        ...this.state.style,
        fillStyle: this.disabled ? theme.colors.disabled : theme.colors.surface,
        strokeStyle: borderColor,
      },
    });
    this.removeChildren([...this.childNodes]);
    const [startText, endText] = this.getValue();
    const halvesRight = width - 10 - 22;
    const separatorWidth = 14;
    const halfWidth = Math.max(0, (halvesRight - 10 - separatorWidth) / 2);
    this.startLabel = new ICELabel({
      interactive: false,
      left: 10,
      top: 0,
      width: halfWidth,
      height,
      verticalAlign: 'middle',
      text: startText || this.placeholder[0],
      style: { fontSize: 13, fillStyle: startText ? theme.colors.text : theme.colors.textTertiary },
    });
    this.endLabel = new ICELabel({
      interactive: false,
      left: 10 + halfWidth + separatorWidth,
      top: 0,
      width: halfWidth,
      height,
      verticalAlign: 'middle',
      text: endText || this.placeholder[1],
      style: { fontSize: 13, fillStyle: endText ? theme.colors.text : theme.colors.textTertiary },
    });
    this.addChild(this.startLabel, false);
    this.addChild(
      new ICELabel({
        interactive: false,
        left: 10 + halfWidth,
        top: 0,
        width: separatorWidth,
        height,
        align: 'center',
        verticalAlign: 'middle',
        text: '→',
        style: { fontSize: 12, fillStyle: theme.colors.textTertiary },
      }),
      false,
    );
    this.addChild(this.endLabel, false);
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
        style: { fontSize: 12, fillStyle: theme.colors.textTertiary },
      }),
      false,
    );
  }

  private __renderPanel(): void {
    const panel = this.panel;
    if (!panel) {
      return;
    }
    const theme = iceUIManager.getTheme();
    const layout = this.__computeLayout();
    panel.removeChildren([...panel.childNodes]);
    this.dayNodes.clear();
    this.presetNodes.clear();
    this.clearNode = null;

    if (this.showPresets) {
      this.__renderPresets(panel, layout);
      panel.addChild(
        new ICEWidget({
          left: PANEL_PADDING + PRESET_WIDTH + COLUMN_GAP / 2,
          top: PANEL_PADDING,
          width: 1,
          height: layout.panel.height - PANEL_PADDING * 2,
          fill: true,
          stroke: false,
          style: { fillStyle: theme.colors.border },
        }),
        false,
      );
    }

    this.monthLabel = new ICELabel({
      interactive: false,
      left: layout.calendar.left + CALENDAR_INNER_PADDING,
      top: 6,
      width: layout.calendar.width - CALENDAR_INNER_PADDING * 2 - 56,
      height: HEADER_HEIGHT - 12,
      align: 'center',
      verticalAlign: 'middle',
      text: this.t('calendar.yearMonth', { year: this.viewYear, month: this.viewMonth }),
      style: { fontSize: 13, fontWeight: '600', fillStyle: theme.colors.text },
    });
    panel.addChild(this.monthLabel, false);

    const nav = (text: string, target: () => void, left: number) => {
      const node = new ICEWidget({
        left,
        top: 8,
        width: 24,
        height: 24,
        radius: theme.radius.sm,
        fill: true,
        stroke: false,
        style: { fillStyle: theme.colors.background },
      });
      node.addChild(
        new ICELabel({
          interactive: false,
          left: 0,
          top: 0,
          width: 24,
          height: 24,
          align: 'center',
          verticalAlign: 'middle',
          text,
          style: { fontSize: 14, fillStyle: theme.colors.text },
        }),
        false,
      );
      node.on('click', target, this);
      node.on(
        'hoverchange',
        (evt: any) => {
          node.setState({
            style: { ...node.state.style, fillStyle: readHovered(evt) ? theme.colors.disabled : theme.colors.background },
          });
        },
        this,
      );
      panel.addChild(node, false);
      return node;
    };
    nav('‹', () => this.prevMonth(), layout.calendar.left + 4);
    nav('›', () => this.nextMonth(), layout.calendar.left + layout.calendar.width - CALENDAR_INNER_PADDING - 24);

    rotatedWeekdayKeys(this.weekStart).forEach((key, index) => {
      panel.addChild(
        new ICELabel({
          interactive: false,
          left: layout.calendar.left + CALENDAR_INNER_PADDING + index * this.cellSize,
          top: HEADER_HEIGHT,
          width: this.cellSize,
          height: WEEKDAY_HEIGHT,
          align: 'center',
          verticalAlign: 'middle',
          text: this.t(key),
          style: { fontSize: 11, fillStyle: theme.colors.textTertiary },
        }),
        false,
      );
    });

    this.getDayCells().forEach((cell, index) => {
      const row = Math.floor(index / 7);
      const col = index % 7;
      const isEndpoint = cell.isRangeStart || cell.isRangeEnd;
      const fillStyle = isEndpoint
        ? theme.colors.primary
        : cell.inRange
        ? theme.colors.primaryBg
        : 'rgba(0,0,0,0)';
      const node = new ICEWidget({
        left: layout.calendar.left + CALENDAR_INNER_PADDING + col * this.cellSize,
        top: GRID_TOP + row * this.cellSize,
        width: this.cellSize,
        height: this.cellSize,
        radius: isEndpoint || !cell.inRange ? this.cellSize / 2 : 0,
        fill: true,
        stroke: !isEndpoint && cell.isToday && !cell.inRange,
        interactive: true,
        style: {
          fillStyle,
          strokeStyle: theme.colors.primary,
          lineWidth: 1,
        },
      });
      node.addChild(
        new ICELabel({
          interactive: false,
          left: 0,
          top: 0,
          width: this.cellSize,
          height: this.cellSize,
          align: 'center',
          verticalAlign: 'middle',
          text: String(cell.day),
          style: {
            fontSize: 12,
            fillStyle: isEndpoint
              ? theme.colors.primaryText
              : cell.inMonth
              ? theme.colors.text
              : theme.colors.textDisabled,
          },
        }),
        false,
      );
      node.on('click', () => this.__pick(cell.date));
      node.on(
        'hoverchange',
        (evt: any) => {
          if (isEndpoint || cell.inRange) {
            return;
          }
          node.setState({
            style: { ...node.state.style, fillStyle: readHovered(evt) ? theme.colors.background : 'rgba(0,0,0,0)' },
          });
        },
        this,
      );
      panel.addChild(node, false);
      this.dayNodes.set(cell.date, node);
    });

    // 页脚：左侧一行「进行中」提示，右侧清空
    const footerTop = layout.calendar.top + layout.calendar.height + 6;
    const hint = this.model.isComplete()
      ? `${this.model.getStart() ? toDateString(this.model.getStart() as Date) : ''} → ${
          this.model.getEnd() ? toDateString(this.model.getEnd() as Date) : ''
        }`
      : this.model.getStart()
      ? this.t('dateRange.pickEnd')
      : this.t('dateRange.pickStart');
    panel.addChild(
      new ICELabel({
        interactive: false,
        left: layout.calendar.left + CALENDAR_INNER_PADDING,
        top: footerTop,
        width: layout.calendar.width - CALENDAR_INNER_PADDING * 2 - 60,
        height: FOOTER_HEIGHT - 6,
        verticalAlign: 'middle',
        text: hint,
        style: { fontSize: 12, fillStyle: theme.colors.textTertiary },
      }),
      false,
    );
    const clear = new ICEWidget({
      left: layout.calendar.left + layout.calendar.width - CALENDAR_INNER_PADDING - 52,
      top: footerTop - 2,
      width: 52,
      height: FOOTER_HEIGHT - 2,
      radius: theme.radius.sm,
      fill: true,
      stroke: false,
      interactive: true,
      style: { fillStyle: theme.colors.background },
    });
    clear.addChild(
      new ICELabel({
        interactive: false,
        left: 0,
        top: 0,
        width: 52,
        height: FOOTER_HEIGHT - 2,
        align: 'center',
        verticalAlign: 'middle',
        text: this.t('dateRange.clear'),
        style: { fontSize: 12, fillStyle: theme.colors.textSecondary },
      }),
      false,
    );
    clear.on('click', () => this.clear(), this);
    clear.on(
      'hoverchange',
      (evt: any) => {
        clear.setState({
          style: { ...clear.state.style, fillStyle: readHovered(evt) ? theme.colors.disabled : theme.colors.background },
        });
      },
      this,
    );
    panel.addChild(clear, false);
    this.clearNode = clear;

    if (this.ice && this.ice.dirty !== undefined) {
      this.ice.dirty = true;
    }
  }

  private __renderPresets(panel: ICEPanel, layout: ICEDateRangePanelLayout): void {
    const theme = iceUIManager.getTheme();
    const active = this.model.matchPreset();
    this.model.getPresets().forEach((preset, index) => {
      const isActive = preset.key === active;
      const node = new ICEWidget({
        left: layout.presets.left,
        top: layout.presets.top + index * (PRESET_ITEM_HEIGHT + PRESET_ITEM_GAP),
        width: PRESET_WIDTH,
        height: PRESET_ITEM_HEIGHT,
        radius: theme.radius.sm,
        fill: true,
        stroke: false,
        interactive: true,
        style: { fillStyle: isActive ? theme.colors.primaryBg : 'rgba(0,0,0,0)' },
      });
      node.addChild(
        new ICELabel({
          interactive: false,
          left: 10,
          top: 0,
          width: PRESET_WIDTH - 16,
          height: PRESET_ITEM_HEIGHT,
          verticalAlign: 'middle',
          text: preset.label,
          style: {
            fontSize: 12,
            fontWeight: isActive ? '600' : '400',
            fillStyle: isActive ? theme.colors.primary : theme.colors.textSecondary,
          },
        }),
        false,
      );
      node.on(
        'click',
        () => {
          this.applyPreset(preset.key);
          this.close();
        },
        this,
      );
      node.on(
        'hoverchange',
        (evt: any) => {
          if (isActive) {
            return;
          }
          node.setState({
            style: { ...node.state.style, fillStyle: readHovered(evt) ? theme.colors.background : 'rgba(0,0,0,0)' },
          });
        },
        this,
      );
      panel.addChild(node, false);
      this.presetNodes.set(preset.key, node);
    });
  }
}

export default ICEDateRangePicker;

/** 内置快捷项（从模型层透出，界面层不必再 import 模型文件）。 */
export { ICE_DATE_RANGE_PRESETS };
