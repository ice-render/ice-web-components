/**
 * 表单校验模型：字段值 + 规则 + 错误 + 变更通知。
 *
 * 纯逻辑、不碰 canvas —— UI 层（ICEFormItem / ICEForm）只负责把值与错误**画出来**。
 * 规则语义：一条规则失败即停止（取第一条错误信息）。
 */

import { tFor } from '../i18n/ICEI18n';

export interface ICEFormRule {
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
  /**
   * 异步校验（如「用户名是否被占用」）。
   *
   * 只在显式调用 `validateFieldAsync` / `validateAsync` 时执行 —— 值变化触发的自动校验
   * 只跑同步规则，避免每次按键都发请求。
   */
  asyncValidator?: (value: any, values: Record<string, any>) => Promise<string | null | undefined>;
}

export interface ICEFormFieldOptions {
  name: string;
  label?: string;
  rules?: ICEFormRule[];
  /**
   * 依赖的字段名：**这些字段变化时本字段自动重算**。
   * 典型场景「确认密码」「结束日期 ≥ 开始日期」——本字段的合法性取决于别的字段。
   */
  dependencies?: string[];
  value?: any;
}

export interface ICEFormModelOptions {
  /** 改值时是否自动重算该字段（默认 change；'none' 表示只在手动校验时算） */
  validateTrigger?: 'change' | 'none';
  /** 内置校验文案的语言（未传则跟随当前语言）；字段规则里的 `message` 仍可逐条覆盖 */
  locale?: string;
}

export type ICEFormModelListener = (model: ICEFormModel) => void;

interface ICEFormField {
  name: string;
  label: string;
  rules: ICEFormRule[];
  dependencies: string[];
  value: any;
  initialValue: any;
  error: string | null;
  validating: boolean;
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

export class ICEFormModel {
  private fields: ICEFormField[] = [];
  private listeners = new Set<ICEFormModelListener>();
  private validateTrigger: 'change' | 'none';
  /** 本实例的语言（`options.locale`）：内置校验文案按它取，未传则跟随当前语言 */
  private locale?: string;

  constructor(options: ICEFormModelOptions = {}) {
    this.validateTrigger = options.validateTrigger || 'change';
    this.locale = options.locale;
  }

  /** 取内置校验文案（可在字段规则里用 `message` 覆盖）。 */
  private __t(key: string, vars?: Record<string, string | number>): string {
    return tFor(this.locale)(key, vars);
  }

  public addField(options: ICEFormFieldOptions): this {
    const field: ICEFormField = {
      name: options.name,
      label: options.label || options.name,
      rules: options.rules ? options.rules.slice() : [],
      dependencies: options.dependencies ? options.dependencies.slice() : [],
      value: options.value,
      initialValue: options.value,
      error: null,
      validating: false,
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

  public getField(name: string): ICEFormField | undefined {
    return this.fields.find((field) => field.name === name);
  }

  public getFieldNames(): string[] {
    return this.fields.map((field) => field.name);
  }

  /** 直接依赖 `name` 的字段（反向查询）。 */
  public getDependents(name: string): string[] {
    return this.fields.filter((field) => field.dependencies.indexOf(name) !== -1).map((field) => field.name);
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
      this.__validateDependents(name);
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
      Object.keys(values).forEach((name) => this.__validateDependents(name));
    }
    this.__notify();
    return this;
  }

  /** 依赖 `name` 的字段重算（静默：调用方统一 __notify）。 */
  private __validateDependents(name: string): void {
    this.getDependents(name).forEach((dependent) => this.validateField(dependent, { silent: true }));
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

  /** 该字段是否正在异步校验中（UI 可显示「校验中…」）。 */
  public isValidating(name: string): boolean {
    const field = this.getField(name);
    return !!field && field.validating;
  }

  /**
   * 单字段异步校验：先跑同步规则（失败即短路、不发请求），再依次跑异步校验器。
   * 返回错误文案（null 表示通过）。
   */
  public async validateFieldAsync(name: string): Promise<string | null> {
    const field = this.getField(name);
    if (!field) {
      return null;
    }
    const syncError = this.__check(field);
    field.error = syncError;
    if (syncError) {
      this.__notify();
      return syncError;
    }
    const asyncRules = field.rules.filter((rule) => typeof rule.asyncValidator === 'function');
    if (!asyncRules.length) {
      this.__notify();
      return null;
    }
    field.validating = true;
    this.__notify();
    try {
      for (const rule of asyncRules) {
        const message = await rule.asyncValidator!(field.value, this.getValues());
        if (message) {
          field.error = message;
          return message;
        }
      }
      field.error = null;
      return null;
    } finally {
      field.validating = false;
      this.__notify();
    }
  }

  /** 校验全部字段（同步 + 异步），返回是否全部通过。 */
  public async validateAsync(): Promise<boolean> {
    await Promise.all(this.fields.map((field) => this.validateFieldAsync(field.name)));
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

  public addChangeListener(listener: ICEFormModelListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private __check(field: ICEFormField): string | null {
    const label = field.label;
    const value = field.value;
    const values = this.getValues();
    for (const rule of field.rules) {
      if (rule.required && isMissing(value)) {
        return rule.message || this.__t('form.required', { label });
      }
      if (isMissing(value)) {
        // 非必填且为空：跳过内置约束（min/max/长度/pattern），但**自定义 validator 仍然执行**
        // —— 「跨字段 / 至少填一个」这类规则的生命周期就在空值上（例如 A、B 都不填才算错）。
        if (!rule.validator) {
          continue;
        }
      }
      const numeric = Number(value);
      if (rule.min !== undefined && Number.isFinite(numeric) && numeric < rule.min) {
        return rule.message || this.__t('form.min', { label, min: rule.min });
      }
      if (rule.max !== undefined && Number.isFinite(numeric) && numeric > rule.max) {
        return rule.message || this.__t('form.max', { label, max: rule.max });
      }
      const length = lengthOf(value);
      if (rule.minLength !== undefined && length < rule.minLength) {
        return rule.message || this.__t('form.minLength', { label, minLength: rule.minLength });
      }
      if (rule.maxLength !== undefined && length > rule.maxLength) {
        return rule.message || this.__t('form.maxLength', { label, maxLength: rule.maxLength });
      }
      if (rule.pattern && !rule.pattern.test(String(value))) {
        return rule.message || this.__t('form.pattern', { label });
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
