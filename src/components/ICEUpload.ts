import { ICERect } from 'ice-render';
import { ICELabel } from './ICELabel';
import { ICEProgressBar } from './ICEProgressBar';
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
  /** 上传进度 0-100（100 = 已完成；不设 = 未开始/不需要进度） */
  progress?: number;
  /** 上传状态（有 customRequest 时由它维护） */
  status?: 'uploading' | 'done' | 'error';
  /** 失败原因（status = 'error' 时显示） */
  error?: string;
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
  /** 删掉一个文件时回调（✕ 与 `removeFile` 同一条路径） */
  onRemove?: (file: ICEUploadFile) => void;
  /** 是否画文件列表（默认 true；只要拖拽区就传 false） */
  showFileList?: boolean;
  /**
   * 自定义上传实现：给了它，加入文件就自动开始上传。
   *
   * 实现里通过 hooks 回报进度 / 成功 / 失败；也可以直接返回 Promise（resolve 成功、reject 失败）。
   */
  customRequest?: (
    file: ICEUploadFile,
    hooks: {
      onProgress: (percent: number) => void;
      onSuccess: (response?: { url?: string }) => void;
      onError: (message: string) => void;
    },
  ) => void | Promise<any>;
  /** 文件行可以上下拖拽排序 */
  draggable?: boolean;
  /** 排序落下后的回调（顺序变了才触发） */
  onReorder?: (files: ICEUploadFile[], from: number, to: number) => void;
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
  private onRemoveCallback: ((file: ICEUploadFile) => void) | null;
  private showFileList: boolean;
  private fileRows = new Map<string, any>();
  private fileRemoveButtons = new Map<string, any>();
  private fileLabels = new Map<string, any>();
  private fileProgressNodes = new Map<string, any>();
  private customRequest:
    | ((file: ICEUploadFile, hooks: {
        onProgress: (percent: number) => void;
        onSuccess: (response?: { url?: string }) => void;
        onError: (message: string) => void;
      }) => void | Promise<any>)
    | null = null;
  /** 桌面拖拽：画布元素上的监听（挂上场景后注册） */
  private dragOver = false;
  private canvasEl: any = null;
  private boundDrag = false;
  private __dragHandlers: { dragover: any; dragleave: any; drop: any } | null = null;
  private draggableRows = false;
  private rowDrag: { from: number; to: number } | null = null;
  private onReorderCallback: ((files: ICEUploadFile[], from: number, to: number) => void) | null = null;
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
    this.onRemoveCallback = typeof props.onRemove === 'function' ? props.onRemove : null;
    this.showFileList = props.showFileList !== false;
    this.customRequest = typeof props.customRequest === 'function' ? props.customRequest : null;
    this.draggableRows = props.draggable === true;
    this.onReorderCallback = typeof props.onReorder === 'function' ? props.onReorder : null;
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
    // 有自定义上传实现就自动开始（没传的话只是加进列表，行为不变）
    if (this.customRequest) {
      this.__startUpload(normalized.uid);
    }
    this.__render();
    this.__emit();
    return true;
  }

  /** 开始 / 重试一次上传：把 hooks 接到这一行上。 */
  private __startUpload(uid: string): void {
    const file = this.files.find((item) => item.uid === uid);
    if (!file || !this.customRequest) {
      return;
    }
    file.status = 'uploading';
    file.error = undefined;
    file.progress = 0;
    const hooks = {
      onProgress: (percent: number) => this.setFileProgress(uid, percent),
      onSuccess: (response?: { url?: string }) => {
        const target = this.files.find((item) => item.uid === uid);
        if (!target) return;
        target.status = 'done';
        target.progress = 100;
        target.error = undefined;
        if (response && response.url) {
          target.url = response.url;
        }
        this.__render();
      },
      onError: (message: string) => {
        const target = this.files.find((item) => item.uid === uid);
        if (!target) return;
        target.status = 'error';
        target.error = String(message || '');
        target.progress = undefined;
        this.__render();
      },
    };
    const result = this.customRequest({ ...file }, hooks);
    if (result && typeof (result as any).then === 'function') {
      (result as Promise<any>).then(
        () => hooks.onSuccess(),
        (error: any) => hooks.onError(String((error && error.message) || error || '上传失败')),
      );
    }
  }

  /** 上传状态：'uploading' | 'done' | 'error'（没用 customRequest 时是 null）。 */
  public getFileStatus(uid: string): 'uploading' | 'done' | 'error' | null {
    const file = this.files.find((item) => item.uid === uid);
    return file && file.status ? file.status : null;
  }

  // ---------------------------------------------------------------- 桌面拖拽

  /** 有文件正悬在拖拽区上方（用于高亮反馈）。 */
  public isDragOver(): boolean {
    return this.dragOver;
  }

  // ---- 文件行拖拽排序 ----

  public isRowDragging(): boolean {
    return !!this.rowDrag;
  }

  /** 按住某一行（真实路径由全局 mousedown 触发；测试可直接调）。 */
  public __onRowDragStart(index: number): this {
    if (!this.draggableRows || index < 0 || index >= this.files.length) {
      return this;
    }
    this.rowDrag = { from: index, to: index };
    return this;
  }

  public __onRowDragMove(index: number): this {
    if (!this.rowDrag) {
      return this;
    }
    this.rowDrag.to = Math.min(Math.max(0, Math.floor(Number(index) || 0)), Math.max(0, this.files.length - 1));
    return this;
  }

  public __onRowDragEnd(): this {
    const drag = this.rowDrag;
    this.rowDrag = null;
    if (!drag || drag.from === drag.to) {
      return this;
    }
    const files = this.files.slice();
    const [moved] = files.splice(drag.from, 1);
    files.splice(drag.to, 0, moved);
    this.files = files;
    this.__render();
    if (this.onReorderCallback) {
      this.onReorderCallback(this.getFileList(), drag.from, drag.to);
    }
    return this;
  }

  /** 把画布元素上的 drag / drop 事件接上（`afterAddHandler` 自动调）。 */
  private __bindCanvasDrop(): void {
    if (this.boundDrag) {
      return;
    }
    const canvas = this.ice && ((this.ice as any).canvas || (this.ice as any).canvasEl);
    if (!canvas || typeof canvas.addEventListener !== 'function') {
      return;
    }
    this.boundDrag = true;
    this.canvasEl = canvas;
    const isInsideDropZone = (evt: any): boolean => {
      if (!this.ice || typeof this.ice.screenToWorld !== 'function' || typeof evt.clientX !== 'number') {
        return false;
      }
      const rect = typeof canvas.getBoundingClientRect === 'function' ? canvas.getBoundingClientRect() : null;
      if (!rect) {
        return false;
      }
      const [wx, wy] = this.ice.screenToWorld(evt.clientX - rect.left, evt.clientY - rect.top);
      const box = this.getMinBoundingBox(true);
      const zoneBottom = box.tl[1] + DROP_ZONE_HEIGHT;
      return wx >= box.tl[0] && wx <= box.br[0] && wy >= box.tl[1] && wy <= zoneBottom;
    };
    const handlers = {
      dragover: (evt: any) => {
        if (this.disabled) {
          return;
        }
        const inside = isInsideDropZone(evt);
        if (inside && evt.preventDefault) {
          evt.preventDefault();
        }
        if (inside !== this.dragOver) {
          this.dragOver = inside;
          this.__render();
        }
      },
      dragleave: (evt: any) => {
        if (this.disabled) {
          return;
        }
        // canvas 级监听：收到 dragleave 就是指针离开了画布（不再落在拖拽区上）
        if (this.dragOver) {
          this.dragOver = false;
          this.__render();
        }
      },
      drop: (evt: any) => {
        this.dragOver = false;
        this.__render();
        if (this.disabled || !isInsideDropZone(evt)) {
          return;
        }
        if (evt.preventDefault) {
          evt.preventDefault();
        }
        const files: any[] = Array.from((evt.dataTransfer && evt.dataTransfer.files) || []);
        files.forEach((file) => this.addFile({ name: file.name, size: file.size, type: file.type }));
      },
    };
    canvas.addEventListener('dragover', handlers.dragover);
    canvas.addEventListener('dragleave', handlers.dragleave);
    canvas.addEventListener('drop', handlers.drop);
    this.__dragHandlers = handlers;
  }

  protected afterAddHandler(): void {
    super.afterAddHandler();
    this.__bindCanvasDrop();
  }

  /** 失败重传（只有失败的行能重试）。 */
  public retryFile(uid: string): boolean {
    const file = this.files.find((item) => item.uid === uid);
    if (!file || !this.customRequest || file.status !== 'error') {
      return false;
    }
    this.__startUpload(uid);
    this.__render();
    this.__emit();
    return true;
  }

  public removeFile(uid: string): this {
    const removed = this.files.find((file) => file.uid === uid);
    if (!removed) {
      return this;
    }
    this.files = this.files.filter((file) => file.uid !== uid);
    this.__render();
    this.__emit();
    if (this.onRemoveCallback) {
      this.onRemoveCallback({ ...removed });
    }
    return this;
  }

  // ---------------------------------------------------------------- 文件列表 / 进度

  /** 文件行节点（`showFileList: false` 时为空）。 */
  public getFileRows(): any[] {
    return this.files.map((file) => this.fileRows.get(file.uid)).filter(Boolean);
  }

  /** 某一行的整行文案（测试 / 无障碍镜像用）。 */
  public getFileRowText(uid: string): string {
    const label = this.fileLabels.get(uid);
    return label ? String(label.getText()) : '';
  }

  public getFileRemoveButton(uid: string): any {
    return this.fileRemoveButtons.get(uid) || null;
  }

  /** 上传中那一行的进度条（没有进度 / 已完成时为 null）。 */
  public getFileProgressNode(uid: string): any {
    return this.fileProgressNodes.get(uid) || null;
  }

  public getFileProgress(uid: string): number | null {
    const file = this.files.find((item) => item.uid === uid);
    return file && typeof file.progress === 'number' ? file.progress : null;
  }

  /** 设置某一行进度（0-100 夹取）；100 表示完成，行里不再显示进度条。 */
  public setFileProgress(uid: string, progress: number): this {
    const file = this.files.find((item) => item.uid === uid);
    if (!file) {
      return this;
    }
    file.progress = Math.min(100, Math.max(0, Math.round(Number(progress) || 0)));
    this.__render();
    return this;
  }

  /** 人类可读的文件大小（512 B / 2.0 KB / 5.0 MB）。 */
  public formatFileSize(bytes: number): string {
    const size = Math.max(0, Number(bytes) || 0);
    if (size < 1024) {
      return `${Math.round(size)} B`;
    }
    if (size < 1024 * 1024) {
      return `${(size / 1024).toFixed(1)} KB`;
    }
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
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
    this.fileRows = new Map();
    this.fileRemoveButtons = new Map();
    this.fileLabels = new Map();
    this.fileProgressNodes = new Map();
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
        // 有文件悬在上方时给个明确的高亮：拖放最怕「不知道松手会发生什么」
        fillStyle: this.disabled
          ? theme.colors.disabled
          : this.dragOver
          ? theme.colors.primaryBg
          : theme.colors.background,
        strokeStyle: this.disabled
          ? theme.colors.borderSecondary
          : this.dragOver
          ? theme.colors.primary
          : theme.colors.border,
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
      if (!this.showFileList) {
        return;
      }
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
      const sizeText = file.size ? `（${this.formatFileSize(file.size)}）` : '';
      const progress = typeof file.progress === 'number' ? file.progress : null;
      const statusText =
        file.status === 'error'
          ? ` · 失败：${file.error || '上传失败'}`
          : file.status === 'done' || progress === 100
          ? ' · 已完成'
          : progress === null
          ? ''
          : ` · ${progress}%`;
      const label = new ICELabel({
          interactive: false,
          left: 8,
          top: 0,
          width: Math.max(0, width - 60),
          height: this.rowHeight,
          verticalAlign: 'middle',
          text: `${file.name}${sizeText}${statusText}`,
          style: { fontSize: 12, fillStyle: theme.colors.text },
        });
      row.addChild(label, false);
      this.fileLabels.set(file.uid, label);
      // 上传中：行内加一条细进度条，让「传到哪了」看得见
      // 上传中才画进度条：失败 / 已完成都不画（失败的原因写在文案里）
      if (progress !== null && progress < 100 && file.status !== 'error') {
        const bar = new ICEProgressBar({
          left: 8,
          top: this.rowHeight - 8,
          width: Math.max(40, width - 60),
          height: 4,
          value: progress,
        });
        row.addChild(bar, false);
        this.fileProgressNodes.set(file.uid, bar);
      }
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
      this.fileRows.set(file.uid, row);
      this.fileRemoveButtons.set(file.uid, remove);
    });

    if (this.ice && this.ice.dirty !== undefined) {
      this.ice.dirty = true;
    }
  }
}
