import { ICEButton } from './ICEButton';
import { ICELabel } from './ICELabel';
import { ICEPanel } from './ICEPanel';
import { ICEWidget } from '../core/ICEWidget';
import { t } from '../i18n/ICEI18n';
import { iceUIManager } from '../core/ICEManager';
import { ICEOverlayManager, ICEOverlayHandle, getICEOverlayManager } from '../core/ICEOverlayManager';
import { ICEFocusManager, getICEFocusManager } from '../core/ICEFocusManager';
import { getICEWorldBox } from '../util/ICEWorldBox';
import type { ICELocalizedProps } from '../i18n/ICEI18n';
import { tFor } from '../i18n/ICEI18n';

/**
 * 漫游式引导：一步一步把用户带过关键界面。
 *
 * - 每一步有目标组件 + 标题 + 描述；目标被一圈主色边框框住，四周用遮罩压暗；
 * - 面板显示「当前/总数」，带「上一步 / 下一步（最后一步为完成）/ 跳过」；
 * - 键盘：→/Enter 下一步、← 上一步、Esc 跳过；
 * - 关闭途径：完成（`finish()`，回调 `onFinish`）、跳过、Esc、`close()`。
 */
export interface ICETourStep {
  target: any;
  title: string;
  description?: string;
  /** 面板相对目标的位置，默认 bottom */
  placement?: 'top' | 'bottom' | 'left' | 'right';
}

export interface ICETourOptions extends ICELocalizedProps {
  steps: ICETourStep[];
  /** 初始步骤，默认 0 */
  current?: number;
  /** 面板宽度，默认 260 */
  panelWidth?: number;
  onNext?: (index: number) => void;
  onPrev?: (index: number) => void;
  onChange?: (index: number) => void;
  onFinish?: () => void;
  onClose?: (reason: 'skip' | 'esc' | 'api') => void;
  manager?: ICEOverlayManager;
  focusManager?: ICEFocusManager;
}

type ICETourCloseReason = 'skip' | 'esc' | 'api';

export class ICETour {
  private ice: any;
  private options: ICETourOptions;
  private manager: ICEOverlayManager;
  private focus: ICEFocusManager;
  private handle: ICEOverlayHandle | null = null;
  private mask: ICEWidget | null = null;
  private highlight: ICEWidget | null = null;
  private panel: ICEPanel | null = null;
  private titleNode: ICELabel | null = null;
  private descriptionNode: ICELabel | null = null;
  private counterNode: ICELabel | null = null;
  private prevButton: ICEButton | null = null;
  private nextButton: ICEButton | null = null;
  private skipButton: ICEButton | null = null;
  private steps: ICETourStep[];
  private current = 0;
  private finished = false;
  private bound = false;
  private pendingReason: ICETourCloseReason | null = null;

  constructor(ice: any, options: ICETourOptions) {
    this.ice = ice;
    this.options = options;
    this.manager = options.manager || getICEOverlayManager(ice);
    this.focus = options.focusManager || getICEFocusManager(ice);
    this.steps = (options.steps || []).slice();
    this.current = Math.max(0, Math.min(this.steps.length - 1, Math.floor(Number(options.current) || 0)));
  }

  /**
   * 内置文案：按 `options.locale` 解析（实例级；未注册 / 未传则回退当前语言）。
   * ICETour 是应用层对象而非组件（不继承 ICEWidget），所以自己持有翻译函数。
   */
  private t(key: string, vars?: Record<string, string | number>): string {
    return tFor(this.options.locale)(key, vars);
  }

  public isOpen(): boolean {
    return !!this.handle && this.handle.isOpen();
  }

  public isFinished(): boolean {
    return this.finished;
  }

  public getCurrent(): number {
    return this.current;
  }

  public getCurrentStep(): ICETourStep | null {
    return this.steps[this.current] || null;
  }

  public getSteps(): ICETourStep[] {
    return this.steps.slice();
  }

  public getPanel(): ICEPanel | null {
    return this.panel;
  }

  public getMask(): ICEWidget | null {
    return this.mask;
  }

  public getHighlightNode(): ICEWidget | null {
    return this.highlight;
  }

  public getTitleText(): string {
    return this.titleNode ? this.titleNode.getText() : '';
  }

  public getDescriptionText(): string {
    return this.descriptionNode ? this.descriptionNode.getText() : '';
  }

  public getCounterText(): string {
    return this.counterNode ? this.counterNode.getText() : '';
  }

  public getNextButton(): ICEButton | null {
    return this.nextButton;
  }

  public getPrevButton(): ICEButton | null {
    return this.prevButton;
  }

  public getSkipButton(): ICEButton | null {
    return this.skipButton;
  }

  /** 当前高亮框（世界坐标）。 */
  public getHighlightBox(): { left: number; top: number; width: number; height: number } | null {
    const step = this.getCurrentStep();
    if (!step || !step.target) {
      return null;
    }
    const box = getICEWorldBox(step.target);
    return { left: box.left, top: box.top, width: box.width, height: box.height };
  }

  public setSteps(steps: ICETourStep[]): this {
    this.steps = (steps || []).slice();
    this.current = 0;
    if (this.isOpen()) {
      this.__renderStep();
    }
    return this;
  }

  public open(index?: number): this {
    this.finished = false;
    if (this.isOpen()) {
      if (index !== undefined) {
        this.__goTo(index, { scroll: false });
      }
      return this;
    }
    if (index !== undefined) {
      this.current = Math.max(0, Math.min(this.steps.length - 1, Math.floor(index) || 0));
    }
    const viewport = this.__visibleRect();
    const mask = new ICEWidget({
      left: 0,
      top: 0,
      width: viewport.width,
      height: viewport.height,
      fill: false,
      stroke: false,
      interactive: true,
    });
    this.mask = mask;
    this.handle = this.manager.open({
      centered: true,
      blocking: true,
      content: mask,
      closeOnOutsideClick: false,
      closeOnEsc: true,
      enterAnimation: 'fade',
      onClose: (reason) => {
        const mapped: ICETourCloseReason = this.pendingReason || (reason === 'esc' ? 'esc' : 'api');
        this.pendingReason = null;
        this.__handleClosed(mapped);
      },
    });
    this.__renderStep();
    this.__bindKeyboard();
    this.focus.setFocusScope(mask);
    if (this.nextButton) {
      this.focus.focus(this.nextButton);
    }
    return this;
  }

  public close(reason: ICETourCloseReason = 'api'): this {
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

  public next(): this {
    if (this.current >= this.steps.length - 1) {
      return this.finish();
    }
    return this.__goTo(this.current + 1, { scroll: true });
  }

  public prev(): this {
    return this.__goTo(this.current - 1, { scroll: false });
  }

  /** 完成引导（最后一步的「下一步」/ 外部主动调用）。 */
  public finish(): this {
    this.finished = true;
    this.close('api');
    if (this.options.onFinish) {
      this.options.onFinish();
    }
    return this;
  }

  public skip(): this {
    this.close('skip');
    return this;
  }

  private __goTo(index: number, options: { scroll: boolean }): this {
    const next = Math.max(0, Math.min(this.steps.length - 1, Math.floor(index) || 0));
    if (next === this.current) {
      return this;
    }
    this.current = next;
    this.__renderStep();
    if (options.scroll && this.options.onNext) {
      this.options.onNext(next);
    } else if (!options.scroll && this.options.onPrev) {
      this.options.onPrev(next);
    }
    if (this.options.onChange) {
      this.options.onChange(next);
    }
    return this;
  }

  /** 重画当前步骤：聚光孔 + 高亮边框 + 引导面板。 */
  private __renderStep(): void {
    const theme = iceUIManager.getTheme();
    const mask = this.mask;
    const step = this.getCurrentStep();
    if (!mask || !step) {
      return;
    }
    mask.removeChildren([...mask.childNodes]);
    this.highlight = null;
    this.titleNode = null;
    this.descriptionNode = null;
    this.counterNode = null;
    this.prevButton = null;
    this.nextButton = null;
    this.skipButton = null;

    const viewport = this.__visibleRect();
    const box = step.target
      ? getICEWorldBox(step.target)
      : { left: 0, top: 0, width: 0, height: 0 };
    const padding = 6;
    const hole = {
      left: box.left - viewport.left - padding,
      top: box.top - viewport.top - padding,
      width: box.width + padding * 2,
      height: box.height + padding * 2,
    };
    const shade = 'rgba(0, 0, 0, 0.55)';
    const shades: Array<[number, number, number, number]> = [
      [0, 0, viewport.width, Math.max(0, hole.top)],
      [0, hole.top + hole.height, viewport.width, Math.max(0, viewport.height - hole.top - hole.height)],
      [0, hole.top, Math.max(0, hole.left), hole.height],
      [hole.left + hole.width, hole.top, Math.max(0, viewport.width - hole.left - hole.width), hole.height],
    ];
    shades.forEach(([left, top, width, height]) => {
      if (width <= 0 || height <= 0) {
        return;
      }
      mask.addChild(
        new ICEWidget({
          left,
          top,
          width,
          height,
          fill: true,
          stroke: false,
          style: { fillStyle: shade },
        }),
        false,
      );
    });
    // 聚光边框：贴在目标外沿
    const highlight = new ICEWidget({
      left: hole.left,
      top: hole.top,
      width: hole.width,
      height: hole.height,
      fill: false,
      stroke: true,
      radius: theme.radius.sm,
      style: { strokeStyle: theme.colors.primary, lineWidth: 2 },
    });
    mask.addChild(highlight, false);
    this.highlight = highlight;

    // 引导面板
    const panelWidth = Number(this.options.panelWidth) || 260;
    const bodyHeight = step.description ? 40 : 20;
    const panelHeight = 16 + 20 + (step.description ? 10 : 0) + bodyHeight + 12 + 32 + 16;
    const panel = new ICEPanel({
      left: 0,
      top: 0,
      width: panelWidth,
      height: panelHeight,
      radius: theme.radius.md,
      style: { fillStyle: theme.colors.surface, strokeStyle: theme.colors.border, shadow: 'lg' },
    });
    const panelPadding = 16;
    this.titleNode = new ICELabel({
      interactive: false,
      left: panelPadding,
      top: 16,
      width: panelWidth - panelPadding * 2,
      height: 20,
      text: step.title,
      verticalAlign: 'middle',
      style: { fontSize: 14, fontWeight: theme.font.weightSemibold, fillStyle: theme.colors.text },
    });
    panel.addChild(this.titleNode, false);
    let top = 16 + 20;
    if (step.description) {
      top += 10;
      this.descriptionNode = new ICELabel({
        interactive: false,
        left: panelPadding,
        top,
        width: panelWidth - panelPadding * 2,
        height: bodyHeight,
        text: step.description,
        verticalAlign: 'middle',
        style: { fontSize: 12, fillStyle: theme.colors.textSecondary },
      });
      panel.addChild(this.descriptionNode, false);
      top += bodyHeight;
    }
    top += 12;
    const footerTop = top;
    this.counterNode = new ICELabel({
      interactive: false,
      left: panelPadding,
      top: footerTop,
      width: 60,
      height: 32,
      text: `${this.current + 1}/${this.steps.length}`,
      verticalAlign: 'middle',
      style: { fontSize: 12, fillStyle: theme.colors.textTertiary },
    });
    panel.addChild(this.counterNode, false);
    this.skipButton = new ICEButton({
      left: panelWidth - panelPadding - 200,
      top: footerTop,
      width: 56,
      height: 32,
      text: this.t('tour.skip'),
      variant: 'text',
      size: 'small',
    });
    this.prevButton = new ICEButton({
      left: panelWidth - panelPadding - 140,
      top: footerTop,
      width: 56,
      height: 32,
      text: this.t('tour.prev'),
      variant: 'default',
      size: 'small',
    });
    this.nextButton = new ICEButton({
      left: panelWidth - panelPadding - 78,
      top: footerTop,
      width: 78,
      height: 32,
      text: this.current === this.steps.length - 1 ? this.t('tour.done') : this.t('tour.next'),
      variant: 'primary',
      size: 'small',
    });
    if (this.current === 0) {
      this.prevButton.setEnabled(false);
    }
    this.skipButton.on('click', () => this.skip());
    this.prevButton.on('click', () => this.prev());
    this.nextButton.on('click', () => this.next());
    panel.addChild(this.skipButton, false);
    panel.addChild(this.prevButton, false);
    panel.addChild(this.nextButton, false);
    // 不把点击冒泡给遮罩（遮罩上没有“点外关闭”，但避免未来改动踩坑）
    panel.on('click', (evt: any) => {
      if (evt && typeof evt.stopPropagation === 'function') {
        evt.stopPropagation();
      }
    });

    const placement = this.__resolvePlacement(hole, panelWidth, panelHeight, viewport);
    panel.setState({ left: placement.left, top: placement.top });
    mask.addChild(panel, false);
    this.panel = panel;
    if (this.ice) {
      this.ice.dirty = true;
    }
  }

  /** 面板默认放在目标下方；下方放不下就翻到上方。 */
  private __resolvePlacement(
    hole: { left: number; top: number; width: number; height: number },
    panelWidth: number,
    panelHeight: number,
    viewport: { width: number; height: number },
  ): { left: number; top: number } {
    const gap = 12;
    const left = Math.min(Math.max(8, hole.left + hole.width / 2 - panelWidth / 2), viewport.width - panelWidth - 8);
    const below = hole.top + hole.height + gap;
    const top = below + panelHeight <= viewport.height - 8 ? below : Math.max(8, hole.top - gap - panelHeight);
    return { left, top };
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
    if (key === 'ArrowRight' || key === 'Enter') {
      this.next();
    } else if (key === 'ArrowLeft') {
      this.prev();
    }
  }

  private __handleClosed(reason: ICETourCloseReason): void {
    this.focus.setFocusScope(null);
    this.mask = null;
    this.panel = null;
    this.highlight = null;
    this.titleNode = null;
    this.descriptionNode = null;
    this.counterNode = null;
    this.prevButton = null;
    this.nextButton = null;
    this.skipButton = null;
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
