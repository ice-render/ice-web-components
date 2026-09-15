/**
 * 派生排列迁到引擎布局器之后的**几何不变量**（2026-09-15 第二批）。
 *
 * 这十一个组件原来在 `__render()` 里手写 `left/top`，现在排布交给
 * `ICEBoxLayout` / `ICEGridLayout` / `ICEFlowLayout`。迁移的验收口径是
 * **坐标与历史手写版逐项一致**（不是"看起来差不多"）—— 这些位置一旦漂了，
 * 用户看到的不是报错而是"行错位 / 文字压在一起 / 点不中"。
 *
 * 每个断言都按**历史公式**算期望值（`index × 行高`、`padding + col × (格 + 缝)` …），
 * 所以它同时钉住了「布局器算出来的」和「以前手算的」是同一套数。
 */
import { ICERate } from '../src/components/ICERate';
import { ICEBreadcrumb } from '../src/components/ICEBreadcrumb';
import { ICEAnchor } from '../src/components/ICEAnchor';
import { ICEColorPicker } from '../src/components/ICEColorPicker';
import { ICEFormList } from '../src/components/ICEFormList';
import { ICEUpload } from '../src/components/ICEUpload';
import { ICETimeline } from '../src/components/ICETimeline';
import { ICEDescriptions } from '../src/components/ICEDescriptions';
import { ICEResult } from '../src/components/ICEResult';
import { ICESteps } from '../src/components/ICESteps';
import { ICELabel } from '../src/components/ICELabel';

describe('派生排列迁移：坐标与历史手写版一致', () => {
  it('ICERate：星星按 `(size + 4)` 节距排（命中反查用同一节距）', () => {
    const rate = new ICERate({ count: 4, size: 24 });
    const stars = rate.getStarNodes();
    expect(stars.map((star) => star.state.left)).toEqual([0, 28, 56, 84]);
    expect(stars.every((star) => star.state.top === 0)).toBe(true);
    expect(stars[0].state.width).toBe(24);
  });

  it('ICEBreadcrumb：项 + 分隔符按 `gap` 串起来', () => {
    const crumb = new ICEBreadcrumb({ items: [{ label: '首页' }, { label: '订单' }, { label: '详情' }], fontSize: 13 });
    const items = crumb.getItemNodes();
    const seps = crumb.getSeparatorNodes();
    const gap = 8; // theme.spacing.xs
    const widths = items.map((node) => node.state.width);
    expect(items[0].state.left).toBe(0);
    expect(seps[0].state.left).toBe(widths[0] + gap);
    expect(items[1].state.left).toBe(widths[0] + gap * 2 + seps[0].state.width);
    expect(seps[1].state.left).toBe(items[1].state.left + widths[1] + gap);
    expect(items[2].state.left).toBe(items[1].state.left + widths[1] + gap * 2 + seps[1].state.width);
    // 宽度自适应：内容总宽 = 最后一项右边界
    expect(crumb.state.width).toBe(items[2].state.left + widths[2]);
  });

  it('ICEAnchor：条目行距 = itemHeight、左边界 0、行宽 = 容器宽', () => {
    const anchor = new ICEAnchor({
      width: 160,
      itemHeight: 32,
      target: null,
      items: [
        { key: 'a', label: 'A', top: 0 },
        { key: 'b', label: 'B', top: 100 },
        { key: 'c', label: 'C', top: 200 },
      ],
    });
    const rows = ['a', 'b', 'c'].map((key) => anchor.getItemNode(key)!);
    expect(rows.map((row) => row.state.top)).toEqual([0, 32, 64]);
    expect(rows.every((row) => row.state.left === 0 && row.state.width === 160)).toBe(true);
  });

  it('ICEColorPicker：色板按 `padding + col × (格 + 缝)` 铺网格', () => {
    const picker = new ICEColorPicker({
      colors: ['#111111', '#222222', '#333333', '#444444', '#555555'],
      columns: 3,
      gap: 6,
      swatchSize: 28,
    });
    const cells = picker.getSwatchNodes();
    const size = 28;
    const gap = 6;
    const padding = 8;
    const expected = cells.map((_cell, index) => ({
      left: padding + (index % 3) * (size + gap),
      top: padding + Math.floor(index / 3) * (size + gap),
    }));
    expect(cells.map((cell) => ({ left: cell.state.left, top: cell.state.top }))).toEqual(expected);
  });

  it('ICEFormList：行距 = rowHeight + gap，底部「添加」按钮在最后一行下方一个 gap', () => {
    const list = new ICEFormList({
      width: 300,
      rowHeight: 36,
      gap: 8,
      initialRows: [{ name: 'A' }, { name: 'B' }],
      renderRow: (row: any) => new ICELabel({ text: String(row.name), height: 36 }),
    });
    const rows = [0, 1].map((index) => list.getRowNode(index)!);
    expect(rows.map((row) => row.state.top)).toEqual([0, 44]);
    expect(rows.every((row) => row.state.left === 0 && row.state.width === 300)).toBe(true);
    expect(list.getAddButton()!.state.top).toBe(2 * 36 + 1 * 8 + 8);
  });

  it('ICEUpload：文件行从上传区下方起、行距 = rowHeight（行宿主承载）', () => {
    const upload = new ICEUpload({ width: 420, rowHeight: 28 });
    upload.addFile({ name: 'a.png' });
    upload.addFile({ name: 'b.png' });
    const rows = upload.getFileList().map((file) => upload.getFileNode(file.uid)!);
    const host = rows[0].parentNode as any;
    expect(rows[1].parentNode).toBe(host);
    expect(host.state.top).toBe(96); // DROP_ZONE_HEIGHT
    expect(rows.map((row) => row.state.top)).toEqual([0, 28]);
    expect(rows.every((row) => row.state.width === 420)).toBe(true);
  });

  it('ICETimeline：条目行距 = itemHeight，竖线与圆点是行内装饰', () => {
    const timeline = new ICETimeline({
      items: [{ title: '一' }, { title: '二' }, { title: '三' }],
      itemHeight: 44,
    });
    const rows = timeline.getItemNodes();
    expect(rows.map((row) => row.state.top)).toEqual([0, 44, 88]);
    // 行内装饰：竖线（16 起、到下一行里 8px）+ 圆点（6 起）
    const first = rows[0].childNodes as any[];
    expect([first[0].state.left, first[0].state.top, first[0].state.height]).toEqual([6, 16, 36]);
    expect([first[1].state.left, first[1].state.top]).toEqual([3, 6]);
    // 最后一行不画竖线：子节点比前面少一个（只剩圆点 + 文字）
    expect(first.length).toBe(3);
    expect((rows[2].childNodes as any[]).length).toBe(2);
  });

  it('ICEDescriptions：格子 = `col × 列宽 + 12` / `4 + line × itemHeight`，格宽 = 列宽 − 24', () => {
    const width = 400;
    const descriptions = new ICEDescriptions({
      width,
      column: 2,
      itemHeight: 24,
      items: [
        { label: 'A', value: '1' },
        { label: 'B', value: '2' },
        { label: 'C', value: '3' },
      ],
    });
    const cells = descriptions.getRowNodes();
    const columnWidth = width / 2;
    expect(cells.map((cell) => ({ left: cell.state.left, top: cell.state.top }))).toEqual([
      { left: 12, top: 4 },
      { left: 12 + columnWidth, top: 4 },
      { left: 12, top: 4 + 24 },
    ]);
    expect(cells[0].state.width).toBe(columnWidth - 24);
  });

  it('ICEResult：动作按钮整行居中（间距 = 12）', () => {
    const width = 400;
    const result = new ICEResult({
      width,
      height: 200,
      actions: [
        { key: 'a', text: '返回' },
        { key: 'b', text: '重试' },
      ],
    });
    const buttons = ['a', 'b'].map((key) => result.getActionButton(key)!);
    const row = buttons[0].parentNode as any;
    const total = 110 * 2 + 12;
    expect(buttons[0].state.left).toBe((width - total) / 2);
    expect(buttons[1].state.left).toBe((width - total) / 2 + 110 + 12);
    expect(buttons[0].state.top).toBe(0);
    expect(row.state.top).toBe(Math.max(110, 200 / 2 + 26));
  });

  it('ICESteps：步骤槽 = `index × (width / 步数)`、槽宽 = 槽距 − 8', () => {
    const width = 420;
    const steps = new ICESteps({ width, items: [{ title: '一' }, { title: '二' }, { title: '三' }] });
    const nodes = [0, 1, 2].map((index) => steps.getStepNode(index)!);
    const slot = width / 3;
    expect(nodes.map((node) => node.state.left)).toEqual([0, slot, slot * 2]);
    expect(nodes.every((node) => node.state.width === slot - 8 && node.state.top === 0)).toBe(true);
  });

});
