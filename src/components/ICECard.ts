import { ICEPanel } from './ICEPanel';
import { iceUIManager } from '../core/ICEManager';
import { createTextNode } from '../util/ICEStyle';

/**
 * 卡片：面板 + 标题，并提供右上角 `extra` 插槽（放“更多/操作”）。
 */
export class ICECard extends ICEPanel {
  private titleNode: any;
  private extraNode: any = null;

  constructor(props: any = {}) {
    // 注意：引擎会把 props 深拷贝进 state，而 extra 可能是组件实例（带 parentNode 环），
    // 直接塞进 props 会 cloneDeep 爆栈 —— 这里先剥离，构造完成后再挂载。
    const { extra, ...rest } = props;
    super({
      ...rest,
      style: {
        shadow: 'md',
        ...(props.style || {}),
      },
    });
    const theme = iceUIManager.getTheme();
    if (props.title) {
      this.titleNode = createTextNode({
        left: props.paddingLeft ?? theme.spacing.md,
        top: props.paddingTop ?? theme.spacing.sm,
        text: props.title,
        fillStyle: theme.colors.text,
        fontFamily: theme.font.family,
        fontSize: theme.font.sizeLarge,
        fontWeight: theme.font.weightSemibold,
      });
      this.addChild(this.titleNode, false);
    }
    if (extra) {
      this.setExtra(extra);
    }
  }

  public setTitle(title: string): this {
    if (!this.titleNode) {
      return this;
    }
    this.titleNode.setText(title);
    this.revalidate();
    return this;
  }

  /**
   * 右上角插槽：放操作链接 / 按钮等。
   *
   * 可以传现成节点，也可以传工厂函数 —— **推荐工厂函数**：引擎按创建顺序决定 zIndex，
   * 调用方在卡片之前 new 出来的节点会被卡片底色盖住；传函数则由卡片在构造期创建，
   * 天然在上层。传现成节点时这里也会把整棵子树抬到卡片之上兜底。
   */
  public setExtra(extra: any): this {
    const theme = iceUIManager.getTheme();
    if (this.extraNode) {
      this.removeChild(this.extraNode);
      this.extraNode = null;
    }
    if (!extra) {
      this.revalidate();
      return this;
    }
    const node = typeof extra === 'function' ? extra() : extra;
    const width = Number(this.state.width) || 0;
    const nodeWidth = Number(node.state && node.state.width) || 0;
    const top = Number(this.titleNode ? this.titleNode.state.top : theme.spacing.sm);
    node.setState({ left: width - theme.spacing.md - nodeWidth, top });
    this.addChild(node, false);
    this.__raiseSubtree(node, (Number(this.state.zIndex) || 0) + 1);
    this.extraNode = node;
    this.revalidate();
    return this;
  }

  public getExtraNode(): any {
    return this.extraNode;
  }

  public getTitleNode(): any {
    return this.titleNode;
  }

  /** 整棵子树统一抬到指定 zIndex（同值不破坏子树内「先父后子」的顺序）。 */
  private __raiseSubtree(node: any, zIndex: number): void {
    if (!node || !node.state) {
      return;
    }
    node.state.zIndex = zIndex;
    (node.childNodes || []).forEach((child: any) => this.__raiseSubtree(child, zIndex));
  }
}
