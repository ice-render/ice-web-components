import { UIAvatar } from './UIAvatar';
import { UIComponent } from '../core/UIComponent';
import { uiManager } from '../core/UIManager';

/**
 * 头像组（业界组件库 Avatar.Group 的最小版）。
 *
 * - 头像横向**重叠**排布（每个左移 `overlap`），靠 UIAvatar 自带的描边把相邻头像分开；
 * - 超过 `max` 个时折叠：只显示前 max 个，末尾补一个 `+N` 头像；
 * - 组件宽度按「最后一个头像的右边缘」算，方便直接放进工具栏/表格单元格。
 */

export interface UIAvatarGroupItem {
  text: string;
  backgroundColor?: string;
}

export interface UIAvatarGroupOptions {
  avatars: UIAvatarGroupItem[];
  size?: number;
  max?: number;
  /** 相邻头像的重叠像素；默认 size / 4 */
  overlap?: number;
  left?: number;
  top?: number;
}

export class UIAvatarGroup extends UIComponent {
  private avatars: UIAvatarGroupItem[];
  private size: number;
  private max: number;
  private overlap: number;
  private avatarNodes: UIAvatar[] = [];
  private restNode: UIAvatar | null = null;

  constructor(props: UIAvatarGroupOptions) {
    const size = Number(props.size) || 32;
    super({
      fill: false,
      stroke: false,
      left: props.left,
      top: props.top,
      width: 0,
      height: size,
    });
    this.avatars = (props.avatars || []).slice();
    this.size = size;
    this.max = Math.max(0, Number(props.max ?? 4));
    this.overlap = props.overlap === undefined ? Math.round(size / 4) : Math.max(0, Number(props.overlap));
    this.__render();
  }

  public getCount(): number {
    return this.avatars.length;
  }

  public getVisibleCount(): number {
    return Math.min(this.max, this.avatars.length);
  }

  public getRestCount(): number {
    return Math.max(0, this.avatars.length - this.getVisibleCount());
  }

  public getAvatarNodes(): UIAvatar[] {
    return this.avatarNodes.slice();
  }

  public getRestNode(): UIAvatar | null {
    return this.restNode;
  }

  public setAvatars(avatars: UIAvatarGroupItem[]): this {
    this.avatars = (avatars || []).slice();
    this.__render();
    return this;
  }

  private __render(): void {
    const theme = uiManager.getTheme();
    this.removeChildren([...this.childNodes]);
    this.avatarNodes = [];
    this.restNode = null;
    const visible = this.getVisibleCount();
    const rest = this.getRestCount();
    const step = this.size - this.overlap;
    const total = visible + (rest > 0 ? 1 : 0);

    this.avatars.slice(0, visible).forEach((item, index) => {
      const avatar = new UIAvatar({
        left: index * step,
        top: 0,
        size: this.size,
        text: item.text,
        backgroundColor: item.backgroundColor,
      });
      this.addChild(avatar, false);
      this.avatarNodes.push(avatar);
    });
    if (rest > 0) {
      const more = new UIAvatar({
        left: visible * step,
        top: 0,
        size: this.size,
        text: `+${rest}`,
        backgroundColor: theme.colors.borderSecondary,
      });
      this.addChild(more, false);
      this.restNode = more;
    }
    this.setState({
      width: total === 0 ? 0 : (total - 1) * step + this.size,
      height: total === 0 ? 0 : this.size,
    });
    if (this.ice && this.ice.dirty !== undefined) {
      this.ice.dirty = true;
    }
  }
}
