import { UIButton } from './UIButton';
import { uiManager } from '../core/UIManager';
import { UIContainer } from '../core/UIContainer';

/**
 * 分段控制器（业界组件库 Segmented / iOS UISegmentedControl 的最小版）：
 * 一组互斥选项，选中项实心高亮。每个分段是 UIButton，因此天然可聚焦（Tab/Enter 可操作）。
 */
export interface UISegmentedOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface UISegmentedOptions {
  options: UISegmentedOption[];
  value?: string;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  onChange?: (value: string) => void;
}

export class UISegmented extends UIContainer {
  private options: UISegmentedOption[];
  private value: string | null;
  private heightValue: number;
  private onChange: ((value: string) => void) | null;
  private nodes = new Map<string, UIButton>();

  constructor(props: UISegmentedOptions) {
    const theme = uiManager.getTheme();
    const height = props.height ?? 32;
    super({
      fill: true,
      stroke: true,
      left: props.left,
      top: props.top,
      width: props.width ?? 240,
      height,
      radius: theme.radius.md,
      style: { fillStyle: theme.colors.background, strokeStyle: theme.colors.border },
    });
    this.options = (props.options || []).slice();
    this.value = props.value ?? (this.options.length ? this.options[0].value : null);
    this.heightValue = height;
    this.onChange = typeof props.onChange === 'function' ? props.onChange : null;
    this.__render();
  }

  public getValue(): string | null {
    return this.value;
  }

  public setValue(value: string): this {
    if (this.value === value) {
      return this;
    }
    this.value = value;
    this.__render();
    return this;
  }

  public getSegmentNode(value: string): UIButton | null {
    return this.nodes.get(value) || null;
  }

  private __render(): void {
    this.removeChildren([...this.childNodes]);
    this.nodes.clear();
    const width = Number(this.state.width) || 240;
    const count = Math.max(1, this.options.length);
    const gap = 2;
    const segmentWidth = (width - 4 - gap * (count - 1)) / count;
    this.options.forEach((option, index) => {
      const selected = option.value === this.value;
      const button = new UIButton({
        left: 2 + index * (segmentWidth + gap),
        top: 2,
        width: segmentWidth,
        height: this.heightValue - 4,
        text: option.label,
        size: 'small',
        variant: selected ? 'primary' : 'text',
        focusable: !option.disabled,
      });
      if (option.disabled) {
        button.setEnabled(false);
      }
      button.on('click', () => {
        if (option.disabled) {
          return;
        }
        const changed = this.value !== option.value;
        this.value = option.value;
        this.__render();
        if (changed && this.onChange) {
          this.onChange(option.value);
        }
      });
      this.addChild(button, false);
      this.nodes.set(option.value, button);
    });
    if (this.ice && this.ice.dirty !== undefined) {
      this.ice.dirty = true;
    }
  }
}
