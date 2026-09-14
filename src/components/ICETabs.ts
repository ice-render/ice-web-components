import { ICEButton } from './ICEButton';
import { ICEContainer } from '../core/ICEContainer';
import { ICEFlowLayout } from 'ice-render';
import { iceUIManager } from '../core/ICEManager';

/**
 * 标签页：一组互斥按钮，`onChange` 通知切换（程序式 `setActiveIndex` 不触发回调）。
 */
export class ICETabs extends ICEContainer {
  private buttons: ICEButton[] = [];
  private activeIndex = 0;
  private tabs: string[] = [];
  private onChangeCallback: ((index: number, tab: string) => void) | null = null;
  /** 形态：line = 实心药丸（默认，行为与以前一致）；card = 文件袋式（未选中页不画底色） */
  private type: 'line' | 'card' = 'line';
  private closable = false;
  private closeCallback: ((tab: string, index: number) => void) | null = null;
  private extraNodes: any[] = [];

  constructor(props: any = {}) {
    const theme = iceUIManager.getTheme();
    const height = props.height || theme.control.height;
    super({
      fill: false,
      stroke: false,
      ...props,
    });
    this.setLayout(new ICEFlowLayout({ gap: 8, align: 'left' }));
    const tabs: string[] = props.tabs || [];
    this.tabs = tabs.slice();
    this.onChangeCallback = typeof props.onChange === 'function' ? props.onChange : null;
    this.type = props.type === 'card' ? 'card' : 'line';
    this.closable = props.closable === true;
    this.closeCallback = typeof props.onClose === 'function' ? props.onClose : null;
    const gap = 8;
    const totalGap = Math.max(0, tabs.length - 1) * gap;
    const autoWidth = props.width ? (props.width - totalGap) / Math.max(1, tabs.length) : 90;
    tabs.forEach((text, index) => {
      const button = new ICEButton({
        text,
        width: Math.max(64, autoWidth),
        height,
        variant: index === 0 ? 'primary' : 'default',
      });
      this.buttons.push(button);
      this.addChild(button, false);
      if (this.closable) this.__attachCloseButton(button, index);
    });
    // 右侧扩展区：直接挂在页签之后，让流式布局把它排到最右
    const extra = props.extra === undefined || props.extra === null ? [] : Array.isArray(props.extra) ? props.extra : [props.extra];
    extra.forEach((node: any) => {
      if (!node) return;
      this.extraNodes.push(node);
      this.addChild(node, false);
    });
    this.buttons.forEach((button, index) => {
      button.on('mousedown', () => this.__activate(index), this);
    });
    this.setActiveIndex(0);
    this.doLayout();
  }

  public getActiveIndex(): number {
    return this.activeIndex;
  }

  public setActiveIndex(index: number): this {
    return this.__applyActive(index);
  }

  public getTabs(): string[] {
    return this.tabs.slice();
  }

  public getType(): 'line' | 'card' {
    return this.type;
  }

  public isClosable(): boolean {
    return this.closable;
  }

  public getExtra(): any[] {
    return this.extraNodes.slice();
  }

  /**
   * 关掉某个页签：移除按钮与标签、通知 `onClose`、把激活下标夹回合法范围。
   * 关闭钮与被调用的地方走的是同一条路径（行为只有一份）。
   */
  public closeTab(index: number): this {
    if (index < 0 || index >= this.buttons.length) return this;
    const [tab] = this.tabs.splice(index, 1);
    const [button] = this.buttons.splice(index, 1);
    if (button) this.removeChild(button);
    if (this.closeCallback) this.closeCallback(tab, index);
    if (this.buttons.length) {
      const next = Math.min(this.activeIndex >= index ? this.activeIndex - 1 : this.activeIndex, this.buttons.length - 1);
      this.__applyActive(Math.max(0, next));
    } else {
      this.activeIndex = 0;
    }
    this.revalidate();
    return this;
  }

  /** 给页签挂一个关闭钮（✕）：点击 = closeTab。 */
  private __attachCloseButton(button: ICEButton, index: number): void {
    const theme = this.theme();
    const close = new ICEButton({
      text: '✕',
      width: 18,
      height: 18,
      variant: 'text',
      size: 'small',
      focusable: false,
      style: { fontSize: 10 },
    });
    close.setState({ left: Math.max(0, (Number(button.state.width) || 80) - 22), top: 4 });
    close.on('click', () => {
      const live = this.buttons.indexOf(button);
      if (live >= 0) this.closeTab(live);
    });
    button.addChild(close, false);
    void theme;
    void index;
  }

  /** 用户点击切页（`setActiveIndex` 是程序式设置，不触发 onChange）。 */
  private __activate(index: number): void {
    const changed = index !== this.activeIndex;
    this.__applyActive(index);
    if (changed && this.onChangeCallback) {
      this.onChangeCallback(index, this.tabs[index]);
    }
  }

  private __applyActive(index: number): this {
    if (index < 0 || index >= this.buttons.length) {
      return this;
    }
    this.activeIndex = index;
    this.buttons.forEach((button, i) => {
      const theme = this.theme();
      const active = i === index;
      /**
       * 形态差异只体现在**底色与描边**上：
       * - `line`（默认）：选中实心主色、未选中浅底 —— 与以前完全一致；
       * - `card`（文件袋式）：选中页贴在内容上（卡片底色 + 描边），未选中页留在背景里（透明）。
       */
      const isCard = this.type === 'card';
      button.setState({
        style: isCard
          ? {
              ...button.state.style,
              fillStyle: active ? theme.colors.surface : 'rgba(0,0,0,0)',
              strokeStyle: active ? theme.colors.border : 'rgba(0,0,0,0)',
              shadow: active ? theme.shadows.sm : undefined,
            }
          : {
              ...button.state.style,
              fillStyle: active ? theme.colors.primary : theme.colors.surface,
              strokeStyle: active ? theme.colors.primary : theme.colors.border,
              ...(active ? theme.shadows.sm : {}),
            },
      });
      button.setState({ fill: isCard ? active : true, stroke: isCard ? active : true });
      const label = button.childNodes && button.childNodes[0];
      if (label && label.setState) {
        label.setState({
          style: {
            fillStyle: active ? theme.colors.primaryText : theme.colors.text,
            fontFamily: theme.font.family,
            fontSize: theme.font.size,
            fontWeight: theme.font.weightMedium,
            textAlign: 'center',
            textBaseline: 'middle',
          },
        });
      }
    });
    this.revalidate();
    return this;
  }
}
