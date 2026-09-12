import { ICERect } from 'ice-render';
import { ICEPanel } from './ICEPanel';
import { iceUIManager } from '../core/ICEManager';
import { createTextNode, getStatusColors } from '../util/ICEStyle';

export class ICEStatCard extends ICEPanel {
  private valueNode: any;
  private titleNode: any;
  private trendNode: any;
  private iconNode: any;

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

    const iconBox = new ICERect({
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

    this.addChild(iconBox, false);
    this.addChild(this.iconNode, false);
    this.addChild(this.titleNode, false);
    this.addChild(this.valueNode, false);
    this.addChild(this.trendNode, false);
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
