import { ICERect } from 'ice-render';
import { UIComponent } from '../core/UIComponent';
import { uiManager } from '../core/UIManager';
import { UIToggleModel } from '../model/UIToggleModel';
import { centerTextNode } from '../util/UIStyle';

export class UICheckBox extends UIComponent {
  private model: UIToggleModel;
  private box: any;
  private mark: any;

  constructor(props: any = {}) {
    const theme = uiManager.getTheme();
    const selected = props.selected === true;
    const boxSize = props.boxSize || theme.control.checkboxSize;
    const width = props.width || boxSize;
    const height = props.height || boxSize;
    const boxLeft = (width - boxSize) / 2;
    const boxTop = (height - boxSize) / 2;
    super({
      fill: false,
      stroke: false,
      draggable: false,
      width,
      height,
      ...props,
    });
    this.model = new UIToggleModel({ selected });
    this.box = new ICERect({
      left: boxLeft,
      top: boxTop,
      width: boxSize,
      height: boxSize,
      radius: theme.radius.xs,
      style: {
        fillStyle: selected ? theme.colors.primary : theme.colors.surface,
        strokeStyle: selected ? theme.colors.primary : theme.colors.borderSecondary,
        lineWidth: theme.control.lineWidth,
      },
    });
    this.mark = centerTextNode(selected ? '✓' : '', theme, boxSize, boxSize, {
      fontSize: Math.max(12, boxSize * 0.72),
      fontWeight: theme.font.weightBold,
      fillStyle: theme.colors.primaryText,
    });
    this.mark.setState({ left: boxLeft, top: boxTop, width: boxSize, height: boxSize });
    this.addChild(this.box, false);
    this.addChild(this.mark, false);
    this.model.addChangeListener(() => this.__sync());
  }

  public isSelected(): boolean {
    return this.model.isSelected();
  }

  public setSelected(selected: boolean): this {
    this.model.setSelected(selected);
    return this;
  }

  protected initEvents(): void {
    super.initEvents();
    this.on('mousedown', () => this.model.toggle(), this);
  }

  protected __applyHoverState(): void {
    this.__sync();
  }

  private __sync(): void {
    const theme = uiManager.getTheme();
    const selected = this.model.isSelected();
    this.box.setState({
      style: {
        fillStyle: selected
          ? this.hovered
            ? theme.colors.primaryHover
            : theme.colors.primary
          : this.hovered
          ? theme.colors.primaryBg
          : theme.colors.surface,
        strokeStyle: selected || this.hovered ? theme.colors.primary : theme.colors.borderSecondary,
        lineWidth: theme.control.lineWidth,
      },
    });
    this.mark.setText(selected ? '✓' : '');
    this.revalidate();
  }
}
