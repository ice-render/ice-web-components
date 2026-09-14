import { ICEButton } from './ICEButton';
import { iceUIManager } from '../core/ICEManager';
import { estimateTextWidth } from '../util/ICEStyle';
import { ICEContainer } from '../core/ICEContainer';

/**
 * 分段控制器：
 * 一组互斥选项，选中项实心高亮。每个分段是 ICEButton，因此天然可聚焦（Tab/Enter 可操作）。
 */
export interface ICESegmentedOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface ICESegmentedOptions {
  /** 组件 id（引擎会用它做唯一标识，e2e/调试时可按 id 定位） */
  id?: string;
  options: ICESegmentedOption[];
  value?: string;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  /**
   * `block`：各段等宽铺满整条（默认，也是老行为）；传 `false` 时按文字宽度排。
   *
   * 注意默认值必须是 `true`：后台筛选条都按「等宽铺满」排版，改成按文字宽度会让
   * 最后几段探出容器（几何审计在 admin 订单页抓到过）。
   */
  block?: boolean;
  onChange?: (value: string) => void;
}

export class ICESegmented extends ICEContainer {
  private options: ICESegmentedOption[];
  private value: string | null;
  private heightValue: number;
  private block = true;
  private onChange: ((value: string) => void) | null;
  private nodes = new Map<string, ICEButton>();

  constructor(props: ICESegmentedOptions) {
    const theme = iceUIManager.getTheme();
    const height = props.height ?? 32;
    super({
      id: props.id,
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
    this.block = props.block !== false;
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

  public getSegmentNode(value: string): ICEButton | null {
    return this.nodes.get(value) || null;
  }

  private __render(): void {
    this.removeChildren([...this.childNodes]);
    this.nodes.clear();
    const width = Number(this.state.width) || 240;
    const count = Math.max(1, this.options.length);
    const gap = 2;
    const blockWidth = (width - 4 - gap * (count - 1)) / count;
    this.options.forEach((option, index) => {
      const selected = option.value === this.value;
      const segmentWidth = this.block
        ? blockWidth
        : Math.max(48, estimateTextWidth(String(option.label ?? ''), 13) + 24);
      const segmentLeft = this.__segmentLeft(index, blockWidth, gap);
      const button = new ICEButton({
        left: segmentLeft,
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

  /** 段起点：block 等宽推进；非 block 按各自宽度累加。 */
  private __segmentLeft(index: number, blockWidth: number, gap: number): number {
    if (this.block) {
      return 2 + index * (blockWidth + gap);
    }
    let left = 2;
    for (let i = 0; i < index; i += 1) {
      left += Math.max(48, estimateTextWidth(String(this.options[i].label ?? ''), 13) + 24) + gap;
    }
    return left;
  }

  public isBlock(): boolean {
    return this.block;
  }

  /** 各段的实际盒子（测试与几何审计用）。 */
  public getSegmentBoxes(): Array<{ value: string; left: number; top: number; width: number; height: number }> {
    const width = Number(this.state.width) || 240;
    const count = Math.max(1, this.options.length);
    const gap = 2;
    const blockWidth = (width - 4 - gap * (count - 1)) / count;
    return this.options.map((option, index) => {
      const node = this.nodes.get(option.value);
      return {
        value: option.value,
        left: node ? Number(node.state.left) || 0 : this.__segmentLeft(index, blockWidth, gap),
        top: 2,
        width: node ? Number(node.state.width) || 0 : blockWidth,
        height: this.heightValue - 4,
      };
    });
  }
}
