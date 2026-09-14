/**
 * 上传队列的暂停 / 继续。
 *
 * 场景：用户发现选错了几个文件，想先停下来挑一挑 —— 现在只能全删了重来。
 *
 * 规格：
 * - `pauseUploads()` 之后不再启动新的（已经在跑的让它跑完，不半途掐断）；
 * - `resumeUploads()` 继续按当前列表顺序灌队列；
 * - 暂停期间加文件：进队列但不启动，恢复后一起走；
 * - 没传 customRequest 时暂停/继续无副作用（老行为）。
 */
import { ICEUpload } from '../src/components/ICEUpload';

function setup(props: any = {}) {
  const calls: string[] = [];
  const hooks = new Map<string, any>();
  const upload = new ICEUpload({
    left: 0,
    top: 0,
    width: 420,
    onChange: () => {},
    customRequest: (file: any, h: any) => {
      calls.push(file.name);
      hooks.set(file.name, h);
    },
    ...props,
  });
  return { upload, calls, hooks };
}

describe('上传暂停 / 继续', () => {
  it('暂停后不再启动新的（在跑的照旧）', () => {
    const { upload, calls } = setup();
    upload.addFile({ name: 'a', size: 10 });
    upload.addFile({ name: 'b', size: 10 });
    expect(calls).toEqual(['a']);
    upload.pauseUploads();
    expect(upload.isUploadsPaused()).toBe(true);
    expect(upload.getQueuedCount()).toBe(1);
    expect(calls).toEqual(['a']);
  });

  it('暂停期间完成一个：下一个也不会启动，直到恢复', () => {
    const { upload, calls, hooks } = setup();
    upload.addFile({ name: 'a', size: 10 });
    upload.addFile({ name: 'b', size: 10 });
    upload.pauseUploads();
    hooks.get('a').onSuccess();
    expect(calls).toEqual(['a']);
    upload.resumeUploads();
    expect(upload.isUploadsPaused()).toBe(false);
    expect(calls).toEqual(['a', 'b']);
  });

  it('暂停期间加的文件：进队列，恢复后按空位补上', () => {
    const { upload, calls, hooks } = setup({ uploadConcurrency: 2 });
    upload.addFile({ name: 'a', size: 10 });
    upload.pauseUploads();
    upload.addFile({ name: 'b', size: 10 });
    upload.addFile({ name: 'c', size: 10 });
    expect(calls).toEqual(['a']);
    upload.resumeUploads();
    // 并发 2、a 还在跑 → 恢复后只补一个空位
    expect(calls).toEqual(['a', 'b']);
    expect(upload.getQueuedCount()).toBe(1);
    hooks.get('a').onSuccess();
    expect(calls).toEqual(['a', 'b', 'c']);
  });

  it('没传 customRequest：暂停/继续无副作用', () => {
    const upload = new ICEUpload({ left: 0, top: 0, width: 300 });
    upload.pauseUploads();
    upload.addFile({ name: 'a', size: 10 });
    upload.resumeUploads();
    expect(upload.getQueuedCount()).toBe(0);
    expect(upload.isUploadsPaused()).toBe(false);
  });
});
