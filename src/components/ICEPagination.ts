import { ICEButton } from './ICEButton';
import { ICELabel } from './ICELabel';
import { ICEBoxLayout, token } from 'ice-render';
import { iceUIManager } from '../core/ICEManager';
import { ICEContainer } from '../core/ICEContainer';
import type { ICELocalizedProps } from '../i18n/ICEI18n';

/**
 * 分页器：页码 + 上一页/下一页 + 可选「共 N 条」与每页条数切换。
 *
 * - 页码按钮就是 `ICEButton`，所以天然可聚焦（Tab / Enter 可操作，见 ICEFocusManager）；
 * - 页数多时用省略号收口：始终显示首页、末页与当前页附近的窗口（最多 `maxPageButtons` 个页码位）；
 * - `setCurrent` / `setPageSize` 会夹取并重排，变更后回调 `onChange(page, pageSize)`。
 */

export interface ICEPaginationOptions extends ICELocalizedProps {
  /** 组件 id（引擎会用它做唯一标识，e2e/调试时可按 id 定位） */
  id?: string;
  total?: number;
  pageSize?: number;
  current?: number;
  width?: number;
  left?: number;
  top?: number;
  /** 页码位上限（含省略号，默认 7） */
  maxPageButtons?: number;
  showTotal?: boolean;
  showSizeChanger?: boolean;
  pageSizeOptions?: number[];
  size?: 'default' | 'small';
  onChange?: (page: number, pageSize: number) => void;
}

const GAP = 8;

export class ICEPagination extends ICEContainer {
  private total: number;
  private pageSize: number;
  private current: number;
  private maxPageButtons: number;
  private showTotal: boolean;
  private showSizeChanger: boolean;
  private pageSizeOptions: number[];
  private size: 'default' | 'small';
  private onChange: ((page: number, pageSize: number) => void) | null;
  private prevButton: ICEButton | null = null;
  private nextButton: ICEButton | null = null;
  private pageButtons = new Map<number, ICEButton>();
  private sizeChanger: ICEButton | null = null;

  constructor(props: ICEPaginationOptions = {}) {
    super({
      id: props.id,
      fill: false,
      stroke: false,
      left: props.left,
      top: props.top,
      width: props.width ?? 420,
      height: (props.size === 'small' ? 28 : 32) + 8,
    });
    this.setLocale(props.locale); // 实例级语言（组件层文案可配、不持全局状态）
    this.total = Math.max(0, Number(props.total) || 0);
    this.pageSize = Math.max(1, Number(props.pageSize) || 10);
    this.current = Math.min(Math.max(1, Number(props.current) || 1), this.getPageCount() || 1);
    this.maxPageButtons = Math.max(5, Number(props.maxPageButtons) || 7);
    this.showTotal = props.showTotal === true;
    this.showSizeChanger = props.showSizeChanger === true;
    this.pageSizeOptions = props.pageSizeOptions && props.pageSizeOptions.length ? props.pageSizeOptions.slice() : [10, 20, 50, 100];
    this.size = props.size || 'default';
    this.onChange = typeof props.onChange === 'function' ? props.onChange : null;
    this.__render();
  }

  public getTotal(): number {
    return this.total;
  }

  public getPageCount(): number {
    return Math.max(1, Math.ceil(this.total / this.pageSize));
  }

  public getCurrent(): number {
    return this.current;
  }

  public getPageSize(): number {
    return this.pageSize;
  }

  public getPrevButton(): ICEButton | null {
    return this.prevButton;
  }

  public getNextButton(): ICEButton | null {
    return this.nextButton;
  }

  public getPageButton(page: number): ICEButton | null {
    return this.pageButtons.get(page) || null;
  }

  public getSizeChanger(): ICEButton | null {
    return this.sizeChanger;
  }

  public setTotal(total: number): this {
    this.total = Math.max(0, Number(total) || 0);
    this.current = Math.min(this.current, this.getPageCount());
    this.__render();
    return this;
  }

  /** 设置当前页（自动夹取到 [1, pageCount]），变化时回调 onChange。 */
  public setCurrent(page: number, options: { silent?: boolean } = {}): this {
    const next = Math.min(Math.max(1, Math.floor(Number(page) || 1)), this.getPageCount());
    if (next === this.current) {
      return this;
    }
    this.current = next;
    this.__render();
    if (!options.silent && this.onChange) {
      this.onChange(this.current, this.pageSize);
    }
    return this;
  }

  /** 设置每页条数（重算页数并把 current 夹取到合法范围），变化时回调 onChange。 */
  public setPageSize(pageSize: number, options: { silent?: boolean } = {}): this {
    const next = Math.max(1, Math.floor(Number(pageSize) || 1));
    if (next === this.pageSize) {
      return this;
    }
    this.pageSize = next;
    // 与 setTotal 一致：尽量保持当前位置，越界才夹取
    this.current = Math.min(this.current, this.getPageCount());
    this.__render();
    if (!options.silent && this.onChange) {
      this.onChange(this.current, this.pageSize);
    }
    return this;
  }

  private __render(): void {
    this.removeChildren([...this.childNodes]);
    this.pageButtons.clear();
    const theme = iceUIManager.getTheme();
    const height = this.size === 'small' ? 28 : 32;
    const gap = this.size === 'small' ? 6 : GAP;
    // 页码行 = 一串定宽按钮 + 文案，横向依次排 → 直接交给引擎的盒式布局。
    // 老实现自己累加 left（文案处还写死 76px 的占位），现在按各节点自己的宽度排（魔数收敛）。
    this.setLayout(new ICEBoxLayout({ axis: 'x', gap }));

    if (this.showTotal) {
      const totalLabel = new ICELabel({
        top: 0,
        height,
        verticalAlign: 'middle',
        text: this.t('pagination.total', { total: this.total }),
        style: { fontSize: 12, fillStyle: token('ui.colors.textSecondary') },
      });
      this.addChild(totalLabel, false);
    }

    const makeButton = (text: string, options: { width?: number; primary?: boolean; enabled?: boolean; onClick?: () => void }) => {
      const width = options.width ?? height;
      const button = new ICEButton({
        top: 0,
        width,
        height,
        text,
        size: this.size === 'small' ? 'small' : 'middle',
        variant: options.primary ? 'primary' : 'default',
      });
      if (options.enabled === false) {
        button.setEnabled(false);
      }
      if (options.onClick) {
        button.on('click', options.onClick);
      }
      this.addChild(button, false);
      return button;
    };

    const pageCount = this.getPageCount();
    this.prevButton = makeButton('‹', {
      enabled: this.current > 1,
      onClick: () => this.setCurrent(this.current - 1),
    });

    this.__pageWindow(pageCount).forEach((page) => {
      if (page === -1) {
        const ellipsis = new ICELabel({
          top: 0,
          width: 24,
          height,
          verticalAlign: 'middle',
          text: '...',
          style: { fontSize: 12, fillStyle: token('ui.colors.textSecondary') },
        });
        this.addChild(ellipsis, false);
        return;
      }
      const button = makeButton(String(page), {
        primary: page === this.current,
        onClick: () => this.setCurrent(page),
      });
      this.pageButtons.set(page, button);
    });

    this.nextButton = makeButton('›', {
      enabled: this.current < pageCount,
      onClick: () => this.setCurrent(this.current + 1),
    });

    if (this.showSizeChanger) {
      this.sizeChanger = makeButton(this.t('pagination.pageSize', { size: this.pageSize }), {
        width: 88,
        onClick: () => {
          const index = this.pageSizeOptions.indexOf(this.pageSize);
          const next = this.pageSizeOptions[(index + 1) % this.pageSizeOptions.length];
          this.setPageSize(next);
        },
      });
    } else {
      this.sizeChanger = null;
    }

    // 组件级策略：高度固定留 8px 下边距；宽度不小于内容宽度（内容宽由布局算出的首选尺寸给出）
    const contentWidth = this.getPreferredSize()[0];
    this.setState({ width: Math.max(Number(this.state.width) || 0, contentWidth), height: height + 8 });
    this.doLayout();
  }

  /** 页码窗口：1 … n-1 [n n+1 n+2] … last（-1 表示省略号） */
  private __pageWindow(pageCount: number): number[] {
    const max = this.maxPageButtons;
    if (pageCount <= max) {
      return Array.from({ length: pageCount }, (_, index) => index + 1);
    }
    const current = this.current;
    const window: number[] = [1];
    let start = Math.max(2, current - 1);
    let end = Math.min(pageCount - 1, current + 1);
    // 让窗口尽量宽（首页/末页附近时单侧多给一格）
    const innerCount = max - 4; // 首尾各 1，两个可能的省略号
    while (end - start + 1 < innerCount) {
      if (start > 2) {
        start -= 1;
      } else if (end < pageCount - 1) {
        end += 1;
      } else {
        break;
      }
    }
    if (start > 2) {
      window.push(-1);
    }
    for (let page = start; page <= end; page++) {
      window.push(page);
    }
    if (end < pageCount - 1) {
      window.push(-1);
    }
    window.push(pageCount);
    return window;
  }
}
