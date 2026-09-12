import { UIComponent } from '../core/UIComponent';
import { UILabel } from './UILabel';
import { uiManager } from '../core/UIManager';
import type { UIFormRule } from '../model/UIFormModel';

/**
 * 表单项：标签 + 控件 + 错误文案。
 *
 * 只负责「摆位置 + 显示错误」；值的读写与校验规则由 UIForm / UIFormModel 管。
 * 控件必须实现取值约定（`getFormValue` / `setFormValue`）。
 *
 * 布局：
 * - `vertical`（默认）：标签在上一行，控件居中，错误文案在最下（高度预留，避免校验时抖动）；
 * - `horizontal`：标签占左侧 labelWidth，控件与错误文案在右侧。
 */

export interface UIFormItemOptions {
  name: string;
  label?: string;
  control: any;
  /** 校验规则（透传给 UIFormModel） */
  rules?: UIFormRule[];
  layout?: 'vertical' | 'horizontal';
  labelWidth?: number;
  width?: number;
  /** 标签行高 / 错误行高 / 间距 */
  labelHeight?: number;
  errorHeight?: number;
  gap?: number;
}

export class UIFormItem extends UIComponent {
  private name: string;
  private labelText: string;
  private control: any;
  private rules: UIFormRule[];
  private itemLayout: 'vertical' | 'horizontal';
  private labelWidth: number;
  private labelHeight: number;
  private errorHeight: number;
  private itemGap: number;
  private labelNode: UILabel;
  private errorNode: UILabel;

  constructor(props: UIFormItemOptions) {
    const theme = uiManager.getTheme();
    const control = props.control;
    if (!control) {
      throw new Error('UIFormItem 需要 control');
    }
    const itemLayout = props.layout || 'vertical';
    const labelHeight = props.labelHeight ?? 18;
    const errorHeight = props.errorHeight ?? 16;
    const gap = props.gap ?? 6;
    const controlWidth = Number(control.state && control.state.width) || 200;
    const controlHeight = Number(control.state && control.state.height) || theme.control.height;
    const labelWidth = itemLayout === 'horizontal' ? props.labelWidth ?? 80 : 0;
    const width = props.width ?? (itemLayout === 'horizontal' ? labelWidth + controlWidth : Math.max(controlWidth, 120));
    const height =
      itemLayout === 'horizontal' ? controlHeight + gap + errorHeight : labelHeight + gap + controlHeight + gap + errorHeight;

    // 只把几何信息交给基类：control / rules 这些不是可序列化状态，不要进 state
    super({
      fill: false,
      stroke: false,
      left: (props as any).left,
      top: (props as any).top,
      width,
      height,
    });

    this.name = props.name;
    this.labelText = props.label || props.name;
    this.control = control;
    this.rules = props.rules ? props.rules.slice() : [];
    this.itemLayout = itemLayout;
    this.labelWidth = labelWidth;
    this.labelHeight = labelHeight;
    this.errorHeight = errorHeight;
    this.itemGap = gap;

    this.labelNode = new UILabel({
      left: 0,
      top: 0,
      height: labelHeight,
      verticalAlign: 'middle',
      text: this.labelText,
      style: { fontSize: 12, fillStyle: theme.colors.textSecondary },
    });
    this.errorNode = new UILabel({
      left: 0,
      top: 0,
      height: errorHeight,
      verticalAlign: 'middle',
      text: '',
      display: false,
      style: { fontSize: 12, fillStyle: theme.colors.error },
    });

    this.addChild(this.labelNode, false);
    this.addChild(this.control, false);
    this.addChild(this.errorNode, false);
    this.__layoutChildren();
  }

  public getName(): string {
    return this.name;
  }

  public getLabel(): string {
    return this.labelText;
  }

  public getRules(): UIFormRule[] {
    return this.rules.slice();
  }

  public getControl(): any {
    return this.control;
  }

  public getLabelNode(): UILabel {
    return this.labelNode;
  }

  public getErrorNode(): UILabel {
    return this.errorNode;
  }

  public getErrorText(): string {
    return this.errorNode.getText();
  }

  /** 设置错误文案（null / '' 表示通过）；同时把控件切到 error / default 状态。 */
  public setError(message: string | null): this {
    const text = message || '';
    this.errorNode.setText(text);
    this.errorNode.setState({ display: !!text });
    if (this.control && typeof this.control.setValidateStatus === 'function') {
      this.control.setValidateStatus(text ? 'error' : 'default');
    }
    return this;
  }

  private __layoutChildren(): void {
    const controlWidth = Number(this.control.state && this.control.state.width) || 200;
    const controlHeight = Number(this.control.state && this.control.state.height) || 32;
    if (this.itemLayout === 'horizontal') {
      this.labelNode.setState({ left: 0, top: Math.max(0, (controlHeight - this.labelHeight) / 2), width: this.labelWidth - 8 });
      this.control.setState({ left: this.labelWidth, top: 0 });
      this.errorNode.setState({ left: this.labelWidth, top: controlHeight + this.itemGap, width: controlWidth });
      return;
    }
    this.labelNode.setState({ left: 0, top: 0, width: Math.max(0, controlWidth) });
    this.control.setState({ left: 0, top: this.labelHeight + this.itemGap });
    this.errorNode.setState({ left: 0, top: this.labelHeight + this.itemGap + controlHeight + this.itemGap });
  }
}
