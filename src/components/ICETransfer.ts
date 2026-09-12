import { ICELabel } from './ICELabel';
import { ICEWidget } from '../core/ICEWidget';
import { ICEScrollPane } from './ICEScrollPane';
import { iceUIManager } from '../core/ICEManager';

/**
 * 穿梭框（业界组件库 Transfer 的最小版）。
 *
 * - 按 `targetKeys` 把 `dataSource` 分成「源 / 目标」两栏，栏内各自可滚动；
 * - 点行切换勾选；中间按钮把勾选项整体右移 / 左移，移动后清空勾选并回调；
 * - 没有勾选（或只有被移动方向的非法项）时按钮不可用；
 * - `disabled` 的行不能勾选、不会被移动；值 = `targetKeys`（字符串数组，可直接进表单）。
 */

export interface ICETransferItem {
  key: string;
  title: string;
  description?: string;
  disabled?: boolean;
}

export type ICETransferDirection = 'left' | 'right';

export interface ICETransferOptions {
  dataSource: ICETransferItem[];
  targetKeys?: string[];
  titles?: [string, string];
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  rowHeight?: number;
  onChange?: (targetKeys: string[], direction: ICETransferDirection, moveKeys: string[]) => void;
}

const PANEL_GAP = 12;
const BUTTON_COLUMN = 36;
const HEADER_HEIGHT = 28;

export class ICETransfer extends ICEWidget {
  private dataSource: ICETransferItem[];
  private targetKeys: string[];
  private titles: [string, string];
  private rowHeight: number;
  private onChangeCallback:
    | ((targetKeys: string[], direction: ICETransferDirection, moveKeys: string[]) => void)
    | null;
  private checked = new Set<string>();
  private sourceRows = new Map<string, ICEWidget>();
  private targetRows = new Map<string, ICEWidget>();
  private moveRightButton: ICEWidget | null = null;
  private moveLeftButton: ICEWidget | null = null;

  constructor(props: ICETransferOptions) {
    const theme = iceUIManager.getTheme();
    super({
      fill: true,
      stroke: true,
      left: props.left,
      top: props.top,
      width: props.width ?? 420,
      height: props.height ?? 220,
      radius: theme.radius.md,
      style: {
        fillStyle: theme.colors.surface,
        strokeStyle: theme.colors.border,
        lineWidth: theme.control.lineWidth,
      },
    });
    this.dataSource = (props.dataSource || []).slice();
    this.titles = props.titles || ['待选', '已选'];
    this.rowHeight = props.rowHeight ?? 28;
    this.onChangeCallback = typeof props.onChange === 'function' ? props.onChange : null;
    this.targetKeys = this.__sanitize(props.targetKeys || []);
    this.__render();
  }

  public getSourceKeys(): string[] {
    return this.dataSource.filter((item) => !this.targetKeys.includes(item.key)).map((item) => item.key);
  }

  public getTargetKeys(): string[] {
    return this.targetKeys.slice();
  }

  public setTargetKeys(keys: string[]): this {
    this.targetKeys = this.__sanitize(keys);
    this.checked.clear();
    this.__render();
    return this;
  }

  public getFormValue(): any {
    return this.getTargetKeys();
  }

  public setFormValue(value: any): void {
    this.setTargetKeys(Array.isArray(value) ? value : []);
  }

  public getCheckedKeys(): string[] {
    return Array.from(this.checked);
  }

  public isChecked(key: string): boolean {
    return this.checked.has(key);
  }

  public getSourceNode(key: string): ICEWidget | null {
    return this.sourceRows.get(key) || null;
  }

  public getTargetNode(key: string): ICEWidget | null {
    return this.targetRows.get(key) || null;
  }

  public getMoveRightButton(): ICEWidget | null {
    return this.moveRightButton;
  }

  public getMoveLeftButton(): ICEWidget | null {
    return this.moveLeftButton;
  }

  public isMoveRightEnabled(): boolean {
    return this.__movable([...this.checked], 'right').length > 0;
  }

  public isMoveLeftEnabled(): boolean {
    return this.__movable([...this.checked], 'left').length > 0;
  }

  public moveRight(): void {
    const moveKeys = this.__movable([...this.checked], 'right');
    if (!moveKeys.length) {
      return;
    }
    this.targetKeys = this.targetKeys.concat(moveKeys);
    this.checked.clear();
    this.__render();
    this.__emit('right', moveKeys);
  }

  public moveLeft(): void {
    const moveKeys = this.__movable([...this.checked], 'left');
    if (!moveKeys.length) {
      return;
    }
    this.targetKeys = this.targetKeys.filter((key) => !moveKeys.includes(key));
    this.checked.clear();
    this.__render();
    this.__emit('left', moveKeys);
  }

  public activate(): void {
    // 穿梭框没有单一激活语义，方向键/回车交给内部行与按钮
  }

  protected __applyValidateState(): void {
    this.__render();
  }

  private __emit(direction: ICETransferDirection, moveKeys: string[]): void {
    if (this.onChangeCallback) {
      this.onChangeCallback(this.getTargetKeys(), direction, moveKeys);
    }
  }

  /** 只保留 dataSource 里真实存在、且未禁用的 key，去重并保持传入顺序。 */
  private __sanitize(keys: string[]): string[] {
    const known = new Map(this.dataSource.map((item) => [item.key, item]));
    const result: string[] = [];
    keys.forEach((key) => {
      const item = known.get(key);
      if (item && !result.includes(key)) {
        result.push(key);
      }
    });
    return result;
  }

  private __movable(keys: string[], direction: ICETransferDirection): string[] {
    const known = new Map(this.dataSource.map((item) => [item.key, item]));
    return keys.filter((key) => {
      const item = known.get(key);
      if (!item || item.disabled) {
        return false;
      }
      return direction === 'right' ? !this.targetKeys.includes(key) : this.targetKeys.includes(key);
    });
  }

  private __toggleCheck(key: string): void {
    const item = this.dataSource.find((entry) => entry.key === key);
    if (!item || item.disabled) {
      return;
    }
    if (this.checked.has(key)) {
      this.checked.delete(key);
    } else {
      this.checked.add(key);
    }
    this.__render();
  }

  private __render(): void {
    const theme = iceUIManager.getTheme();
    const width = Number(this.state.width) || 420;
    const height = Number(this.state.height) || 220;
    const borderColor = this.validateStatus === 'error' ? theme.colors.error : theme.colors.border;
    this.setState({
      style: { ...this.state.style, fillStyle: theme.colors.surface, strokeStyle: borderColor },
    });
    this.removeChildren([...this.childNodes]);
    this.sourceRows.clear();
    this.targetRows.clear();

    const panelWidth = Math.max(80, (width - BUTTON_COLUMN - PANEL_GAP * 2) / 2);
    const listHeight = height;
    const sourceKeys = this.getSourceKeys();
    const targetKeys = this.getTargetKeys();

    const source = this.__renderPanel(
      `${this.titles[0]}（${sourceKeys.length}）`,
      0,
      panelWidth,
      listHeight,
      sourceKeys,
      'source',
    );
    const target = this.__renderPanel(
      `${this.titles[1]}（${targetKeys.length}）`,
      panelWidth + PANEL_GAP + BUTTON_COLUMN + PANEL_GAP,
      panelWidth,
      listHeight,
      targetKeys,
      'target',
    );
    this.addChild(source, false);
    this.addChild(target, false);

    const buttonX = panelWidth + PANEL_GAP;
    const rightEnabled = this.isMoveRightEnabled();
    const leftEnabled = this.isMoveLeftEnabled();
    const right = this.__renderMoveButton('›', buttonX, height / 2 - 34, rightEnabled);
    right.on('click', () => this.moveRight());
    const left = this.__renderMoveButton('‹', buttonX, height / 2 + 6, leftEnabled);
    left.on('click', () => this.moveLeft());
    this.moveRightButton = right;
    this.moveLeftButton = left;
    this.addChild(right, false);
    this.addChild(left, false);

    if (this.ice && this.ice.dirty !== undefined) {
      this.ice.dirty = true;
    }
  }

  private __renderPanel(
    title: string,
    left: number,
    width: number,
    height: number,
    keys: string[],
    side: 'source' | 'target',
  ): ICEWidget {
    const theme = iceUIManager.getTheme();
    const panel = new ICEWidget({
      left,
      top: 0,
      width,
      height,
      radius: theme.radius.md,
      fill: true,
      stroke: true,
      interactive: false,
      style: { fillStyle: theme.colors.background, strokeStyle: theme.colors.border },
    });
    panel.addChild(
      new ICELabel({
        interactive: false,
        left: 10,
        top: 0,
        width: Math.max(0, width - 20),
        height: HEADER_HEIGHT,
        verticalAlign: 'middle',
        text: title,
        style: { fontSize: 12, fontWeight: '600', fillStyle: theme.colors.textSecondary },
      }),
      false,
    );
    const pane = new ICEScrollPane({
      left: 1,
      top: HEADER_HEIGHT,
      width: width - 2,
      height: Math.max(0, height - HEADER_HEIGHT - 1),
      fill: false,
      stroke: false,
      style: { fillStyle: 'transparent', strokeStyle: 'transparent' },
    });
    const content = new ICEWidget({
      width: width - 2,
      height: Math.max(height - HEADER_HEIGHT - 1, keys.length * this.rowHeight),
      fill: false,
      stroke: false,
    });
    const items = new Map(this.dataSource.map((item) => [item.key, item]));
    keys.forEach((key, index) => {
      const item = items.get(key);
      if (!item) {
        return;
      }
      const row = this.__renderRow(item, index * this.rowHeight, width - 2);
      row.on('click', () => this.__toggleCheck(item.key));
      content.addChild(row, false);
      if (side === 'source') {
        this.sourceRows.set(item.key, row);
      } else {
        this.targetRows.set(item.key, row);
      }
    });
    pane.setContent(content);
    panel.addChild(pane, false);
    return panel;
  }

  private __renderRow(item: ICETransferItem, top: number, width: number): ICEWidget {
    const theme = iceUIManager.getTheme();
    const checked = this.checked.has(item.key);
    const row = new ICEWidget({
      left: 0,
      top,
      width,
      height: this.rowHeight,
      fill: true,
      stroke: false,
      style: { fillStyle: checked ? theme.colors.primaryBg : 'transparent' },
    });
    // 勾选框：纯展示，命中留给整行（interactive:false 避免抢走点击）
    const box = new ICEWidget({
      left: 8,
      top: (this.rowHeight - 16) / 2,
      width: 16,
      height: 16,
      radius: theme.radius.xs,
      fill: true,
      stroke: true,
      interactive: false,
      style: {
        fillStyle: checked ? theme.colors.primary : theme.colors.surface,
        strokeStyle: item.disabled
          ? theme.colors.disabled
          : checked
            ? theme.colors.primary
            : theme.colors.border,
      },
    });
    if (checked) {
      box.addChild(
        new ICELabel({
          interactive: false,
          left: 0,
          top: 0,
          width: 16,
          height: 16,
          align: 'center',
          verticalAlign: 'middle',
          text: '✓',
          style: { fontSize: 11, fillStyle: '#ffffff' },
        }),
        false,
      );
    }
    row.addChild(box, false);
    row.addChild(
      new ICELabel({
        interactive: false,
        left: 32,
        top: 0,
        width: Math.max(0, width - 40),
        height: this.rowHeight,
        verticalAlign: 'middle',
        text: item.title,
        style: {
          fontSize: 13,
          fillStyle: item.disabled ? theme.colors.textDisabled : theme.colors.text,
        },
      }),
      false,
    );
    return row;
  }

  private __renderMoveButton(text: string, left: number, top: number, enabled: boolean): ICEWidget {
    const theme = iceUIManager.getTheme();
    const button = new ICEWidget({
      left,
      top,
      width: BUTTON_COLUMN,
      height: 28,
      radius: theme.radius.sm,
      fill: true,
      stroke: true,
      style: {
        fillStyle: enabled ? theme.colors.surface : theme.colors.background,
        strokeStyle: enabled ? theme.colors.border : theme.colors.disabled,
      },
    });
    button.addChild(
      new ICELabel({
        interactive: false,
        left: 0,
        top: 0,
        width: BUTTON_COLUMN,
        height: 28,
        align: 'center',
        verticalAlign: 'middle',
        text,
        style: { fontSize: 14, fillStyle: enabled ? theme.colors.text : theme.colors.textDisabled },
      }),
      false,
    );
    return button;
  }
}
