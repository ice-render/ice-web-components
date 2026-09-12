import { ICELabel } from './ICELabel';
import { ICEWidget } from '../core/ICEWidget';
import { iceUIManager } from '../core/ICEManager';

/**
 * 评分（业界组件库 Rate）：N 颗星，点击设置分值、悬停预览、键盘 ←/→ 调整。
 */
export interface ICERateOptions {
  count?: number;
  value?: number;
  disabled?: boolean;
  size?: number;
  color?: string;
  left?: number;
  top?: number;
  onChange?: (value: number) => void;
}

export class ICERate extends ICEWidget {
  private count: number;
  private value: number;
  private preview = 0;
  private disabled: boolean;
  private size: number;
  private color: string;
  private starNodes: ICEWidget[] = [];
  private onChange: ((value: number) => void) | null;
  private running = false;

  constructor(props: ICERateOptions = {}) {
    const theme = iceUIManager.getTheme();
    const count = Math.max(1, props.count ?? 5);
    const size = props.size ?? 24;
    super({
      fill: false,
      stroke: false,
      left: props.left,
      top: props.top,
      width: count * (size + 4),
      height: size,
      interactive: !(props.disabled === true),
    });
    this.count = count;
    this.value = Math.min(count, Math.max(0, Number(props.value) || 0));
    this.disabled = props.disabled === true;
    this.size = size;
    this.color = props.color || theme.colors.warning;
    this.onChange = typeof props.onChange === 'function' ? props.onChange : null;
    this.focusable = !this.disabled;
    this.__render();
  }

  protected afterAddHandler(): void {
    super.afterAddHandler();
    if (!this.running && this.ice && this.ice.evtBus && typeof this.ice.evtBus.on === 'function') {
      this.ice.evtBus.on('mousemove', this.__onMouseMove, this);
      this.ice.evtBus.on('keydown', this.__onKeyDown, this);
      // 点击由组件自身处理：星节点在 hover 预览时会重建，若让它们各自接点击，
      // 重建后的节点会丢掉 mousedown→click 的关联（实测点不中）
      this.on('click', this.__onClick, this);
      this.running = true;
    }
  }

  public getValue(): number {
    return this.value;
  }

  public setValue(value: number): this {
    const next = Math.min(this.count, Math.max(0, Math.round(Number(value) || 0)));
    if (next === this.value) {
      return this;
    }
    this.value = next;
    this.__render();
    return this;
  }

  public getPreviewValue(): number {
    return this.preview;
  }

  public getStarNodes(): ICEWidget[] {
    return this.starNodes.slice();
  }

  public setDisabled(disabled: boolean): this {
    this.disabled = !!disabled;
    this.focusable = !this.disabled;
    this.__render();
    return this;
  }

  /** 把指针 x 换算成星序号（1..count）。 */
  private __starIndexAt(offsetX: number): number {
    const box = this.__worldBox();
    const inside = offsetX >= box.left && offsetX <= box.left + box.width;
    if (!inside) {
      return 0;
    }
    const index = Math.ceil((offsetX - box.left) / (this.size + 4));
    return Math.min(this.count, Math.max(1, index));
  }

  private __onClick(evt: any): void {
    if (this.disabled || !evt || typeof evt.offsetX !== 'number') {
      return;
    }
    const index = this.__starIndexAt(evt.offsetX);
    if (index > 0) {
      this.__applyValue(index);
    }
  }

  private __onMouseMove(evt: any): void {
    if (this.disabled || !evt || typeof evt.offsetX !== 'number') {
      return;
    }
    const next = this.__starIndexAt(evt.offsetX);
    if (next && next !== this.preview) {
      this.preview = next;
      this.__render();
    }
  }

  private __onMouseLeave(): void {
    if (this.preview) {
      this.preview = 0;
      this.__render();
    }
  }

  private __onKeyDown(evt: any): void {
    if (this.disabled || !this.isFocused()) {
      return;
    }
    const raw = evt && (evt.originalEvent || evt);
    const key = raw && (raw.key || raw.code);
    if (key === 'ArrowRight' || key === 'ArrowUp') {
      this.__applyValue(this.value + 1);
    } else if (key === 'ArrowLeft' || key === 'ArrowDown') {
      this.__applyValue(this.value - 1);
    }
  }

  private __applyValue(value: number): void {
    const next = Math.min(this.count, Math.max(0, value));
    if (next === this.value) {
      return;
    }
    this.value = next;
    this.__render();
    if (this.onChange) {
      this.onChange(next);
    }
  }

  private __worldBox(): { left: number; top: number; width: number; height: number } {
    let left = 0;
    let top = 0;
    let node: any = this;
    while (node && node.state) {
      left += Number(node.state.left) || 0;
      top += Number(node.state.top) || 0;
      node = node.parentNode;
    }
    return { left, top, width: Number(this.state.width) || 0, height: Number(this.state.height) || 0 };
  }

  private __render(): void {
    const theme = iceUIManager.getTheme();
    this.removeChildren([...this.childNodes]);
    this.starNodes = [];
    const active = this.preview || this.value;
    for (let i = 0; i < this.count; i++) {
      const on = i < active;
      const star = new ICEWidget({
        left: i * (this.size + 4),
        top: 0,
        width: this.size,
        height: this.size,
        fill: false,
        stroke: false,
        interactive: false,
      });
      star.addChild(
        new ICELabel({
          interactive: false,
          left: 0,
          top: 0,
          width: this.size,
          height: this.size,
          align: 'center',
          verticalAlign: 'middle',
          text: on ? '★' : '☆',
          style: { fontSize: this.size - 4, fillStyle: on ? this.color : theme.colors.disabled },
        }),
        false,
      );

      this.addChild(star, false);
      this.starNodes.push(star);
    }
    if (this.ice && this.ice.dirty !== undefined) {
      this.ice.dirty = true;
    }
  }
}
