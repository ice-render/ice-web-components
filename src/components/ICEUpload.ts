import { ICERect } from 'ice-render';
import { ICELabel } from './ICELabel';
import { ICEWidget } from '../core/ICEWidget';
import { t } from '../i18n/ICEI18n';
import { iceUIManager } from '../core/ICEManager';
import type { ICELocalizedProps } from '../i18n/ICEI18n';

/**
 * 上传选择器。
 *
 * - 上：虚线拖拽区（点击唤起隐藏的 `<input type="file">`）；
 * - 下：文件列表（名称 / 大小 / 删除）；
 * - 校验：`accept`（扩展名或 MIME，支持 `image/*`）、`maxSize`、`maxCount`、`beforeUpload`；
 * - 被拒时 `addFile` 返回 false 并记录原因（`getLastRejectReason()`），列表与回调都不动；
 * - 文件对象是**纯数据**（`{uid,name,size,type,url}`），不依赖 DOM，便于测试与序列化。
 */

export interface ICEUploadFile {
  uid: string;
  name: string;
  size?: number;
  type?: string;
  url?: string;
}

export interface ICEUploadOptions extends ICELocalizedProps {
  /** 组件 id（引擎会用它做唯一标识，e2e/调试时可按 id 定位） */
  id?: string;
  accept?: string;
  multiple?: boolean;
  maxCount?: number;
  /** 单文件大小上限（字节） */
  maxSize?: number;
  disabled?: boolean;
  text?: string;
  hint?: string;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  rowHeight?: number;
  beforeUpload?: (file: ICEUploadFile) => boolean | string | undefined;
  onChange?: (files: ICEUploadFile[]) => void;
}

const DROP_ZONE_HEIGHT = 96;

export class ICEUpload extends ICEWidget {
  private files: ICEUploadFile[] = [];
  private accept: string;
  private multiple: boolean;
  private maxCount: number;
  private maxSize: number;
  private disabled: boolean;
  private text: string;
  private hint: string;
  private rowHeight: number;
  private beforeUpload: ((file: ICEUploadFile) => boolean | string | undefined) | null;
  private onChangeCallback: ((files: ICEUploadFile[]) => void) | null;
  private lastRejectReason: string | null = null;
  private dropZone: ICEWidget | null = null;
  private fileNodes = new Map<string, ICEWidget>();
  private inputEl: any = null;
  private seq = 0;

  constructor(props: ICEUploadOptions = {}) {
    const theme = iceUIManager.getTheme();
    const width = props.width ?? 320;
    super({
      id: props.id,
      fill: false,
      stroke: false,
      left: props.left,
      top: props.top,
      width,
      height: props.height ?? DROP_ZONE_HEIGHT,
    });
    this.setLocale(props.locale); // 实例级语言（组件层文案可配、不持全局状态）
    this.accept = props.accept || '';
    this.multiple = props.multiple !== false;
    this.maxCount = Math.max(0, Number(props.maxCount) || Number.MAX_SAFE_INTEGER);
    this.maxSize = Math.max(0, Number(props.maxSize) || Number.MAX_SAFE_INTEGER);
    this.disabled = props.disabled === true;
    this.text = props.text || this.t('upload.hint');
    this.hint = props.hint || this.__defaultHint();
    this.rowHeight = Math.max(20, Number(props.rowHeight) || 28);
    this.beforeUpload = typeof props.beforeUpload === 'function' ? props.beforeUpload : null;
    this.onChangeCallback = typeof props.onChange === 'function' ? props.onChange : null;
    this.focusable = !this.disabled;
    this.__render();
  }

  public getFileList(): ICEUploadFile[] {
    return this.files.map((file) => ({ ...file }));
  }

  public isDisabled(): boolean {
    return this.disabled;
  }

  public getLastRejectReason(): string | null {
    return this.lastRejectReason;
  }

  public getDropZoneNode(): ICEWidget | null {
    return this.dropZone;
  }

  /** 上传区提示文案（测试 / QA 用）。 */
  public getHintText(): string {
    return this.text;
  }

  public getFileNode(uid: string): ICEWidget | null {
    return this.fileNodes.get(uid) || null;
  }

  /** 加入一个文件（真实选择结果或调用方构造的数据）；被拒时返回 false。 */
  public addFile(file: Partial<ICEUploadFile>): boolean {
    const normalized: ICEUploadFile = {
      uid: file.uid || `upload-${++this.seq}`,
      name: String(file.name ?? ''),
      size: Number(file.size) || 0,
      type: file.type,
      url: file.url,
    };
    const reason = this.__rejectReason(normalized);
    if (reason) {
      this.lastRejectReason = reason;
      return false;
    }
    this.lastRejectReason = null;
    this.files.push(normalized);
    this.__render();
    this.__emit();
    return true;
  }

  public removeFile(uid: string): this {
    const next = this.files.filter((file) => file.uid !== uid);
    if (next.length === this.files.length) {
      return this;
    }
    this.files = next;
    this.__render();
    this.__emit();
    return this;
  }

  public clear(): this {
    if (!this.files.length) {
      return this;
    }
    this.files = [];
    this.__render();
    this.__emit();
    return this;
  }

  public setDisabled(disabled: boolean): this {
    this.disabled = !!disabled;
    this.focusable = !this.disabled;
    this.__render();
    return this;
  }

  /** 唤起系统文件选择框（无 DOM 环境返回 false）。 */
  public openPicker(): boolean {
    if (this.disabled) {
      return false;
    }
    const doc: any = typeof document === 'undefined' ? null : document;
    if (!doc || typeof doc.createElement !== 'function') {
      return false;
    }
    if (!this.inputEl) {
      const input = doc.createElement('input');
      input.type = 'file';
      if (this.accept) {
        input.accept = this.accept;
      }
      input.multiple = this.multiple;
      input.style.position = 'fixed';
      input.style.left = '-9999px';
      input.addEventListener('change', () => {
        const picked: any[] = Array.from(input.files || []);
        picked.forEach((file) => this.addFile({ name: file.name, size: file.size, type: file.type }));
        input.value = '';
      });
      if (doc.body && typeof doc.body.appendChild === 'function') {
        doc.body.appendChild(input);
      }
      this.inputEl = input;
    }
    if (typeof this.inputEl.click === 'function') {
      this.inputEl.click();
      return true;
    }
    return false;
  }

  public activate(): void {
    this.openPicker();
  }

  private __defaultHint(): string {
    const parts: string[] = [];
    if (this.accept) {
      parts.push(this.accept);
    }
    if (this.maxSize < Number.MAX_SAFE_INTEGER) {
      parts.push(this.t('upload.sizeLimit', { size: Math.round(this.maxSize / 1024) }));
    }
    return parts.join(' · ');
  }

  private __rejectReason(file: ICEUploadFile): string | null {
    if (this.disabled) {
      return this.t('upload.disabled');
    }
    if (!this.__accepts(file)) {
      return this.t('upload.typeUnsupported', { name: file.name });
    }
    if (Number(file.size) > this.maxSize) {
      return this.t('upload.sizeExceeded', { name: file.name });
    }
    if (this.files.length >= this.maxCount) {
      return this.t('upload.maxCount', { max: this.maxCount });
    }
    if (this.beforeUpload) {
      const result = this.beforeUpload(file);
      if (result === false) {
        return `文件被拒绝：${file.name}`;
      }
      if (typeof result === 'string') {
        return result;
      }
    }
    return null;
  }

  private __accepts(file: ICEUploadFile): boolean {
    if (!this.accept) {
      return true;
    }
    const name = file.name.toLowerCase();
    const type = String(file.type || '').toLowerCase();
    return this.accept
      .split(',')
      .map((token) => token.trim().toLowerCase())
      .filter(Boolean)
      .some((token) => {
        if (token.startsWith('.')) {
          return name.endsWith(token);
        }
        if (token.endsWith('/*')) {
          return type.startsWith(token.slice(0, -1));
        }
        return type === token;
      });
  }

  private __emit(): void {
    if (this.onChangeCallback) {
      this.onChangeCallback(this.getFileList());
    }
  }

  private __render(): void {
    const theme = iceUIManager.getTheme();
    const width = Number(this.state.width) || 320;
    this.removeChildren([...this.childNodes]);
    this.fileNodes = new Map();
    this.setState({ height: DROP_ZONE_HEIGHT + this.files.length * this.rowHeight });

    const zone = new ICEWidget({
      // 内缩 3px：点击后焦点环画在组件外框上，不缩进的话会盖住虚线边
      left: 3,
      top: 3,
      width: Math.max(0, width - 6),
      height: DROP_ZONE_HEIGHT - 6,
      radius: theme.radius.md,
      fill: true,
      stroke: true,
      lineDash: [6, 4],
      style: {
        fillStyle: this.disabled ? theme.colors.disabled : theme.colors.background,
        strokeStyle: this.disabled ? theme.colors.borderSecondary : theme.colors.border,
      },
    });
    const zoneWidth = Math.max(0, width - 6);
    const plusX = zoneWidth / 2 - 12;
    zone.addChild(
      new ICELabel({
        interactive: false,
        left: plusX,
        top: 14,
        width: 24,
        height: 24,
        align: 'center',
        verticalAlign: 'middle',
        text: '＋',
        style: {
          fontSize: 20,
          fillStyle: this.disabled ? theme.colors.textDisabled : theme.colors.textSecondary,
        },
      }),
      false,
    );
    zone.addChild(
      new ICELabel({
        interactive: false,
        left: 12,
        top: 42,
        width: Math.max(0, zoneWidth - 24),
        height: 18,
        align: 'center',
        verticalAlign: 'middle',
        text: this.text,
        style: {
          fontSize: 13,
          fillStyle: this.disabled ? theme.colors.textDisabled : theme.colors.text,
        },
      }),
      false,
    );
    if (this.hint) {
      zone.addChild(
        new ICELabel({
          interactive: false,
          left: 12,
          top: 62,
          width: Math.max(0, zoneWidth - 24),
          height: 16,
          align: 'center',
          verticalAlign: 'middle',
          text: this.hint,
          style: { fontSize: 11, fillStyle: theme.colors.textTertiary },
        }),
        false,
      );
    }
    if (!this.disabled) {
      zone.on('click', () => this.openPicker());
    }
    this.addChild(zone, false);
    this.dropZone = zone;

    this.files.forEach((file, index) => {
      const top = DROP_ZONE_HEIGHT + index * this.rowHeight;
      const row = new ICEWidget({
        left: 0,
        top,
        width,
        height: this.rowHeight,
        fill: true,
        stroke: false,
        style: { fillStyle: index % 2 === 0 ? theme.colors.surface : theme.colors.background },
      });
      row.addChild(
        new ICELabel({
          interactive: false,
          left: 8,
          top: 0,
          width: Math.max(0, width - 60),
          height: this.rowHeight,
          verticalAlign: 'middle',
          text: `${file.name}${file.size ? `（${Math.max(1, Math.round(file.size / 1024))} KB）` : ''}`,
          style: { fontSize: 12, fillStyle: theme.colors.text },
        }),
        false,
      );
      const remove = new ICEWidget({
        left: width - 32,
        top: Math.round((this.rowHeight - 20) / 2),
        width: 20,
        height: 20,
        radius: theme.radius.sm,
        fill: false,
        stroke: false,
      });
      remove.addChild(
        new ICELabel({
          interactive: false,
          left: 0,
          top: 0,
          width: 20,
          height: 20,
          align: 'center',
          verticalAlign: 'middle',
          text: '✕',
          style: { fontSize: 12, fillStyle: theme.colors.textTertiary },
        }),
        false,
      );
      remove.on('click', () => this.removeFile(file.uid));
      row.addChild(remove, false);
      this.addChild(row, false);
      this.fileNodes.set(file.uid, row);
    });

    if (this.ice && this.ice.dirty !== undefined) {
      this.ice.dirty = true;
    }
  }
}
