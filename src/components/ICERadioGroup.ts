import { ICEWidget } from '../core/ICEWidget';
import { ICELabel } from './ICELabel';
import { ICERadioButton } from './ICERadioButton';
import { iceUIManager } from '../core/ICEManager';
import { estimateTextWidth } from '../util/ICEStyle';

/**
 * 单选组（业界组件库 Radio.Group）：一组互斥选项，整行可点，值是选项的 `value`。
 *
 * 与 `ICERadioButton` 的分工：单个按钮只管「选中/未选中」，**互斥与取值由本组件维护**，
 * 因此业务代码不用再自己写「点了 A 要把 B 取消」这类同步逻辑。
 *
 * - 键盘：聚焦后 ←/↑ 上一项、→/↓ 下一项（自动跳过禁用项），Enter/Space 选中当前项；
 * - 表单：实现取值约定，可直接放进 `ICEForm`；
 * - 事件：值变化触发 `change`（载荷 `{ value }`）并调用 `onChange`。
 */
export interface ICERadioGroupOption {
  value: string;
  label?: string;
  disabled?: boolean;
}

export interface ICERadioGroupOptions {
  /** 组件 id（引擎会用它做唯一标识，e2e/调试时可按 id 定位） */
  id?: string;
  options: ICERadioGroupOption[];
  /** 当前选中值（不在选项里的值会被忽略） */
  value?: string;
  /** 排布方向，默认 horizontal */
  direction?: 'horizontal' | 'vertical';
  /** 选项之间的间距，默认 16 */
  itemGap?: number;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  fontSize?: number;
  onChange?: (value: string) => void;
}

export class ICERadioGroup extends ICEWidget {
  private options: ICERadioGroupOption[];
  private value: string | null;
  private direction: 'horizontal' | 'vertical';
  private itemGap: number;
  private fontSize: number;
  private itemHeight: number;
  private onChange: ((value: string) => void) | null;
  private itemNodes: ICEWidget[] = [];
  private radioNodes: ICERadioButton[] = [];
  private labelNodes: ICELabel[] = [];
  private activeIndex = 0;
  private bound = false;

  constructor(props: ICERadioGroupOptions) {
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
    this.onChange = typeof props.onChange === 'function' ? props.onChange : null;
    this.value = this.__isKnown(props.value) ? String(props.value) : null;
    // 键盘活动项跟随初始值：聚焦后第一次按方向键是从「当前值」出发的
    this.activeIndex = this.value ? Math.max(0, this.options.findIndex((option) => option.value === this.value)) : 0;
    this.__render(props.width !== undefined);
  }

  public getValue(): string | null {
    return this.value;
  }

  /** 程序式改值：只发 `change` 事件，不回调 `onChange`（与库内其它控件一致）。 */
  public setValue(value: string): this {
    if (!this.__isKnown(value) || value === this.value) {
      return this;
    }
    this.value = String(value);
    this.activeIndex = Math.max(0, this.options.findIndex((option) => option.value === this.value));
    this.__syncSelection();
    this.trigger('change', null, { value: this.value });
    return this;
  }

  public getFormValue(): any {
    return this.value;
  }

  public setFormValue(value: any): void {
    if (value === undefined || value === null || value === '') {
      return;
    }
    this.setValue(String(value));
  }

  public getOptionNodes(): ICEWidget[] {
    return this.itemNodes.slice();
  }

  public getItemNode(value: string): ICEWidget | null {
    const index = this.options.findIndex((option) => option.value === value);
    return index === -1 ? null : this.itemNodes[index];
  }

  public getRadioNode(value: string): ICERadioButton | null {
    const index = this.options.findIndex((option) => option.value === value);
    return index === -1 ? null : this.radioNodes[index];
  }

  public getLabelTexts(): string[] {
    return this.labelNodes.map((node) => node.getText());
  }

  /** 当前键盘活动项（不一定是选中项）。 */
  public getActiveIndex(): number {
    return this.activeIndex;
  }

  public setOptions(options: ICERadioGroupOption[]): this {
    this.options = (options || []).slice();
    if (!this.__isKnown(this.value)) {
      this.value = null;
    }
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

  private __isKnown(value: any): boolean {
    return this.options.some((option) => option.value === value);
  }

  /** 选项 → 组内索引（跳过禁用项的下一项）。 */
  private __nextEnabled(from: number, delta: number): number {
    let index = from;
    for (let step = 0; step < this.options.length; step += 1) {
      index += delta;
      if (index < 0 || index >= this.options.length) {
        return from;
      }
      if (!this.options[index].disabled) {
        return index;
      }
    }
    return from;
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
    } else if (key === 'Enter' || key === ' ' || key === 'Spacebar') {
      const option = this.options[this.activeIndex];
      if (option) {
        this.__select(option, false);
      }
    }
  }

  private __moveActive(delta: number): void {
    const next = this.__nextEnabled(this.activeIndex, delta);
    if (next === this.activeIndex) {
      return;
    }
    this.activeIndex = next;
    this.__select(this.options[next], false);
  }

  /** 选中一个选项；`user` 为 true 时回调 onChange。 */
  private __select(option: ICERadioGroupOption, user: boolean): void {
    if (!option || option.disabled || !this.enabled) {
      return;
    }
    if (option.value === this.value) {
      return;
    }
    this.value = option.value;
    this.activeIndex = this.options.indexOf(option);
    this.__syncSelection();
    this.trigger('change', null, { value: this.value });
    if (user && this.onChange) {
      this.onChange(this.value);
    }
  }

  private __syncSelection(): void {
    this.options.forEach((option, index) => {
      const radio = this.radioNodes[index];
      if (radio) {
        radio.setSelected(option.value === this.value);
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
    this.radioNodes = [];
    this.labelNodes = [];

    const radioSize = theme.control.radioSize;
    const controlGap = theme.spacing.xs;
    let cursor = 0;
    let maxWidth = 0;

    this.options.forEach((option, index) => {
      const label = String(option.label ?? option.value);
      const textWidth = estimateTextWidth(label, this.fontSize);
      const itemWidth = radioSize + controlGap + textWidth;
      const left = this.direction === 'vertical' ? 0 : cursor;
      const top = this.direction === 'vertical' ? index * this.itemHeight : 0;
      // 整行（圈 + 文字）是一个可点节点：点文字也能选中，这是 业界组件库 的行为
      const item = new ICEWidget({
        left,
        top,
        width: itemWidth,
        height: this.itemHeight,
        fill: false,
        stroke: false,
        interactive: !option.disabled,
        focusable: false,
      });
      const radio = new ICERadioButton({
        left: 0,
        top: 0,
        width: radioSize,
        height: this.itemHeight,
        selected: option.value === this.value,
        focusable: false,
        interactive: false,
      });
      if (option.disabled) {
        radio.setEnabled(false);
      }
      const labelNode = new ICELabel({
        interactive: false,
        left: radioSize + controlGap,
        top: 0,
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
      item.addChild(radio, false);
      item.addChild(labelNode, false);
      // 只挂 click：mousedown + click 会被派发两次（选中语义幂等，但 onChange 语义不是）
      item.on('click', () => this.__select(option, true));
      this.addChild(item, false);
      this.itemNodes.push(item);
      this.radioNodes.push(radio);
      this.labelNodes.push(labelNode);
      maxWidth = Math.max(maxWidth, itemWidth);
      cursor += itemWidth + this.itemGap;
    });

    if (this.direction === 'vertical') {
      this.state.height = this.itemHeight * Math.max(1, this.options.length);
    }
    this.state.width = adoptWidth ? Math.max(Number(this.state.width) || 0, maxWidth) : maxWidth;
    this.__syncSelection();
  }
}
