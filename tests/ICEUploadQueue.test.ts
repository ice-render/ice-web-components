/**
 * 上传队列：并发数 + 顺序跟着列表走。
 *
 * 之前 `customRequest` 是「加一个就立刻传一个」的散兵游勇：选 20 个文件就是 20 个并发，
 * 浏览器和服务器都吃不消；而且用户拖了顺序，队列也不会跟着变。
 *
 * 规格：
 * - `uploadConcurrency`（默认 1）：同时在跑的只有这么多，其余是「排队中」；
 * - 有人完成/失败就按**当前列表顺序**启动下一个；
 * - 拖拽换序后，下一个启动的是新顺序里的那个（顺序真的同步回队列）；
 * - 删掉排队中的文件，它不会被启动；
 * - 没传 `customRequest` 时一切照旧（只是加进列表）。
 */
import { ICEUpload } from '../src/components/ICEUpload';

function setup(props: any = {}) {
  const calls: string[] = [];
  const hooks = new Map<string, any>();
  const upload = new ICEUpload({
    left: 0,
    top: 0,
    width: 420,
    rowHeight: 32,
    draggable: true,
    onChange: () => {},
    customRequest: (file: any, h: any) => {
      calls.push(file.name);
      hooks.set(file.name, h);
    },
    ...props,
  });
  return { upload, calls, hooks };
}

describe('上传队列', () => {
  it('并发 1（默认）：只有第一个在传，其余排队', () => {
    const { upload, calls } = setup();
    upload.addFile({ name: 'a.png', size: 10 });
    upload.addFile({ name: 'b.png', size: 10 });
    upload.addFile({ name: 'c.png', size: 10 });
    expect(calls).toEqual(['a.png']);
    expect(upload.getFileStatus(upload.getFileList()[0].uid)).toBe('uploading');
    expect(upload.getFileStatus(upload.getFileList()[1].uid)).toBe('pending');
    expect(upload.getQueuedCount()).toBe(2);
  });

  it('完成一个就按列表顺序启动下一个', () => {
    const { upload, calls, hooks } = setup();
    upload.addFile({ name: 'a.png', size: 10 });
    upload.addFile({ name: 'b.png', size: 10 });
    hooks.get('a.png').onSuccess();
    expect(calls).toEqual(['a.png', 'b.png']);
    expect(upload.getFileStatus(upload.getFileList()[0].uid)).toBe('done');
    expect(upload.getFileStatus(upload.getFileList()[1].uid)).toBe('uploading');
  });

  it('并发 2：同时跑两个', () => {
    const { upload, calls } = setup({ uploadConcurrency: 2 });
    upload.addFile({ name: 'a.png', size: 10 });
    upload.addFile({ name: 'b.png', size: 10 });
    upload.addFile({ name: 'c.png', size: 10 });
    expect(calls).toEqual(['a.png', 'b.png']);
    expect(upload.getQueuedCount()).toBe(1);
  });

  it('拖拽换序后：下一个启动的是新顺序里的那个', () => {
    const { upload, calls, hooks } = setup();
    upload.addFile({ name: 'a.png', size: 10 });
    upload.addFile({ name: 'b.png', size: 10 });
    (upload as any).__onRowDragStart(1);
    (upload as any).__onRowDragMove(0);
    (upload as any).__onRowDragEnd();
    expect(upload.getFileList().map((file) => file.name)).toEqual(['b.png', 'a.png']);
    hooks.get('a.png').onSuccess();
    expect(calls).toEqual(['a.png', 'b.png']);
  });

  it('删掉排队中的文件：它不会被启动', () => {
    const { upload, calls, hooks } = setup();
    upload.addFile({ name: 'a.png', size: 10 });
    upload.addFile({ name: 'b.png', size: 10 });
    upload.removeFile(upload.getFileList()[1].uid);
    hooks.get('a.png').onSuccess();
    expect(calls).toEqual(['a.png']);
    expect(upload.getQueuedCount()).toBe(0);
  });

  it('没传 customRequest：没有队列的概念（老行为）', () => {
    const upload = new ICEUpload({ left: 0, top: 0, width: 300 });
    upload.addFile({ name: 'a.png', size: 10 });
    expect(upload.getFileStatus(upload.getFileList()[0].uid)).toBe(null);
    expect(upload.getQueuedCount()).toBe(0);
  });
});
