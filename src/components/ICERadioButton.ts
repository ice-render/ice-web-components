import { ICECircle } from 'ice-render';
import { ICEWidget } from '../core/ICEWidget';
import { iceUIManager } from '../core/ICEManager';
import { ICEToggleModel } from '../model/ICEToggleModel';

/**
 * 单选框：点击或 Enter/Space 选中；同组互斥由调用方（表单/业务）维护。
 */
export class ICERadioButton extends ICEWidget {
  private model: ICEToggleModel;
  private outer: any;
  private inner: any;

  constructor(props: any = {}) {
    const theme = iceUIManager.getTheme();
    const selected = props.selected === true;
    const outerSize = props.size || theme.control.radioSize;
    const width = props.width || outerSize;
    const height = props.height || outerSize;
    const outerLeft = (width - outerSize) / 2;
    const outerTop = (height - outerSize) / 2;
    const outerRadius = outerSize / 2;
    const innerRadius = outerSize / 4;
    super({
      fill: false,
      stroke: false,
      draggable: false,
      width,
      height,
      ...props,
    });
    this.focusable = props.focusable !== false;
    this.model = new ICEToggleModel({ selected });
    this.outer = new ICECircle({
      left: outerLeft,
      top: outerTop,
      radius: outerRadius,
      style: {
        fillStyle: theme.colors.surface,
        strokeStyle: selected ? theme.colors.primary : theme.colors.borderSecondary,
        lineWidth: theme.control.lineWidth,
      },
    });
    this.inner = new ICECircle({
      left: outerLeft + outerSize / 2 - innerRadius,
      top: outerTop + outerSize / 2 - innerRadius,
      radius: innerRadius,
      style: {
        fillStyle: selected ? theme.colors.primary : 'transparent',
        strokeStyle: selected ? theme.colors.primary : 'transparent',
      },
    });
    this.addChild(this.outer, false);
    this.addChild(this.inner, false);
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

  /** 键盘激活（Enter / Space）与鼠标点击同义：选中本项。 */
  public activate(): void {
    if (!this.enabled) {
      return;
    }
    this.model.setSelected(true);
  }

  protected initEvents(): void {
    super.initEvents();
    this.on('mousedown', () => this.__select(), this);
  }

  /** 禁用的控件不响应鼠标（与 `activate()` 的键盘路径保持一致）。 */
  private __select(): void {
    if (!this.enabled) {
      return;
    }
    this.model.setSelected(true);
  }

  protected __applyHoverState(): void {
    this.__sync();
  }

  /**
   * 尺寸变化时把圆形选框与内点重新居中（`ICEWidget.__syncInternalLayout()`）。
   *
   * 构造期按 `props.width/height` 算好 `outerLeft/outerTop` 就再没对过账：父层布局改尺寸后
   * 居中偏移还停在旧值上，圆会偏出盒子。圆的大小由 `size` 决定（与组件尺寸无关），
   * 所以只需重算居中偏移与内点相对位置。
   */
  protected __syncInternalLayout(): void {
    const outerSize = (Number(this.outer && this.outer.state.radius) || 0) * 2;
    if (!(outerSize > 0)) {
      return;
    }
    const width = Number(this.state.width) || outerSize;
    const height = Number(this.state.height) || outerSize;
    const left = (width - outerSize) / 2;
    const top = (height - outerSize) / 2;
    const innerRadius = Number(this.inner && this.inner.state.radius) || 0;
    this.outer.setState({ left, top });
    this.inner.setState({
      left: left + outerSize / 2 - innerRadius,
      top: top + outerSize / 2 - innerRadius,
    });
  }

  private __sync(): void {
    const theme = iceUIManager.getTheme();
    const selected = this.model.isSelected();
    this.outer.setState({
      style: {
        fillStyle: this.hovered && !selected ? theme.colors.primaryBg : theme.colors.surface,
        strokeStyle: selected || this.hovered ? theme.colors.primary : theme.colors.borderSecondary,
        lineWidth: theme.control.lineWidth,
      },
    });
    this.inner.setState({
      style: {
        fillStyle: selected ? (this.hovered ? theme.colors.primaryHover : theme.colors.primary) : 'transparent',
        strokeStyle: selected ? (this.hovered ? theme.colors.primaryHover : theme.colors.primary) : 'transparent',
      },
    });
    this.revalidate();
  }
}
