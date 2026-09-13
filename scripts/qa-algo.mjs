/**
 * algorithm-sandbox.html（ICE Algorithm Sandbox）的浏览器端 QA。
 *
 * 用法：
 *   npm run qa:algo
 *   PLAYWRIGHT_PATH=/path/to/playwright npm run qa:algo
 *
 * 检查项（回放控制是真键盘 / 真鼠标）：
 * 1. 开局：排序模式、24 根柱子画在一张自绘网格上、轨迹已录好、统计面板写对；
 * 2. 回放：播放前进、到末尾自动停、单步 → 与 ←、空格播放/暂停；
 * 3. 切算法：换成快速排序后轨迹帧数与算法名跟着换，最后一帧真的升序；
 * 4. 寻路模式：切过去换成迷宫网格、A* 访问的格子比 BFS 少、真实鼠标拖动画墙；
 * 5. 布局：四块面板两两不交叠、都在机壳里。
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
  throw new Error('qa-algo 需要 playwright：npm i -D playwright，或用 PLAYWRIGHT_PATH 指定');
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
const URL = `http://127.0.0.1:${server.address().port}/examples/algorithm-sandbox.html`;

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
await page.waitForFunction(() => !!window.__algo && !!window.__algo.player, null, { timeout: 20000 });
await page.waitForTimeout(300);

const rect = await page.evaluate(() => {
  const r = document.getElementById('canvas').getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
});
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

/* ---------- 1. 开局 ---------- */
const boot = await page.evaluate(() => {
  const algo = window.__algo;
  const bars = algo.nodes.bars;
  return {
    mode: algo.state.mode,
    algorithm: algo.state.algorithm,
    frames: algo.player.getFrameCount(),
    index: algo.player.getIndex(),
    playing: algo.player.isPlaying(),
    barNodes: bars ? bars.childNodes.length : -1,
    barCols: bars ? bars.getCols() : -1,
    barRows: bars ? bars.getRows() : -1,
    litCells: bars ? bars.getTiles().filter(Boolean).length : -1,
    algorithmText: algo.nodes.statLabels.algorithm.getText(),
    complexity: algo.nodes.statLabels.complexity.getText(),
    stepText: algo.nodes.statLabels.step.getText(),
  };
});
check(
  '开局：默认排序模式，柱子画在单节点自绘网格上，轨迹已经录好',
  boot.mode === 'sort' && boot.algorithm === 'bubble' && boot.frames > 100 && boot.index === 0 && boot.playing === false &&
    boot.barNodes === 0 && boot.barCols === 24 && boot.barRows === 32 && boot.litCells > 24,
  JSON.stringify(boot),
);
check(
  '开局：统计面板写明算法 / 复杂度 / 进度帧号',
  boot.algorithmText === '冒泡排序' && boot.complexity === 'O(n²)' && /\/ \d+ 帧/.test(boot.stepText),
  JSON.stringify({ algorithmText: boot.algorithmText, complexity: boot.complexity, stepText: boot.stepText }),
);
check('零 console error', errors.length === 0, errors.join(' | '));

/* ---------- 2. 回放控制 ---------- */
await clickExpr('window.__algo.nodes.replayButtons.play');
await page.waitForTimeout(400);
const playing = await page.evaluate(() => ({ index: window.__algo.player.getIndex(), playing: window.__algo.player.isPlaying() }));
check('播放：点「播放」之后帧真的往前走', playing.index > 0 && playing.playing === true, JSON.stringify(playing));

await clickExpr('window.__algo.nodes.replayButtons.play'); // 暂停
const paused = await page.evaluate(() => ({ index: window.__algo.player.getIndex(), playing: window.__algo.player.isPlaying() }));
await page.waitForTimeout(250);
const stillPaused = await page.evaluate(() => window.__algo.player.getIndex());
check('暂停：暂停之后帧不再前进', paused.playing === false && stillPaused === paused.index, JSON.stringify({ paused, stillPaused }));

await clickExpr('window.__algo.nodes.replayButtons.step');
const afterStep = await page.evaluate(() => window.__algo.player.getIndex());
await clickExpr('window.__algo.nodes.replayButtons.stepBack');
const afterBack = await page.evaluate(() => window.__algo.player.getIndex());
check('单步：→ 前进一帧、← 后退一帧（回到原位）', afterStep === paused.index + 1 && afterBack === paused.index, `${paused.index} → ${afterStep} → ${afterBack}`);

// 空格是「没有焦点控件时」的全局播放快捷键；先点一下画布空白处把焦点清掉
await page.mouse.click(rect.left + 1200, rect.top + 60);
await page.waitForTimeout(100);
const focusCleared = await page.evaluate(() => window.__algo.W.getICEFocusManager(window.__algo.ice).getFocused());
await page.keyboard.press(' ');
await page.waitForTimeout(300);
const spacePlay = await page.evaluate(() => window.__algo.player.isPlaying());
await page.keyboard.press(' ');
await page.waitForTimeout(150);
const spacePause = await page.evaluate(() => window.__algo.player.isPlaying());
check(
  '空格键：点空白处清掉焦点后，真键盘按空格 = 播放 / 再按 = 暂停',
  focusCleared === null && spacePlay === true && spacePause === false,
  JSON.stringify({ focusCleared: !!focusCleared, spacePlay, spacePause }),
);

/* ---------- 3. 跑到底 + 切算法 ---------- */
await page.evaluate(() => {
  const player = window.__algo.player;
  player.seek(player.getFrameCount() - 1);
});
await page.waitForTimeout(150);
const finished = await page.evaluate(() => {
  const player = window.__algo.player;
  const frame = player.getFrame();
  const sorted = frame.values.every((value, index) => index === 0 || frame.values[index - 1] <= value);
  return { finished: player.isFinished(), sorted, note: frame.note, bars: window.__algo.nodes.bars.getTiles().filter(Boolean).length };
});
check(
  '跑到底：最后一帧的柱子是升序、状态是「已结束」',
  finished.finished === true && finished.sorted === true && finished.note.indexOf('排序完成') !== -1,
  JSON.stringify(finished),
);

await clickExpr('window.__algo.nodes.algoButtons.quick');
await page.waitForTimeout(250);
const switched = await page.evaluate(() => {
  const player = window.__algo.player;
  return {
    algorithm: window.__algo.state.algorithm,
    frames: player.getFrameCount(),
    index: player.getIndex(),
    label: window.__algo.nodes.statLabels.algorithm.getText(),
    complexity: window.__algo.nodes.statLabels.complexity.getText(),
  };
});
check(
  '切算法：点「快速排序」→ 轨迹重录（帧号归零、算法名与复杂度换掉）',
  switched.algorithm === 'quick' && switched.index === 0 && switched.frames !== boot.frames &&
    switched.label === '快速排序' && switched.complexity === 'O(n log n)',
  JSON.stringify(switched),
);

/* ---------- 4. 寻路模式 ---------- */
await clickExpr('window.__algo.nodes.modeButtons.maze');
await page.waitForFunction(() => window.__algo && window.__algo.player.getFrameCount() > 10, null, { timeout: 5000 });
const mazeBoot = await page.evaluate(() => {
  const algo = window.__algo;
  const maze = algo.nodes.maze;
  return {
    mode: algo.state.mode,
    nodes: maze ? maze.childNodes.length : -1,
    rows: maze ? maze.getRows() : -1,
    cols: maze ? maze.getCols() : -1,
    frames: algo.player.getFrameCount(),
    walls: algo.mazeModel.getCells().filter((value) => value === 1).length,
    label: algo.nodes.statLabels.algorithm.getText(),
    note: algo.nodes.statLabels.complexity.getText(),
  };
});
check(
  '寻路：切到迷宫模式（单节点网格 16×24、随机墙已撒、轨迹重录）',
  mazeBoot.mode === 'maze' && mazeBoot.nodes === 0 && mazeBoot.rows === 16 && mazeBoot.cols === 24 &&
    mazeBoot.frames > 10 && mazeBoot.walls > 10 && mazeBoot.label === '广度优先 BFS',
  JSON.stringify(mazeBoot),
);

const visitCompare = await page.evaluate(() => {
  const algo = window.__algo;
  const maze = algo.mazeModel;
  // 先用一个**确定**的迷宫（清空 + 一堵带缺口的竖墙）比较，别拿随机墙去比 ——
  // 终点偶尔会被随机墙围死，那时候所有算法都只能访问全图，比较就失去意义了
  maze.clearWalls();
  for (let row = 0; row < 12; row += 1) maze.setWall(row, 12, true);
  const bfs = maze.solve('bfs');
  const astar = maze.solve('astar');
  const last = (frames) => frames[frames.length - 1];
  return {
    bfsVisited: last(bfs).visitedCount,
    astarVisited: last(astar).visitedCount,
    bfsPath: last(bfs).path.length,
    astarPath: last(astar).path.length,
    reached: last(astar).reached,
  };
});
check(
  '寻路：A* 与 BFS 给同一条最短路，但 A* 访问的格子更少（启发式真的省事）',
  visitCompare.reached === true && visitCompare.astarVisited < visitCompare.bfsVisited && visitCompare.astarPath === visitCompare.bfsPath,
  JSON.stringify(visitCompare),
);

// 真实鼠标：在迷宫上拖一条墙出来
const mouseWalls = await boxOf('window.__algo.nodes.maze');
/** 找一段确定是空地的横条，从这里拖 —— 起点落在墙上会变成「擦墙」，墙数反而变少。 */
const dragPlan = await page.evaluate(() => {
  const maze = window.__algo.mazeModel;
  const cellSize = window.__algo.nodes.maze.getCellSize();
  for (let row = 2; row < maze.getRows() - 2; row += 1) {
    for (let col = 2; col < maze.getCols() - 5; col += 1) {
      let clear = true;
      for (let offset = 0; offset < 4; offset += 1) {
        if (maze.isWall(row, col + offset)) clear = false;
      }
      if (clear) return { row, col, cellSize };
    }
  }
  return null;
});
const before = await page.evaluate(() => window.__algo.mazeModel.getCells().filter((value) => value === 1).length);
const startX = mouseWalls.l + (dragPlan.col + 0.5) * dragPlan.cellSize;
const startY = mouseWalls.t + (dragPlan.row + 0.5) * dragPlan.cellSize;
await page.mouse.move(rect.left + startX, rect.top + startY);
await page.mouse.down();
await page.mouse.move(rect.left + startX + dragPlan.cellSize * 3, rect.top + startY, { steps: 10 });
await page.mouse.up();
await page.waitForTimeout(150);
const after = await page.evaluate((plan) => {
  const maze = window.__algo.mazeModel;
  const painted = [0, 1, 2, 3].filter((offset) => maze.isWall(plan.row, plan.col + offset)).length;
  return { walls: maze.getCells().filter((value) => value === 1).length, frames: window.__algo.player.getFrameCount(), painted };
}, dragPlan);
check(
  '寻路：真实鼠标在空地上拖动 = 画墙（拖过的格子都成了墙，之前的轨迹作废）',
  after.painted >= 3 && after.walls > before && after.frames === 0,
  JSON.stringify({ before, after, dragPlan }),
);

/* ---------- 5. 布局 ---------- */
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
  const nodes = window.__algo.nodes;
  return {
    shell: box(nodes.shell),
    left: box(nodes.sideLeft),
    stage: box(nodes.stage),
    right: box(nodes.sideRight),
    status: box(nodes.statusBar),
    maze: nodes.maze ? box(nodes.maze) : null,
  };
});
const inside = (inner, outer) =>
  inner.l >= outer.l - 0.5 && inner.t >= outer.t - 0.5 && inner.l + inner.w <= outer.l + outer.w + 0.5 && inner.t + inner.h <= outer.t + outer.h + 0.5;
const overlap = (a, b) => a.l < b.l + b.w && b.l < a.l + a.w && a.t < b.t + b.h && b.t < a.t + a.h;
check(
  '布局：四块面板两两不交叠、都在机壳里，迷宫嵌在舞台内',
  !overlap(layout.left, layout.stage) && !overlap(layout.stage, layout.right) && !overlap(layout.left, layout.right) &&
    !overlap(layout.status, layout.stage) && !overlap(layout.status, layout.right) &&
    [layout.left, layout.stage, layout.right, layout.status].every((panel) => inside(panel, layout.shell)) &&
    inside(layout.maze, layout.stage),
  JSON.stringify(layout),
);

check('全程零 console error', errors.length === 0, errors.join(' | '));

await page.screenshot({ path: '/tmp/qa-algo.png' });
await browser.close();
server.close();

if (failures.length) {
  console.log(`\n${failures.length} 项失败：`);
  failures.forEach((item) => console.log(` - ${item}`));
  process.exit(1);
}
console.log('\nAlgorithm Sandbox QA 通过（截图 /tmp/qa-algo.png）');
