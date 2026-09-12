import { ICEText } from 'ice-render';
import { UIComponent } from '../core/UIComponent';
import { uiManager } from '../core/UIManager';

export class UILabel extends UIComponent {
  private textNode: any;

  constructor(props: any = {}) {
    const theme = uiManager.getTheme();
    const font = {
      fillStyle: theme.colors.text,
      fontFamily: theme.font.family,
      fontSize: theme.font.size,
      fontWeight: theme.font.weightNormal,
    };
    super({
      fill: false,
      stroke: false,
      ...props,
    });
    const vAlign = props.verticalAlign;
    // 有显式 height（如与控件同行）时默认垂直居中；无显式 height 时交给 ICEText
    // 的默认 baseline，按单行文本自然排版，避免标题被错误地以 top 为中心而整体上移。
    const baseline =
      vAlign === 'top'
        ? 'top'
        : vAlign === 'bottom'
        ? 'bottom'
        : props.height !== undefined
        ? 'middle'
        : undefined;
    this.textNode = new ICEText({
      left: 0,
      top: 0,
      text: props.text ?? '',
      stroke: false,
      style: {
        ...font,
        ...(baseline ? { textBaseline: baseline } : {}),
        ...(props.style || {}),
      },
    });
    this.addChild(this.textNode, false);
    // 构造期 ICEText 已经量过一次（此时还没有 ctx，走 DOM 兜底），直接取用即可；
    // 这里**不能**再强制 refreshParams，否则会打乱引擎首帧的 canvas 实测时序，让文字轻微位移。
    this.__adoptTextSize(false);
  }

  public setText(text: string): this {
    this.textNode.setText(text ?? '');
    // 文本已变，必须在当帧拿到新尺寸（否则布局管理器会按旧宽度排布）
    this.__adoptTextSize(true);
    this.revalidate();
    return this;
  }

  public getText(): string {
    return this.textNode.getText();
  }

  /**
   * 让标签自身占据文字的实测尺寸。
   *
   * ICEText 会把自身宽高自动调成实测值，而 UILabel 只是它的一层包装容器：调用方不显式给尺寸时，
   * UILabel 会停在 ICERect 的默认 10×10 —— 布局管理器（ICEFlowLayout / ICEBoxLayout 读的都是
   * 子项的 `state.width/height`）于是不为文字留空间，表现为「标题和后面的按钮叠在一起」
   * （examples/basic.html 的标题与按钮重叠就是这么来的）。
   *
   * 调用方显式传了 width/height 时不覆盖，沿用引擎里「默认值 10 视为未设置」的约定。
   */
  private __adoptTextSize(remeasure: boolean): void {
    if (!this.textNode) {
      return;
    }
    if (remeasure && typeof this.textNode.refreshParams === 'function') {
      this.textNode.refreshParams();
    }
    const width = Number(this.textNode.state.width);
    const height = Number(this.textNode.state.height);
    // 直接写 state：与 ICEText 自己的测量逻辑保持一致（派生尺寸不适合走 setState 的递归置脏，
    // 否则会扰动渲染/离屏缓存的决策）。重排由调用方的 revalidate() 负责。
    let changed = false;
    if (this.props.width === 10 && width > 0) {
      if (this.state.width !== width) {
        this.state.width = width;
        changed = true;
      }
    }
    if (this.props.height === 10 && height > 0) {
      if (this.state.height !== height) {
        this.state.height = height;
        changed = true;
      }
    }
    if (changed) {
      // 盒子尺寸变了：本地原点在中心，原点位置随之变化 → 自身矩阵必须重算
      this.dirty = true;
      // 等价于 ICEComponent.__afterStateMerge 的行为：尺寸变化通知父容器重排
      if (this.parentNode && typeof this.parentNode.requestLayout === 'function') {
        this.parentNode.requestLayout();
      }
    }
  }

  /**
   * @overwrite
   * 标签的首选尺寸就是文字的实测尺寸。不覆盖的话会落到 `ICEGroup.getPreferredSize()` 的
   * `[0, 0]`（没有 layoutManager 时），按首选尺寸排布的调用方同样拿不到正确宽度。
   */
  public getPreferredSize(): [number, number] {
    return [Number(this.state.width) || 0, Number(this.state.height) || 0];
  }
}
