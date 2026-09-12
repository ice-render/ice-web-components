import { UITextField } from './UITextField';
import { uiManager } from '../core/UIManager';

/**
 * 多行文本框：与 UITextField 同语义（取值约定 / change 事件 / 错误态 / 焦点），
 * 差别是允许换行（Enter 插入 `\n`）且默认更高。
 */

export class UITextArea extends UITextField {
  constructor(props: any = {}) {
    const theme = uiManager.getTheme();
    super({
      height: theme.control.height * 2,
      ...props,
    });
    this.allowNewline = true;
  }
}
