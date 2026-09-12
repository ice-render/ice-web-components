/**
 * ICEUpload 单测（上传选择器）。
 *
 * 规格：
 * - `addFile` 走 accept / maxSize / maxCount 校验，通过则进列表并回调 onChange；
 * - 被拒时返回 false 并给出原因（getLastRejectReason），列表不变、不回调；
 * - removeFile / clear 维护列表；disabled 时一律拒绝；
 * - `beforeUpload` 返回 false 或字符串时视为拒绝（字符串作为原因）；
 * - 渲染：拖拽区 + 每个文件一行（可查节点），无 DOM 环境下 openPicker 安全空转。
 */
import { ICEUpload } from '../src/components/ICEUpload';

function setup(props: any = {}) {
  const changes: Array<Array<{ name: string }>> = [];
  const upload = new ICEUpload({
    left: 0,
    top: 0,
    width: 320,
    onChange: (files: Array<{ name: string }>) => changes.push(files),
    ...props,
  });
  return { upload, changes };
}

describe('ICEUpload', () => {
  it('添加文件进列表并回调；uid 唯一', () => {
    const { upload, changes } = setup();
    expect(upload.addFile({ name: 'a.png', size: 100 })).toBe(true);
    expect(upload.addFile({ name: 'b.png', size: 200 })).toBe(true);
    const list = upload.getFileList();
    expect(list.map((file) => file.name)).toEqual(['a.png', 'b.png']);
    expect(list[0].uid).not.toBe(list[1].uid);
    expect(changes.length).toBe(2);
    expect(upload.getFileNode(list[0].uid)).not.toBeNull();
    expect(upload.getDropZoneNode()).not.toBeNull();
  });

  it('accept 过滤扩展名', () => {
    const { upload, changes } = setup({ accept: '.png,.jpg' });
    expect(upload.addFile({ name: 'a.txt', size: 10 })).toBe(false);
    expect(upload.getFileList().length).toBe(0);
    expect(changes.length).toBe(0);
    expect(upload.getLastRejectReason()).toContain('不支持');
    expect(upload.addFile({ name: 'b.JPG', size: 10 })).toBe(true);
  });

  it('maxSize / maxCount 限制', () => {
    const { upload } = setup({ maxSize: 150 });
    expect(upload.addFile({ name: 'big.png', size: 200 })).toBe(false);
    expect(upload.getLastRejectReason()).toContain('大小');
    expect(upload.addFile({ name: 'ok.png', size: 100 })).toBe(true);

    const limited = setup({ maxCount: 1 }).upload;
    limited.addFile({ name: 'a.png', size: 1 });
    expect(limited.addFile({ name: 'b.png', size: 1 })).toBe(false);
    expect(limited.getLastRejectReason()).toContain('数量');
    expect(limited.getFileList().length).toBe(1);
  });

  it('beforeUpload 返回 false / 字符串时拒绝', () => {
    const { upload } = setup({ beforeUpload: (file: any) => (file.name === 'x.png' ? false : '名字不合法') });
    expect(upload.addFile({ name: 'x.png', size: 1 })).toBe(false);
    expect(upload.addFile({ name: 'y.png', size: 1 })).toBe(false);
    expect(upload.getLastRejectReason()).toBe('名字不合法');
    expect(upload.getFileList().length).toBe(0);
  });

  it('removeFile / clear；disabled 拒绝新增', () => {
    const { upload, changes } = setup();
    upload.addFile({ name: 'a.png', size: 1 });
    upload.addFile({ name: 'b.png', size: 1 });
    const first = upload.getFileList()[0];
    upload.removeFile(first.uid);
    expect(upload.getFileList().map((file) => file.name)).toEqual(['b.png']);
    expect(changes.length).toBe(3);
    upload.clear();
    expect(upload.getFileList().length).toBe(0);

    const disabled = setup({ disabled: true }).upload;
    expect(disabled.addFile({ name: 'a.png', size: 1 })).toBe(false);
    expect(disabled.isDisabled()).toBe(true);
    expect(disabled.openPicker()).toBe(false);
  });

  it('列表高度随文件数增长；无文件时只显示拖拽区', () => {
    const { upload } = setup();
    const emptyHeight = upload.state.height;
    upload.addFile({ name: 'a.png', size: 1 });
    expect(upload.state.height).toBeGreaterThan(emptyHeight);
    upload.clear();
    expect(upload.state.height).toBe(emptyHeight);
  });
});
