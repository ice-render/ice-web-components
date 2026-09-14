/**
 * ICEUpload 的自定义上传。
 *
 * 规格：
 * - 传了 `customRequest(file, { onProgress, onSuccess, onError })` 之后，加入文件就**自动开始上传**；
 * - 进度回调 → 行内进度条与百分比；
 * - 成功 → 状态 `done`、显示「已完成」；失败 → 状态 `error`、显示失败原因；
 * - 返回 Promise 也认（resolve = 成功、reject = 失败）；
 * - 没传 customRequest 时行为不变（文件只是加进列表）。
 */
import { ICEUpload } from '../src/components/ICEUpload';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function setup(props: any = {}) {
  return new ICEUpload({ left: 0, top: 0, width: 420, onChange: () => {}, ...props });
}

describe('ICEUpload 自定义上传', () => {
  it('加入文件就调 customRequest，并把进度回调接上', () => {
    const calls: string[] = [];
    let hooks: any = null;
    const upload = setup({
      customRequest: (file: any, h: any) => {
        calls.push(file.name);
        hooks = h;
      },
    });
    upload.addFile({ name: 'a.png', size: 1024 });
    const uid = upload.getFileList()[0].uid;
    expect(calls).toEqual(['a.png']);
    expect(upload.getFileStatus(uid)).toBe('uploading');
    hooks.onProgress(37);
    expect(upload.getFileProgress(uid)).toBe(37);
    expect(upload.getFileProgressNode(uid)).toBeTruthy();
    expect(upload.getFileRowText(uid)).toContain('37%');
  });

  it('成功：进度 100、状态 done、显示「已完成」', () => {
    let hooks: any = null;
    const upload = setup({ customRequest: (_file: any, h: any) => { hooks = h; } });
    upload.addFile({ name: 'b.png', size: 2048 });
    const uid = upload.getFileList()[0].uid;
    hooks.onSuccess({ url: 'https://example.com/b.png' });
    expect(upload.getFileStatus(uid)).toBe('done');
    expect(upload.getFileProgress(uid)).toBe(100);
    expect(upload.getFileRowText(uid)).toContain('已完成');
    expect(upload.getFileList()[0].url).toBe('https://example.com/b.png');
  });

  it('失败：状态 error 并显示原因', () => {
    let hooks: any = null;
    const upload = setup({ customRequest: (_file: any, h: any) => { hooks = h; } });
    upload.addFile({ name: 'c.png', size: 1024 });
    const uid = upload.getFileList()[0].uid;
    hooks.onError('网络超时');
    expect(upload.getFileStatus(uid)).toBe('error');
    expect(upload.getFileRowText(uid)).toContain('网络超时');
    expect(upload.getFileProgressNode(uid)).toBe(null);
  });

  it('返回 Promise：resolve 成功、reject 失败', async () => {
    const okUpload = setup({ customRequest: () => Promise.resolve() });
    okUpload.addFile({ name: 'ok.png', size: 10 });
    await flush();
    expect(okUpload.getFileStatus(okUpload.getFileList()[0].uid)).toBe('done');

    const badUpload = setup({ customRequest: () => Promise.reject(new Error('服务器 500')) });
    badUpload.addFile({ name: 'bad.png', size: 10 });
    await flush();
    const uid = badUpload.getFileList()[0].uid;
    expect(badUpload.getFileStatus(uid)).toBe('error');
    expect(badUpload.getFileRowText(uid)).toContain('服务器 500');
  });

  it('重试：把失败的行再传一次（状态回到 uploading）', () => {
    let count = 0;
    let hooks: any = null;
    const upload = setup({
      customRequest: (_file: any, h: any) => {
        count += 1;
        hooks = h;
      },
    });
    upload.addFile({ name: 'd.png', size: 10 });
    const uid = upload.getFileList()[0].uid;
    hooks.onError('超时');
    expect(upload.retryFile(uid)).toBe(true);
    expect(count).toBe(2);
    expect(upload.getFileStatus(uid)).toBe('uploading');
    expect(upload.getFileRowText(uid)).not.toContain('超时');
  });

  it('没传 customRequest 时只是加进列表（老行为）', () => {
    const upload = setup();
    upload.addFile({ name: 'e.png', size: 10 });
    const uid = upload.getFileList()[0].uid;
    expect(upload.getFileStatus(uid)).toBe(null);
    expect(upload.getFileProgress(uid)).toBe(null);
  });
});
