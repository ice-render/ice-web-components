/**
 * 表单校验模型：字段值 + 规则 + 错误 + 变更通知。
 *
 * 纯逻辑、不碰 canvas —— UI 层（UIFormItem / UIForm）只负责把值与错误**画出来**。
 * 规则语义：一条规则失败即停止（取第一条错误信息）。
 */

export interface UIFormRule {
  /** 必填：null/undefined/空串/空数组/false 都算缺失（开关与多选同样适用） */
  required?: boolean;
  /** 自定义错误文案（不填用默认文案） */
  message?: string;
  /** 数值下界 / 上界（值可转成数字时生效） */
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  /** 自定义校验：返回错误文案表示失败，返回 null/undefined 表示通过 */
  validator?: (value: any, values: Record<string, any>) => string | null | undefined;
}

export interface UIFormFieldOptions {
  name: string;
  label?: string;
  rules?: UIFormRule[];
  value?: any;
}

export interface UIFormModelOptions {
  /** 改值时是否自动重算该字段（默认 change；'none' 表示只在手动校验时算） */
  validateTrigger?: 'change' | 'none';
}

export type UIFormModelListener = (model: UIFormModel) => void;

interface UIFormField {
  name: string;
  label: string;
  rules: UIFormRule[];
  value: any;
  initialValue: any;
  error: string | null;
}

function isMissing(value: any): boolean {
  if (value === null || value === undefined) {
    return true;
  }
  if (typeof value === 'string') {
    return value.trim() === '';
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  return value === false;
}

function lengthOf(value: any): number {
  if (typeof value === 'string') {
    return value.length;
  }
  if (Array.isArray(value)) {
    return value.length;
  }
  return value === null || value === undefined ? 0 : String(value).length;
}

export class UIFormModel {
  private fields: UIFormField[] = [];
  private listeners = new Set<UIFormModelListener>();
  private validateTrigger: 'change' | 'none';

  constructor(options: UIFormModelOptions = {}) {
    this.validateTrigger = options.validateTrigger || 'change';
  }

  public addField(options: UIFormFieldOptions): this {
    const field: UIFormField = {
      name: options.name,
      label: options.label || options.name,
      rules: options.rules ? options.rules.slice() : [],
      value: options.value,
      initialValue: options.value,
      error: null,
    };
    const index = this.fields.findIndex((item) => item.name === options.name);
    if (index === -1) {
      this.fields.push(field);
    } else {
      this.fields[index] = field;
    }
    return this;
  }

  public removeField(name: string): this {
    this.fields = this.fields.filter((field) => field.name !== name);
    return this;
  }

  public getField(name: string): UIFormField | undefined {
    return this.fields.find((field) => field.name === name);
  }

  public getFieldNames(): string[] {
    return this.fields.map((field) => field.name);
  }

  public getLabel(name: string): string {
    const field = this.getField(name);
    return field ? field.label : name;
  }

  public getValue(name: string): any {
    const field = this.getField(name);
    return field ? field.value : undefined;
  }

  public getValues(): Record<string, any> {
    const out: Record<string, any> = {};
    this.fields.forEach((field) => {
      out[field.name] = field.value;
    });
    return out;
  }

  /**
   * 设置字段值。默认按 `validateTrigger` 决定是否立刻重算该字段（默认重算），
   * `silent: true` 表示只写值、不重算也不通知（批量初始化用）。
   */
  public setValue(name: string, value: any, options: { silent?: boolean } = {}): this {
    const field = this.getField(name);
    if (!field) {
      return this;
    }
    field.value = value;
    if (options.silent) {
      return this;
    }
    if (this.validateTrigger === 'change') {
      this.validateField(name, { silent: true });
    }
    this.__notify();
    return this;
  }

  public setValues(values: Record<string, any>, options: { silent?: boolean } = {}): this {
    Object.keys(values).forEach((name) => {
      const field = this.getField(name);
      if (field) {
        field.value = values[name];
      }
    });
    if (options.silent) {
      return this;
    }
    if (this.validateTrigger === 'change') {
      Object.keys(values).forEach((name) => this.validateField(name, { silent: true }));
    }
    this.__notify();
    return this;
  }

  public getError(name: string): string | null | undefined {
    const field = this.getField(name);
    return field ? field.error : undefined;
  }

  /** 只返回有错误的字段（无错误时为空对象） */
  public getErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    this.fields.forEach((field) => {
      if (field.error) {
        out[field.name] = field.error;
      }
    });
    return out;
  }

  public hasErrors(): boolean {
    return this.fields.some((field) => !!field.error);
  }

  /** 校验单个字段并写回错误；返回错误文案（null 表示通过）。 */
  public validateField(name: string, options: { silent?: boolean } = {}): string | null {
    const field = this.getField(name);
    if (!field) {
      return null;
    }
    field.error = this.__check(field);
    if (!options.silent) {
      this.__notify();
    }
    return field.error;
  }

  /** 校验全部字段并返回是否全部通过。 */
  public validate(): boolean {
    this.fields.forEach((field) => {
      field.error = this.__check(field);
    });
    this.__notify();
    return !this.hasErrors();
  }

  /** 回到初始值并清空错误。 */
  public reset(): this {
    this.fields.forEach((field) => {
      field.value = field.initialValue;
      field.error = null;
    });
    this.__notify();
    return this;
  }

  public addChangeListener(listener: UIFormModelListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private __check(field: UIFormField): string | null {
    const label = field.label;
    const value = field.value;
    const values = this.getValues();
    for (const rule of field.rules) {
      if (rule.required && isMissing(value)) {
        return rule.message || `${label}不能为空`;
      }
      if (isMissing(value)) {
        continue; // 非必填且为空：其余规则跳过
      }
      const numeric = Number(value);
      if (rule.min !== undefined && Number.isFinite(numeric) && numeric < rule.min) {
        return rule.message || `${label}不能小于 ${rule.min}`;
      }
      if (rule.max !== undefined && Number.isFinite(numeric) && numeric > rule.max) {
        return rule.message || `${label}不能大于 ${rule.max}`;
      }
      const length = lengthOf(value);
      if (rule.minLength !== undefined && length < rule.minLength) {
        return rule.message || `${label}长度不能少于 ${rule.minLength}`;
      }
      if (rule.maxLength !== undefined && length > rule.maxLength) {
        return rule.message || `${label}长度不能超过 ${rule.maxLength}`;
      }
      if (rule.pattern && !rule.pattern.test(String(value))) {
        return rule.message || `${label}格式不正确`;
      }
      if (rule.validator) {
        const message = rule.validator(value, values);
        if (message) {
          return message;
        }
      }
    }
    return null;
  }

  private __notify(): void {
    this.listeners.forEach((listener) => listener(this));
  }
}
