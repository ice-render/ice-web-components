import { ICEWidget } from '../core/ICEWidget';
import { ICECheckBox } from './ICECheckBox';
import { ICELabel } from './ICELabel';
import { iceUIManager } from '../core/ICEManager';
import { estimateTextWidth } from '../util/ICEStyle';
import { ICEBoxLayout } from 'ice-render';

/**
 * 多选组：一组可多选的选项，值是 `string[]`（按选项顺序）。
 *
 * - 整行可点（点文字也能勾选）；
 * - `max` 限制最多勾选几项，超出时忽略并触发 `exceed`（载荷 `{ value, max }`）；
 * - 键盘：方向键移动活动项、Space 切换；
 * - 表单：值为数组，`setFormValue` 兼容单值 / 空值；
 * - 事件：值变化触发 `change`（载荷 `{ value }`）并调用 `onChange`。
 */
export interface ICECheckboxGroupOption {
  value: string;
  label?: string;
  disabled?: boolean;
}

export interface ICECheckboxGroupOptions {
  /** 组件 id（引擎会用它做唯一标识，e2e/调试时可按 id 定位） */
  id?: string;
  options: ICECheckboxGroupOption[];
  /** 已选值（按选项顺序归一化） */
  value?: string[];
  direction?: 'horizontal' | 'vertical';
  itemGap?: number;
  /** 最多可勾选数量，不传表示不限 */
  max?: number;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  fontSize?: number;
  onChange?: (value: string[]) => void;
}

export class ICECheckboxGroup extends ICEWidget {
  private options: ICECheckboxGroupOption[];
  private selected: string[];
  private direction: 'horizontal' | 'vertical';
  private itemGap: number;
  private fontSize: number;
  private itemHeight: number;
  private max: number;
  private onChange: ((value: string[]) => void) | null;
  private itemNodes: ICEWidget[] = [];
  private checkboxNodes: ICECheckBox[] = [];
  private labelNodes: ICELabel[] = [];
  private activeIndex = 0;
  private bound = false;

  constructor(props: ICECheckboxGroupOptions) {
    const theme = iceUIManager.getTheme();
    const direction = props.direction === 'vertical' ? 'vertical' : 'horizontal';
    const itemHeight = props.height ?? theme.control.height;
    super({
      id: props.id,
      fill: false,
      stroke: false,
      left: props.left,
      top: props.top,
      width: props.width ?? 200,
      height: direction === 'vertical' ? itemHeight * Math.max(1, (props.options || []).length) : itemHeight,
    });
    this.focusable = true;
    this.options = (props.options || []).slice();
    this.direction = direction;
    this.itemGap = props.itemGap ?? theme.spacing.md;
    this.fontSize = props.fontSize ?? theme.font.size;
    this.itemHeight = itemHeight;
    this.max = Math.max(0, Number(props.max) || 0);
    this.onChange = typeof props.onChange === 'function' ? props.onChange : null;
    this.selected = this.__normalize(props.value);
    // 选项的排布交给引擎布局器（交叉轴 start = 保持自身尺寸、贴起点，与历史行为一致）。
    // 纵向的 `gap` 与 `ICERadioGroup` 同口径：历史行距 = itemHeight，`itemGap` 不参与（另议，先不改版式）。
    this.setLayout(
      new ICEBoxLayout({ axis: direction === 'vertical' ? 'y' : 'x', gap: direction === 'vertical' ? 0 : this.itemGap, align: 'start' })
    );
    this.__render(props.width !== undefined);
  }

  /** 已选值（按选项顺序）。 */
  public getValue(): string[] {
    return this.selected.slice();
  }

  public getCheckedCount(): number {
    return this.selected.length;
  }

  public isChecked(value: string): boolean {
    return this.selected.indexOf(value) !== -1;
  }

  /** 程序式设值：只发 `change` 事件，不回调 `onChange`。 */
  public setValue(value: string[]): this {
    const next = this.__normalize(value);
    if (next.join('\u0000') === this.selected.join('\u0000')) {
      return this;
    }
    this.selected = next;
    this.__syncSelection();
    this.trigger('change', null, { value: this.getValue() });
    return this;
  }

  /** 全选（受 `max` 限制）。 */
  public checkAll(): this {
    const values = this.options
      .filter((option) => !option.disabled)
      .slice(0, this.max > 0 ? this.max : undefined)
      .map((option) => option.value);
    return this.setValue(values);
  }

  public clear(): this {
    return this.setValue([]);
  }

  public getFormValue(): any {
    return this.getValue();
  }

  public setFormValue(value: any): void {
    if (value === undefined || value === null || value === '') {
      this.setValue([]);
      return;
    }
    this.setValue(Array.isArray(value) ? value.map((item) => String(item)) : [String(value)]);
  }

  public getOptionNodes(): ICEWidget[] {
    return this.itemNodes.slice();
  }

  public getItemNode(value: string): ICEWidget | null {
    const index = this.options.findIndex((option) => option.value === value);
    return index === -1 ? null : this.itemNodes[index];
  }

  public getCheckboxNode(value: string): ICECheckBox | null {
    const index = this.options.findIndex((option) => option.value === value);
    return index === -1 ? null : this.checkboxNodes[index];
  }

  public getLabelTexts(): string[] {
    return this.labelNodes.map((node) => node.getText());
  }

  public getActiveIndex(): number {
    return this.activeIndex;
  }

  public setOptions(options: ICECheckboxGroupOption[]): this {
    this.options = (options || []).slice();
    this.selected = this.__normalize(this.selected);
    this.activeIndex = 0;
    this.__render(true);
    return this;
  }

  protected afterAddHandler(): void {
    super.afterAddHandler();
    if (this.bound || !this.ice || !this.ice.evtBus) {
      return;
    }
    this.bound = true;
    this.ice.evtBus.on('keydown', this.__onKeyDown, this);
  }

  /** 去掉未知值 / 重复值 / 禁用值，并按选项顺序排列。 */
  private __normalize(value: any): string[] {
    const wanted = new Set((Array.isArray(value) ? value : value ? [value] : []).map((item) => String(item)));
    return this.options
      .filter((option) => wanted.has(option.value) && !option.disabled)
      .map((option) => option.value);
  }

  private __onKeyDown(evt: any): void {
    if (!this.ice || !this.enabled || !this.isFocused()) {
      return;
    }
    const raw = evt && (evt.originalEvent || evt);
    const key = raw && (raw.key || raw.code);
    if (key === 'ArrowRight' || key === 'ArrowDown') {
      this.__moveActive(1);
    } else if (key === 'ArrowLeft' || key === 'ArrowUp') {
      this.__moveActive(-1);
    } else if (key === ' ' || key === 'Spacebar' || key === 'Enter') {
      const option = this.options[this.activeIndex];
      if (option) {
        this.__toggle(option, false);
      }
    }
  }

  private __moveActive(delta: number): void {
    let index = this.activeIndex;
    for (let step = 0; step < this.options.length; step += 1) {
      index += delta;
      if (index < 0 || index >= this.options.length) {
        return;
      }
      if (!this.options[index].disabled) {
        this.activeIndex = index;
        return;
      }
    }
  }

  /** 切换一个选项；`user` 为 true 时回调 onChange。 */
  private __toggle(option: ICECheckboxGroupOption, user: boolean): void {
    if (!option || option.disabled || !this.enabled) {
      return;
    }
    this.activeIndex = this.options.indexOf(option);
    const checked = this.isChecked(option.value);
    if (!checked && this.max > 0 && this.selected.length >= this.max) {
      this.trigger('exceed', null, { value: option.value, max: this.max });
      return;
    }
    const next = checked
      ? this.selected.filter((item) => item !== option.value)
      : this.__normalize([...this.selected, option.value]);
    this.selected = next;
    this.__syncSelection();
    this.trigger('change', null, { value: this.getValue() });
    if (user && this.onChange) {
      this.onChange(this.getValue());
    }
  }

  private __syncSelection(): void {
    this.options.forEach((option, index) => {
      const checkbox = this.checkboxNodes[index];
      if (checkbox) {
        checkbox.setSelected(this.isChecked(option.value));
      }
    });
    this.revalidate();
    if (this.ice) {
      this.ice.dirty = true;
    }
  }

  private __render(adoptWidth: boolean): void {
    const theme = iceUIManager.getTheme();
    this.removeChildren([...this.childNodes]);
    this.itemNodes = [];
    this.checkboxNodes = [];
    this.labelNodes = [];

    const boxSize = theme.control.checkboxSize;
    const controlGap = theme.spacing.xs;
    let maxWidth = 0;

    this.options.forEach((option) => {
      const label = String(option.label ?? option.value);
      const textWidth = estimateTextWidth(label, this.fontSize);
      const itemWidth = boxSize + controlGap + textWidth;
      const item = new ICEWidget({
        width: itemWidth,
        height: this.itemHeight,
        fill: false,
        stroke: false,
        interactive: !option.disabled,
        focusable: false,
      });
      // 行内（框 + 缝 + 文字）与行间排布都交给引擎布局器
      item.setLayout(new ICEBoxLayout({ axis: 'x', gap: controlGap, align: 'start' }));
      const checkbox = new ICECheckBox({
        width: boxSize,
        height: this.itemHeight,
        selected: this.isChecked(option.value),
        focusable: false,
        interactive: false,
      });
      if (option.disabled) {
        checkbox.setEnabled(false);
      }
      const labelNode = new ICELabel({
        interactive: false,
        width: textWidth,
        height: this.itemHeight,
        text: label,
        verticalAlign: 'middle',
        style: {
          fontSize: this.fontSize,
          fontFamily: theme.font.family,
          fillStyle: option.disabled ? theme.colors.textDisabled : theme.colors.text,
        },
      });
      item.addChild(checkbox, false);
      item.addChild(labelNode, false);
      // 只挂 click：引擎对一次真实鼠标点击会先派发 mousedown 再派发 click，
      // 两个都挂会让「切换」语义执行两次（勾上又取消，表现为点了没反应）。
      item.on('click', () => this.__toggle(option, true));
      this.addChild(item, false);
      this.itemNodes.push(item);
      this.checkboxNodes.push(checkbox);
      this.labelNodes.push(labelNode);
      maxWidth = Math.max(maxWidth, itemWidth);
    });

    if (this.direction === 'vertical') {
      this.state.height = this.itemHeight * Math.max(1, this.options.length);
    }
    this.state.width = adoptWidth ? Math.max(Number(this.state.width) || 0, maxWidth) : maxWidth;
    this.__syncSelection();
  }
}
