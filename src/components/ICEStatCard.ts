import { ICERect } from 'ice-render';
import { ICEPanel } from './ICEPanel';
import { iceUIManager } from '../core/ICEManager';
import { createTextNode, getStatusColors } from '../util/ICEStyle';
import { ICELayoutManager } from 'ice-render';

/**
 * 统计卡内部零件的自持策略（2026-09-15）。
 *
 * 原来这些偏移是**构造期**按当时的宽高算死的：卡片一旦被父层布局改尺寸（等分网格 / stretch），
 * 图标与文字块就停在旧盒子上 —— 文字比卡片宽就溢出盖住邻居（与 `ICEButton` 的标签同一类问题）。
 * 改成自持策略后，尺寸变化会走引擎的失效链路自动重排内部（见 AGENTS「布局铁律」）。
 */
class ICEStatCardLayout extends ICELayoutManager {
  layoutContainer(container: any): void {
    const card = container as ICEStatCard;
    const parts = card.__getStatCardNodes();
    if (!parts) {
      return;
    }
    const width = Number(container.state.width) || 0;
    const height = Number(container.state.height) || 0;
    const theme = iceUIManager.getTheme();
    const blockHeight = 72; // 标题18 + 间距 + 数值30 + 间距 + 趋势18
    const textTop = Math.round((height - blockHeight) / 2);
    const iconSize = 36;
    const iconTop = Math.round((height - iconSize) / 2);
    const textLeft = theme.spacing.md + iconSize + theme.spacing.sm;
    const textWidth = Math.max(0, width - textLeft - theme.spacing.sm);

    parts.iconBox.setState({ left: theme.spacing.md, top: iconTop, width: iconSize, height: iconSize });
    parts.iconNode.setState({ left: theme.spacing.md, top: iconTop, width: iconSize, height: iconSize });
    parts.titleNode.setState({ left: textLeft, top: textTop, width: textWidth, height: 18 });
    parts.valueNode.setState({ left: textLeft, top: textTop + 22, width: textWidth, height: 30 });
    parts.trendNode.setState({ left: textLeft, top: textTop + 54, width: textWidth, height: 18 });
  }

  /** 序列化参数：内部几何由卡片尺寸决定，策略本身无参。 */
  public toJSON(): any {
    return {};
  }
}

/**
 * 统计卡：图标 + 标题 + 数值 + 涨跌趋势，用于仪表盘顶部指标。
 */
export class ICEStatCard extends ICEPanel {
  private valueNode: any;
  private titleNode: any;
  private trendNode: any;
  private iconNode: any;
  private iconBox: any;

  constructor(props: any = {}) {
    super({
      ...props,
      style: {
        shadow: 'sm',
        ...(props.style || {}),
      },
    });

    const theme = iceUIManager.getTheme();
    const width = props.width || 220;
    const height = props.height || 120;
    const iconColor = props.iconColor || theme.colors.primary;
    const iconBg = props.iconBg || theme.colors.primaryBg;
    const trendType = props.trendType || 'success';
    const trend = props.trend === undefined ? '' : String(props.trend);

    // 图标盒与文字块在卡片内垂直居中对齐
    const blockHeight = 72; // 标题18 + 间距 + 数值30 + 间距 + 趋势18
    const textTop = Math.round((height - blockHeight) / 2);
    const iconSize = 36;
    const iconTop = Math.round((height - iconSize) / 2);

    this.iconBox = new ICERect({
      left: theme.spacing.md,
      top: iconTop,
      width: iconSize,
      height: iconSize,
      radius: theme.radius.md,
      style: {
        fillStyle: iconBg,
        strokeStyle: iconBg,
        lineWidth: theme.control.lineWidth,
      },
    });
    this.iconNode = createTextNode({
      left: theme.spacing.md,
      top: iconTop,
      width: iconSize,
      height: iconSize,
      text: props.icon || '●',
      fillStyle: iconColor,
      fontFamily: theme.font.family,
      fontSize: 18,
      fontWeight: theme.font.weightSemibold,
      align: 'center',
      verticalAlign: 'middle',
    });

    const textLeft = theme.spacing.md + iconSize + theme.spacing.sm; // 图标右侧 + 间距
    const textWidth = Math.max(0, width - textLeft - theme.spacing.sm);

    this.titleNode = createTextNode({
      left: textLeft,
      top: textTop,
      width: textWidth,
      height: 18,
      text: props.title || '',
      fillStyle: theme.colors.textSecondary,
      fontFamily: theme.font.family,
      fontSize: theme.font.sizeSmall,
      fontWeight: theme.font.weightNormal,
      align: 'left',
      verticalAlign: 'middle',
    });
    this.valueNode = createTextNode({
      left: textLeft,
      top: textTop + 22,
      width: textWidth,
      height: 30,
      text: String(props.value ?? '0'),
      fillStyle: theme.colors.text,
      fontFamily: theme.font.family,
      fontSize: 24,
      fontWeight: theme.font.weightSemibold,
      align: 'left',
      verticalAlign: 'middle',
    });
    this.trendNode = createTextNode({
      left: textLeft,
      top: textTop + 54,
      width: textWidth,
      height: 18,
      text: trend,
      fillStyle: getStatusColors(theme, trendType).text,
      fontFamily: theme.font.family,
      fontSize: theme.font.sizeSmall,
      fontWeight: theme.font.weightSemibold,
      align: 'left',
      verticalAlign: 'middle',
    });

    this.addChild(this.iconBox, false);
    this.addChild(this.iconNode, false);
    this.addChild(this.titleNode, false);
    this.addChild(this.valueNode, false);
    this.addChild(this.trendNode, false);
    // 内部零件的摆位交给自持策略：卡片被父层布局改尺寸时会自动重排（不再停在构造期的盒子）
    this.setLayout(new ICEStatCardLayout());
  }

  /** 自持策略要摆的零件（内部 API）。 */
  public __getStatCardNodes(): {
    iconBox: any;
    iconNode: any;
    titleNode: any;
    valueNode: any;
    trendNode: any;
  } | null {
    if (!this.iconBox || !this.iconNode || !this.titleNode || !this.valueNode || !this.trendNode) {
      return null;
    }
    return {
      iconBox: this.iconBox,
      iconNode: this.iconNode,
      titleNode: this.titleNode,
      valueNode: this.valueNode,
      trendNode: this.trendNode,
    };
  }

  public setValue(value: string | number): this {
    this.valueNode.setText(String(value ?? '0'));
    this.revalidate();
    return this;
  }

  public setTitle(title: string): this {
    this.titleNode.setText(title ?? '');
    this.revalidate();
    return this;
  }

  public setTrend(trend: string): this {
    this.trendNode.setText(trend ?? '');
    this.revalidate();
    return this;
  }
}
