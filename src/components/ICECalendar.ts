import { ICEWidget } from '../core/ICEWidget';
import { ICELabel } from './ICELabel';
import { iceUIManager } from '../core/ICEManager';
import type { ICELocalizedProps } from '../i18n/ICEI18n';

/** 周标题的文案 key（顺序 = 周一开头的展示顺序）。 */
export const ICE_CALENDAR_WEEKDAY_KEYS = [
  'calendar.weekday.mon',
  'calendar.weekday.tue',
  'calendar.weekday.wed',
  'calendar.weekday.thu',
  'calendar.weekday.fri',
  'calendar.weekday.sat',
  'calendar.weekday.sun',
];

/** `YYYY-MM-DD`（本地时区，日期选择器统一用这个字符串形态）。 */
export function formatCalendarDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export interface ICECalendarCell {
  date: string;
  day: number;
  /** 是否属于当前显示的月份 */
  inMonth: boolean;
}

/**
 * 生成月视图网格（固定 6 行 × 7 列 = 42 格，前后用相邻月份补齐）。
 * 默认周一开头（与 `ICEDatePicker` 一致）。
 */
export function buildMonthGrid(month: string, options: { weekStart?: number } = {}): ICECalendarCell[] {
  const [year, monthIndex] = __parseMonth(month);
  const weekStart = options.weekStart ?? 1;
  const first = new Date(year, monthIndex, 1);
  const offset = (first.getDay() - weekStart + 7) % 7;
  const start = new Date(year, monthIndex, 1 - offset);
  const cells: ICECalendarCell[] = [];
  for (let index = 0; index < 42; index += 1) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
    cells.push({
      date: formatCalendarDate(date),
      day: date.getDate(),
      inMonth: date.getMonth() === monthIndex && date.getFullYear() === year,
    });
  }
  return cells;
}

/** 把 `YYYY-MM` / `YYYY-MM-DD` / Date 统一整理成 `YYYY-MM`。 */
function __parseMonth(month: any): [number, number] {
  if (month instanceof Date) {
    return [month.getFullYear(), month.getMonth()];
  }
  const text = String(month ?? '');
  const match = /^(\d{4})-(\d{2})/.exec(text);
  if (match) {
    return [Number(match[1]), Number(match[2]) - 1];
  }
  const now = new Date();
  return [now.getFullYear(), now.getMonth()];
}

function __shiftMonth(month: string, delta: number): string {
  const [year, monthIndex] = __parseMonth(month);
  const date = new Date(year, monthIndex + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function __parseDate(value: any): Date | null {
  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value ?? ''));
  if (!match) {
    return null;
  }
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/**
 * 日历（业界组件库 Calendar 的最小版）：月视图 + 日期选择。
 *
 * - 标题「YYYY 年 M 月」+ 上/下月切换（回调 `onChangeMonth`）；
 * - 6×7 网格：相邻月份补齐的格子弱化显示，点击仍然可选；
 * - 选中日期实底高亮，今天带主色描边（`today` 可注入，便于测试与「业务今天」）；
 * - 键盘：←/→ 按天、↑/↓ 按周移动选中，PageUp/PageDown 切月。
 */
export interface ICECalendarOptions extends ICELocalizedProps {
  /** 组件 id（引擎会用它做唯一标识，e2e/调试时可按 id 定位） */
  id?: string;
  /** 选中日期 `YYYY-MM-DD` */
  value?: string;
  /** 当前显示的月份 `YYYY-MM`，默认取 value 所在月 / 今天所在月 */
  month?: string;
  /** 「今天」的日期（不传取系统时间；传了便于测试与业务定制） */
  today?: string;
  width?: number;
  height?: number;
  left?: number;
  top?: number;
  onSelect?: (date: string) => void;
  onChangeMonth?: (month: string) => void;
}

export class ICECalendar extends ICEWidget {
  private value: string | null = null;
  private visibleMonth: string;
  private today: string;
  private onSelect: ((date: string) => void) | null;
  private onChangeMonth: ((month: string) => void) | null;
  private cellHeight: number;
  private headerHeight = 40;
  private weekHeight = 24;
  private titleNode: ICELabel | null = null;
  private weekdayNodes: ICELabel[] = [];
  private cellNodes: ICEWidget[] = [];
  private cellLabels = new Map<string, ICELabel>();
  private cellNodeMap = new Map<string, ICEWidget>();
  private bound = false;

  constructor(props: ICECalendarOptions = {}) {
    const theme = iceUIManager.getTheme();
    const width = props.width ?? 280;
    const cellHeight = Math.round(Math.min(40, Math.max(28, (width - 16) / 7 / 1.4)));
    const value = __parseDate(props.value);
    const visibleMonth = props.month ?? (value ? formatCalendarDate(value).slice(0, 7) : formatCalendarDate(new Date()).slice(0, 7));
    const today = props.today ?? formatCalendarDate(new Date());
    const height = props.height ?? cellHeight * 6 + 64;
    super({
      id: props.id,
      fill: true,
      stroke: true,
      left: props.left,
      top: props.top,
      width,
      height,
      radius: theme.radius.md,
      style: { fillStyle: theme.colors.surface, strokeStyle: theme.colors.border, lineWidth: theme.control.lineWidth },
    });
    this.setLocale(props.locale); // 实例级语言（组件层文案可配、不持全局状态）
    this.focusable = true;
    this.value = value ? formatCalendarDate(value) : null;
    this.visibleMonth = visibleMonth;
    this.today = today;
    this.cellHeight = cellHeight;
    this.onSelect = typeof props.onSelect === 'function' ? props.onSelect : null;
    this.onChangeMonth = typeof props.onChangeMonth === 'function' ? props.onChangeMonth : null;
    this.__render();
  }

  public getValue(): string | null {
    return this.value;
  }

  public setValue(value: any, options: { silent?: boolean } = {}): this {
    const date = __parseDate(value);
    if (!date) {
      return this;
    }
    const next = formatCalendarDate(date);
    if (next === this.value) {
      return this;
    }
    this.value = next;
    this.visibleMonth = next.slice(0, 7);
    this.__render();
    if (!options.silent) {
      this.trigger('select', null, { date: next });
      if (this.onSelect) {
        this.onSelect(next);
      }
    }
    return this;
  }

  public getFormValue(): any {
    return this.value;
  }

  public setFormValue(value: any): void {
    if (value === undefined || value === null || value === '') {
      this.value = null;
      this.__render();
      return;
    }
    this.setValue(value, { silent: true });
  }

  public getVisibleMonth(): string {
    return this.visibleMonth;
  }

  public setVisibleMonth(month: string, options: { silent?: boolean } = {}): this {
    const next = `${__parseMonth(month)[0]}-${String(__parseMonth(month)[1] + 1).padStart(2, '0')}`;
    if (next === this.visibleMonth) {
      return this;
    }
    this.visibleMonth = next;
    this.__render();
    if (!options.silent) {
      this.trigger('changeMonth', null, { month: next });
      if (this.onChangeMonth) {
        this.onChangeMonth(next);
      }
    }
    return this;
  }

  public prevMonth(): this {
    return this.setVisibleMonth(__shiftMonth(this.visibleMonth, -1));
  }

  public nextMonth(): this {
    return this.setVisibleMonth(__shiftMonth(this.visibleMonth, 1));
  }

  public getTitleText(): string {
    return this.titleNode ? this.titleNode.getText() : '';
  }

  public getWeekdayTexts(): string[] {
    return this.weekdayNodes.map((node) => node.getText());
  }

  public getCellNodes(): ICEWidget[] {
    return this.cellNodes.slice();
  }

  public getCellNode(date: string): ICEWidget | null {
    return this.cellNodeMap.get(date) || null;
  }

  public getCellBackground(date: string): string {
    const node = this.cellNodeMap.get(date);
    return node ? String(node.state.style.fillStyle) : '';
  }

  public getCellTextColor(date: string): string {
    const label = this.cellLabels.get(date);
    const textNode = label && label.childNodes[0];
    return textNode ? String(textNode.state.style.fillStyle) : '';
  }

  public isToday(date: string): boolean {
    return date === this.today;
  }

  /** 程序式选中（不发事件）。 */
  public selectDate(date: string): this {
    const parsed = __parseDate(date);
    if (!parsed) {
      return this;
    }
    this.value = formatCalendarDate(parsed);
    this.visibleMonth = this.value.slice(0, 7);
    this.__render();
    return this;
  }

  public getPrevButton(): ICEWidget | null {
    return (this as any).prevButton || null;
  }

  public getNextButton(): ICEWidget | null {
    return (this as any).nextButton || null;
  }

  protected afterAddHandler(): void {
    super.afterAddHandler();
    if (this.bound || !this.ice || !this.ice.evtBus) {
      return;
    }
    this.bound = true;
    this.ice.evtBus.on('keydown', this.__onKeyDown, this);
  }

  private __shiftSelected(days: number): void {
    const base = __parseDate(this.value) || __parseDate(`${this.visibleMonth}-01`) || new Date();
    const next = new Date(base.getFullYear(), base.getMonth(), base.getDate() + days);
    this.setValue(formatCalendarDate(next));
  }

  private __onKeyDown(evt: any): void {
    if (!this.ice || !this.enabled || !this.isFocused()) {
      return;
    }
    const raw = evt && (evt.originalEvent || evt);
    const key = raw && (raw.key || raw.code);
    if (key === 'ArrowLeft') {
      this.__shiftSelected(-1);
    } else if (key === 'ArrowRight') {
      this.__shiftSelected(1);
    } else if (key === 'ArrowUp') {
      this.__shiftSelected(-7);
    } else if (key === 'ArrowDown') {
      this.__shiftSelected(7);
    } else if (key === 'PageUp') {
      const base = __parseDate(this.value) || __parseDate(`${this.visibleMonth}-01`) || new Date();
      this.setValue(formatCalendarDate(new Date(base.getFullYear(), base.getMonth() - 1, base.getDate())));
    } else if (key === 'PageDown') {
      const base = __parseDate(this.value) || __parseDate(`${this.visibleMonth}-01`) || new Date();
      this.setValue(formatCalendarDate(new Date(base.getFullYear(), base.getMonth() + 1, base.getDate())));
    }
  }

  private __render(): void {
    const theme = iceUIManager.getTheme();
    this.removeChildren([...this.childNodes]);
    this.weekdayNodes = [];
    this.cellNodes = [];
    this.cellLabels = new Map();
    this.cellNodeMap = new Map();

    const width = Number(this.state.width) || 280;
    const [year, monthIndex] = __parseMonth(this.visibleMonth);
    const padding = 8;
    const innerWidth = width - padding * 2;
    const cellWidth = innerWidth / 7;

    // 头部：‹ 标题 ›
    const prev = new ICEWidget({
      left: padding,
      top: 8,
      width: 28,
      height: 28,
      fill: false,
      stroke: false,
    });
    prev.addChild(
      new ICELabel({
        interactive: false,
        left: 0,
        top: 0,
        width: 28,
        height: 28,
        text: '‹',
        align: 'center',
        verticalAlign: 'middle',
        style: { fontSize: 16, fillStyle: theme.colors.textSecondary },
      }),
      false,
    );
    prev.on('click', () => this.prevMonth());
    const next = new ICEWidget({
      left: width - padding - 28,
      top: 8,
      width: 28,
      height: 28,
      fill: false,
      stroke: false,
    });
    next.addChild(
      new ICELabel({
        interactive: false,
        left: 0,
        top: 0,
        width: 28,
        height: 28,
        text: '›',
        align: 'center',
        verticalAlign: 'middle',
        style: { fontSize: 16, fillStyle: theme.colors.textSecondary },
      }),
      false,
    );
    next.on('click', () => this.nextMonth());
    (this as any).prevButton = prev;
    (this as any).nextButton = next;
    this.titleNode = new ICELabel({
      interactive: false,
      left: padding + 32,
      top: 8,
      width: innerWidth - 64,
      height: 28,
      text: this.t('calendar.yearMonth', { year, month: monthIndex + 1 }),
      align: 'center',
      verticalAlign: 'middle',
      style: { fontSize: 14, fontWeight: theme.font.weightSemibold, fillStyle: theme.colors.text },
    });
    this.addChild(prev, false);
    this.addChild(this.titleNode, false);
    this.addChild(next, false);

    // 星期表头
    const weekdays = ICE_CALENDAR_WEEKDAY_KEYS.map((key) => this.t(key));
    weekdays.forEach((text, index) => {
      const node = new ICELabel({
        interactive: false,
        left: padding + index * cellWidth,
        top: this.headerHeight,
        width: cellWidth,
        height: this.weekHeight,
        text,
        align: 'center',
        verticalAlign: 'middle',
        style: { fontSize: 12, fillStyle: theme.colors.textTertiary },
      });
      this.addChild(node, false);
      this.weekdayNodes.push(node);
    });

    // 日期格
    const cells = buildMonthGrid(this.visibleMonth);
    cells.forEach((cell, index) => {
      const row = Math.floor(index / 7);
      const col = index % 7;
      const selected = cell.date === this.value;
      const isToday = cell.date === this.today;
      const node = new ICEWidget({
        left: padding + col * cellWidth,
        top: this.headerHeight + this.weekHeight + row * this.cellHeight,
        width: cellWidth,
        height: this.cellHeight,
        fill: selected,
        stroke: isToday && !selected,
        radius: theme.radius.sm,
        style: {
          fillStyle: selected ? theme.colors.primary : 'rgba(0,0,0,0)',
          strokeStyle: theme.colors.primary,
          lineWidth: 1,
        },
      });
      const label = new ICELabel({
        interactive: false,
        left: 0,
        top: 0,
        width: cellWidth,
        height: this.cellHeight,
        text: String(cell.day),
        align: 'center',
        verticalAlign: 'middle',
        style: {
          fontSize: 13,
          fillStyle: selected
            ? theme.colors.primaryText
            : cell.inMonth
              ? theme.colors.text
              : theme.colors.textDisabled,
        },
      });
      node.addChild(label, false);
      node.on('click', () => this.setValue(cell.date));
      this.addChild(node, false);
      this.cellNodes.push(node);
      this.cellLabels.set(cell.date, label);
      this.cellNodeMap.set(cell.date, node);
    });

    this.revalidate();
    if (this.ice) {
      this.ice.dirty = true;
    }
  }
}
