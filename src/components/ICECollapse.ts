import { ICELabel } from './ICELabel';
import { ICEWidget } from '../core/ICEWidget';
import { iceUIManager } from '../core/ICEManager';
import { createTextNode, readHovered } from '../util/ICEStyle';

/**
 * 折叠面板（业界组件库 Collapse / Swing 无直接对应物）。
 *
 * - 每项 = 标题行（▸/▾ + 标题）+ 展开时的内容区；内容支持纯文本或组件工厂；
 * - `accordion: true` 时同时只展开一个；展开/收起会重排并回调 onExpand(keys)；
 * - 标题行是独立命中区（点标题只切换展开，不触发内容交互）。
 */
export interface ICECollapseItem {
  key: string;
  title: string;
  content?: string | (() => any);
  disabled?: boolean;
}

export interface ICECollapseOptions {
  /** 组件 id（引擎会用它做唯一标识，e2e/调试时可按 id 定位） */
  id?: string;
  items: ICECollapseItem[];
  activeKeys?: string[];
  accordion?: boolean;
  left?: number;
  top?: number;
  width?: number;
  headerHeight?: number;
  contentHeight?: number;
  onChange?: (keys: string[]) => void;
  onExpand?: (keys: string[]) => void;
}

export class ICECollapse extends ICEWidget {
  private items: ICECollapseItem[];
  private active: string[];
  private accordion: boolean;
  private headerHeight: number;
  private contentHeight: number;
  private expandCallback: ((keys: string[]) => void) | null;
  private headerNodes = new Map<string, ICEWidget>();
  private contentNodes = new Map<string, ICEWidget>();
  private offsetMap = new Map<string, number>();

  constructor(props: ICECollapseOptions) {
    const theme = iceUIManager.getTheme();
    const width = props.width ?? 280;
    super({
      id: props.id,
      fill: false,
      stroke: false,
      left: props.left,
      top: props.top,
      width,
      height: 0,
    });
    this.items = (props.items || []).slice();
    this.active = (props.activeKeys || []).slice();
    this.accordion = props.accordion === true;
    this.headerHeight = props.headerHeight ?? 36;
    this.contentHeight = props.contentHeight ?? 48;
    this.expandCallback =
      (typeof props.onExpand === 'function' ? props.onExpand : null) ||
      (typeof props.onChange === 'function' ? props.onChange : null);
    this.__render();
  }

  public getActiveKeys(): string[] {
    return this.active.slice();
  }

  public setActiveKeys(keys: string[]): this {
    this.active = (keys || []).slice();
    this.__render();
    return this;
  }

  public getHeaderNode(key: string): ICEWidget | null {
    return this.headerNodes.get(key) || null;
  }

  public getContentNode(key: string): ICEWidget | null {
    return this.contentNodes.get(key) || null;
  }

  public getItemTop(key: string): number {
    return this.offsetMap.has(key) ? (this.offsetMap.get(key) as number) : -1;
  }

  private __toggle(key: string): void {
    const expanded = this.active.indexOf(key) !== -1;
    if (expanded) {
      this.active = this.active.filter((item) => item !== key);
    } else if (this.accordion) {
      this.active = [key];
    } else {
      this.active = this.active.concat([key]);
    }
    this.__render();
    if (this.expandCallback) {
      this.expandCallback(this.getActiveKeys());
    }
  }

  private __render(): void {
    this.removeChildren([...this.childNodes]);
    this.headerNodes.clear();
    this.contentNodes.clear();
    this.offsetMap.clear();
    const theme = iceUIManager.getTheme();
    const width = Number(this.state.width) || 280;
    let top = 0;

    this.items.forEach((item) => {
      const expanded = this.active.indexOf(item.key) !== -1;
      this.offsetMap.set(item.key, top);
      const header = new ICEWidget({
        left: 0,
        top,
        width,
        height: this.headerHeight,
        radius: theme.radius.sm,
        fill: true,
        stroke: false,
        interactive: !item.disabled,
        style: { fillStyle: theme.colors.background },
      });
      header.addChild(
        new ICELabel({
          interactive: false,
          left: 12,
          top: 0,
          width: 16,
          height: this.headerHeight,
          align: 'center',
          verticalAlign: 'middle',
          text: expanded ? '▾' : '▸',
          style: { fontSize: 12, fillStyle: theme.colors.textSecondary },
        }),
        false,
      );
      // 悬停反馈：折叠面板的标题行是主要点击目标
      header.on(
        'hoverchange',
        (evt: any) => {
          const hovered = readHovered(evt);
          header.setState({
            style: { ...header.state.style, fillStyle: hovered ? theme.colors.disabled : theme.colors.background },
          });
        },
        this,
      );
      header.addChild(
        new ICELabel({
          interactive: false,
          left: 32,
          top: 0,
          width: width - 44,
          height: this.headerHeight,
          verticalAlign: 'middle',
          text: item.title,
          style: {
            fontSize: 13,
            fontWeight: '600',
            fillStyle: item.disabled ? theme.colors.textDisabled : theme.colors.text,
          },
        }),
        false,
      );
      if (!item.disabled) {
        header.on('click', () => this.__toggle(item.key));
      }
      this.addChild(header, false);
      this.headerNodes.set(item.key, header);
      top += this.headerHeight;

      if (expanded) {
        const content = new ICEWidget({
          left: 0,
          top,
          width,
          height: this.contentHeight,
          fill: true,
          stroke: false,
          style: { fillStyle: theme.colors.surface },
        });
        if (typeof item.content === 'function') {
          const node = item.content();
          if (node) {
            node.setState({ left: 32, top: 4 });
            content.addChild(node, false);
          }
        } else {
          content.addChild(
            createTextNode({
              left: 32,
              top: 0,
              width: width - 44,
              height: this.contentHeight,
              text: String(item.content ?? ''),
              fillStyle: theme.colors.textSecondary,
              fontFamily: theme.font.family,
              fontSize: 12,
              align: 'left',
              verticalAlign: 'middle',
            }),
            false,
          );
        }
        this.addChild(content, false);
        this.contentNodes.set(item.key, content);
        top += this.contentHeight;
      }
    });

    this.setState({ height: top });
    if (this.ice && this.ice.dirty !== undefined) {
      this.ice.dirty = true;
    }
  }
}
