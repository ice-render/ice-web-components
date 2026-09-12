import { ICEButton } from './ICEButton';
import { ICEImageView } from './ICEImageView';
import { ICEPanel } from './ICEPanel';
import { ICEWidget } from '../core/ICEWidget';
import { iceUIManager } from '../core/ICEManager';
import { ICEOverlayManager, ICEOverlayHandle, getICEOverlayManager } from '../core/ICEOverlayManager';
import { ICEFocusManager, getICEFocusManager } from '../core/ICEFocusManager';

/**
 * 图片预览（业界组件库 `Image.PreviewGroup`）：全屏遮罩 + 居中图片 + 底部工具栏。
 *
 * - 上一张 / 下一张循环切换（`change` 事件 + `onIndexChange`）；
 * - 缩放（步进 + 上下限）与 90° 旋转，`reset()` 复位；
 * - 关闭途径：工具栏关闭按钮、遮罩点击、Esc；打开期间接管 ←/→/+/− 快捷键；
 * - 浮层挂在引擎工具层（复用 `ICEOverlayManager`），关闭后自动移除。
 */
export type ICEImagePreviewCloseReason = 'close' | 'mask' | 'esc' | 'api';

export interface ICEImagePreviewOptions {
  images: string[];
  /** 初始索引，默认 0 */
  index?: number;
  /** 每次缩放的步进，默认 0.25 */
  zoomStep?: number;
  /** 缩放下限，默认 0.25 */
  minZoom?: number;
  /** 缩放上限，默认 3 */
  maxZoom?: number;
  maskClosable?: boolean;
  closeOnEsc?: boolean;
  onIndexChange?: (index: number) => void;
  onClose?: (reason: ICEImagePreviewCloseReason) => void;
  manager?: ICEOverlayManager;
  focusManager?: ICEFocusManager;
}

type ICEPreviewToolbarButton = 'zoomOut' | 'zoomIn' | 'rotateLeft' | 'rotateRight' | 'prev' | 'next' | 'close';

export class ICEImagePreview {
  private ice: any;
  private options: ICEImagePreviewOptions;
  private manager: ICEOverlayManager;
  private focus: ICEFocusManager;
  private handle: ICEOverlayHandle | null = null;
  private mask: ICEPanel | null = null;
  private frame: ICEWidget | null = null;
  private image: ICEImageView | null = null;
  private buttons = new Map<ICEPreviewToolbarButton, ICEButton>();
  private index = 0;
  private zoom = 1;
  private rotation = 0;
  private bound = false;
  private pendingReason: ICEImagePreviewCloseReason | null = null;

  constructor(ice: any, options: ICEImagePreviewOptions) {
    this.ice = ice;
    this.options = options;
    this.manager = options.manager || getICEOverlayManager(ice);
    this.focus = options.focusManager || getICEFocusManager(ice);
    this.index = this.__clampIndex(Number(options.index) || 0);
  }

  public isOpen(): boolean {
    return !!this.handle && this.handle.isOpen();
  }

  public getIndex(): number {
    return this.index;
  }

  public getZoom(): number {
    return this.zoom;
  }

  public getRotation(): number {
    return this.rotation;
  }

  public getMask(): ICEPanel | null {
    return this.mask;
  }

  public getFrame(): ICEWidget | null {
    return this.frame;
  }

  public getImageNode(): ICEImageView | null {
    return this.image;
  }

  public getToolbarButton(name: ICEPreviewToolbarButton): ICEButton | null {
    return this.buttons.get(name) || null;
  }

  public getImages(): string[] {
    return (this.options.images || []).slice();
  }

  public open(index?: number): this {
    if (this.isOpen()) {
      if (index !== undefined) {
        this.setIndex(index);
      }
      return this;
    }
    if (index !== undefined) {
      this.index = this.__clampIndex(Number(index) || 0);
    }
    const viewport = this.__visibleRect();
    const mask = new ICEPanel({
      left: 0,
      top: 0,
      width: viewport.width,
      height: viewport.height,
      radius: 0,
      fill: true,
      stroke: false,
      style: { fillStyle: 'rgba(0, 0, 0, 0.85)' },
    });
    mask.on('click', () => {
      if (this.options.maskClosable !== false) {
        this.close('mask');
      }
    });

    const frameWidth = Math.max(80, Math.min(viewport.width * 0.8, 960));
    const frameHeight = Math.max(60, Math.min(viewport.height * 0.68, 640));
    const frame = new ICEWidget({
      left: (viewport.width - frameWidth) / 2,
      top: Math.max(24, (viewport.height - frameHeight) / 2 - 24),
      width: frameWidth,
      height: frameHeight,
      fill: false,
      stroke: false,
      interactive: false,
      clipChildren: true,
    });
    const image = new ICEImageView({
      left: 0,
      top: 0,
      width: frameWidth,
      height: frameHeight,
      fit: 'contain',
      src: this.__currentSrc(),
      // 深色遮罩上不要底衬：否则图片周围会浮出一圈比遮罩更亮的方块
      placeholder: 'rgba(0, 0, 0, 0)',
    });
    frame.addChild(image, false);
    this.frame = frame;
    this.image = image;
    mask.addChild(frame, false);

    const toolbar = this.__createToolbar(viewport, frame);
    mask.addChild(toolbar, false);

    this.mask = mask;
    this.handle = this.manager.open({
      centered: true,
      blocking: true,
      content: mask,
      closeOnOutsideClick: false,
      closeOnEsc: this.options.closeOnEsc !== false,
      enterAnimation: 'fade',
      onClose: (reason) => {
        const mapped: ICEImagePreviewCloseReason =
          this.pendingReason || (reason === 'esc' ? 'esc' : reason === 'outside' ? 'mask' : 'api');
        this.pendingReason = null;
        this.__handleClosed(mapped);
      },
    });
    this.focus.setFocusScope(frame);
    const closeButton = this.buttons.get('close');
    if (closeButton) {
      this.focus.focus(closeButton);
    }
    this.__bindKeyboard();
    this.__syncImage();
    return this;
  }

  public close(reason: ICEImagePreviewCloseReason = 'api'): this {
    if (!this.handle || !this.handle.isOpen()) {
      return this;
    }
    const handle = this.handle;
    this.pendingReason = reason;
    this.handle = null;
    this.__unbindKeyboard();
    handle.close();
    return this;
  }

  public setIndex(index: number): this {
    const next = this.__clampIndex(index);
    if (next === this.index) {
      return this;
    }
    this.index = next;
    this.__syncImage();
    this.trigger('change', null, { index: next });
    if (this.options.onIndexChange) {
      this.options.onIndexChange(next);
    }
    return this;
  }

  public next(): this {
    const total = (this.options.images || []).length;
    if (total <= 1) {
      return this;
    }
    return this.setIndex((this.index + 1) % total);
  }

  public prev(): this {
    const total = (this.options.images || []).length;
    if (total <= 1) {
      return this;
    }
    return this.setIndex((this.index - 1 + total) % total);
  }

  public zoomIn(): this {
    return this.__setZoom(this.zoom + this.__zoomStep());
  }

  public zoomOut(): this {
    return this.__setZoom(this.zoom - this.__zoomStep());
  }

  public rotateLeft(): this {
    return this.__setRotation(this.rotation - 90);
  }

  public rotateRight(): this {
    return this.__setRotation(this.rotation + 90);
  }

  /** 缩放与旋转同时复位。 */
  public reset(): this {
    this.zoom = 1;
    this.rotation = 0;
    this.__syncImage();
    this.trigger('zoom', null, { zoom: this.zoom });
    this.trigger('rotate', null, { rotation: this.rotation });
    return this;
  }

  /** 事件总线（组件自身不是画布节点，所以直接转发给实例上的 emitter）。 */
  private listeners = new Map<string, Array<(evt: any) => void>>();

  public on(name: string, handler: (evt: any) => void): this {
    const list = this.listeners.get(name) || [];
    list.push(handler);
    this.listeners.set(name, list);
    return this;
  }

  public off(name: string, handler: (evt: any) => void): this {
    const list = this.listeners.get(name) || [];
    this.listeners.set(
      name,
      list.filter((item) => item !== handler),
    );
    return this;
  }

  public trigger(name: string, evt: any, param?: any): this {
    const payload = param === undefined ? evt : { param, ...(evt || {}) };
    (this.listeners.get(name) || []).forEach((handler) => handler(payload));
    return this;
  }

  private __clampIndex(index: number): number {
    const total = (this.options.images || []).length;
    if (total <= 0) {
      return 0;
    }
    return Math.max(0, Math.min(total - 1, Math.floor(index) || 0));
  }

  private __currentSrc(): string {
    return (this.options.images || [])[this.index] || '';
  }

  private __zoomStep(): number {
    return Number(this.options.zoomStep) || 0.25;
  }

  private __setZoom(zoom: number): this {
    const min = Number(this.options.minZoom) || 0.25;
    const max = Number(this.options.maxZoom) || 3;
    const next = Math.max(min, Math.min(max, Number(zoom.toFixed(4))));
    if (next === this.zoom) {
      return this;
    }
    this.zoom = next;
    this.__syncImage();
    this.trigger('zoom', null, { zoom: next });
    return this;
  }

  private __setRotation(rotation: number): this {
    const next = ((Math.round(rotation) % 360) + 360) % 360;
    if (next === this.rotation) {
      return this;
    }
    this.rotation = next;
    this.__syncImage();
    this.trigger('rotate', null, { rotation: next });
    return this;
  }

  /** 图片按缩放铺在 frame 内（超出部分被 frame 裁掉），旋转走引擎 transform。 */
  private __syncImage(): void {
    if (!this.frame || !this.image) {
      return;
    }
    const frameWidth = Number(this.frame.state.width) || 0;
    const frameHeight = Number(this.frame.state.height) || 0;
    const width = frameWidth * this.zoom;
    const height = frameHeight * this.zoom;
    this.image.setState({
      src: this.__currentSrc(),
      left: (frameWidth - width) / 2,
      top: (frameHeight - height) / 2,
      width,
      height,
      transform: { ...(this.image.state.transform || {}), rotate: this.rotation },
    });
    if (this.ice) {
      this.ice.dirty = true;
    }
  }

  private __createToolbar(viewport: { width: number; height: number }, frame: ICEWidget): ICEWidget {
    const theme = iceUIManager.getTheme();
    const size = 36;
    const gap = 8;
    const defs: Array<{ name: ICEPreviewToolbarButton; icon: string; onClick: () => void }> = [
      { name: 'zoomOut', icon: '−', onClick: () => this.zoomOut() },
      { name: 'zoomIn', icon: '＋', onClick: () => this.zoomIn() },
      { name: 'rotateLeft', icon: '↺', onClick: () => this.rotateLeft() },
      { name: 'rotateRight', icon: '↻', onClick: () => this.rotateRight() },
      { name: 'prev', icon: '‹', onClick: () => this.prev() },
      { name: 'next', icon: '›', onClick: () => this.next() },
      { name: 'close', icon: '✕', onClick: () => this.close('close') },
    ];
    const width = defs.length * size + (defs.length - 1) * gap;
    const toolbar = new ICEWidget({
      left: Math.max(0, (viewport.width - width) / 2),
      top: Number(frame.state.top) + Number(frame.state.height) + 16,
      width,
      height: size,
      fill: false,
      stroke: false,
      interactive: false,
    });
    this.buttons.clear();
    defs.forEach((def, index) => {
      const button = new ICEButton({
        left: index * (size + gap),
        top: 0,
        width: size,
        height: size,
        text: def.icon,
        variant: def.name === 'close' ? 'default' : 'default',
        size: 'small',
      });
      button.setState({ radius: size / 2, style: { ...button.state.style, fillStyle: theme.colors.elevated } });
      button.on('click', def.onClick);
      toolbar.addChild(button, false);
      this.buttons.set(def.name, button);
    });
    return toolbar;
  }

  private __bindKeyboard(): void {
    if (this.bound || !this.ice || !this.ice.evtBus) {
      return;
    }
    this.bound = true;
    this.ice.evtBus.on('keydown', this.__onKeyDown, this);
  }

  private __unbindKeyboard(): void {
    if (!this.bound || !this.ice || !this.ice.evtBus) {
      return;
    }
    this.bound = false;
    this.ice.evtBus.off('keydown', this.__onKeyDown, this);
  }

  private __onKeyDown(evt: any): void {
    if (!this.isOpen()) {
      return;
    }
    const raw = evt && (evt.originalEvent || evt);
    const key = raw && (raw.key || raw.code);
    if (key === 'ArrowRight') {
      this.next();
    } else if (key === 'ArrowLeft') {
      this.prev();
    } else if (key === '+' || key === '=') {
      this.zoomIn();
    } else if (key === '-' || key === '_') {
      this.zoomOut();
    }
  }

  private __handleClosed(reason: ICEImagePreviewCloseReason): void {
    this.focus.setFocusScope(null);
    this.mask = null;
    this.frame = null;
    this.image = null;
    this.buttons.clear();
    if (this.options.onClose) {
      this.options.onClose(reason);
    }
  }

  private __visibleRect(): { left: number; top: number; width: number; height: number } {
    const width = Number(this.ice && this.ice.canvasWidth) || 0;
    const height = Number(this.ice && this.ice.canvasHeight) || 0;
    const vp = this.ice && typeof this.ice.getRenderViewport === 'function' ? this.ice.getRenderViewport() : null;
    const scale = vp && vp.scale ? vp.scale : 1;
    return {
      left: vp ? -(vp.tx || 0) / scale : 0,
      top: vp ? -(vp.ty || 0) / scale : 0,
      width: width / scale,
      height: height / scale,
    };
  }
}

/** 便捷入口：`openImagePreview(ice, { images: [...], index: 0 })`。 */
export function openImagePreview(ice: any, options: ICEImagePreviewOptions): ICEImagePreview {
  const preview = new ICEImagePreview(ice, options);
  preview.open();
  return preview;
}
