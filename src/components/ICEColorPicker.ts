import { ICEWidget } from '../core/ICEWidget';
import { iceUIManager } from '../core/ICEManager';
import { ICEGridLayout } from 'ice-render';

/**
 * 颜色选择器。
 *
 * - 按 `colors` 渲染色块网格（`columns` 控制列数），选中色块带描边环；
 * - 点击色块回写 value 并回调 `onChange`；`disabled` 时忽略交互且不可聚焦；
 * - 键盘 ↑/↓/←/→ 在网格里移动选择；
 * - 表单集成：`getFormValue` / `setFormValue`，错误态边框标红。
 */
export interface ICEColorPickerOptions {
  /** 组件 id（引擎会用它做唯一标识，e2e/调试时可按 id 定位） */
  id?: string;
  colors?: string[];
  columns?: number;
  value?: string;
  swatchSize?: number;
  gap?: number;
  disabled?: boolean;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  onChange?: (color: string) => void;
}

export class ICEColorPicker extends ICEWidget {
  private colors: string[];
  private columns: number;
  private value?: string;
  private swatchSize: number;
  private gap: number;
  private padding: number;
  private disabled: boolean;
  private onChange: ((color: string) => void) | null;
  private cells: ICEWidget[] = [];
  private running = false;

  constructor(props: ICEColorPickerOptions = {}) {
    const theme = iceUIManager.getTheme();
    const colors = (props.colors && props.colors.length ? props.colors : ICEColorPicker.__defaultPalette()).slice();
    const columns = Math.max(1, Math.floor(props.columns ?? 6));
    const gap = props.gap ?? 8;
    const padding = 8;
    const rows = colors.length === 0 ? 0 : Math.ceil(colors.length / columns);
    const size = ICEColorPicker.__resolveSwatchSize(props, columns, gap, padding);
    const width = props.width ?? columns * size + (columns - 1) * gap + padding * 2;
    const height = props.height ?? padding * 2 + rows * size + Math.max(0, rows - 1) * gap;
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
    this.colors = colors;
    this.columns = columns;
    this.value = props.value === undefined ? undefined : String(props.value);
    this.swatchSize = size;
    this.gap = gap;
    this.padding = padding;
    this.disabled = props.disabled === true;
    this.onChange = typeof props.onChange === 'function' ? props.onChange : null;
    this.focusable = !this.disabled;
    // 文本类控件：鼠标点进去也要有「正在输入」的焦点反馈（:focus 语义）
    this.focusRingMode = 'always';
    if (this.disabled) {
      this.setEnabled(false);
    }
    // 色板是 `columns` 列的派生网格（格 = swatchSize，缝 = gap）→ 网格布局器 + 容器内距
    this.setState({ padding: { left: padding, top: padding } });
    this.setLayout(new ICEGridLayout({ cols: columns, gapX: gap, gapY: gap }));
    this.__render();
  }

  protected afterAddHandler(): void {
    super.afterAddHandler();
    if (!this.running && this.ice && this.ice.evtBus && typeof this.ice.evtBus.on === 'function') {
      this.ice.evtBus.on('keydown', this.__onKeyDown, this);
      this.running = true;
    }
  }

  public getValue(): string | undefined {
    return this.value;
  }

  public setValue(hex: string): this {
    const next = String(hex);
    if (this.value === next) {
      return this;
    }
    this.value = next;
    this.__render();
    return this;
  }

  public isSelected(hex: string): boolean {
    return this.value === hex;
  }

  public getSwatchNodes(): ICEWidget[] {
    return this.cells.slice();
  }

  public getSwatchNode(color: string): ICEWidget | null {
    const index = this.colors.indexOf(color);
    return index >= 0 ? this.cells[index] || null : null;
  }

  public getRowCount(): number {
    return this.colors.length === 0 ? 0 : Math.ceil(this.colors.length / this.columns);
  }

  public getFormValue(): any {
    return this.value;
  }

  public setFormValue(value: any): void {
    this.setValue(String(value));
  }

  protected __applyValidateState(): void {
    this.__render();
  }

  private __pick(color: string): void {
    if (this.disabled || this.value === color) {
      return;
    }
    this.value = color;
    this.__render();
    if (this.onChange) {
      this.onChange(color);
    }
  }

  private __onKeyDown(evt: any): void {
    if (this.disabled || !this.isFocused() || this.colors.length === 0) {
      return;
    }
    const raw = evt && (evt.originalEvent || evt);
    const key = raw && (raw.key || raw.code);
    const current = this.value === undefined ? -1 : this.colors.indexOf(this.value);
    const from = current < 0 ? 0 : current;
    let next = -1;
    if (key === 'ArrowRight') {
      next = Math.min(this.colors.length - 1, from + 1);
    } else if (key === 'ArrowLeft') {
      next = Math.max(0, from - 1);
    } else if (key === 'ArrowDown') {
      next = Math.min(this.colors.length - 1, from + this.columns);
    } else if (key === 'ArrowUp') {
      next = Math.max(0, from - this.columns);
    }
    if (next >= 0) {
      this.__pick(this.colors[next]);
    }
  }

  private __render(): void {
    const theme = iceUIManager.getTheme();
    this.removeChildren([...this.childNodes]);
    this.cells = [];
    const borderColor = this.validateStatus === 'error' ? theme.colors.error : theme.colors.border;
    this.setState({
      style: {
        ...this.state.style,
        fillStyle: this.disabled ? theme.colors.disabled : theme.colors.surface,
        strokeStyle: borderColor,
      },
    });

    this.colors.forEach((color, index) => {
      const selected = this.value === color;
      // 外层色块即命中区：选中时用主色描边成环，未选中保留细边框。
      const cell = new ICEWidget({
        width: this.swatchSize,
        height: this.swatchSize,
        radius: theme.radius.sm,
        fill: true,
        stroke: true,
        interactive: !this.disabled,
        style: {
          fillStyle: theme.colors.surface,
          strokeStyle: selected ? theme.colors.primary : borderColor,
          lineWidth: selected ? 2 : 1,
        },
      });
      // 内层色块只负责显示颜色，interactive:false 避免抢走外层点击。
      cell.addChild(
        new ICEWidget({
          left: 3,
          top: 3,
          width: Math.max(0, this.swatchSize - 6),
          height: Math.max(0, this.swatchSize - 6),
          radius: theme.radius.xs,
          fill: true,
          stroke: false,
          interactive: false,
          style: { fillStyle: color },
        }),
        false,
      );
      cell.on('click', () => this.__pick(color));
      this.addChild(cell, false);
      this.cells.push(cell);
    });
    if (this.ice && this.ice.dirty !== undefined) {
      this.ice.dirty = true;
    }
  }

  private static __resolveSwatchSize(
    props: ICEColorPickerOptions,
    columns: number,
    gap: number,
    padding: number,
  ): number {
    if (props.swatchSize !== undefined) {
      return Math.max(12, Number(props.swatchSize));
    }
    if (props.width !== undefined) {
      const available = Number(props.width) - padding * 2 - gap * (columns - 1);
      return Math.max(12, Math.floor(available / columns));
    }
    return 28;
  }

  private static __defaultPalette(): string[] {
    // Bootstrap 主题色板（$theme-colors + 扩展色），与整套主题同源
    return [
      '#0d6efd', // primary
      '#6610f2', // indigo
      '#6f42c1', // purple
      '#d63384', // pink
      '#dc3545', // danger
      '#fd7e14', // orange
      '#ffc107', // warning
      '#198754', // success
      '#20c997', // teal
      '#0dcaf0', // info
      '#6c757d', // secondary
      '#212529', // dark
    ];
  }
}
