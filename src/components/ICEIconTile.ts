import { ICEWidget } from '../core/ICEWidget';
import { ICELabel } from './ICELabel';
import { iceUIManager } from '../core/ICEManager';
import { resolvedStyleColor } from '../util/ICEStyle';

/**
 * 图标磁贴（桌面图标 / 应用宫格）：大图标字形 + 下方文字标签。
 *
 * - 单击选中（标签变蓝底白字，XP 桌面的选择样式），再点一下取消；
 * - **双击打开**（`dblclick` → `open` 事件 + `onOpen`），Enter/Space 等价（键盘可达）；
 * - `selected` 为受控初始值，`setSelected()` 是程序式接口（取消全选时用）。
 */
export interface ICEIconTileOptions {
  /** 组件 id（引擎会用它做唯一标识，e2e/调试时可按 id 定位） */
  id?: string;
  /** 图标字形（emoji 或单个符号） */
  icon: string;
  /**
   * 自绘图标节点（给了它就代替 `icon` 字形）。
   *
   * 需要「画」出来的图标（拟物、彩色、多图层）时用：传一个组件，磁贴会把它在图标区居中。
   */
  iconNode?: any;
  label: string;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  iconSize?: number;
  fontSize?: number;
  selected?: boolean;
  onSelect?: (selected: boolean) => void;
  onOpen?: (label: string) => void;
}

export class ICEIconTile extends ICEWidget {
  private iconNode: any;
  private labelNode: ICELabel;
  private labelBackground: ICEWidget;
  private selected: boolean;
  private onSelect: ((selected: boolean) => void) | null;
  private onOpen: ((label: string) => void) | null;
  private readonly labelText: string;
  /** 图标区高度（来自 props，固定值；标签与高亮块的纵向位置由它推出来） */
  private readonly iconSize: number;
  /** 图标是调用方传进来的自绘节点（居中方式与内置字形不同） */
  private readonly customIcon: boolean;

  constructor(props: ICEIconTileOptions) {
    const theme = iceUIManager.getTheme();
    const width = props.width ?? 84;
    const height = props.height ?? 78;
    super({
      id: props.id,
      fill: false,
      stroke: false,
      left: props.left,
      top: props.top,
      width,
      height,
      interactive: true,
      focusable: true,
    });
    this.labelText = props.label;
    this.selected = props.selected === true;
    this.onSelect = typeof props.onSelect === 'function' ? props.onSelect : null;
    this.onOpen = typeof props.onOpen === 'function' ? props.onOpen : null;
    const iconSize = props.iconSize ?? 34;
    this.iconSize = iconSize;
    this.customIcon = !!props.iconNode;
    if (props.iconNode) {
      const glyph = props.iconNode;
      const glyphWidth = Number(glyph.state && glyph.state.width) || iconSize;
      const glyphHeight = Number(glyph.state && glyph.state.height) || iconSize;
      glyph.setState({
        left: Math.round((width - glyphWidth) / 2),
        top: 4 + Math.max(0, Math.round((iconSize + 6 - glyphHeight) / 2)),
      });
      this.iconNode = glyph;
    } else {
      this.iconNode = new ICELabel({
        interactive: false,
        left: 0,
        top: 4,
        width,
        height: iconSize + 6,
        text: props.icon,
        align: 'center',
        verticalAlign: 'middle',
        style: { fontSize: iconSize, fillStyle: '#ffffff' },
      });
    }
    this.labelNode = new ICELabel({
      interactive: false,
      left: 4,
      top: iconSize + 12,
      width: width - 8,
      height: 18,
      text: props.label,
      align: 'center',
      verticalAlign: 'middle',
      style: { fontSize: props.fontSize ?? 11, fillStyle: '#ffffff' },
    });
    // 选中态：标签底下的蓝色高亮块（ICELabel 自己只画文字，底色得单独给一层）
    this.labelBackground = new ICEWidget({
      left: 2,
      top: iconSize + 10,
      width: width - 4,
      height: 22,
      fill: true,
      stroke: false,
      style: { fillStyle: 'rgba(0,0,0,0)' },
    });
    this.addChild(this.labelBackground, false);
    this.addChild(this.iconNode, false);
    this.addChild(this.labelNode, false);
    this.on('click', () => this.toggle());
    this.on('dblclick', () => this.open());
    this.__sync();
    void theme;
  }

  public getLabel(): string {
    return this.labelText;
  }

  public isSelected(): boolean {
    return this.selected;
  }

  public setSelected(selected: boolean): this {
    const next = !!selected;
    if (next === this.selected) {
      return this;
    }
    this.selected = next;
    this.__sync();
    this.trigger('select', null, { selected: next });
    if (this.onSelect) {
      this.onSelect(next);
    }
    return this;
  }

  /** 单击切换选中（桌面图标的标准行为）。 */
  public toggle(): this {
    return this.setSelected(!this.selected);
  }

  /** 打开（双击 / Enter / Space）。 */
  public open(): this {
    this.trigger('open', null, { label: this.labelText });
    if (this.onOpen) {
      this.onOpen(this.labelText);
    }
    return this;
  }

  /** 键盘激活 = 打开（与双击同义）。 */
  public activate(): void {
    if (!this.enabled) {
      return;
    }
    this.open();
  }

  public getLabelColor(): string {
    const textNode = this.labelNode.childNodes[0];
    return textNode ? resolvedStyleColor(textNode, 'fillStyle') : '';
  }

  public getLabelBackground(): string {
    return resolvedStyleColor(this.labelBackground, 'fillStyle', 'rgba(0,0,0,0)');
  }

  /**
   * 尺寸变化时重排图标、文字标签与选中高亮块（`ICEWidget.__syncInternalLayout()`）。
   *
   * 构造期是按 `width` 算好 `(width - 图标宽) / 2` 居中偏移、以及 `width - 4 / width - 8`
   * 这些宽度的，之后父层布局改尺寸时谁都不动 —— 高亮块与标签还停在旧宽度上，
   * 比盒子宽的部分直接画到邻居身上（等分网格里的磁贴必现）。
   */
  protected __syncInternalLayout(): void {
    const theme = iceUIManager.getTheme();
    const width = Number(this.state.width) || 0;
    if (!(width > 0)) {
      return;
    }
    if (this.customIcon) {
      const glyphWidth = Number(this.iconNode.state && this.iconNode.state.width) || this.iconSize;
      const glyphHeight = Number(this.iconNode.state && this.iconNode.state.height) || this.iconSize;
      this.iconNode.setState({
        left: Math.round((width - glyphWidth) / 2),
        top: 4 + Math.max(0, Math.round((this.iconSize + 6 - glyphHeight) / 2)),
      });
    } else {
      this.iconNode.setState({ left: 0, top: 4, width, height: this.iconSize + 6 });
    }
    this.labelNode.setState({ left: 4, top: this.iconSize + 12, width: width - 8, height: 18 });
    this.labelBackground.setState({ left: 2, top: this.iconSize + 10, width: width - 4, height: 22 });
    void theme;
  }

  protected __applyHoverState(): void {
    this.__sync();
  }

  private __sync(): void {
    const selected = this.selected;
    this.labelBackground.setState({
      display: selected,
      style: { ...this.labelBackground.state.style, fillStyle: selected ? '#0a246a' : 'rgba(0,0,0,0)' },
    });
    const textNode = this.labelNode.childNodes[0];
    if (textNode) {
      textNode.setState({
        style: {
          ...textNode.state.style,
          fillStyle: selected || this.hovered ? '#ffffff' : '#ffffff',
        },
      });
    }
    this.iconNode.setState({ opacity: selected ? 0.85 : 1 });
    this.revalidate();
  }
}
