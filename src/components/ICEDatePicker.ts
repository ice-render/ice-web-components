import { ICELabel } from './ICELabel';
import { ICEPanel } from './ICEPanel';
import { ICEWidget } from '../core/ICEWidget';
import { iceUIManager } from '../core/ICEManager';
import { ICEOverlayManager, ICEOverlayHandle, getICEOverlayManager } from '../core/ICEOverlayManager';

/**
 * 日期选择器（业界组件库 DatePicker 的最小版）。
 *
 * - 字段区显示所选日期（可自定义 `format`），未选显示 placeholder，错误态边框标红；
 * - 日历浮层：月份标题 + ‹/› 切月 + 周标题（周一开头）+ 6×7 网格（含上下月补位）；
 *   今天、选中日分别高亮；
 * - 值统一是 `YYYY-MM-DD` 字符串（可序列化、可直接进表单）；
 * - 关闭策略与 Select 系列一致：浮层 closeOnOutsideClick:false，由组件自己判断点外 + Esc。
 */

export type ICEDatePickerPlacement = 'bottomLeft' | 'bottomRight';

export interface ICEDatePickerOptions {
  value?: string;
  placeholder?: string;
  disabled?: boolean;
  /** 显示格式（默认原样显示 YYYY-MM-DD） */
  format?: (value: string) => string;
  /** 注入「今天」，便于测试与演示 */
  today?: string;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  cellSize?: number;
  placement?: ICEDatePickerPlacement;
  onChange?: (value: string) => void;
  manager?: ICEOverlayManager;
}

export interface ICEDateCell {
  date: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
}

const WEEK_LABELS = ['一', '二', '三', '四', '五', '六', '日'];

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

function toDateString(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export class ICEDatePicker extends ICEWidget {
  private value: string | null;
  private placeholder: string;
  private disabled: boolean;
  private formatFn: (value: string) => string;
  private today: string;
  private cellSize: number;
  private placement: ICEDatePickerPlacement;
  private manager: ICEOverlayManager | null;
  private onChangeCallback: ((value: string) => void) | null;
  private handle: ICEOverlayHandle | null = null;
  private panel: ICEPanel | null = null;
  private fieldLabel: ICELabel | null = null;
  private monthLabel: ICELabel | null = null;
  private grid: ICEWidget | null = null;
  private dayNodes = new Map<string, ICEWidget>();
  private viewYear = 1970;
  private viewMonth = 1;
  private running = false;

  constructor(props: ICEDatePickerOptions = {}) {
    const theme = iceUIManager.getTheme();
    const width = props.width ?? 200;
    const height = props.height ?? theme.control.height;
    super({
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
    this.value = props.value ?? null;
    this.placeholder = props.placeholder || '';
    this.disabled = props.disabled === true;
    this.formatFn = typeof props.format === 'function' ? props.format : (value: string) => value;
    this.today = props.today || toDateString(new Date());
    this.cellSize = props.cellSize ?? 30;
    this.placement = props.placement || 'bottomLeft';
    this.manager = props.manager || null;
    this.onChangeCallback = typeof props.onChange === 'function' ? props.onChange : null;
    this.focusable = !this.disabled;
    this.__setViewFromValue();
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

  public getValue(): string | null {
    return this.value;
  }

  public setValue(value: string | null): this {
    this.value = value;
    this.__setViewFromValue();
    this.__syncField();
    if (this.isOpen()) {
      this.__renderPanel();
    }
    return this;
  }

  public getFormValue(): any {
    return this.value;
  }

  public setFormValue(value: any): void {
    this.setValue(value === undefined || value === null || value === '' ? null : String(value));
  }

  public getFieldLabel(): string {
    return this.fieldLabel ? this.fieldLabel.getText() : '';
  }

  public isOpen(): boolean {
    return !!this.handle && this.handle.isOpen();
  }

  public getPanel(): ICEPanel | null {
    return this.panel;
  }

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

  public getDayNode(date: string): ICEWidget | null {
    return this.dayNodes.get(date) || null;
  }

  /** 当前视图月的 6×7 网格（周一开头，含上下月补位）。 */
  public getDayCells(): ICEDateCell[] {
    const first = new Date(this.viewYear, this.viewMonth - 1, 1);
    const weekday = (first.getDay() + 6) % 7; // 周一 = 0
    const start = new Date(this.viewYear, this.viewMonth - 1, 1 - weekday);
    const cells: ICEDateCell[] = [];
    for (let i = 0; i < 42; i++) {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const value = toDateString(date);
      cells.push({
        date: value,
        day: date.getDate(),
        inMonth: date.getMonth() === this.viewMonth - 1 && date.getFullYear() === this.viewYear,
        isToday: value === this.today,
        isSelected: value === this.value,
      });
    }
    return cells;
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
        throw new Error('ICEDatePicker 需要先加入 ICE 场景');
      }
      this.manager = getICEOverlayManager(this.ice);
    }
    const width = this.cellSize * 7 + 16;
    const theme = iceUIManager.getTheme();
    const panel = new ICEPanel({
      width,
      height: 40 + 24 + this.cellSize * 6 + 12,
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
    this.grid = null;
    this.dayNodes.clear();
    return this;
  }

  private __setViewFromValue(): void {
    const source = this.value || this.today;
    const [year, month] = source.split('-').map((part) => Number(part));
    if (Number.isFinite(year) && Number.isFinite(month)) {
      this.viewYear = year;
      this.viewMonth = month;
    }
  }

  private __pick(date: string): void {
    this.value = date;
    this.__syncField();
    this.close();
    if (this.onChangeCallback) {
      this.onChangeCallback(date);
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

  private __syncField(): void {
    const theme = iceUIManager.getTheme();
    const width = Number(this.state.width) || 200;
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
    const text = this.value ? this.formatFn(this.value) : this.placeholder;
    this.fieldLabel = new ICELabel({
      interactive: false,
      left: 10,
      top: 0,
      width: Math.max(0, width - 34),
      height,
      verticalAlign: 'middle',
      text,
      style: { fontSize: 13, fillStyle: this.value ? theme.colors.text : theme.colors.textTertiary },
    });
    this.addChild(this.fieldLabel, false);
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
    panel.removeChildren([...panel.childNodes]);
    this.dayNodes.clear();
    const width = Number(panel.state.width) || this.cellSize * 7 + 16;
    const padding = 8;

    // 月份标题 + 切月按钮（用可点的 ICEWidget 做，避免额外依赖按钮样式）
    const prev = new ICEWidget({
      left: padding,
      top: 6,
      width: 24,
      height: 24,
      radius: theme.radius.sm,
      fill: true,
      stroke: false,
      style: { fillStyle: theme.colors.background },
    });
    prev.addChild(
      new ICELabel({
        interactive: false,
        left: 0,
        top: 0,
        width: 24,
        height: 24,
        align: 'center',
        verticalAlign: 'middle',
        text: '‹',
        style: { fontSize: 14, fillStyle: theme.colors.text },
      }),
      false,
    );
    prev.on('click', () => this.prevMonth());
    const next = new ICEWidget({
      left: width - padding - 24,
      top: 6,
      width: 24,
      height: 24,
      radius: theme.radius.sm,
      fill: true,
      stroke: false,
      style: { fillStyle: theme.colors.background },
    });
    next.addChild(
      new ICELabel({
        interactive: false,
        left: 0,
        top: 0,
        width: 24,
        height: 24,
        align: 'center',
        verticalAlign: 'middle',
        text: '›',
        style: { fontSize: 14, fillStyle: theme.colors.text },
      }),
      false,
    );
    next.on('click', () => this.nextMonth());
    this.monthLabel = new ICELabel({
      interactive: false,
      left: padding + 28,
      top: 6,
      width: width - padding * 2 - 56,
      height: 24,
      align: 'center',
      verticalAlign: 'middle',
      text: `${this.viewYear} 年 ${this.viewMonth} 月`,
      style: { fontSize: 13, fontWeight: '600', fillStyle: theme.colors.text },
    });
    panel.addChild(prev, false);
    panel.addChild(this.monthLabel, false);
    panel.addChild(next, false);

    // 周标题
    WEEK_LABELS.forEach((label, index) => {
      panel.addChild(
        new ICELabel({
          interactive: false,
          left: padding + index * this.cellSize,
          top: 38,
          width: this.cellSize,
          height: 20,
          align: 'center',
          verticalAlign: 'middle',
          text: label,
          style: { fontSize: 11, fillStyle: theme.colors.textTertiary },
        }),
        false,
      );
    });

    // 日期网格
    const grid = new ICEWidget({
      left: 0,
      top: 0,
      width: Number(panel.state.width) || width,
      height: Number(panel.state.height) || 0,
      fill: false,
      stroke: false,
    });
    this.grid = grid;
    this.getDayCells().forEach((cell, index) => {
      const row = Math.floor(index / 7);
      const col = index % 7;
      const node = new ICEWidget({
        left: padding + col * this.cellSize,
        top: 60 + row * this.cellSize,
        width: this.cellSize,
        height: this.cellSize,
        radius: this.cellSize / 2,
        fill: true,
        stroke: false,
        interactive: true,
        style: {
          fillStyle: cell.isSelected
            ? theme.colors.primary
            : cell.isToday
            ? theme.colors.primaryBg
            : 'rgba(0,0,0,0)',
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
            fillStyle: cell.isSelected
              ? theme.colors.primaryText
              : cell.inMonth
              ? theme.colors.text
              : theme.colors.textDisabled,
          },
        }),
        false,
      );
      node.on('click', () => this.__pick(cell.date));
      panel.addChild(node, false);
      this.dayNodes.set(cell.date, node);
    });
    if (this.ice && this.ice.dirty !== undefined) {
      this.ice.dirty = true;
    }
  }
}
