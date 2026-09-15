import { ICEButton } from './ICEButton';
import { iceUIManager } from '../core/ICEManager';
import { estimateTextWidth } from '../util/ICEStyle';
import { ICEContainer } from '../core/ICEContainer';
import { ICEBoxLayout, ICEGridLayout } from 'ice-render';

/**
 * 分段控制器：
 * 一组互斥选项，选中项实心高亮。每个分段是 ICEButton，因此天然可聚焦（Tab/Enter 可操作）。
 *
 * 排列交给**引擎布局器**（2026-09-15 起），组件不再手算坐标：
 * - `block: true`（默认）→ `ICEGridLayout({ cols, gapX: 2, cellSizing: 'equal' })`：
 *   各段等分铺满（`equal` 就是 Swing `GridLayout` 的等宽等高口径），内缩 2 由容器 `padding` 承担；
 * - `block: false` → `ICEBoxLayout({ axis: 'x', gap: 2 })`：按各段自己的宽度依次排。
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
      // 内缩 2：等分/盒式的"内容盒"从 2px 开始（老实现是写死在 left/top 里的 2）
      padding: 2,
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
    this.__applyLayout();
    this.options.forEach((option, index) => {
      const selected = option.value === this.value;
      const button = new ICEButton({
        // 位置与尺寸交给布局器；非等分模式（BoxLayout 主轴不写尺寸）需要自己给宽度
        width: this.block ? undefined : this.__segmentWidth(option),
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

  /** 挂上当前形态对应的引擎布局（形态在构造期确定，`__render` 重建时重挂一次）。 */
  private __applyLayout(): void {
    const count = Math.max(1, this.options.length);
    if (this.block) {
      this.setLayout(new ICEGridLayout({ cols: count, gapX: 2, gapY: 0, cellSizing: 'equal' }));
    } else {
      this.setLayout(new ICEBoxLayout({ axis: 'x', gap: 2 }));
    }
  }

  /** 非等分模式下单个分段的宽度（按文字宽度估算，保底 48）。 */
  private __segmentWidth(option: ICESegmentedOption): number {
    return Math.max(48, estimateTextWidth(String(option.label ?? ''), 13) + 24);
  }

  /** 段起点：block 等宽推进；非 block 按各自宽度累加。 */
  private __segmentLeft(index: number, blockWidth: number, gap: number): number {
    if (this.block) {
      return 2 + index * (blockWidth + gap);
    }
    let left = 2;
    for (let i = 0; i < index; i += 1) {
      left += this.__segmentWidth(this.options[i]) + gap;
    }
    return left;
  }

  public isBlock(): boolean {
    return this.block;
  }

  /** 各段的实际盒子（测试与几何审计用）。 */
  public getSegmentBoxes(): Array<{ value: string; left: number; top: number; width: number; height: number }> {
    const gap = 2;
    const width = Number(this.state.width) || 240;
    const count = Math.max(1, this.options.length);
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
