import { ICEText } from 'ice-render';
import { ICEWidget } from '../core/ICEWidget';
import { iceUIManager } from '../core/ICEManager';

/**
 * 文本标签：包装引擎 `ICEText`，支持水平（`align`）与垂直（`verticalAlign`）对齐；
 * 未显式给尺寸时采用文字的实测尺寸，便于参与流式/盒式布局。
 */
export class ICELabel extends ICEWidget {
  private textNode: any;
  /** 调用方是否显式给了宽/高：只有「没给」时才让标签盒跟随文字的实测尺寸。 */
  private __autoBoxWidth = true;
  private __autoBoxHeight = true;

  constructor(props: any = {}) {
    const theme = iceUIManager.getTheme();
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
    // 不能拿「默认值 10」当「未设置」的哨兵：引擎侧的文本自动尺寸已改为按「调用方是否显式给尺寸」
    // 判定（见 ice-render AGENTS.md「文本渲染自包含与自动尺寸铁律」），组件库这一层必须同口径，
    // 否则 `new ICELabel({ width: 10 })` 这类调用在引擎里是「显式 10 宽」，在这里却被当成未设置。
    this.__autoBoxWidth = props.width === undefined;
    this.__autoBoxHeight = props.height === undefined;
    const vAlign = props.verticalAlign;
    // 水平对齐：ICELabel 只是 ICEText 的包装，`align` 必须显式映射进 style.textAlign。
    // 曾经漏了这层映射 —— 所有 `new ICELabel({ align: 'center' })` 都静默地按左对齐渲染，
    // 表现为「明明给了居中、文字却贴着盒子左边」（轮播文字、时间列、空状态文字都中招）。
    const hAlign = props.align;
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
    const textProps: any = {
      left: 0,
      top: 0,
      text: props.text ?? '',
      stroke: false,
      style: {
        ...font,
        ...(hAlign === 'center' ? { textAlign: 'center' } : {}),
        ...(hAlign === 'right' ? { textAlign: 'right' } : {}),
        ...(baseline ? { textBaseline: baseline } : {}),
        ...(props.style || {}),
      },
    };
    // 调用方显式给了宽高时，让内层文字用**同一个盒子**：这样 verticalAlign / textAlign 才是
    // 相对标签盒居中/对齐的。否则文字盒会缩到文字自身大小，`middle` 变成「在这个小盒子里居中」
    // —— 20px 高的标签里文字会整体偏高约 5px（admin 示例状态卡的文字比进度条高、
    // 团队卡姓名/角色相对头像偏上，都是这个原因）。
    if (props.width !== undefined) {
      textProps.width = props.width;
    }
    if (props.height !== undefined) {
      textProps.height = props.height;
    }
    this.textNode = new ICEText(textProps);
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
   * 改文字颜色（动态强调 / 置灰用，比如 BIOS 自检行的灰→黄→绿、菜单选中态）。
   *
   * 必须走内层 `ICEText`：文字是它画的，构造期 `style` 已经下沉到那一层，
   * 之后再 `setState({ style })` 只会改到外壳容器，屏幕上的字纹丝不动。
   * 只覆盖 `fillStyle`，字号 / 字体 / 对齐这些原样保留。
   */
  public setTextColor(color: string): this {
    if (this.textNode && this.textNode.state) {
      this.textNode.setState({ style: { ...(this.textNode.state.style || {}), fillStyle: color } });
    }
    this.dirty = true;
    return this;
  }

  /**
   * 让标签自身占据文字的实测尺寸。
   *
   * ICEText 会把自身宽高自动调成实测值，而 ICELabel 只是它的一层包装容器：调用方不显式给尺寸时，
   * ICELabel 会停在 ICERect 的默认 10×10 —— 布局管理器（ICEFlowLayout / ICEBoxLayout 读的都是
   * 子项的 `state.width/height`）于是不为文字留空间，表现为「标题和后面的按钮叠在一起」
   * （流式布局里「标题压住后面的按钮」就是这么来的）。
   *
   * 调用方显式传了 width/height 时不覆盖（按构造参数判定，不用 10 当哨兵）。
   */
  private __adoptTextSize(remeasure: boolean): void {
    if (!this.textNode) {
      return;
    }
    if (remeasure && typeof this.textNode.refreshParams === 'function') {
      this.textNode.refreshParams();
    }
    this.__syncTextSize();
  }

  /**
   * 让包装盒跟上**内层文字的实际尺寸**（自动宽高时）。
   *
   * 为什么不能只在构造 / `setText` 时同步一次：构造期还没有 canvas ctx，`ICEText` 走的是 DOM 兜底测量 ——
   * 长中文串会被量得偏大（实测 admin 示例里 418 vs 真实 228）。等引擎用真字体重量之后，
   * 内层 ICEText 自己变准了，但**包装盒还停在旧数字上**：于是点在盒子右边的空白会命中这个标签、
   * 按盒子宽度留位的邻居也会错位（批量操作行里提示文字压住按钮，就是这么来的）。
   * 所以每帧渲染前对一次账，差得多就更新盒子并请父容器重排（有布局管理器的容器会自动重排）。
   */
  private __syncTextSize(): void {
    if (!this.textNode || !this.textNode.state) {
      return;
    }
    // 「自动盒」用构造期记下的标志判断（显式写 width: 10 也算给了尺寸，不能拿默认值 10 当哨兵）
    const autoWidth = this.__autoBoxWidth;
    const autoHeight = this.__autoBoxHeight;
    if (!autoWidth && !autoHeight) {
      return;
    }
    const width = Number(this.textNode.state.width) || 0;
    const height = Number(this.textNode.state.height) || 0;
    let changed = false;
    if (autoWidth && width > 0 && Math.abs(Number(this.state.width) - width) > 0.5) {
      this.state.width = width;
      changed = true;
    }
    if (autoHeight && height > 0 && Math.abs(Number(this.state.height) - height) > 0.5) {
      this.state.height = height;
      changed = true;
    }
    if (!changed) {
      return;
    }
    // 盒子尺寸变了：本地原点在中心，原点位置随之变化 → 矩阵要重算、本帧要重画
    this.dirty = true;
    this.paramsDirty = true;
    if (this.parentNode && typeof this.parentNode.requestLayout === 'function') {
      this.parentNode.requestLayout();
    }
  }

  protected doRender(): void {
    // 渲染前对一次账：内层文字这一帧（或上一帧）用真字体重量过了，包装盒得跟着走
    this.__syncTextSize();
    super.doRender();
  }

  /**
   * 尺寸变化时把内层文字盒铺到新的标签盒上（`ICEWidget.__syncInternalLayout()`）。
   *
   * 构造期只在「调用方显式给了宽高」时把内层文字盒设成同一个盒子（见构造函数），
   * 那次之后就没人再对账了：父层布局把标签拉窄/拉高之后，文字盒还停在构造期的尺寸，
   * 于是 `textAlign` / `textBaseline` 是**相对旧盒子**算的 —— 居中的字偏到盒子外，
   * 右对齐的字直接越到邻居身上。
   *
   * 反过来（`__autoBoxWidth/Height`，即调用方没给尺寸）不能这么做：那种情况下是
   * 标签盒跟着文字走，`__syncTextSize()` 负责，这里必须什么都不做，否则会打架。
   */
  protected __syncInternalLayout(): void {
    if (!this.textNode || !this.textNode.state) {
      return;
    }
    const cur = this.textNode.state;
    const next: any = {};
    if (!this.__autoBoxWidth) {
      next.width = Number(this.state.width) || 0;
    }
    if (!this.__autoBoxHeight) {
      next.height = Number(this.state.height) || 0;
    }
    if (next.width === undefined && next.height === undefined) {
      return;
    }
    const widthSame = next.width === undefined || Number(cur.width) === next.width;
    const heightSame = next.height === undefined || Number(cur.height) === next.height;
    if (widthSame && heightSame) {
      return;
    }
    this.textNode.setState(next);
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
