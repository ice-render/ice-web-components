/**
 * 上传中的文件行不许拖拽排序。
 *
 * 理由很实际：上传任务的顺序与列表顺序绑在一起时，拖动会让「进度条跟着谁走」变得含糊；
 * 更糟的是用户拖到一半上传完成，行会自己跳走。
 *
 * 规格：
 * - `status: 'uploading'` 的行拖不动；
 * - 已经拖起来之后该行转入上传中，落下也不重排；
 * - 完成 / 失败的行照常能拖。
 */
import { ICEUpload } from '../src/components/ICEUpload';

function setup(props: any = {}) {
  const reorders: any[] = [];
  const upload = new ICEUpload({
    left: 0,
    top: 0,
    width: 420,
    rowHeight: 32,
    draggable: true,
    onChange: () => {},
    onReorder: (files: any[]) => reorders.push(files.map((file: any) => file.name)),
    ...props,
  });
  return { upload, reorders };
}

describe('上传中禁止拖拽排序', () => {
  it('上传中的行拖不起来', () => {
    const { upload } = setup({ customRequest: () => {} });
    upload.addFile({ name: 'a.png', size: 10 });
    const uid = upload.getFileList()[0].uid;
    expect(upload.getFileStatus(uid)).toBe('uploading');
    (upload as any).__onRowDragStart(0);
    expect(upload.isRowDragging()).toBe(false);
  });

  it('拖起来之后该行转入上传中：落下也不重排', () => {
    const { upload, reorders } = setup();
    upload.addFile({ name: 'a.png', size: 10 });
    upload.addFile({ name: 'b.png', size: 10 });
    (upload as any).__onRowDragStart(0);
    expect(upload.isRowDragging()).toBe(true);
    (upload as any).files[0].status = 'uploading';
    (upload as any).__onRowDragMove(1);
    (upload as any).__onRowDragEnd();
    expect(reorders).toEqual([]);
    expect(upload.getFileList().map((file) => file.name)).toEqual(['a.png', 'b.png']);
  });

  it('完成的行照常能拖', () => {
    const hooks: any[] = [];
    const { upload, reorders } = setup({ customRequest: (_file: any, h: any) => hooks.push(h) });
    upload.addFile({ name: 'a.png', size: 10 });
    upload.addFile({ name: 'b.png', size: 10 });
    hooks[0].onSuccess();
    hooks[1].onSuccess();
    (upload as any).__onRowDragStart(0);
    (upload as any).__onRowDragMove(1);
    (upload as any).__onRowDragEnd();
    expect(reorders).toEqual([['b.png', 'a.png']]);
  });
});
