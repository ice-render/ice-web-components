/**
 * ICEUpload 的「把文件从桌面拖进画布」。
 *
 * 规格：
 * - 组件挂上场景后，在画布元素上注册 `dragover` / `dragleave` / `drop`；
 * - 拖到拖拽区上方 → `isDragOver()` 为真（有高亮反馈），离开或落下后复位；
 * - 落下时逐个文件走 `addFile`（accept / maxSize / maxCount 校验照旧生效）；
 * - 落在区域外不添加；组件被禁用时不响应；
 * - 没有画布元素 / 没有 DOM 时静默跳过（老引擎、node 环境不炸）。
 */
import { ICEUpload } from '../src/components/ICEUpload';

function makeICE() {
  const listeners: Record<string, any[]> = {};
  const canvas: any = {
    getBoundingClientRect: () => ({ left: 100, top: 50, width: 800, height: 600 }),
    addEventListener: (name: string, handler: any) => {
      (listeners[name] = listeners[name] || []).push(handler);
    },
    removeEventListener: (name: string, handler: any) => {
      listeners[name] = (listeners[name] || []).filter((item) => item !== handler);
    },
    __fire: (name: string, evt: any) => (listeners[name] || []).forEach((handler) => handler(evt)),
    __listeners: listeners,
  };
  const ice: any = {
    canvas,
    canvasWidth: 800,
    canvasHeight: 600,
    toolNodes: [],
    dirty: false,
    evtBus: { on() {}, off() {}, trigger() {} },
    addTool: () => {},
    removeTool: () => {},
    screenToWorld: (x: number, y: number) => [x, y],
    getRenderViewport: () => ({ scale: 1, tx: 0, ty: 0 }),
    setFocusedComponent: () => {},
    getFocusedComponent: () => null,
  };
  return { ice, canvas };
}

function setup(props: any = {}) {
  const { ice, canvas } = makeICE();
  const upload = new ICEUpload({ left: 0, top: 0, width: 420, onChange: () => {}, ...props });
  (upload as any).ice = ice;
  (upload as any).afterAddHandler();
  return { upload, canvas };
}

const dragEvent = (clientX: number, clientY: number, files: any[] = []) => {
  const evt: any = { clientX, clientY, dataTransfer: { files, types: ['Files'] }, preventDefault() {}, stopPropagation() {} };
  return evt;
};

describe('ICEUpload 拖放', () => {
  it('挂上画布后注册 drag / drop 监听', () => {
    const { canvas } = setup();
    expect(typeof canvas.__listeners.dragover?.[0]).toBe('function');
    expect(typeof canvas.__listeners.drop?.[0]).toBe('function');
    expect(typeof canvas.__listeners.dragleave?.[0]).toBe('function');
  });

  it('拖到拖拽区上方高亮，离开后复位', () => {
    const { upload, canvas } = setup();
    expect(upload.isDragOver()).toBe(false);
    canvas.__fire('dragover', dragEvent(150, 90));
    expect(upload.isDragOver()).toBe(true);
    canvas.__fire('dragleave', dragEvent(150, 90));
    expect(upload.isDragOver()).toBe(false);
  });

  it('落下文件逐个走 addFile（校验照旧）', () => {
    const { upload, canvas } = setup({ maxSize: 4096 });
    const files = [
      { name: 'ok.png', size: 1024 },
      { name: 'big.zip', size: 999999 },
    ];
    canvas.__fire('drop', dragEvent(150, 90, files));
    expect(upload.getFileList().map((file) => file.name)).toEqual(['ok.png']);
    expect(upload.getLastRejectReason()).toContain('big.zip');
    expect(upload.isDragOver()).toBe(false);
  });

  it('落在拖拽区外不添加', () => {
    const { upload, canvas } = setup();
    canvas.__fire('drop', dragEvent(700, 500, [{ name: 'x.png', size: 10 }]));
    expect(upload.getFileList().length).toBe(0);
  });

  it('禁用时不响应拖放', () => {
    const { upload, canvas } = setup({ disabled: true });
    canvas.__fire('dragover', dragEvent(150, 90));
    expect(upload.isDragOver()).toBe(false);
    canvas.__fire('drop', dragEvent(150, 90, [{ name: 'x.png', size: 10 }]));
    expect(upload.getFileList().length).toBe(0);
  });

  it('没有画布元素时静默跳过（不炸）', () => {
    const upload = new ICEUpload({ left: 0, top: 0, width: 200 });
    (upload as any).ice = { canvasWidth: 100, canvasHeight: 100, evtBus: { on() {}, off() {} } };
    expect(() => (upload as any).afterAddHandler()).not.toThrow();
    expect(upload.isDragOver()).toBe(false);
  });
});
