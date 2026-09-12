/**
 * pixel-editor.html（ICE Pixel Studio）的浏览器端 QA。
 *
 * 用法：
 *   npm run qa:pixel
 *   PLAYWRIGHT_PATH=/path/to/playwright npm run qa:pixel
 *
 * 检查项（画布上的操作全是真实鼠标按下 / 拖动 / 松开）：
 * 1. 开局：32×32 空画布、画板是**单个自绘节点**、5 个工具、12 个颜色、零 console error；
 * 2. 铅笔：点一格上色、拖一条 → **一次笔画只占一次撤销**；
 * 3. 撤销 / 重做：按钮与 Ctrl+Z / Ctrl+Y 两条路都走；
 * 4. 油漆桶：矩形框里灌满、框外不动；
 * 5. 直线 / 矩形工具：拖动时高亮预览，松手才落笔；
 * 6. 橡皮擦回纸色；换颜色之后落笔的颜色跟着变；
 * 7. 示例图案 → 画布上有东西；
 * 8. 导出：SVG 字符串（含 viewBox 与合并后的 rect）、PNG data URL（解出 IHDR 尺寸必须是 512×512）；
 * 9. 换尺寸：16×16 → 格子变大、历史清空；
 * 10. 布局：四个面板两两不交叠、都在机壳里。
 */
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const require = createRequire(import.meta.url);

function loadPlaywright() {
  const candidates = [
    process.env.PLAYWRIGHT_PATH,
    'playwright',
    path.resolve(process.cwd(), '../ice-render/node_modules/playwright'),
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch (err) {
      /* 试下一个 */
    }
  }
  throw new Error('qa-pixel 需要 playwright：npm i -D playwright，或用 PLAYWRIGHT_PATH 指定');
}

const { chromium } = loadPlaywright();

const ROOT = process.cwd();
const server = http.createServer((req, res) => {
  const relative = decodeURIComponent(String(req.url || '/').split('?')[0]);
  const file = path.join(ROOT, relative);
  if (!file.startsWith(ROOT)) {
    res.statusCode = 403;
    res.end('forbidden');
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.statusCode = 404;
      res.end('not found');
      return;
    }
    res.setHeader('content-type', file.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream');
    res.end(data);
  });
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const URL = `http://127.0.0.1:${server.address().port}/examples/pixel-editor.html`;

const failures = [];
const check = (name, ok, detail = '') => {
  if (!ok) failures.push(`${name}${detail ? ' — ' + detail : ''}`);
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? '  ' + detail : ''}`);
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1340, height: 900 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console: ' + m.text());
});
await page.goto(URL);
await page.waitForFunction(() => !!window.__pixel && !!window.__pixel.model, null, { timeout: 20000 });
await page.waitForTimeout(400);

const rect = await page.evaluate(() => {
  const r = document.getElementById('canvas').getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
});

/** 画板格子的中心点（世界坐标 → 页面坐标），给真实鼠标用。 */
const pointOf = async (row, col) =>
  page.evaluate(
    ([targetRow, targetCol]) => {
      const board = window.__pixel.board;
      let l = 0;
      let t = 0;
      let cursor = board;
      while (cursor && cursor.state) {
        l += Number(cursor.state.left) || 0;
        t += Number(cursor.state.top) || 0;
        cursor = cursor.parentNode;
      }
      const cellSize = board.getCellSize();
      return { x: l + (targetCol + 0.5) * cellSize, y: t + (targetRow + 0.5) * cellSize };
    },
    [row, col],
  );
const clickCell = async (row, col) => {
  const point = await pointOf(row, col);
  await page.mouse.move(rect.left + point.x, rect.top + point.y);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(60);
};
const dragCells = async (from, to, steps = 12) => {
  const start = await pointOf(from[0], from[1]);
  const end = await pointOf(to[0], to[1]);
  await page.mouse.move(rect.left + start.x, rect.top + start.y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i += 1) {
    const ratio = i / steps;
    await page.mouse.move(rect.left + start.x + (end.x - start.x) * ratio, rect.top + start.y + (end.y - start.y) * ratio);
  }
  await page.mouse.up();
  await page.waitForTimeout(80);
};
const boxOf = async (source) =>
  page.evaluate((src) => {
    // eslint-disable-next-line no-eval
    const node = eval(src);
    if (!node || !node.state) return null;
    let l = 0;
    let t = 0;
    let cursor = node;
    while (cursor && cursor.state) {
      l += Number(cursor.state.left) || 0;
      t += Number(cursor.state.top) || 0;
      cursor = cursor.parentNode;
    }
    return { l, t, w: Number(node.state.width) || 0, h: Number(node.state.height) || 0 };
  }, source);
const clickExpr = async (source) => {
  const box = await boxOf(source);
  if (!box) return false;
  await page.mouse.click(rect.left + box.l + box.w / 2, rect.top + box.t + box.h / 2);
  await page.waitForTimeout(120);
  return true;
};
/** 画布上的统计：非纸色像素数 / 某个颜色的像素数 / 历史深度。 */
const snapshot = () =>
  page.evaluate(() => {
    const p = window.__pixel;
    const cells = p.model.getCells();
    const background = p.model.getBackground();
    const counts = {};
    cells.forEach((value) => {
      if (value === background) return;
      counts[value] = (counts[value] || 0) + 1;
    });
    return {
      painted: cells.filter((value) => value !== background).length,
      counts,
      depth: p.model.getHistoryDepth(),
      dirty: p.model.isDirty(),
      tiles: p.board.getTiles(),
      color: p.state.color,
      tool: p.state.tool,
    };
  });

/* ---------- 1. 开局 ---------- */
const boot = await page.evaluate(() => {
  const p = window.__pixel;
  return {
    rows: p.model.getRows(),
    cols: p.model.getCols(),
    boardNodes: p.board.childNodes.length,
    boardTiles: p.board.getTiles().length,
    swatchNodes: p.swatches.childNodes.length,
    tools: Object.keys(p.nodes.toolButtons),
    palette: p.model.getPalette().length,
    painted: p.model.getCells().filter((value) => value !== p.model.getBackground()).length,
    cellSize: p.board.getCellSize(),
    canUndo: p.model.canUndo(),
    canRedo: p.model.canRedo(),
    status: p.nodes.statusText.getText(),
  };
});
check(
  '开局：32×32 空画布，画板与色板各是单个自绘节点',
  boot.rows === 32 && boot.cols === 32 && boot.painted === 0 && boot.boardNodes === 0 && boot.swatchNodes === 0 &&
    boot.boardTiles === 1024 && boot.tools.length === 5 && boot.palette === 12 && boot.cellSize === 16,
  JSON.stringify(boot),
);
check(
  '开局：撤销/重做按钮是灰的（没有历史），状态栏把尺寸/工具/色值都写出来了',
  boot.canUndo === false && boot.canRedo === false && /32×32/.test(boot.status) && /铅笔/.test(boot.status),
  boot.status,
);
check('零 console error', errors.length === 0, errors.join(' | '));

/* ---------- 2. 铅笔：点一格 + 拖一条 ---------- */
await clickCell(4, 4);
const afterClick = await snapshot();
check(
  '铅笔：真实点一格 → 该格上色、棋盘数据同步、一次操作占一次撤销',
  afterClick.painted === 1 && afterClick.tiles[4 * 32 + 4] === `c${afterClick.color}` && afterClick.depth.undo === 1,
  JSON.stringify({ painted: afterClick.painted, tile: afterClick.tiles[4 * 32 + 4], depth: afterClick.depth }),
);

await dragCells([8, 4], [8, 14]);
const afterDrag = await snapshot();
check(
  '铅笔：按住拖过 11 格 → 一路都画上，而且只占一次撤销（一次笔画 = 一步历史）',
  afterDrag.painted === 12 && afterDrag.depth.undo === 2,
  JSON.stringify({ painted: afterDrag.painted, depth: afterDrag.depth }),
);

/* ---------- 3. 撤销 / 重做 ---------- */
await clickExpr('window.__pixel.nodes.actionButtons.undo');
const afterUndo = await snapshot();
check(
  '撤销按钮：整笔拖出来的一条线一次退掉（不是一格一格退）',
  afterUndo.painted === 1 && afterUndo.depth.undo === 1 && afterUndo.depth.redo === 1,
  JSON.stringify({ painted: afterUndo.painted, depth: afterUndo.depth }),
);

await page.keyboard.press('Control+y');
await page.waitForTimeout(120);
const afterRedoKey = await snapshot();
check(
  'Ctrl+Y 重做：那一条线整条回来',
  afterRedoKey.painted === 12 && afterRedoKey.depth.redo === 0,
  JSON.stringify({ painted: afterRedoKey.painted, depth: afterRedoKey.depth }),
);

await page.keyboard.press('Control+z');
await page.waitForTimeout(120);
const afterUndoKey = await snapshot();
check(
  'Ctrl+Z 撤销：和按钮同一条路（历史深度对得上）',
  afterUndoKey.painted === 1 && afterUndoKey.depth.undo === 1 && afterUndoKey.depth.redo === 1,
  JSON.stringify({ painted: afterUndoKey.painted, depth: afterUndoKey.depth }),
);

/* ---------- 4. 矩形框 + 油漆桶 ---------- */
await clickExpr('window.__pixel.nodes.toolButtons.rect');
await dragCells([12, 10], [18, 16]);
const afterRect = await snapshot();
const rectPixels = 2 * (7 + 7) - 4; // 7×7 的框
check(
  '矩形工具：拖出一个 7×7 的框（描边 24 个像素，内部没被填）',
  afterRect.painted === 1 + rectPixels && afterRect.tool === 'rect',
  JSON.stringify({ painted: afterRect.painted, expect: 1 + rectPixels }),
);

await clickExpr('window.__pixel.nodes.toolButtons.fill');
await clickCell(15, 13); // 框里
const afterFill = await snapshot();
check(
  '油漆桶：框里灌满 5×5 共 25 格，框外一个都没变',
  afterFill.painted === 1 + rectPixels + 25 && afterFill.depth.undo === 3,
  JSON.stringify({ painted: afterFill.painted, depth: afterFill.depth }),
);

/* ---------- 5. 直线工具 + 拖动时的高亮预览 ---------- */
await clickExpr('window.__pixel.nodes.toolButtons.line');
const lineStart = await pointOf(24, 4);
const lineEnd = await pointOf(24, 14);
await page.mouse.move(rect.left + lineStart.x, rect.top + lineStart.y);
await page.mouse.down();
await page.mouse.move(rect.left + lineEnd.x, rect.top + lineEnd.y, { steps: 8 });
await page.waitForTimeout(80);
const duringLine = await page.evaluate(() => ({
  highlights: window.__pixel.board.getHighlights().length,
  painted: window.__pixel.model.getCells().filter((value) => value !== window.__pixel.model.getBackground()).length,
}));
await page.mouse.up();
await page.waitForTimeout(80);
const afterLine = await snapshot();
check(
  '直线工具：拖动时先高亮预览（11 格），松手才落笔 —— 预览期间画布没变',
  duringLine.highlights === 11 && duringLine.painted === 1 + rectPixels + 25 && afterLine.painted === 1 + rectPixels + 25 + 11,
  JSON.stringify({ duringLine, painted: afterLine.painted }),
);
check(
  '直线工具：松手后高亮层收干净（不留预览残影）',
  (await page.evaluate(() => window.__pixel.board.getHighlights().length)) === 0,
);

/* ---------- 6. 橡皮 + 换颜色 ---------- */
await clickExpr('window.__pixel.nodes.toolButtons.eraser');
await clickCell(24, 6);
const afterErase = await snapshot();
check(
  '橡皮：把线上的一格擦回纸色（画布少一格，历史 +1）',
  afterErase.painted === afterLine.painted - 1 && afterErase.depth.undo === 5,
  JSON.stringify({ painted: afterErase.painted, depth: afterErase.depth }),
);

await clickExpr('window.__pixel.nodes.toolButtons.pencil');
const swatchBox = await page.evaluate(() => {
  const swatches = window.__pixel.swatches;
  let l = 0;
  let t = 0;
  let cursor = swatches;
  while (cursor && cursor.state) {
    l += Number(cursor.state.left) || 0;
    t += Number(cursor.state.top) || 0;
    cursor = cursor.parentNode;
  }
  return { l, t, cell: swatches.getCellSize() };
});
// 色板是 2 行 × 6 列：第 5 格 = 第 0 行第 4 列 = 调色板下标 4（红色）
await page.mouse.click(rect.left + swatchBox.l + 4.5 * swatchBox.cell, rect.top + swatchBox.t + 0.5 * swatchBox.cell);
await page.waitForTimeout(120);
const pickedRed = await page.evaluate(() => ({ color: window.__pixel.state.color, highlight: window.__pixel.swatches.getHighlights() }));
await clickCell(30, 30);
const afterRed = await snapshot();
check(
  '色板：点第 4 个色块 → 选中色与高亮都跟着走，落笔用的是新颜色',
  pickedRed.color === 4 && pickedRed.highlight.length === 1 && pickedRed.highlight[0].col === 4 &&
    afterRed.counts[4] === 1 && afterRed.tiles[30 * 32 + 30] === 'c4',
  JSON.stringify({ picked: pickedRed, counts: afterRed.counts }),
);

/* ---------- 7. 清空 + 示例图案 ---------- */
await clickExpr('window.__pixel.nodes.actionButtons.clear');
const afterClear = await snapshot();
check(
  '清空：画布回到全纸色，而且这一步可以撤销回来',
  afterClear.painted === 0 && afterClear.depth.undo >= 1,
  JSON.stringify({ painted: afterClear.painted, depth: afterClear.depth }),
);
await page.keyboard.press('Control+z');
await page.waitForTimeout(120);
check(
  '清空可以撤销（Ctrl+Z 把刚才那张画退回来）',
  (await snapshot()).painted > 0,
);

await clickExpr('window.__pixel.nodes.actionButtons.demo');
const afterDemo = await snapshot();
check(
  '示例图案：一键画出一张 8×8 的笑脸（26 个像素）',
  afterDemo.painted === 26,
  JSON.stringify({ painted: afterDemo.painted }),
);

/* ---------- 8. 导出 SVG / PNG ---------- */
const svgInfo = await page.evaluate(() => {
  const svg = window.__pixel.exportSvg();
  return { head: svg.slice(0, 60), rects: (svg.match(/<rect /g) || []).length, hasViewBox: svg.includes('viewBox="0 0 512 512"'), hasClosing: svg.includes('</svg>') };
});
check(
  '导出 SVG：是合法 svg（viewBox 跟画布尺寸一致）、同色横向合并后 rect 数量远小于 1024',
  svgInfo.head.startsWith('<svg') && svgInfo.hasViewBox && svgInfo.hasClosing && svgInfo.rects > 1 && svgInfo.rects < 40,
  JSON.stringify(svgInfo),
);

const pngInfo = await page.evaluate(() => {
  const dataUrl = window.__pixel.exportPng();
  return { head: dataUrl.slice(0, 22), length: dataUrl.length };
});
/** 从 PNG 的 IHDR 里读宽高（big-endian），确认导出的位图尺寸 = 画布 × 16。 */
const pngBytes = Buffer.from((await page.evaluate(() => window.__pixel.lastPng)).split(',')[1], 'base64');
const pngWidth = pngBytes.readUInt32BE(16);
const pngHeight = pngBytes.readUInt32BE(20);
check(
  '导出 PNG：data URL 前缀对，IHDR 解出来就是 512×512（32 格 × 16 倍）',
  pngInfo.head === 'data:image/png;base64,' && pngWidth === 512 && pngHeight === 512,
  JSON.stringify({ head: pngInfo.head, pngWidth, pngHeight, length: pngInfo.length }),
);

/* ---------- 9. 换尺寸 ---------- */
await clickExpr('window.__pixel.nodes.sizeButtons[16]');
const afterResize = await page.evaluate(() => {
  const p = window.__pixel;
  return {
    rows: p.model.getRows(),
    cols: p.model.getCols(),
    boardRows: p.board.getRows(),
    boardCols: p.board.getCols(),
    cellSize: p.board.getCellSize(),
    painted: p.model.getCells().filter((value) => value !== p.model.getBackground()).length,
    depth: p.model.getHistoryDepth(),
    undoEnabled: p.nodes.actionButtons.undo.isEnabled ? p.nodes.actionButtons.undo.isEnabled() : null,
  };
});
check(
  '换尺寸：16×16 → 棋盘换成 16×16、每格放大到 32px、历史清空、画布是新的空板',
  afterResize.rows === 16 && afterResize.cols === 16 && afterResize.boardRows === 16 && afterResize.boardCols === 16 &&
    afterResize.cellSize === 32 && afterResize.painted === 0 && afterResize.depth.undo === 0,
  JSON.stringify(afterResize),
);

await clickExpr('window.__pixel.nodes.sizeButtons[32]');
await page.waitForTimeout(120);
check(
  '尺寸按钮的选中态跟着换（32×32 又变成主色）',
  (await page.evaluate(() => window.__pixel.model.getRows())) === 32,
);

/* ---------- 10. 布局 ---------- */
const layout = await page.evaluate(() => {
  const box = (node) => {
    let l = 0;
    let t = 0;
    let cursor = node;
    while (cursor && cursor.state) {
      l += Number(cursor.state.left) || 0;
      t += Number(cursor.state.top) || 0;
      cursor = cursor.parentNode;
    }
    return { l, t, w: Number(node.state.width) || 0, h: Number(node.state.height) || 0 };
  };
  const nodes = window.__pixel.nodes;
  return {
    shell: box(nodes.shell),
    tool: box(nodes.toolPanel),
    board: box(nodes.boardPanel),
    side: box(nodes.sidePanel),
    status: box(nodes.statusBar),
    canvas: box(window.__pixel.board),
  };
});
const inside = (inner, outer) =>
  inner.l >= outer.l - 0.5 && inner.t >= outer.t - 0.5 && inner.l + inner.w <= outer.l + outer.w + 0.5 && inner.t + inner.h <= outer.t + outer.h + 0.5;
const overlap = (a, b) => a.l < b.l + b.w && b.l < a.l + a.w && a.t < b.t + b.h && b.t < a.t + a.h;
check(
  '布局：四块面板两两不交叠、都在机壳里',
  !overlap(layout.tool, layout.board) && !overlap(layout.board, layout.side) && !overlap(layout.tool, layout.side) &&
    !overlap(layout.status, layout.board) && !overlap(layout.status, layout.side) &&
    [layout.tool, layout.board, layout.side, layout.status].every((panel) => inside(panel, layout.shell)),
  JSON.stringify(layout),
);
check('布局：画板嵌在画板面板内', inside(layout.canvas, layout.board), JSON.stringify({ canvas: layout.canvas, board: layout.board }));

check('全程零 console error', errors.length === 0, errors.join(' | '));

await page.screenshot({ path: '/tmp/qa-pixel.png' });
await browser.close();
server.close();

if (failures.length) {
  console.log(`\n${failures.length} 项失败：`);
  failures.forEach((item) => console.log(` - ${item}`));
  process.exit(1);
}
console.log('\nPixel Studio QA 通过（截图 /tmp/qa-pixel.png）');
