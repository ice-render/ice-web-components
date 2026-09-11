import { ICERect } from 'ice-render';
import { UIPanel } from './UIPanel';
import { uiManager } from '../core/UIManager';
import { createTextNode, getStatusColors } from '../util/UIStyle';

export class UIStatCard extends UIPanel {
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

    const theme = uiManager.getTheme();
    const width = props.width || 220;
    const height = props.height || 120;
    const iconColor = props.iconColor || theme.colors.primary;
    const iconBg = props.iconBg || theme.colors.primaryBg;
    const trendType = props.trendType || 'success';
    const trend = props.trend === undefined ? '' : String(props.trend);

    const iconBox = new ICERect({
      left: theme.spacing.md,
      top: theme.spacing.md,
      width: 36,
      height: 36,
      radius: theme.radius.md,
      style: {
        fillStyle: iconBg,
        strokeStyle: iconBg,
        lineWidth: theme.control.lineWidth,
      },
    });
    this.iconNode = createTextNode({
      left: theme.spacing.md,
      top: theme.spacing.md,
      width: 36,
      height: 36,
      text: props.icon || '●',
      fillStyle: iconColor,
      fontFamily: theme.font.family,
      fontSize: 18,
      fontWeight: theme.font.weightSemibold,
      align: 'center',
      verticalAlign: 'middle',
    });

    this.titleNode = createTextNode({
      left: theme.spacing.md,
      top: 58,
      text: props.title || '',
      fillStyle: theme.colors.textSecondary,
      fontFamily: theme.font.family,
      fontSize: theme.font.sizeSmall,
      fontWeight: theme.font.weightNormal,
      align: 'left',
      verticalAlign: 'top',
    });
    this.valueNode = createTextNode({
      left: theme.spacing.md,
      top: 28,
      text: String(props.value ?? '0'),
      fillStyle: theme.colors.text,
      fontFamily: theme.font.family,
      fontSize: 24,
      fontWeight: theme.font.weightSemibold,
      align: 'left',
      verticalAlign: 'top',
    });
    this.trendNode = createTextNode({
      left: width - 74,
      top: 60,
      width: 58,
      text: trend,
      fillStyle: getStatusColors(theme, trendType).text,
      fontFamily: theme.font.family,
      fontSize: theme.font.sizeSmall,
      fontWeight: theme.font.weightSemibold,
      align: 'right',
      verticalAlign: 'top',
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
