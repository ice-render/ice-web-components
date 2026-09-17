import { ICEWidget } from '../core/ICEWidget';
import { t } from '../i18n/ICEI18n';
import { ICELabel } from './ICELabel';
import { iceUIManager } from '../core/ICEManager';
import type { ICEFormRule } from '../model/ICEFormModel';
import type { ICELocalizedProps } from '../i18n/ICEI18n';
import { ICELayoutManager, token } from 'ice-render';

/**
 * 表单项的自持策略（Swing 里 `JLabel` + 编辑器的复合版式，由各 Look&Feel 自己摆）。
 *
 * 两个形态都在这里摆位：
 * - `horizontal`：标签占左侧 `labelWidth`（右留 8px），控件与错误文案在右侧；
 * - `vertical`：标签一行、控件一行、错误文案一行（高度预留，校验时不抖动）。
 *
 * 组件只留策略：控件多大、标签多宽、间距多少。
 */
class ICEFormItemLayout extends ICELayoutManager {
  layoutContainer(container: any): void {
    const input = container.__getFormItemLayoutInput();
    const { itemLayout, gap, labelWidth, labelHeight, labelNode, control, errorNode } = input;
    const controlWidth = Number(control.state && control.state.width) || 200;
    const controlHeight = Number(control.state && control.state.height) || 32;

    if (itemLayout === 'horizontal') {
      labelNode.setState({ left: 0, top: Math.max(0, (controlHeight - labelHeight) / 2), width: labelWidth - 8 });
      control.setState({ left: labelWidth, top: 0 });
      errorNode.setState({ left: labelWidth, top: controlHeight + gap, width: controlWidth });
      return;
    }

    labelNode.setState({ left: 0, top: 0, width: Math.max(0, controlWidth) });
    control.setState({ left: 0, top: labelHeight + gap });
    errorNode.setState({ left: 0, top: labelHeight + gap + controlHeight + gap });
  }

  /** 内部策略：不进文档（`null` = 由 `ICEFormItem` 构造时重建，形态与尺寸都在 state 里）。 */
  public toJSON(): any {
    return null;
  }
}

/**
 * 表单项：标签 + 控件 + 错误文案。
 *
 * 只负责「摆位置 + 显示错误」；值的读写与校验规则由 ICEForm / ICEFormModel 管。
 * 控件必须实现取值约定（`getFormValue` / `setFormValue`）。
 *
 * 布局：
 * - `vertical`（默认）：标签在上一行，控件居中，错误文案在最下（高度预留，避免校验时抖动）；
 * - `horizontal`：标签占左侧 labelWidth，控件与错误文案在右侧。
 */

export interface ICEFormItemOptions extends ICELocalizedProps {
  /** 组件 id（引擎会用它做唯一标识，e2e/调试时可按 id 定位） */
  id?: string;
  name: string;
  label?: string;
  control: any;
  /** 校验规则（透传给 ICEFormModel） */
  rules?: ICEFormRule[];
  /**
   * 依赖的字段名：这些字段变化时本项自动重算（跨字段校验，如「确认密码」）。
   * 透传给 ICEFormModel。
   */
  dependencies?: string[];
  layout?: 'vertical' | 'horizontal';
  labelWidth?: number;
  width?: number;
  /** 标签行高 / 错误行高 / 间距 */
  labelHeight?: number;
  errorHeight?: number;
  gap?: number;
}

export class ICEFormItem extends ICEWidget {
  private name: string;
  private labelText: string;
  private control: any;
  private rules: ICEFormRule[];
  private dependencies: string[];
  private validating = false;
  private itemLayout: 'vertical' | 'horizontal';
  private labelWidth: number;
  private labelHeight: number;
  private errorHeight: number;
  private itemGap: number;
  private labelNode: ICELabel;
  private errorNode: ICELabel;

  constructor(props: ICEFormItemOptions) {
    const theme = iceUIManager.getTheme();
    const control = props.control;
    if (!control) {
      throw new Error('ICEFormItem 需要 control');
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
      id: props.id,
      fill: false,
      stroke: false,
      // 纯布局容器：自己不能参与命中，否则会挡住内部控件（焦点管理器就认不出输入框了）
      interactive: false,
      left: (props as any).left,
      top: (props as any).top,
      width,
      height,
    });
    this.setLocale(props.locale); // 实例级语言（组件层文案可配、不持全局状态）

    this.name = props.name;
    this.labelText = props.label || props.name;
    this.control = control;
    this.rules = props.rules ? props.rules.slice() : [];
    this.dependencies = props.dependencies ? props.dependencies.slice() : [];
    this.itemLayout = itemLayout;
    this.labelWidth = labelWidth;
    this.labelHeight = labelHeight;
    this.errorHeight = errorHeight;
    this.itemGap = gap;

    this.labelNode = new ICELabel({
      left: 0,
      top: 0,
      height: labelHeight,
      verticalAlign: 'middle',
      text: this.labelText,
      style: { fontSize: 12, fillStyle: token('ui.colors.textSecondary') },
    });
    this.errorNode = new ICELabel({
      left: 0,
      top: 0,
      height: errorHeight,
      verticalAlign: 'middle',
      text: '',
      display: false,
      style: { fontSize: 12, fillStyle: token('ui.colors.error') },
    });

    this.addChild(this.labelNode, false);
    this.addChild(this.control, false);
    this.addChild(this.errorNode, false);
    // 摆位交给自持策略；组件只把"形态与尺寸"喂给它
    this.setLayout(new ICEFormItemLayout());
    this.doLayout();
  }

  /** 自持策略需要的输入（形态 / 尺寸 / 三个节点）。 */
  public __getFormItemLayoutInput(): {
    itemLayout: 'vertical' | 'horizontal';
    gap: number;
    labelWidth: number;
    labelHeight: number;
    labelNode: ICELabel;
    control: any;
    errorNode: ICELabel;
  } {
    return {
      itemLayout: this.itemLayout,
      gap: this.itemGap,
      labelWidth: this.labelWidth,
      labelHeight: this.labelHeight,
      labelNode: this.labelNode,
      control: this.control,
      errorNode: this.errorNode,
    };
  }

  public getName(): string {
    return this.name;
  }

  public getLabel(): string {
    return this.labelText;
  }

  public getRules(): ICEFormRule[] {
    return this.rules.slice();
  }

  /** 依赖的字段名（跨字段重校验用）。 */
  public getDependencies(): string[] {
    return this.dependencies.slice();
  }

  public getControl(): any {
    return this.control;
  }

  public getLabelNode(): ICELabel {
    return this.labelNode;
  }

  public getErrorNode(): ICELabel {
    return this.errorNode;
  }

  public getErrorText(): string {
    return this.errorNode.getText();
  }

  public isValidating(): boolean {
    return this.validating;
  }

  /** 异步校验中：错误行显示「校验中…」（错误文案让位，校验完再由 setError 接管）。 */
  public setValidating(pending: boolean): this {
    const next = !!pending;
    if (next === this.validating) {
      return this;
    }
    this.validating = next;
    if (next) {
      this.errorNode.setText(this.t('form.validating'));
      this.errorNode.setState({ display: true });
      if (this.control && typeof this.control.setValidateStatus === 'function') {
        this.control.setValidateStatus('default');
      }
    } else if (this.errorNode.getText() === this.t('form.validating')) {
      this.errorNode.setText('');
      this.errorNode.setState({ display: false });
    }
    return this;
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

}
