import { ICELabel } from './ICELabel';
import { ICEPanel } from './ICEPanel';
import { ICEWidget } from '../core/ICEWidget';
import { ICEScrollPane } from './ICEScrollPane';
import { iceUIManager } from '../core/ICEManager';
import { ICEOverlayManager, ICEOverlayHandle, getICEOverlayManager } from '../core/ICEOverlayManager';

/**
 * 时间选择器（业界组件库 TimePicker 的最小版）。
 *
 * - 字段区显示所选时间，未选显示 placeholder，错误态边框标红；
 * - 浮层是「时/分/秒」三列（`format: 'HH:mm'` 时只有两列），列内用 `ICEScrollPane` 滚动，
 *   打开时自动滚到当前取值；
 * - 取值受步进控制（`hourStep` / `minuteStep` / `secondStep`）；
 * - 点某个取值 → 只改该单位 → 回写值 + 关闭 + `onChange`（与 `ICEDatePicker` 的交互一致）；
 * - 关闭策略与 Select 系列一致：浮层 closeOnOutsideClick:false，由组件自己判断点外 + Esc。
 */

export type ICETimeUnit = 'hour' | 'minute' | 'second';
export type ICETimePickerFormat = 'HH:mm:ss' | 'HH:mm';
export type ICETimePickerPlacement = 'bottomLeft' | 'bottomRight';

export interface ICETimePickerOptions {
  /** 组件 id（引擎会用它做唯一标识，e2e/调试时可按 id 定位） */
  id?: string;
  value?: string;
  placeholder?: string;
  disabled?: boolean;
  /** 值格式：HH:mm:ss（默认）或 HH:mm */
  format?: ICETimePickerFormat;
  hourStep?: number;
  minuteStep?: number;
  secondStep?: number;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  placement?: ICETimePickerPlacement;
  onChange?: (value: string) => void;
  manager?: ICEOverlayManager;
}

interface TimeParts {
  hour: number;
  minute: number;
  second: number;
}

const COLUMN_WIDTH = 56;
const ROW_HEIGHT = 28;
const VISIBLE_ROWS = 5;
const PANEL_PADDING = 6;

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

function clampStep(step: number | undefined): number {
  const value = Math.floor(Number(step));
  return Number.isFinite(value) && value >= 1 ? value : 1;
}

export class ICETimePicker extends ICEWidget {
  private value?: string;
  private placeholder: string;
  private disabled: boolean;
  private format: ICETimePickerFormat;
  private steps: Record<ICETimeUnit, number>;
  private placement: ICETimePickerPlacement;
  private manager: ICEOverlayManager | null;
  private onChangeCallback: ((value: string) => void) | null;
  private handle: ICEOverlayHandle | null = null;
  private panel: ICEPanel | null = null;
  private fieldLabel: ICELabel | null = null;
  private columnNodes = new Map<ICETimeUnit, ICEScrollPane>();
  private optionNodes = new Map<string, ICEWidget>();
  private running = false;

  constructor(props: ICETimePickerOptions = {}) {
    const theme = iceUIManager.getTheme();
    const width = props.width ?? 160;
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
    this.value = props.value === undefined || props.value === null ? undefined : String(props.value);
    this.placeholder = props.placeholder || '';
    this.disabled = props.disabled === true;
    this.format = props.format === 'HH:mm' ? 'HH:mm' : 'HH:mm:ss';
    this.steps = {
      hour: clampStep(props.hourStep),
      minute: clampStep(props.minuteStep),
      second: clampStep(props.secondStep),
    };
    this.placement = props.placement || 'bottomLeft';
    this.manager = props.manager || null;
    this.onChangeCallback = typeof props.onChange === 'function' ? props.onChange : null;
    this.focusable = !this.disabled;
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
        this.ice.evtBus.on('mousedown', this.__onGlobalMouseDown, this);
      }
      this.on('click', this.__onClick, this);
      this.running = true;
    }
  }

  public getValue(): string | undefined {
    return this.value;
  }

  public setValue(value: string | null | undefined): this {
    this.value = value === undefined || value === null || value === '' ? undefined : String(value);
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
    this.setValue(value);
  }

  public getUnits(): ICETimeUnit[] {
    return this.format === 'HH:mm' ? ['hour', 'minute'] : ['hour', 'minute', 'second'];
  }

  /** 某一列的候选取值（补零字符串，受对应 step 控制）。 */
  public getColumnValues(unit: ICETimeUnit): string[] {
    const max = unit === 'hour' ? 23 : 59;
    const step = this.steps[unit] || 1;
    const values: string[] = [];
    for (let value = 0; value <= max; value += step) {
      values.push(pad(value));
    }
    return values;
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

  public getColumnNode(unit: ICETimeUnit): ICEScrollPane | null {
    return this.columnNodes.get(unit) || null;
  }

  public getOptionNode(unit: ICETimeUnit, value: string): ICEWidget | null {
    return this.optionNodes.get(`${unit}:${value}`) || null;
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
        throw new Error('ICETimePicker 需要先加入 ICE 场景');
      }
      this.manager = getICEOverlayManager(this.ice);
    }
    const theme = iceUIManager.getTheme();
    const units = this.getUnits();
    const panel = new ICEPanel({
      width: PANEL_PADDING * 2 + units.length * COLUMN_WIDTH,
      height: PANEL_PADDING * 2 + VISIBLE_ROWS * ROW_HEIGHT,
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
    this.columnNodes.clear();
    this.optionNodes.clear();
    return this;
  }

  protected __applyValidateState(): void {
    this.__syncField();
  }

  /** 解析当前值（未选/非法时全部按 0 起算）。 */
  private __parse(): TimeParts {
    const parts = (this.value || '').split(':');
    const parse = (text: string | undefined, max: number): number => {
      const value = Number(text);
      return Number.isFinite(value) ? Math.min(max, Math.max(0, Math.floor(value))) : 0;
    };
    return { hour: parse(parts[0], 23), minute: parse(parts[1], 59), second: parse(parts[2], 59) };
  }

  private __format(parts: TimeParts): string {
    const base = `${pad(parts.hour)}:${pad(parts.minute)}`;
    return this.format === 'HH:mm' ? base : `${base}:${pad(parts.second)}`;
  }

  private __pick(unit: ICETimeUnit, value: string): void {
    const parts = this.__parse();
    parts[unit] = Number(value) || 0;
    this.value = this.__format(parts);
    this.__syncField();
    this.close();
    if (this.onChangeCallback) {
      this.onChangeCallback(this.value);
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
    const width = Number(this.state.width) || 160;
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
    this.fieldLabel = new ICELabel({
      interactive: false,
      left: 10,
      top: 0,
      width: Math.max(0, width - 34),
      height,
      verticalAlign: 'middle',
      text: this.value || this.placeholder,
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
    this.columnNodes.clear();
    this.optionNodes.clear();
    const parts = this.__parse();
    const current: Record<ICETimeUnit, string> = {
      hour: pad(parts.hour),
      minute: pad(parts.minute),
      second: pad(parts.second),
    };
    const viewportHeight = VISIBLE_ROWS * ROW_HEIGHT;

    this.getUnits().forEach((unit, index) => {
      const values = this.getColumnValues(unit);
      const pane = new ICEScrollPane({
        left: PANEL_PADDING + index * COLUMN_WIDTH,
        top: PANEL_PADDING,
        width: COLUMN_WIDTH,
        height: viewportHeight,
        fill: false,
        stroke: false,
        style: { fillStyle: 'transparent', strokeStyle: 'transparent' },
      });
      const content = new ICEWidget({
        width: COLUMN_WIDTH,
        height: values.length * ROW_HEIGHT,
        fill: false,
        stroke: false,
      });
      values.forEach((value, rowIndex) => {
        const selected = this.value !== undefined && value === current[unit];
        const row = new ICEWidget({
          left: 0,
          top: rowIndex * ROW_HEIGHT,
          width: COLUMN_WIDTH,
          height: ROW_HEIGHT,
          radius: theme.radius.sm,
          fill: true,
          stroke: false,
          style: { fillStyle: selected ? theme.colors.primaryBg : 'transparent' },
        });
        row.addChild(
          new ICELabel({
            interactive: false,
            left: 0,
            top: 0,
            width: COLUMN_WIDTH,
            height: ROW_HEIGHT,
            align: 'center',
            verticalAlign: 'middle',
            text: value,
            style: {
              fontSize: 13,
              fontWeight: selected ? '600' : '400',
              fillStyle: selected ? theme.colors.primary : theme.colors.text,
            },
          }),
          false,
        );
        row.on('click', () => this.__pick(unit, value));
        content.addChild(row, false);
        this.optionNodes.set(`${unit}:${value}`, row);
      });
      pane.setContent(content);
      panel.addChild(pane, false);
      this.columnNodes.set(unit, pane);
      // 打开时把当前取值滚到视野中间
      const currentIndex = values.indexOf(current[unit]);
      if (currentIndex >= 0) {
        pane.setScroll(0, Math.max(0, currentIndex * ROW_HEIGHT - (viewportHeight - ROW_HEIGHT) / 2));
      }
    });
  }
}
