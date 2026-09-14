/**
 * ICEUpload 的文件列表与进度。
 *
 * 规格：
 * - 选中文件后每行显示：文件名 + 大小（人类可读）+ 状态 + 删除按钮；
 * - 上传中可以给某一行设进度（0-100），行里出现进度条；100 之后按「完成」显示；
 * - 删除走 `onRemove` 并回调 `onChange`；`clear()` 清空；
 * - `showFileList: false` 时只用 dropZone（老行为可选关闭）。
 */
import { ICEUpload } from '../src/components/ICEUpload';

function setup(props: any = {}) {
  const changes: any[][] = [];
  const removed: string[] = [];
  const upload = new ICEUpload({
    left: 0,
    top: 0,
    width: 420,
    onChange: (files: any[]) => changes.push(files),
    onRemove: (file: any) => removed.push(file.name),
    ...props,
  });
  return { upload, changes, removed };
}

describe('ICEUpload 文件列表', () => {
  it('加文件后出现一行：名字 + 人类可读大小 + 删除按钮', () => {
    const { upload, changes } = setup();
    upload.addFile({ name: 'report.pdf', size: 2048 });
    const rows = upload.getFileRows();
    expect(rows.length).toBe(1);
    const file = upload.getFileList()[0];
    expect(file.name).toBe('report.pdf');
    expect(upload.getFileRowText(file.uid)).toContain('report.pdf');
    expect(upload.getFileRowText(file.uid)).toContain('2.0 KB');
    expect(upload.getFileRemoveButton(file.uid)).toBeTruthy();
    expect(changes.length).toBe(1);
  });

  it('大小格式化：B / KB / MB', () => {
    const { upload } = setup();
    expect(upload.formatFileSize(512)).toBe('512 B');
    expect(upload.formatFileSize(2048)).toBe('2.0 KB');
    expect(upload.formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB');
  });

  it('进度：设了 0-100 的行出现进度条，100 之后是「已完成」', () => {
    const { upload } = setup();
    upload.addFile({ name: 'a.png', size: 1024 });
    const uid = upload.getFileList()[0].uid;
    upload.setFileProgress(uid, 42);
    expect(upload.getFileProgress(uid)).toBe(42);
    expect(upload.getFileProgressNode(uid)).toBeTruthy();
    expect(upload.getFileRowText(uid)).toContain('42%');
    upload.setFileProgress(uid, 100);
    expect(upload.getFileProgressNode(uid)).toBe(null);
    expect(upload.getFileRowText(uid)).toContain('已完成');
    upload.setFileProgress(uid, 500); // 越界夹到 100
    expect(upload.getFileProgress(uid)).toBe(100);
  });

  it('删除一行会回调 onRemove 与 onChange', () => {
    const { upload, changes, removed } = setup();
    upload.addFile({ name: 'a.png', size: 1024 });
    const uid = upload.getFileList()[0].uid;
    upload.getFileRemoveButton(uid)!.trigger('click', null, {});
    expect(upload.getFileList().length).toBe(0);
    expect(removed).toEqual(['a.png']);
    expect(changes.length).toBe(2);
  });

  it('showFileList:false 时不画列表（只要拖拽区）', () => {
    const { upload } = setup({ showFileList: false });
    upload.addFile({ name: 'a.png', size: 1024 });
    expect(upload.getFileList().length).toBe(1);
    expect(upload.getFileRows().length).toBe(0);
  });
});
