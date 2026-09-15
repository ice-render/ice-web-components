import { ICEContainer } from '../core/ICEContainer';
import { ICEFormItem } from './ICEFormItem';
import { ICEFormModel, ICEFormRule } from '../model/ICEFormModel';
import { ICEBoxLayout } from 'ice-render';

/**
 * 表单容器：把若干 ICEFormItem 纵向堆叠，绑上校验模型。
 *
 * 纵向堆叠 + 每个表单项拉满宽度交给**引擎的箱式布局**（`ICEBoxLayout({ axis: 'y', align: 'stretch' })`，
 * `stretch` 就是 Swing BoxLayout 的默认口径）；本组件只保留一条自己的策略：
 * **高度等于内容高度**（`doLayout()` 之后同步一次）。
 *
 * - 值与校验都在 `ICEFormModel` 里（纯逻辑），ICEForm 负责「控件 ⇄ 模型」同步与错误渲染；
 * - 控件触发 `change` → 写回模型并按 validateTrigger 校验 → 模型通知 → 表单项更新错误显示；
 * - `submit()` 校验通过才回调 `onSubmit`（回调拿到当前值快照）。
 */

export interface ICEFormOptions {
  /** 组件 id（引擎会用它做唯一标识，e2e/调试时可按 id 定位） */
  id?: string;
  width?: number;
  gap?: number;
  /** 复用外部模型（表单与业务共享状态） */
  model?: ICEFormModel;
  items?: ICEFormItem[];
  /**
   * 改值后延迟多少毫秒再校验（默认 0 = 立刻校验）。
   *
   * 每敲一个字符就弹「格式不正确」是最讨嫌的交互之一：值**立刻**写进模型，
   * 只有错误提示延后；`validate()` / `submit()` 不受影响，仍然立刻出结果。
   */
  validateDebounce?: number;
  left?: number;
  top?: number;
}

export type ICEFormSubmitHandler = (values: Record<string, any>) => void;

export class ICEForm extends ICEContainer {
  private model: ICEFormModel;
  private items: ICEFormItem[] = [];
  private submitHandlers: ICEFormSubmitHandler[] = [];
  private itemGap: number;
  private validateDebounce: number;
  private debounceTimers = new Map<string, any>();
  /** reset 期间抑制「控件 change → 写回模型」，避免把初始值当成用户输入再校验一次 */
  private muted = false;

  constructor(props: ICEFormOptions = {}) {
    const width = props.width ?? 320;
    super({
      id: props.id,
      fill: false,
      stroke: false,
      // 纯布局容器：内部控件的点击不该被表单本身吃掉
      interactive: false,
      left: props.left,
      top: props.top,
      width,
      height: 0,
    });
    this.itemGap = props.gap ?? 16;
    // 纵向堆叠交给引擎布局：交叉轴 stretch = 每个表单项拉满表单宽度（Swing BoxLayout 的默认行为）
    this.setLayout(new ICEBoxLayout({ axis: 'y', gap: this.itemGap, align: 'stretch' }));
    this.validateDebounce = Math.max(0, Math.floor(Number(props.validateDebounce) || 0));
    this.model = props.model || new ICEFormModel();
    this.model.addChangeListener(() => this.__syncErrors());
    if (props.items) {
      this.addItems(props.items);
    }
  }

  public getModel(): ICEFormModel {
    return this.model;
  }

  /** 防抖排期：同一字段连续改值只跑最后一次；到点后校验该字段并刷新错误显示。 */
  private __scheduleValidate(name: string): void {
    const pending = this.debounceTimers.get(name);
    if (pending) {
      clearTimeout(pending);
    }
    const timer = setTimeout(() => {
      this.debounceTimers.delete(name);
      this.model.validateField(name);
      this.__syncErrors();
    }, this.validateDebounce);
    this.debounceTimers.set(name, timer);
  }

  /** 取消防抖（组件卸载 / 立刻校验前调用）。 */
  public flushValidateDebounce(): this {
    Array.from(this.debounceTimers.keys()).forEach((name) => {
      const timer = this.debounceTimers.get(name);
      if (timer) {
        clearTimeout(timer);
      }
      this.debounceTimers.delete(name);
      this.model.validateField(name);
    });
    this.__syncErrors();
    return this;
  }

  public getItems(): ICEFormItem[] {
    return this.items.slice();
  }

  public addItems(items: ICEFormItem[]): this {
    items.forEach((item) => this.addItem(item));
    return this;
  }

  public addItem(item: ICEFormItem): this {
    this.items.push(item);
    const name = item.getName();
    const control = item.getControl();
    this.model.addField({
      name,
      label: item.getLabel(),
      rules: item.getRules() as ICEFormRule[],
      dependencies: item.getDependencies ? item.getDependencies() : [],
      value: control.getFormValue ? control.getFormValue() : undefined,
    });
    if (control && typeof control.on === 'function') {
      control.on('change', () => {
        if (this.muted) {
          return;
        }
        const value = control.getFormValue ? control.getFormValue() : undefined;
        if (this.validateDebounce > 0) {
          // 值先落进模型（getValues 立刻是最新的），错误提示延后
          this.model.setValue(name, value, { silent: true });
          this.__scheduleValidate(name);
        } else {
          this.model.setValue(name, value);
        }
      });
    }
    this.addChild(item, false);
    this.__syncErrors();
    return this;
  }

  public getValues(): Record<string, any> {
    return this.model.getValues();
  }

  public setValues(values: Record<string, any>): this {
    // 先写控件（会触发 change → 写回模型并校验），没有对应控件的字段直接写模型
    this.items.forEach((item) => {
      const name = item.getName();
      if (Object.prototype.hasOwnProperty.call(values, name)) {
        const control = item.getControl();
        if (control && typeof control.setFormValue === 'function') {
          control.setFormValue(values[name]);
        }
      }
    });
    this.model.setValues(values, { silent: true });
    this.model.validate();
    this.__syncErrors();
    return this;
  }

  public reset(): this {
    this.muted = true;
    try {
      this.model.reset();
      this.items.forEach((item) => {
        const control = item.getControl();
        if (control && typeof control.setFormValue === 'function') {
          control.setFormValue(this.model.getValue(item.getName()));
        }
      });
    } finally {
      this.muted = false;
    }
    this.__syncErrors();
    return this;
  }

  public validate(): boolean {
    const ok = this.model.validate();
    this.__syncErrors();
    return ok;
  }

  /** 同步 + 异步校验全部字段（返回是否通过）。 */
  public async validateAsync(): Promise<boolean> {
    const ok = await this.model.validateAsync();
    this.__syncErrors();
    return ok;
  }

  public onSubmit(handler: ICEFormSubmitHandler): this {
    this.submitHandlers.push(handler);
    return this;
  }

  /** 校验通过才回调 onSubmit。 */
  public submit(): boolean {
    if (!this.validate()) {
      return false;
    }
    const values = this.getValues();
    this.submitHandlers.forEach((handler) => handler(values));
    return true;
  }

  /** 异步版提交：等异步校验通过才回调 onSubmit。 */
  public async submitAsync(): Promise<boolean> {
    if (!(await this.validateAsync())) {
      return false;
    }
    const values = this.getValues();
    this.submitHandlers.forEach((handler) => handler(values));
    return true;
  }

  private __syncErrors(): void {
    this.items.forEach((item) => {
      const validating = this.model.isValidating(item.getName());
      item.setValidating(validating);
      if (!validating) {
        item.setError(this.model.getError(item.getName()) || null);
      }
    });
  }

  /**
   * 排布 = 引擎箱式布局摆位置，然后同步一次自身高度。
   *
   * 覆盖 `doLayout()` 而不是自己写一套堆叠：位置完全由布局器决定（含 `stretch` 的拉满宽度），
   * 本组件只保留"高度等于内容高度"这一条策略。
   */
  public doLayout(): void {
    super.doLayout();
    this.__syncHeight();
  }

  /** 高度 = 所有表单项高度 + 间距（宽度由调用方决定，跟着 `stretch` 走）。 */
  private __syncHeight(): void {
    let total = 0;
    this.items.forEach((item, index) => {
      total += (Number(item.state.height) || 0) + (index > 0 ? this.itemGap : 0);
    });
    total = Math.max(0, total);
    if (Math.abs((Number(this.state.height) || 0) - total) <= 0.5) {
      return;
    }
    // 直接写 state：这是本组件自己的高度策略，不该再触发一轮「尺寸变了 → 请求重排」
    this.state.height = total;
    this.dirty = true;
    if (this.ice) {
      this.ice.dirty = true;
    }
  }
}
