/**
 * 运行中调整并发数。
 *
 * 场景：用户一开始只敢开 1 个并发，发现网速够用想开到 3 —— 不该逼他刷新页面重选文件。
 *
 * 规格：
 * - `setUploadConcurrency(n)` 调大：**立刻**把排队的灌进空位；
 * - 调小：正在跑的**不打断**（半途掐断会留下脏数据），只是不再补新的；
 * - 并发数至少是 1（传 0 / 负数按 1 处理）。
 */
import { ICEUpload } from '../src/components/ICEUpload';

function setup(props: any = {}) {
  const calls: string[] = [];
  const upload = new ICEUpload({
    left: 0,
    top: 0,
    width: 420,
    onChange: () => {},
    customRequest: (file: any) => {
      calls.push(file.name);
    },
    ...props,
  });
  return { upload, calls };
}

const addMany = (upload: ICEUpload, names: string[]) => names.forEach((name) => upload.addFile({ name, size: 10 }));

describe('运行中调整上传并发', () => {
  it('调大并发：排队的立刻补进空位', () => {
    const { upload, calls } = setup();
    addMany(upload, ['a', 'b', 'c', 'd']);
    expect(calls).toEqual(['a']);
    expect(upload.getQueuedCount()).toBe(3);
    upload.setUploadConcurrency(3);
    expect(upload.getConcurrency()).toBe(3);
    expect(calls).toEqual(['a', 'b', 'c']);
    expect(upload.getQueuedCount()).toBe(1);
  });

  it('调小并发：正在跑的不打断，只是不再补新的', () => {
    const { upload, calls } = setup({ uploadConcurrency: 3 });
    addMany(upload, ['a', 'b', 'c', 'd']);
    expect(calls).toEqual(['a', 'b', 'c']);
    upload.setUploadConcurrency(1);
    // 已经跑起来的三个不受影响
    expect(calls).toEqual(['a', 'b', 'c']);
    expect(upload.getQueuedCount()).toBe(1);
    expect(upload.getFileStatus(upload.getFileList()[0].uid)).toBe('uploading');
  });

  it('并发数至少是 1', () => {
    const { upload } = setup();
    upload.setUploadConcurrency(0);
    expect(upload.getConcurrency()).toBe(1);
    upload.setUploadConcurrency(-5);
    expect(upload.getConcurrency()).toBe(1);
  });
});
