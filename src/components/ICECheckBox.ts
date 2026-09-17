import { ICERect, token } from 'ice-render';
import { ICEWidget } from '../core/ICEWidget';
import { iceUIManager } from '../core/ICEManager';
import { ICEToggleModel } from '../model/ICEToggleModel';
import { centerTextNode } from '../util/ICEStyle';

/**
 * 复选框：点击或 Enter/Space 切换勾选，触发 `change`，可直接进表单。
 */
export class ICECheckBox extends ICEWidget {
  private model: ICEToggleModel;
  private box: any;
  private mark: any;

  constructor(props: any = {}) {
    const theme = iceUIManager.getTheme();
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
    this.focusable = props.focusable !== false;
    // 无障碍：勾选框的可读名称是它的标签文本
    if (props.ariaLabel !== undefined || props.label !== undefined) {
      this.setAriaLabel(String(props.ariaLabel !== undefined ? props.ariaLabel : props.label));
    }
    this.model = new ICEToggleModel({ selected });
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
      fillStyle: token('ui.colors.primaryText'),
    });
    this.mark.setState({ left: boxLeft, top: boxTop, width: boxSize, height: boxSize });
    this.addChild(this.box, false);
    this.addChild(this.mark, false);
    this.model.addChangeListener(() => {
      this.__sync();
      this.trigger('change', null, { value: this.isSelected() });
    });
  }

  public isSelected(): boolean {
    return this.model.isSelected();
  }

  public setSelected(selected: boolean): this {
    this.model.setSelected(selected);
    return this;
  }

  public getFormValue(): any {
    return this.isSelected();
  }

  public setFormValue(value: any): void {
    this.setSelected(!!value);
  }

  /** 键盘激活（Enter / Space）与鼠标点击同义：切换勾选状态。 */
  public activate(): void {
    if (!this.enabled) {
      return;
    }
    this.model.toggle();
  }

  protected initEvents(): void {
    super.initEvents();
    this.on('mousedown', () => this.__toggle(), this);
  }

  /** 禁用的控件不响应鼠标（与 `activate()` 的键盘路径保持一致）。 */
  private __toggle(): void {
    if (!this.enabled) {
      return;
    }
    this.model.toggle();
  }

  protected __applyHoverState(): void {
    this.__sync();
  }

  /**
   * 尺寸变化时把勾选框与对勾重新居中（`ICEWidget.__syncInternalLayout()`）。
   *
   * 构造期按 `props.width/height` 算好 `boxLeft/boxTop` 就再没对过账：父层布局把复选框
   * 拉成别的尺寸后，`(宽 - 框宽) / 2` 这个居中偏移还停在旧值上，框会整体偏出盒子。
   * 框本身的大小由 `boxSize` 决定（跟组件尺寸无关），所以只需要重算居中偏移。
   */
  protected __syncInternalLayout(): void {
    const boxSize = Number(this.box && this.box.state.width) || 0;
    if (!(boxSize > 0)) {
      return;
    }
    const width = Number(this.state.width) || boxSize;
    const height = Number(this.state.height) || boxSize;
    const left = (width - boxSize) / 2;
    const top = (height - boxSize) / 2;
    this.box.setState({ left, top });
    this.mark.setState({ left, top, width: boxSize, height: boxSize });
  }

  private __sync(): void {
    const theme = iceUIManager.getTheme();
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
