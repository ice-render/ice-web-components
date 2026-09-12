import { UIButton } from './UIButton';
import { UITextField } from './UITextField';
import { uiManager } from '../core/UIManager';

/**
 * 密码框：显示掩码（• 数量 = 真实长度），`getValue()` / 表单取值仍是明文。
 *
 * `showToggle: true` 时右侧出现眼睛按钮，可在明文/掩码之间切换（便于用户核对输入）。
 */
export class UIPasswordField extends UITextField {
  private visible = false;
  private toggleButton: UIButton | null = null;
  private showToggle: boolean;

  constructor(props: any = {}) {
    super(props);
    this.showToggle = props.showToggle === true;
    if (this.showToggle) {
      const theme = uiManager.getTheme();
      const width = Number(this.state.width) || 200;
      const height = Number(this.state.height) || theme.control.height;
      const toggle = new UIButton({
        left: width - 34,
        top: Math.max(0, (height - 24) / 2),
        width: 28,
        height: 24,
        text: '👁',
        variant: 'text',
        size: 'small',
        focusable: false,
      });
      toggle.on('click', () => this.setVisible(!this.visible));
      this.addChild(toggle, false);
      this.toggleButton = toggle;
    }
    this.refresh();
  }

  /** 明文 / 掩码。 */
  public isVisible(): boolean {
    return this.visible;
  }

  public setVisible(visible: boolean): this {
    this.visible = !!visible;
    this.refresh();
    return this;
  }

  public getToggleButton(): UIButton | null {
    return this.toggleButton;
  }

  protected formatDisplayValue(value: string): string {
    if (this.visible) {
      return value;
    }
    return value.replace(/[\s\S]/g, '•');
  }
}
