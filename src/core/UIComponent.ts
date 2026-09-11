import { ICEGroup } from 'ice-render';
import type { UIPainter } from './UIPainter';
import { uiManager } from './UIManager';

export class UIComponent extends ICEGroup {
  protected painter: UIPainter | null = null;
  protected preferredWidth: number = 0;
  protected preferredHeight: number = 0;
  protected enabled: boolean = true;

  constructor(props: any = {}) {
    super({
      fill: false,
      stroke: false,
      draggable: true,
      interactive: true,
      ...props,
    });
  }

  public setEnabled(enabled: boolean): this {
    this.enabled = !!enabled;
    this.setState({ interactive: this.enabled });
    this.revalidate();
    return this;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setPreferredSize(width: number, height: number): this {
    this.preferredWidth = Math.max(0, width || 0);
    this.preferredHeight = Math.max(0, height || 0);
    this.revalidate();
    return this;
  }

  public getPreferredSize(): [number, number] {
    if (this.painter && typeof this.painter.getPreferredSize === 'function') {
      return this.painter.getPreferredSize(this);
    }
    return [this.preferredWidth, this.preferredHeight];
  }

  public setPainter(painter: UIPainter | null): this {
    if (this.painter && typeof this.painter.uninstall === 'function') {
      this.painter.uninstall(this);
    }
    this.painter = painter;
    if (painter && typeof painter.install === 'function') {
      painter.install(this);
    }
    this.revalidate();
    return this;
  }

  public getPainter(): UIPainter | null {
    return this.painter;
  }

  public revalidate(): this {
    this.requestLayout();
    if (this.ice) {
      this.ice.dirty = true;
    }
    return this;
  }

  protected theme() {
    return uiManager.getTheme();
  }
}
