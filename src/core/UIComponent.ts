import { ICEGroup } from 'ice-render';
import type { UIPainter } from './UIPainter';
import { uiManager } from './UIManager';

export class UIComponent extends ICEGroup {
  protected painter: UIPainter | null = null;
  protected preferredWidth: number = 0;
  protected preferredHeight: number = 0;
  protected enabled: boolean = true;
  protected hovered: boolean = false;

  constructor(props: any = {}) {
    super({
      fill: false,
      stroke: false,
      draggable: false,
      transformable: false,
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

  public isHovered(): boolean {
    return this.hovered;
  }

  public setHovered(hovered: boolean): this {
    const next = !!hovered && this.enabled;
    if (next === this.hovered) {
      return this;
    }
    this.hovered = next;
    this.__applyHoverState();
    this.revalidate();
    return this;
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

  protected __applyHoverState(): void {
    // 默认不改变外观，交互组件按需覆盖。
  }

  /**
   * UI 组件内部的图元只负责外观，不参与画布级拖拽、变换、连线。
   * 只有真正的 UI 组件（UIComponent）保留自己的交互配置。
   */
  public addChild(child: any, markDirty: boolean = true): void {
    if (!(child instanceof UIComponent) && child && child.state) {
      child.state.interactive = false;
      child.state.draggable = false;
      child.state.transformable = false;
      child.state.linkable = false;
    }
    super.addChild(child, markDirty);
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
