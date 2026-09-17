import { ICEContainer } from '../core/ICEContainer';
import { iceUIManager } from '../core/ICEManager';
import { ICEBorderLayout, token, type ICEThemeTokenRef } from 'ice-render';

/**
 * 布局骨架：顶栏 / 侧栏 / 内容 / 页脚。
 *
 * 后台外壳每个示例都在手搭（算坐标、算剩余宽度、侧栏收起时手动把内容挪过去），
 * 这里把它沉淀成一个件。版式本身**交给引擎的五区布局**（`ICEBorderLayout`）：
 * 顶栏 north / 侧栏 west（右置时 east）/ 内容 center / 页脚 south，本组件只负责
 * 「哪个节点是哪个区」和「各区声明多大」——
 *
 * - 四个区域都是可选的，**没给的不占空间**（没页脚时内容直接到底）；
 * - 侧栏可在左 / 在右，可收起（`setSiderVisible(false)` / `setSiderWidth(0)`）；
 *   收起 = 把侧栏节点 `display` 关掉：布局器按 Swing 口径跳过不可见子项，内容自动占满；
 * - 容器尺寸变化自动重排（走引擎的失效/校验链路，`__afterStateMerge` 里补一次立即排）；
 * - `getRegionBox(name)` 直接读区域节点被布局器摆好的盒子，暴露给测试与几何审计。
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
  /** 页面底色：字面量或**主题引用**（引用跟随热切换） */
  private background: string | ICEThemeTokenRef;

  constructor(props: ICELayoutOptions = {}) {
    const theme = iceUIManager.getTheme();
    super({
      ...props,
      fill: true,
      stroke: false,
      width: props.width ?? 640,
      height: props.height ?? 400,
      style: { fillStyle: props.background || token('ui.colors.background'), ...(props.style || {}) },
    });
    this.headerHeight = Math.max(0, Math.floor(Number(props.headerHeight) || 56));
    this.footerHeight = Math.max(0, Math.floor(Number(props.footerHeight) || 44));
    this.siderWidth = Math.max(0, Math.floor(Number(props.siderWidth) || 220));
    this.siderPosition = props.siderPosition === 'right' ? 'right' : 'left';
    this.background = props.background || token('ui.colors.background');
    // 版式交给引擎：五区布局按 Swing 的 BorderLayout 口径摆位置（north/south 先在竖直方向切，
    // west/east 再在中间带切，center 吃剩下的），本组件只声明"哪个节点是哪个区"。
    this.setLayout(new ICEBorderLayout({ gap: 0 }));
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
    this.headerNode = this.__swap(this.headerNode, node, 'north');
    return this.layout();
  }

  public setSider(node: any): this {
    this.siderNode = this.__swap(this.siderNode, node, this.siderPosition === 'right' ? 'east' : 'west');
    return this.layout();
  }

  public setContent(node: any): this {
    this.contentNode = this.__swap(this.contentNode, node, 'center');
    return this.layout();
  }

  public setFooter(node: any): this {
    this.footerNode = this.__swap(this.footerNode, node, 'south');
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

  /** 区域盒子：直接读布局器摆好的实际位置（没给该区域 / 该区域被收起时是零盒子）。 */
  public getRegionBox(name: ICELayoutRegion): ICELayoutBox {
    const node =
      name === 'header'
        ? this.headerNode
        : name === 'sider'
        ? this.siderNode
        : name === 'content'
        ? this.contentNode
        : name === 'footer'
        ? this.footerNode
        : null;
    // 没有该区域、或该区域被收起（display:false，布局器会跳过它）→ 零盒子
    if (!node || !node.state || !node.isEffectivelyVisible()) {
      return { left: 0, top: 0, width: 0, height: 0 };
    }
    return {
      left: Number(node.state.left) || 0,
      top: Number(node.state.top) || 0,
      width: Number(node.state.width) || 0,
      height: Number(node.state.height) || 0,
    };
  }

  /**
   * 把"声明尺寸"同步到区域节点，再让引擎布局摆位。
   *
   * 五区布局读的是各区域**自己的尺寸**（north/south 用自身高度、west/east 用自身宽度），
   * 所以 `headerHeight` / `footerHeight` / `siderWidth` 这些声明先落到节点上；
   * 侧栏收起也走这里（`display: false` → 布局器跳过它）。
   */
  public layout(): this {
    if (this.headerNode) {
      this.headerNode.setState({ height: this.headerHeight });
    }
    if (this.footerNode) {
      this.footerNode.setState({ height: this.footerHeight });
    }
    if (this.siderNode) {
      this.siderNode.setState({
        width: this.siderWidth,
        display: this.siderVisible && this.siderWidth > 0,
      });
    }
    this.doLayout();
    return this;
  }

  /** 换区域节点：旧的从子节点摘掉，新的接上（传 null 就是清空）。 */
  private __swap(previous: any, next: any, constraint: 'north' | 'south' | 'east' | 'west' | 'center'): any {
    if (previous && previous !== next) {
      this.removeChild(previous);
    }
    if (next && next.parentNode !== this) {
      this.addChild(next, false);
    }
    // 五区布局从子节点 state 上读方位（engine 2026-09-14 起的约定）
    if (next && next.state) {
      next.setState({ layoutConstraint: constraint });
    }
    return next || null;
  }
}

export default ICELayout;
