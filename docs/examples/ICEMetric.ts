/**
 * 「写一个自己的组件」完整示例 —— 文档 docs/guides/custom-components.md 用的就是这个文件。
 *
 * 它刻意把自定义组件需要接触的面都覆盖了一遍：
 *
 * - 继承 `ICEWidget`，构造期就把子节点建好（本库的约定：构造结束即「画好了」）；
 * - `...props` 透传（`id` 等身份 props 不能吞掉）、内部展示节点 `interactive: false`；
 * - 主题：`iceUIManager.getTheme()` + `getStatusColors()`；
 * - 交互：`__applyHoverState()` 悬停、`this.on('click')` 点击、`focusable` + `activate()`；
 * - 键盘：全局 `evtBus` 的 `keydown`（↑/↓ 调值），并在处理函数里做空值守卫；
 * - 表单：`getFormValue` / `setFormValue` + `change` 事件；
 * - 校验：覆盖 `__applyValidateState()` 画错误态。
 *
 * 注意：这里用相对路径导入是为了让示例能被仓库里的单测直接跑到；
 * 在**你自己的项目**里请从包名导入：`import { ICEWidget } from 'ice-web-components'`。
 */
import { ICEWidget } from '../../src/core/ICEWidget';
import { ICELabel } from '../../src/components/ICELabel';
import { iceUIManager } from '../../src/core/ICEManager';
import { getStatusColors, ICEStatusColor } from '../../src/util/ICEStyle';

export interface ICEMetricOptions {
  /** 组件 id（引擎用它做唯一标识；e2e/调试时可按 id 定位） */
  id?: string;
  label: string;
  value?: number;
  unit?: string;
  /** 状态色：default / primary / success / warning / error / info */
  status?: ICEStatusColor;
  step?: number;
  min?: number;
  max?: number;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  onChange?: (value: number) => void;
}

const PADDING = 14;

export class ICEMetric extends ICEWidget {
  private label: string;
  private value: number;
  private unit: string;
  private status: ICEStatusColor;
  private step: number;
  private min: number;
  private max: number;
  private onChange: ((value: number) => void) | null;
  private valueNode: ICELabel | null = null;
  private running = false;

  constructor(props: ICEMetricOptions) {
    const theme = iceUIManager.getTheme();
    // ① 交给基类：**展开 props**（否则调用方传的 id 会被吞掉），再覆盖自己关心的字段
    super({
      ...props,
      fill: true,
      stroke: true,
      left: props.left,
      top: props.top,
      width: props.width ?? 200,
      height: props.height ?? 88,
      radius: theme.radius.md,
      style: {
        fillStyle: theme.colors.surface,
        strokeStyle: theme.colors.border,
        lineWidth: theme.control.lineWidth,
      },
    });
    this.label = props.label;
    this.unit = props.unit ?? '';
    this.status = props.status || 'primary';
    this.step = Number(props.step) || 1;
    // 先把 min/max 赋好，再算 value —— 子类字段没有声明提升，
    // 顺序写反会让 __clamp 里读到 undefined，结果是 NaN（这个示例的第一版就踩了）
    this.min = props.min === undefined ? -Infinity : Number(props.min);
    this.max = props.max === undefined ? Infinity : Number(props.max);
    this.value = this.__clamp(Number(props.value) || 0);
    this.onChange = typeof props.onChange === 'function' ? props.onChange : null;
    // ② 参与 Tab 焦点轮转（不需要键盘操作的展示组件就别开）
    this.focusable = true;
    // ③ 构造期就把内容画好：
    this.__render();
  }

  /** 组件加入 ICE 场景后调用：这里订阅全局键盘事件（必须在处理函数里判空）。 */
  protected afterAddHandler(): void {
    super.afterAddHandler();
    if (!this.running && this.ice && this.ice.evtBus && typeof this.ice.evtBus.on === 'function') {
      this.ice.evtBus.on('keydown', this.__onKeyDown, this);
      this.running = true;
    }
  }

  public getValue(): number {
    return this.value;
  }

  public setValue(value: number): this {
    const next = this.__clamp(value);
    if (next === this.value) {
      return this;
    }
    this.value = next;
    this.__render();
    this.trigger('change', null, { value: next });
    this.revalidate();
    return this;
  }

  /** ④ 表单约定：实现这两个方法就能直接放进 ICEForm */
  public getFormValue(): any {
    return this.value;
  }

  public setFormValue(value: any): void {
    this.setValue(Number(value));
  }

  /** ⑤ 键盘激活（Enter / Space）等价一次点击 —— 这里语义是「加一步」 */
  public activate(): void {
    this.__stepBy(this.step);
  }

  public getValueNode(): ICELabel | null {
    return this.valueNode;
  }

  /** ⑥ 悬停反馈：把视觉变化写在这里（由 ICEHoverManager 触发） */
  protected __applyHoverState(): void {
    const theme = iceUIManager.getTheme();
    this.setState({
      style: {
        ...this.state.style,
        strokeStyle: this.hovered ? theme.colors.primary : this.__borderColor(),
      },
    });
  }

  /** ⑦ 校验态：错误时描边标红（ICFormItem 会调用 setValidateStatus） */
  protected __applyValidateState(): void {
    const theme = iceUIManager.getTheme();
    this.setState({
      style: {
        ...this.state.style,
        strokeStyle: this.validateStatus === 'error' ? theme.colors.error : this.__borderColor(),
        lineWidth: this.validateStatus === 'error' ? theme.control.lineWidthFocused : theme.control.lineWidth,
      },
    });
    this.revalidate();
  }

  private __borderColor(): string {
    const theme = iceUIManager.getTheme();
    return this.enabled ? theme.colors.border : theme.colors.disabled;
  }

  private __clamp(value: number): number {
    const base = Number.isFinite(value) ? value : 0;
    return Math.min(this.max, Math.max(this.min, base));
  }

  private __stepBy(delta: number): void {
    if (!this.enabled) {
      return;
    }
    const before = this.value;
    this.setValue(this.value + delta);
    if (this.value !== before && this.onChange) {
      this.onChange(this.value);
    }
  }

  private __onKeyDown(evt: any): void {
    // 全局事件是广播过来的：先确认自己还挂在场景里、并且真的有焦点
    if (!this.ice || !this.isFocused() || !this.enabled) {
      return;
    }
    const raw = evt && (evt.originalEvent || evt);
    const key = raw && (raw.key || raw.code);
    if (key === 'ArrowUp') {
      this.__stepBy(this.step);
    } else if (key === 'ArrowDown') {
      this.__stepBy(-this.step);
    }
  }

  private __render(): void {
    const theme = iceUIManager.getTheme();
    const colors = getStatusColors(theme, this.status);
    const width = Number(this.state.width) || 200;
    const height = Number(this.state.height) || 88;
    this.removeChildren([...this.childNodes]);

    this.setState({
      style: {
        ...this.state.style,
        fillStyle: this.enabled ? theme.colors.surface : theme.colors.disabled,
        strokeStyle: this.validateStatus === 'error' ? theme.colors.error : this.__borderColor(),
      },
    });

    // ⑧ 左侧状态色条（纯装饰：interactive: false，别抢走点击）
    this.addChild(
      new ICEWidget({
        left: 0,
        top: 0,
        width: 4,
        height,
        radius: theme.radius.sm,
        fill: true,
        stroke: false,
        interactive: false,
        style: { fillStyle: colors.solid },
      }),
      false,
    );

    this.addChild(
      new ICELabel({
        interactive: false,
        left: PADDING,
        top: PADDING,
        width: Math.max(0, width - PADDING * 2),
        height: 16,
        verticalAlign: 'middle',
        text: this.label,
        style: { fontSize: 12, fillStyle: theme.colors.textSecondary },
      }),
      false,
    );

    this.valueNode = new ICELabel({
      interactive: false,
      left: PADDING,
      top: PADDING + 22,
      width: Math.max(0, width - PADDING * 2),
      height: 30,
      verticalAlign: 'middle',
      text: this.unit ? `${this.value} ${this.unit}` : String(this.value),
      style: { fontSize: 24, fontWeight: '600', fillStyle: colors.strong },
    });
    this.addChild(this.valueNode, false);

    this.addChild(
      new ICELabel({
        interactive: false,
        left: PADDING,
        top: height - PADDING - 14,
        width: Math.max(0, width - PADDING * 2),
        height: 14,
        verticalAlign: 'middle',
        text: '点击 +1 · 聚焦后 ↑/↓ 调整',
        style: { fontSize: 11, fillStyle: theme.colors.textTertiary },
      }),
      false,
    );
  }

  /** ⑨ 组件自己的点击语义：整块可点（子节点都设了 interactive: false，不会被抢走） */
  protected initEvents(): void {
    super.initEvents();
    this.on('click', () => this.__stepBy(this.step));
  }
}
