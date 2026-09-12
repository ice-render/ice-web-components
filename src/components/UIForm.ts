import { UIContainer } from '../core/UIContainer';
import { UIFormItem } from './UIFormItem';
import { UIFormModel, UIFormRule } from '../model/UIFormModel';

/**
 * 表单容器：把若干 UIFormItem 纵向堆叠，绑上校验模型。
 *
 * - 值与校验都在 `UIFormModel` 里（纯逻辑），UIForm 负责「控件 ⇄ 模型」同步与错误渲染；
 * - 控件触发 `change` → 写回模型并按 validateTrigger 校验 → 模型通知 → 表单项更新错误显示；
 * - `submit()` 校验通过才回调 `onSubmit`（回调拿到当前值快照）。
 */

export interface UIFormOptions {
  width?: number;
  gap?: number;
  /** 复用外部模型（表单与业务共享状态） */
  model?: UIFormModel;
  items?: UIFormItem[];
  left?: number;
  top?: number;
}

export type UIFormSubmitHandler = (values: Record<string, any>) => void;

export class UIForm extends UIContainer {
  private model: UIFormModel;
  private items: UIFormItem[] = [];
  private submitHandlers: UIFormSubmitHandler[] = [];
  private itemGap: number;
  /** reset 期间抑制「控件 change → 写回模型」，避免把初始值当成用户输入再校验一次 */
  private muted = false;

  constructor(props: UIFormOptions = {}) {
    const width = props.width ?? 320;
    super({ fill: false, stroke: false, left: props.left, top: props.top, width, height: 0 });
    this.itemGap = props.gap ?? 16;
    this.model = props.model || new UIFormModel();
    this.model.addChangeListener(() => this.__syncErrors());
    if (props.items) {
      this.addItems(props.items);
    }
  }

  public getModel(): UIFormModel {
    return this.model;
  }

  public getItems(): UIFormItem[] {
    return this.items.slice();
  }

  public addItems(items: UIFormItem[]): this {
    items.forEach((item) => this.addItem(item));
    return this;
  }

  public addItem(item: UIFormItem): this {
    this.items.push(item);
    const name = item.getName();
    const control = item.getControl();
    this.model.addField({
      name,
      label: item.getLabel(),
      rules: item.getRules() as UIFormRule[],
      value: control.getFormValue ? control.getFormValue() : undefined,
    });
    if (control && typeof control.on === 'function') {
      control.on('change', () => {
        if (this.muted) {
          return;
        }
        this.model.setValue(name, control.getFormValue ? control.getFormValue() : undefined);
      });
    }
    this.addChild(item, false);
    this.__layout();
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

  public onSubmit(handler: UIFormSubmitHandler): this {
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

  private __layout(): void {
    let top = 0;
    this.items.forEach((item) => {
      item.setState({ left: 0, top, width: Number(this.state.width) || undefined });
      top += (Number(item.state.height) || 0) + this.itemGap;
    });
    this.setState({ height: Math.max(0, top - this.itemGap) });
  }
}
