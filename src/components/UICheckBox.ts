import { ICERect, ICEText } from 'ice-render';
import { UIComponent } from '../core/UIComponent';
import { uiManager } from '../core/UIManager';
import { UIToggleModel } from '../model/UIToggleModel';

export class UICheckBox extends UIComponent {
  private model: UIToggleModel;
  private box: any;
  private mark: any;

  constructor(props: any = {}) {
    const theme = uiManager.getTheme();
    const selected = props.selected === true;
    super({
      fill: false,
      stroke: false,
      draggable: false,
      ...props,
    });
    this.model = new UIToggleModel({ selected });
    this.box = new ICERect({
      left: 0,
      top: 0,
      width: props.boxSize || 18,
      height: props.boxSize || 18,
      radius: 4,
      style: {
        fillStyle: selected ? theme.colors.primary : theme.colors.surface,
        strokeStyle: selected ? theme.colors.primary : theme.colors.border,
        lineWidth: 1,
      },
    });
    this.mark = new ICEText({
      left: 3,
      top: 0,
      text: selected ? '✓' : '',
      style: {
        fillStyle: theme.colors.primaryText,
        fontFamily: theme.font.family,
        fontSize: 14,
        fontWeight: theme.font.weightBold,
      },
    });
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

  private __sync(): void {
    const theme = uiManager.getTheme();
    const selected = this.model.isSelected();
    this.box.setState({
      style: {
        fillStyle: selected ? theme.colors.primary : theme.colors.surface,
        strokeStyle: selected ? theme.colors.primary : theme.colors.border,
        lineWidth: 1,
      },
    });
    this.mark.setText(selected ? '✓' : '');
    this.revalidate();
  }
}
