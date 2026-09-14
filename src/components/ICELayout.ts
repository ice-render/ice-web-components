import { ICEContainer } from '../core/ICEContainer';
import { iceUIManager } from '../core/ICEManager';

/**
 * 布局骨架：顶栏 / 侧栏 / 内容 / 页脚。
 *
 * 后台外壳每个示例都在手搭（算坐标、算剩余宽度、侧栏收起时手动把内容挪过去），
 * 这里把它沉淀成一个件：
 *
 * - 四个区域都是可选的，**没给的不占空间**（没页脚时内容直接到底）；
 * - 侧栏可在左 / 在右，可收起（`setSiderVisible(false)` / `setSiderWidth(0)`）；
 * - 容器尺寸变化会自动重排（`__afterStateMerge` 里补一次），不是一次性算完就固定；
 * - 区域节点被真的摆到对应盒子里（改它们的 left/top/width/height），
 *   `getRegionBox(name)` 把版式暴露出来给测试与几何审计。
 *
 * 用在需要「整页骨架」的场景；只是想给一段内容加个壳的话，`ICEPanel` / `ICECard` 更轻。
 */

export type ICELayoutRegion = 'header' | 'sider' | 'content' | 'footer';

export interface ICELayoutBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface ICELayoutOptions {
  id?: string;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  headerHeight?: number;
  footerHeight?: number;
  siderWidth?: number;
  siderPosition?: 'left' | 'right';
  header?: any;
  sider?: any;
  content?: any;
  footer?: any;
  style?: Record<string, any>;
  background?: string;
}

export class ICELayout extends ICEContainer {
  private headerNode: any = null;
  private siderNode: any = null;
  private contentNode: any = null;
  private footerNode: any = null;
  private headerHeight: number;
  private footerHeight: number;
  private siderWidth: number;
  private siderPosition: 'left' | 'right';
  private siderVisible = true;
  private background: string;

  constructor(props: ICELayoutOptions = {}) {
    const theme = iceUIManager.getTheme();
    super({
      ...props,
      fill: true,
      stroke: false,
      width: props.width ?? 640,
      height: props.height ?? 400,
      style: { fillStyle: props.background || theme.colors.background, ...(props.style || {}) },
    });
    this.headerHeight = Math.max(0, Math.floor(Number(props.headerHeight) || 56));
    this.footerHeight = Math.max(0, Math.floor(Number(props.footerHeight) || 44));
    this.siderWidth = Math.max(0, Math.floor(Number(props.siderWidth) || 220));
    this.siderPosition = props.siderPosition === 'right' ? 'right' : 'left';
    this.background = props.background || theme.colors.background;
    if (props.header) this.setHeader(props.header);
    if (props.sider) this.setSider(props.sider);
    if (props.content) this.setContent(props.content);
    if (props.footer) this.setFooter(props.footer);
    this.layout();
  }

  protected __afterStateMerge(sizeChanged: boolean): void {
    super.__afterStateMerge(sizeChanged);
    if (sizeChanged) {
      this.layout();
    }
  }

  public setHeader(node: any): this {
    this.headerNode = this.__swap(this.headerNode, node);
    return this.layout();
  }

  public setSider(node: any): this {
    this.siderNode = this.__swap(this.siderNode, node);
    return this.layout();
  }

  public setContent(node: any): this {
    this.contentNode = this.__swap(this.contentNode, node);
    return this.layout();
  }

  public setFooter(node: any): this {
    this.footerNode = this.__swap(this.footerNode, node);
    return this.layout();
  }

  public getHeader(): any {
    return this.headerNode;
  }

  public getSider(): any {
    return this.siderNode;
  }

  public getContent(): any {
    return this.contentNode;
  }

  public getFooter(): any {
    return this.footerNode;
  }

  public setSiderWidth(width: number): this {
    this.siderWidth = Math.max(0, Math.floor(Number(width) || 0));
    return this.layout();
  }

  public getSiderWidth(): number {
    return this.siderWidth;
  }

  public setSiderVisible(visible: boolean): this {
    this.siderVisible = visible !== false;
    if (this.siderNode) {
      this.siderNode.setState({ display: this.siderVisible && this.siderWidth > 0 });
    }
    return this.layout();
  }

  public isSiderVisible(): boolean {
    return this.siderVisible;
  }

  public setHeaderHeight(height: number): this {
    this.headerHeight = Math.max(0, Math.floor(Number(height) || 0));
    return this.layout();
  }

  public setFooterHeight(height: number): this {
    this.footerHeight = Math.max(0, Math.floor(Number(height) || 0));
    return this.layout();
  }

  /** 区域盒子（没给该区域时是零尺寸的盒子，位置按「不占空间」算）。 */
  public getRegionBox(name: ICELayoutRegion): ICELayoutBox {
    const width = Number(this.state.width) || 0;
    const height = Number(this.state.height) || 0;
    const top = this.headerNode ? this.headerHeight : 0;
    const bottom = this.footerNode ? Math.max(0, height - this.footerHeight) : height;
    const bodyHeight = Math.max(0, bottom - top);
    const siderActive = !!this.siderNode && this.siderVisible && this.siderWidth > 0;
    const sideWidth = siderActive ? Math.min(this.siderWidth, width) : 0;
    const footerTop = this.footerNode ? Math.max(0, height - this.footerHeight) : height;
    switch (name) {
      case 'header':
        return { left: 0, top: 0, width, height: this.headerNode ? this.headerHeight : 0 };
      case 'footer':
        return { left: 0, top: footerTop, width, height: this.footerNode ? this.footerHeight : 0 };
      case 'sider':
        return {
          left: this.siderPosition === 'right' ? Math.max(0, width - sideWidth) : 0,
          top,
          width: sideWidth,
          height: bodyHeight,
        };
      case 'content':
        return {
          left: siderActive && this.siderPosition === 'left' ? sideWidth : 0,
          top,
          width: Math.max(0, width - sideWidth),
          height: bodyHeight,
        };
      default:
        return { left: 0, top: 0, width: 0, height: 0 };
    }
  }

  /** 按当前尺寸把各区域摆好（尺寸变化后由 `__afterStateMerge` 自动调）。 */
  public layout(): this {
    const place = (node: any, box: ICELayoutBox, visible = true) => {
      if (!node) {
        return;
      }
      node.setState({
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
        display: visible && box.width > 0 && box.height > 0,
      });
    };
    place(this.headerNode, this.getRegionBox('header'));
    place(this.footerNode, this.getRegionBox('footer'));
    place(this.siderNode, this.getRegionBox('sider'), this.siderVisible);
    place(this.contentNode, this.getRegionBox('content'));
    return this;
  }

  /** 换区域节点：旧的从子节点摘掉，新的接上（传 null 就是清空）。 */
  private __swap(previous: any, next: any): any {
    if (previous && previous !== next) {
      this.removeChild(previous);
    }
    if (next && next.parentNode !== this) {
      this.addChild(next, false);
    }
    return next || null;
  }
}

export default ICELayout;
