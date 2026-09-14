/**
 * Upload 文件列表的拖拽排序。
 *
 * 规格：
 * - `draggable: true` 时按住文件行上下拖，松手换顺序；
 * - `onReorder(files, from, to)` 回调；顺序变了才回调；
 * - 不传 draggable 时拖不动（老行为）；拖回原地不算排序。
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
    onReorder: (files: any[], from: number, to: number) =>
      reorders.push([files.map((file: any) => file.name), from, to]),
    ...props,
  });
  return { upload, reorders };
}

const add = (upload: ICEUpload, names: string[]) => names.forEach((name) => upload.addFile({ name, size: 10 }));

describe('ICEUpload 列表拖拽排序', () => {
  it('拖第一行到第三行：顺序真的变了并回调', () => {
    const { upload, reorders } = setup();
    add(upload, ['a.png', 'b.png', 'c.png']);
    (upload as any).__onRowDragStart(0);
    expect(upload.isRowDragging()).toBe(true);
    (upload as any).__onRowDragMove(2);
    (upload as any).__onRowDragEnd();
    expect(upload.getFileList().map((file) => file.name)).toEqual(['b.png', 'c.png', 'a.png']);
    expect(reorders).toEqual([[['b.png', 'c.png', 'a.png'], 0, 2]]);
    expect(upload.isRowDragging()).toBe(false);
  });

  it('拖回原地不算排序（不回调）', () => {
    const { upload, reorders } = setup();
    add(upload, ['a.png', 'b.png']);
    (upload as any).__onRowDragStart(1);
    (upload as any).__onRowDragMove(1);
    (upload as any).__onRowDragEnd();
    expect(upload.getFileList().map((file) => file.name)).toEqual(['a.png', 'b.png']);
    expect(reorders).toEqual([]);
  });

  it('落点越界会被夹住（0 与最后一行）', () => {
    const { upload } = setup();
    add(upload, ['a.png', 'b.png', 'c.png']);
    (upload as any).__onRowDragStart(2);
    (upload as any).__onRowDragMove(99);
    (upload as any).__onRowDragEnd();
    expect(upload.getFileList().map((file) => file.name)).toEqual(['a.png', 'b.png', 'c.png']);
    (upload as any).__onRowDragStart(2);
    (upload as any).__onRowDragMove(-5);
    (upload as any).__onRowDragEnd();
    expect(upload.getFileList().map((file) => file.name)).toEqual(['c.png', 'a.png', 'b.png']);
  });

  it('不传 draggable 时拖不动（老行为）', () => {
    const { upload, reorders } = setup({ draggable: false });
    add(upload, ['a.png', 'b.png']);
    (upload as any).__onRowDragStart(0);
    expect(upload.isRowDragging()).toBe(false);
    (upload as any).__onRowDragMove(1);
    (upload as any).__onRowDragEnd();
    expect(reorders).toEqual([]);
    expect(upload.getFileList().map((file) => file.name)).toEqual(['a.png', 'b.png']);
  });
});
