import { ICECircle, ICERect } from 'ice-render';
import { ICEWidget } from '../core/ICEWidget';
import { iceUIManager } from '../core/ICEManager';
import { ICEToggleModel } from '../model/ICEToggleModel';

/**
 * 开关：点击或 Enter/Space 切换，滑块带过渡动画，触发 `change`。
 */
export class ICESwitch extends ICEWidget {
  private model: ICEToggleModel;
  private track: any;
  private knob: any;
  private knobTravel: number;

  constructor(props: any = {}) {
    const theme = iceUIManager.getTheme();
    const selected = props.selected === true;
    super({
      fill: false,
      stroke: false,
      draggable: false,
      ...props,
    });
    this.focusable = props.focusable !== false;
    this.model = new ICEToggleModel({ selected });
    const width = props.width || theme.control.switchWidth;
    const height = props.height || theme.control.switchHeight;
    const knobSize = Math.max(12, Math.min(theme.control.switchHandle, height - 4));
    const knobGap = (height - knobSize) / 2;
    this.knobTravel = width - knobSize - knobGap * 2;
    this.track = new ICERect({
      left: 0,
      top: 0,
      width,
      height,
      radius: height / 2,
      style: {
        fillStyle: selected ? theme.colors.primary : theme.colors.borderSecondary,
        strokeStyle: selected ? theme.colors.primary : theme.colors.borderSecondary,
        lineWidth: theme.control.lineWidth,
      },
    });
    this.knob = new ICECircle({
      left: selected ? this.knobTravel : knobGap,
      top: knobGap,
      radius: knobSize / 2,
      style: {
        fillStyle: theme.colors.surface,
        strokeStyle: theme.colors.surface,
        ...theme.shadows.sm,
      },
    });
    this.addChild(this.track, false);
    this.addChild(this.knob, false);
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

  /** 键盘激活（Enter / Space）与鼠标点击同义：切换开关。 */
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

  private __sync(): void {
    const theme = iceUIManager.getTheme();
    const selected = this.model.isSelected();
    this.track.setState({
      style: {
        fillStyle: selected
          ? this.hovered
            ? theme.colors.primaryHover
            : theme.colors.primary
          : this.hovered
          ? theme.colors.primaryBorder
          : theme.colors.borderSecondary,
        strokeStyle: selected
          ? this.hovered
            ? theme.colors.primaryHover
            : theme.colors.primary
          : this.hovered
          ? theme.colors.primaryBorder
          : theme.colors.borderSecondary,
        lineWidth: theme.control.lineWidth,
      },
    });
    this.knob.setState({
      left: selected ? this.knobTravel : this.__knobGap(),
    });
    this.revalidate();
  }

  /**
   * 尺寸变化时按新盒子重算轨道、滑块尺寸与行程（`ICEWidget.__syncInternalLayout()`）。
   *
   * 构造期是把 `props.width/height` 直接当成轨道尺寸、并把滑块行程 `knobTravel` 存成字段的；
   * 之后父层布局改尺寸时这三样都不动 —— 轨道还停在旧长度（比盒子长的部分直接画到外面），
   * 滑块的开/关位置也按旧行程算。
   */
  protected __syncInternalLayout(): void {
    const theme = iceUIManager.getTheme();
    const width = Number(this.state.width) || theme.control.switchWidth;
    const height = Number(this.state.height) || theme.control.switchHeight;
    if (!(width > 0) || !(height > 0)) {
      return;
    }
    const knobSize = Math.max(12, Math.min(theme.control.switchHandle, height - 4));
    const knobGap = (height - knobSize) / 2;
    this.knobTravel = width - knobSize - knobGap * 2;
    this.track.setState({ left: 0, top: 0, width, height, radius: height / 2 });
    this.knob.setState({ top: knobGap, radius: knobSize / 2 });
    this.__sync();
  }

  private __knobGap(): number {
    const height = Number(this.state.height) || iceUIManager.getTheme().control.switchHeight;
    const knobSize = Number(this.knob.state.radius) * 2 || iceUIManager.getTheme().control.switchHandle;
    return (height - knobSize) / 2;
  }
}
