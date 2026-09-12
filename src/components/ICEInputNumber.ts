import { ICELabel } from './ICELabel';
import { ICEWidget } from '../core/ICEWidget';
import { ICEButton } from './ICEButton';
import { iceUIManager } from '../core/ICEManager';

/**
 * 数字输入框（业界组件库 InputNumber / Swing JSpinner 的最小版）。
 *
 * - 左右步进按钮 + 键盘 ↑/↓ 步进，按 min/max 夹取，结果按 precision 取整；
 * - 支持直接输入数字（数字键 / 小数点 / 负号 / Backspace）；
 * - 表单集成：`getFormValue` / `setFormValue`，错误态边框标红。
 */
export interface ICEInputNumberOptions {
  value?: number;
  min?: number;
  max?: number;
  step?: number;
  precision?: number;
  disabled?: boolean;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  onChange?: (value: number) => void;
}

export class ICEInputNumber extends ICEWidget {
  private currentValue: number;
  private min: number;
  private max: number;
  private step: number;
  private precision: number;
  private disabled: boolean;
  private onChange: ((value: number) => void) | null;
  private textLabel: ICELabel | null = null;
  private decreaseButton: ICEButton | null = null;
  private increaseButton: ICEButton | null = null;
  private buffer = '';
  private running = false;

  constructor(props: ICEInputNumberOptions = {}) {
    const theme = iceUIManager.getTheme();
    const width = props.width ?? 140;
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
    this.min = props.min === undefined ? -Infinity : Number(props.min);
    this.max = props.max === undefined ? Infinity : Number(props.max);
    this.step = Number(props.step) || 1;
    this.precision = props.precision === undefined ? null as any : Number(props.precision);
    this.disabled = props.disabled === true;
    this.currentValue = this.__clamp(Number(props.value) || 0);
    this.onChange = typeof props.onChange === 'function' ? props.onChange : null;
    this.focusable = !this.disabled;
    this.__render();
  }

  protected afterAddHandler(): void {
    super.afterAddHandler();
    if (!this.running && this.ice && this.ice.evtBus && typeof this.ice.evtBus.on === 'function') {
      this.ice.evtBus.on('keydown', this.__onKeyDown, this);
      this.running = true;
    }
  }

  public getValue(): number {
    return this.currentValue;
  }

  public setValue(value: number): this {
    const next = this.__clamp(Number(value));
    if (next === this.currentValue) {
      return this;
    }
    this.currentValue = next;
    this.__render();
    return this;
  }

  public getFormValue(): any {
    return this.currentValue;
  }

  public setFormValue(value: any): void {
    this.setValue(Number(value));
  }

  public getText(): string {
    return this.__format(this.currentValue);
  }

  public getIncreaseButton(): ICEButton | null {
    return this.increaseButton;
  }

  public getDecreaseButton(): ICEButton | null {
    return this.decreaseButton;
  }

  public setEnabled(enabled: boolean): this {
    this.disabled = !enabled;
    this.focusable = !this.disabled;
    this.__render();
    return this;
  }

  private __applyValue(value: number): void {
    if (this.disabled) {
      return;
    }
    const next = this.__clamp(value);
    if (next === this.currentValue) {
      return;
    }
    this.currentValue = next;
    this.__render();
    if (this.onChange) {
      this.onChange(next);
    }
  }

  private __stepBy(direction: number): void {
    if (this.disabled) {
      return;
    }
    this.__applyValue(this.currentValue + direction * this.step);
  }

  private __onKeyDown(evt: any): void {
    if (this.disabled || !this.isFocused()) {
      return;
    }
    const raw = evt && (evt.originalEvent || evt);
    const key = raw && (raw.key || raw.code);
    if (key === 'ArrowUp') {
      this.__stepBy(1);
    } else if (key === 'ArrowDown') {
      this.__stepBy(-1);
    } else if (key === 'Backspace') {
      this.buffer = this.buffer.slice(0, -1);
      this.__applyValue(this.buffer === '' || this.buffer === '-' ? 0 : Number(this.buffer));
    } else if (key === 'Enter') {
      this.buffer = '';
    } else if (typeof key === 'string' && /^[0-9.-]$/.test(key)) {
      this.buffer = (this.buffer + key).slice(-12);
      const parsed = Number(this.buffer);
      if (Number.isFinite(parsed)) {
        this.__applyValue(parsed);
      }
    }
  }

  private __clamp(value: number): number {
    const base = Number.isFinite(value) ? value : 0;
    const bounded = Math.min(this.max, Math.max(this.min, base));
    return this.precision === null || this.precision === undefined
      ? bounded
      : Number(bounded.toFixed(this.precision));
  }

  private __format(value: number): string {
    return this.precision === null || this.precision === undefined ? String(value) : value.toFixed(this.precision);
  }

  private __render(): void {
    const theme = iceUIManager.getTheme();
    this.removeChildren([...this.childNodes]);
    const width = Number(this.state.width) || 140;
    const height = Number(this.state.height) || 32;
    const borderColor = this.validateStatus === 'error' ? theme.colors.error : theme.colors.border;
    this.setState({
      style: {
        ...this.state.style,
        fillStyle: this.disabled ? theme.colors.disabled : theme.colors.surface,
        strokeStyle: borderColor,
      },
    });

    const decrease = new ICEButton({
      left: 2,
      top: 2,
      width: 26,
      height: height - 4,
      text: '−',
      variant: 'text',
      size: 'small',
      focusable: false,
    });
    decrease.on('click', () => this.__stepBy(-1));
    const increase = new ICEButton({
      left: width - 28,
      top: 2,
      width: 26,
      height: height - 4,
      text: '+',
      variant: 'text',
      size: 'small',
      focusable: false,
    });
    increase.on('click', () => this.__stepBy(1));
    const label = new ICELabel({
      interactive: false,
      left: 32,
      top: 0,
      width: Math.max(0, width - 64),
      height,
      align: 'center',
      verticalAlign: 'middle',
      text: this.__format(this.currentValue),
      style: {
        fontSize: 13,
        fillStyle: this.disabled ? theme.colors.textDisabled : theme.colors.text,
      },
    });
    if (this.disabled) {
      decrease.setEnabled(false);
      increase.setEnabled(false);
    }
    this.addChild(decrease, false);
    this.addChild(label, false);
    this.addChild(increase, false);
    this.decreaseButton = decrease;
    this.increaseButton = increase;
    this.textLabel = label;
    if (this.ice && this.ice.dirty !== undefined) {
      this.ice.dirty = true;
    }
  }
}
