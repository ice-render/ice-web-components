import { ICEWidget } from '../core/ICEWidget';
import { iceUIManager } from '../core/ICEManager';
import { centerTextNode } from '../util/ICEStyle';

/**
 * 图标：一个居中的字形（★ ✓ ℹ …），字号与颜色可配。
 */
export class ICEIcon extends ICEWidget {
  private textNode: any;

  constructor(props: any = {}) {
    const theme = iceUIManager.getTheme();
    const size = props.size || props.fontSize || theme.font.sizeLarge;
    super({
      fill: false,
      stroke: false,
      width: size,
      height: size,
      ...props,
    });
    this.textNode = centerTextNode(props.icon || props.text || '★', theme, size, size, {
      fontSize: size,
      fontWeight: theme.font.weightNormal,
      fillStyle: props.color || theme.colors.text,
    });
    this.addChild(this.textNode, false);
  }

  public setIcon(icon: string): this {
    this.textNode.setText(icon || '★');
    this.revalidate();
    return this;
  }
}
