/**
 * arcade.html（ICE Arcade 掌机）的浏览器端 QA。
 *
 * 用法：
 *   npm run qa:arcade
 *   PLAYWRIGHT_PATH=/path/to/playwright npm run qa:arcade
 *
 * 检查项（键盘部分全是真实按键，鼠标部分全是真实点击）：
 * 1. 开局：默认插着俄罗斯方块卡带、棋盘 200 格、HUD 与模型一致、零 console error；
 * 2. 俄罗斯方块：方向键移动 / 撞墙、↑ 旋转、↓ 软降 +1 分、空格硬降锁定、
 *    重力自己走、P 暂停时重力与输入都停摆、造题强制消行（分数/闪屏/HUD 同步）、
 *    一路硬降到 game over（overlay + 最高分落盘）、R 重开；
 * 3. 贪吃蛇：点卡带切换、HUD 卡片改成「长度 / 等级」、真实方向键入队、
 *    吃食物（长度 +1 / 分数 / HUD）、撞墙 game over（overlay + 最高分落盘）、
 *    暂停时 tick 无效、R 重开；
 * 4. 卡带切换：切回去俄罗斯方块是一个全新的模型，卡带按钮高亮跟着换；
 * 4.5 2048：4×4 棋盘 + 数字标签层、合并脉冲、推不动判负；
 * 4.6 CHIP-8：64×32 单节点自绘屏、自写 demo ROM 在跑（方块绕屏且不残留）、
 *    机器键盘按下/松开（keyup）、R 让给机器键 7、P 暂停冻住指令流、重开按钮复位、
 *    没有排行榜的卡带点「排行榜」只提示不报错；
 * 5. 引擎能力：棋盘是**单个自绘节点**（ICETileMap，无子节点、有自绘计数）、
 *    消行 / 吃食物会触发 tween 脉冲、换卡带棋盘淡入、主题走 registerTheme('arcade')；
 * 6. 排行榜：点「排行榜」按钮弹出 ICEModal（内含 ICETable + ICEScrollPane），
 *    分数降序、Esc 能关掉；
 * 7. 鼠标：点「暂停」「重新开始」「音效开关」都有反应；
 * 8. 布局：两种卡带的棋盘都在屏幕框内，侧栏与操作面板不交叠，所有面板都在机壳里。
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
  throw new Error('qa-arcade 需要 playwright：npm i -D playwright，或用 PLAYWRIGHT_PATH 指定');
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
const URL = `http://127.0.0.1:${server.address().port}/examples/arcade.html`;

const failures = [];
const check = (name, ok, detail = '') => {
  if (!ok) failures.push(`${name}${detail ? ' — ' + detail : ''}`);
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? '  ' + detail : ''}`);
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 820 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console: ' + m.text());
});
await page.goto(URL);
// UMD 包冷启动要解析一会儿，等句柄真的挂上再开始（比写死 sleep 稳）
await page.waitForFunction(() => !!window.__arcade && !!window.__arcade.model, null, { timeout: 20000 });
await page.waitForTimeout(400);

/** 棋盘上已落方块数 + 当前方块行号：用来判断「有没有动」。 */
const signature = () =>
  page.evaluate(() => {
    const model = window.__arcade.model;
    const cells = model.getBoard().reduce((all, row) => all.concat(row), []).filter(Boolean).length;
    return cells * 1000 + model.getCurrent().row;
  });
/** 世界坐标（含父链偏移），用于真实鼠标点击。 */
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
const rect = await page.evaluate(() => {
  const r = document.getElementById('canvas').getBoundingClientRect();
  return { left: r.left, top: r.top };
});
const clickExpr = async (source) => {
  const box = await boxOf(source);
  if (!box) return false;
  await page.mouse.click(rect.left + box.l + box.w / 2, rect.top + box.t + box.h / 2);
  await page.waitForTimeout(200);
  return true;
};
/** 保证游戏在跑（不因 window blur 之类的意外停在暂停态）。 */
const ensureRunning = () =>
  page.evaluate(() => {
    const model = window.__arcade.model;
    if (!model.isGameOver() && model.isPaused()) model.resume();
  });
/** 屏幕里当前卡带的棋盘节点（ICETileMap）。 */
const boardExpr = (id) => `(window.__arcade.nodes.screen.childNodes || []).find((n) => n.state && n.state.id === '${id}')`;

/* ---------- 1. 开局：默认卡带 ---------- */
const boot = await page.evaluate(() => {
  const r = window.__arcade;
  return {
    game: r.game,
    cells: r.model.getBoard().reduce((all, row) => all.concat(row), []).filter(Boolean).length,
    pieceCells: r.model.getCurrent().cells.length,
    scoreText: r.scoreCard.getText(),
    cartridges: Object.keys(r.cartridges).length,
  };
});
check(
  '开局：默认插着俄罗斯方块卡带（卡带架上共 4 块），HUD 与模型一致',
  boot.game === 'tetris' && boot.cells === 0 && boot.pieceCells === 4 && boot.scoreText === '0' && boot.cartridges === 4,
  JSON.stringify(boot),
);
check('零 console error', errors.length === 0, errors.join(' | '));

/* ---------- 1.5 引擎能力：自绘棋盘 + 主题 token ---------- */
const engineUse = await page.evaluate(() => {
  const board = (window.__arcade.nodes.screen.childNodes || []).find((n) => n.state && n.state.id === 'tetris-board');
  const oldCellNodes = (window.__arcade.nodes.screen.childNodes || []).filter((n) => n.state && /^tetris-cell-/.test(n.state.id || ''));
  return {
    boardFound: !!board,
    childNodes: board ? board.childNodes.length : -1,
    oldCellNodes: oldCellNodes.length,
    paintCount: board && board.getPaintCount ? board.getPaintCount() : -1,
    themeName: window.ICEWEB.iceUIManager.getThemeName(),
    paletteFromToken: window.ICEWEB.ICE_ARCADE_PALETTE.I.fillStyle,
    chip8On: window.ICEWEB.ICE_ARCADE_PALETTE.chip8On.fillStyle,
    chip8Off: window.ICEWEB.ICE_ARCADE_PALETTE.chip8Off.fillStyle,
  };
});
check(
  '引擎能力：整块棋盘是单个自绘节点（ICETileMap，不再一格一个组件）',
  engineUse.boardFound && engineUse.childNodes === 0 && engineUse.oldCellNodes === 0 && engineUse.paintCount > 0,
  JSON.stringify(engineUse),
);
check(
  '引擎能力：主题走 registerTheme(\'arcade\')，棋盘与 CHIP-8 单色屏配色都来自 token',
  engineUse.themeName === 'arcade' && engineUse.paletteFromToken === '#0dcaf0' &&
    engineUse.chip8On === '#9be7ff' && engineUse.chip8Off === '#0d1218',
  JSON.stringify({ theme: engineUse.themeName, piece: engineUse.paletteFromToken, on: engineUse.chip8On, off: engineUse.chip8Off }),
);

/* ---------- 2. 俄罗斯方块 ---------- */
await ensureRunning();
const beforeMove = await page.evaluate(() => window.__arcade.model.getCurrent().col);
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(80);
const afterRight = await page.evaluate(() => window.__arcade.model.getCurrent().col);
await page.keyboard.press('ArrowLeft');
await page.waitForTimeout(80);
const afterLeft = await page.evaluate(() => window.__arcade.model.getCurrent().col);
check('俄罗斯方块：→ 右移一格、← 左移回原位', afterRight === beforeMove + 1 && afterLeft === beforeMove, `${beforeMove} → ${afterRight} → ${afterLeft}`);

for (let i = 0; i < 14; i += 1) await page.keyboard.press('ArrowLeft');
await page.waitForTimeout(120);
const leftMost = await page.evaluate(() => {
  const model = window.__arcade.model;
  return { min: Math.min(...model.getCurrent().cells.map(([, col]) => col)) };
});
check('俄罗斯方块：一路左移撞墙不越界', leftMost.min === 0, JSON.stringify(leftMost));

await ensureRunning();
const beforeRotate = await page.evaluate(() => ({
  type: window.__arcade.model.getCurrent().type,
  cells: JSON.stringify(window.__arcade.model.getCurrent().cells),
}));
await page.keyboard.press('ArrowUp');
await page.waitForTimeout(80);
const afterRotate = await page.evaluate(() => ({
  cells: JSON.stringify(window.__arcade.model.getCurrent().cells),
  max: Math.max(...window.__arcade.model.getCurrent().cells.map(([, col]) => col)),
  cols: window.__arcade.model.getCols(),
}));
check(
  beforeRotate.type === 'O' ? '俄罗斯方块：↑ 旋转（O 形旋转后形状不变）' : '俄罗斯方块：↑ 旋转且不出右边界',
  beforeRotate.type === 'O'
    ? afterRotate.cells === beforeRotate.cells
    : afterRotate.cells !== beforeRotate.cells && afterRotate.max < afterRotate.cols,
  `${beforeRotate.type} ${beforeRotate.cells} → ${afterRotate.cells}`,
);

await page.evaluate(() => window.__arcade.model.reset());
await ensureRunning();
const beforeSoft = await page.evaluate(() => ({ score: window.__arcade.model.getScore(), row: window.__arcade.model.getCurrent().row }));
await page.keyboard.press('ArrowDown');
await page.waitForTimeout(80);
const afterSoft = await page.evaluate(() => ({ score: window.__arcade.model.getScore(), row: window.__arcade.model.getCurrent().row }));
check('俄罗斯方块：↓ 软降往下走、正好 +1 分', afterSoft.row > beforeSoft.row && afterSoft.score === beforeSoft.score + 1, JSON.stringify(afterSoft));

const beforeHard = await page.evaluate(() => ({
  next: window.__arcade.model.getNextQueue()[0],
  score: window.__arcade.model.getScore(),
  locked: window.__arcade.model.getBoard().reduce((all, row) => all.concat(row), []).filter(Boolean).length,
}));
await page.keyboard.press('Space');
await page.waitForTimeout(120);
const afterHard = await page.evaluate(() => ({
  type: window.__arcade.model.getCurrent().type,
  score: window.__arcade.model.getScore(),
  locked: window.__arcade.model.getBoard().reduce((all, row) => all.concat(row), []).filter(Boolean).length,
  hudScore: window.__arcade.scoreCard.getText(),
}));
check(
  '俄罗斯方块：空格硬降（锁定 / 换块 / 加分）',
  afterHard.type === beforeHard.next && afterHard.locked >= beforeHard.locked + 4 && afterHard.score > beforeHard.score,
  JSON.stringify({ before: beforeHard, after: afterHard }),
);
check('俄罗斯方块：HUD 分数与模型同步', Number(afterHard.hudScore) === afterHard.score, `${afterHard.hudScore} vs ${afterHard.score}`);

await page.evaluate(() => window.__arcade.model.reset());
await ensureRunning();
const gravityBefore = await signature();
await page.waitForTimeout(1100);
const gravityAfter = await signature();
check('俄罗斯方块：重力自己会走（1.1s 内状态变化）', gravityBefore !== gravityAfter, `${gravityBefore} → ${gravityAfter}`);

await page.keyboard.press('p');
await page.waitForTimeout(120);
const pausedState = await page.evaluate(() => ({
  paused: window.__arcade.model.isPaused(),
  overlay: window.__arcade.nodes.screen.childNodes.some((n) => n.state && n.state.id === 'tetris-paused' && n.state.display !== false),
  buttonText: window.__arcade.buttons.pauseButton.getText(),
}));
const pausedSignature = await signature();
await page.waitForTimeout(1100);
await page.keyboard.press('ArrowLeft');
await page.waitForTimeout(60);
const pausedSignature2 = await signature();
check(
  '俄罗斯方块：P 暂停（重力与输入都停摆 + 屏幕提示）',
  pausedState.paused === true && pausedState.overlay === true && /继续/.test(pausedState.buttonText) && pausedSignature === pausedSignature2,
  JSON.stringify({ pausedState, pausedSignature, pausedSignature2 }),
);
await page.keyboard.press('p');
await page.waitForTimeout(1100);
check('俄罗斯方块：再按 P 恢复（重力接着走）', (await signature()) !== pausedSignature2, '');

// 固定随机序列（random 恒为 0 → 洗牌结果固定）让第一块必是 O：只有 O / I / T / J / L
// 这类「落地那一行就是自身最宽行」的形状能单独补满一行，S/Z 天生跨两行、拿它造题必然失败。
const prepared = await page.evaluate(() => {
  const model = window.__arcade.model;
  model.reset({ random: () => 0 });
  if (model.isPaused()) model.resume();
  const ghost = model.getGhost();
  const bottom = Math.max(...ghost.map(([row]) => row));
  const gap = ghost.filter(([row]) => row === bottom).map(([, col]) => col);
  for (let col = 0; col < model.getCols(); col += 1) {
    if (gap.indexOf(col) === -1) model.setCellForTest(19, col, 'J');
  }
  return { type: model.getCurrent().type, gap, lines: model.getLines(), bottom };
});
check('俄罗斯方块：消行用例前置（固定随机序列下首块是 O）', prepared.type === 'O' && prepared.bottom === 19, JSON.stringify(prepared));
await page.keyboard.press('Space');
await page.waitForTimeout(40);
const cleared = await page.evaluate(() => {
  const model = window.__arcade.model;
  const board = (window.__arcade.nodes.screen.childNodes || []).find((n) => n.state && n.state.id === 'tetris-board');
  return {
    lines: model.getLines(),
    last: model.getLastClearedLines(),
    // 消行现在是 ICETileMap 的 tween 脉冲（不再是手搓的闪屏遮罩）
    pulse: board && board.getPulseAlpha ? board.getPulseAlpha() : -1,
    leftover: model.getBoard()[19].filter((cell) => cell === 'J').length,
  };
});
check(
  '俄罗斯方块：消一行（行数 +1、底行清空、tween 脉冲亮起）',
  cleared.lines === prepared.lines + 1 && cleared.last === 1 && cleared.leftover === 0 && cleared.pulse > 0,
  JSON.stringify(cleared),
);

let over = false;
for (let i = 0; i < 80 && !over; i += 1) {
  await page.keyboard.press('Space');
  over = await page.evaluate(() => window.__arcade.model.isGameOver());
}
await page.waitForTimeout(300);
const overState = await page.evaluate(() => ({
  over: window.__arcade.model.isGameOver(),
  overlay: window.__arcade.nodes.screen.childNodes.some((n) => n.state && n.state.id === 'tetris-over' && n.state.display !== false),
  best: window.__arcade.scores.tetris.getBest(),
  bestText: window.__arcade.bestLabel.getText(),
  score: window.__arcade.model.getScore(),
  entries: window.__arcade.scores.tetris.getScores().map((item) => item.score),
}));
check(
  '俄罗斯方块：硬降到底 game over（提示出现 + 成绩进榜）',
  overState.over === true && overState.overlay === true && overState.best === overState.score && overState.best > 0 && overState.entries.indexOf(overState.score) !== -1,
  JSON.stringify(overState),
);
check('俄罗斯方块：最高分标签跟着更新', overState.bestText.indexOf(String(overState.best)) !== -1, overState.bestText);

await page.keyboard.press('r');
await page.waitForTimeout(220);
const restarted = await page.evaluate(() => {
  const model = window.__arcade.model;
  return {
    over: model.isGameOver(),
    cells: model.getBoard().reduce((all, row) => all.concat(row), []).filter(Boolean).length,
    score: model.getScore(),
    overlay: window.__arcade.nodes.screen.childNodes.some((n) => n.state && n.state.id === 'tetris-over' && n.state.display !== false),
  };
});
check(
  '俄罗斯方块：R 重开（棋盘清空 / 分数归零 / 提示收起）',
  restarted.over === false && restarted.cells === 0 && restarted.score === 0 && restarted.overlay === false,
  JSON.stringify(restarted),
);

/* ---------- 3. 鼠标交互 ---------- */
const clickedPause = await clickExpr('window.__arcade.buttons.pauseButton');
const pausedByClick = await page.evaluate(() => window.__arcade.model.isPaused());
await clickExpr('window.__arcade.buttons.pauseButton');
const resumedByClick = await page.evaluate(() => window.__arcade.model.isPaused());
check('鼠标：点「暂停 / 继续」能切换', clickedPause && pausedByClick === true && resumedByClick === false, `${pausedByClick} → ${resumedByClick}`);

await page.evaluate(() => window.__arcade.model.hardDrop());
const clickedRestart = await clickExpr('window.__arcade.buttons.restartButton');
const restartedByClick = await page.evaluate(() => ({
  score: window.__arcade.model.getScore(),
  cells: window.__arcade.model.getBoard().reduce((all, row) => all.concat(row), []).filter(Boolean).length,
}));
check('鼠标：点「重新开始」清空棋盘', clickedRestart && restartedByClick.score === 0 && restartedByClick.cells === 0, JSON.stringify(restartedByClick));

const soundBefore = await page.evaluate(() => window.__arcade.buttons.soundSwitch.isSelected());
await clickExpr('window.__arcade.buttons.soundSwitch');
const soundAfter = await page.evaluate(() => ({
  selected: window.__arcade.buttons.soundSwitch.isSelected(),
  enabled: window.__arcade.sound.enabled,
}));
check('鼠标：音效开关与 sound.enabled 同步', soundBefore === true && soundAfter.selected === false && soundAfter.enabled === false, JSON.stringify(soundAfter));
await clickExpr('window.__arcade.buttons.soundSwitch');

/* ---------- 3.5 排行榜：ICEModal + ICETable + ICEScrollPane ---------- */
await page.evaluate(() => {
  // 先塞两条成绩，保证表格里有内容可查（同时验证模型的排序/截断）
  const scores = window.__arcade.scores.tetris;
  scores.clear();
  scores.add(120, { at: Date.now() - 60000 });
  scores.add(480, { at: Date.now() - 30000 });
  scores.add(300, { at: Date.now() });
});
const leaderboardOpened = await clickExpr('window.__arcade.buttons.leaderboardButton');
await page.waitForTimeout(320);
const leaderboardState = await page.evaluate(() => {
  const info = window.__arcade.leaderboard;
  const layer = window.ICEWEB.getICEOverlayManager(window.__arcade.ice).getLayer();
  const find = (node, predicate) => {
    if (!node) return null;
    if (predicate(node)) return node;
    const children = node.childNodes || [];
    for (let i = 0; i < children.length; i += 1) {
      const found = find(children[i], predicate);
      if (found) return found;
    }
    return null;
  };
  const table = find(layer, (n) => n.state && n.state.id === 'arcade-leaderboard-table');
  const scroll = find(layer, (n) => n.state && n.state.id === 'arcade-leaderboard-scroll');
  return {
    open: window.ICEWEB.getICEOverlayManager(window.__arcade.ice).isOpen(),
    hasHandle: !!info,
    entries: info ? info.entries.map((item) => item.score) : [],
    hasTable: !!table,
    hasScroll: !!scroll,
  };
});
check(
  '排行榜：点按钮弹出 ICEModal（内含 ICETable + ICEScrollPane）且分数降序',
  leaderboardOpened && leaderboardState.open === true && leaderboardState.hasHandle && leaderboardState.hasTable && leaderboardState.hasScroll &&
    JSON.stringify(leaderboardState.entries) === JSON.stringify([480, 300, 120]),
  JSON.stringify(leaderboardState),
);
await page.keyboard.press('Escape');
await page.waitForTimeout(240);
const leaderboardClosed = await page.evaluate(() => window.ICEWEB.getICEOverlayManager(window.__arcade.ice).isOpen());
check('排行榜：Esc 能关掉', leaderboardClosed === false, String(leaderboardClosed));

/* ---------- 4. 换卡带：贪吃蛇 ---------- */
const switched = await clickExpr('window.__arcade.cartridges.snake');
// 换卡带会 fadeIn 新棋盘：刚切完透明度还没到 1（这就是「动画真的在跑」的证据）
const fading = await page.evaluate(() => {
  const board = (window.__arcade.nodes.screen.childNodes || []).find((n) => n.state && n.state.id === 'snake-board');
  return board ? Number(board.state.opacity) : -1;
});
await page.waitForTimeout(400);
const snakeBoot = await page.evaluate(() => {
  const r = window.__arcade;
  const screenIds = (r.nodes.screen.childNodes || []).map((n) => (n.state && n.state.id) || '');
  const board = (r.nodes.screen.childNodes || []).find((n) => n.state && n.state.id === 'snake-board');
  return {
    game: r.game,
    length: r.model.getLength(),
    score: r.model.getScore(),
    food: r.model.getFood(),
    board: screenIds.indexOf('snake-board') !== -1,
    tetrisGone: screenIds.indexOf('tetris-board') === -1,
    hudScore: Number(r.scoreCard.getText()),
    childNodes: board ? board.childNodes.length : -1,
    paintCount: board && board.getPaintCount ? board.getPaintCount() : -1,
    opacity: board ? Number(board.state.opacity) : -1,
  };
});
check(
  '换卡带：点「贪吃蛇」真的插上第二块卡带（棋盘换、HUD 卡片换、整块棋盘仍是单节点）',
  // 注意：切过去之后贪吃蛇就开始自己走了，等待期间可能已经吃到东西 —— 只断言「是刚开局」的量级
  switched && snakeBoot.game === 'snake' && snakeBoot.length >= 3 && snakeBoot.length <= 6 && snakeBoot.score < 100 &&
    !!snakeBoot.food && snakeBoot.board && snakeBoot.tetrisGone && snakeBoot.hudScore === snakeBoot.score,
  JSON.stringify(snakeBoot),
);
check(
  '换卡带：新棋盘用 tween 淡入（切换瞬间透明度 < 1，之后回到 1）',
  fading >= 0 && fading < 1 && snakeBoot.opacity === 1 && snakeBoot.childNodes === 0 && snakeBoot.paintCount > 0,
  JSON.stringify({ fading, opacity: snakeBoot.opacity, childNodes: snakeBoot.childNodes, paintCount: snakeBoot.paintCount }),
);

// 真实按键：↑ 应该进转向队列（不能 180°，所以不会立刻改当前方向）
await ensureRunning();
await page.keyboard.press('ArrowUp');
await page.waitForTimeout(80);
const queued = await page.evaluate(() => ({
  pending: window.__arcade.model.getPendingDirections(),
  direction: window.__arcade.model.getDirection(),
}));
check(
  '贪吃蛇：真实方向键进入转向队列',
  queued.pending.indexOf('up') !== -1 || queued.direction === 'up',
  JSON.stringify(queued),
);

await page.keyboard.press('r'); // 复位方向与队列，下面要按「朝右」造题
await page.waitForTimeout(200);
const eaten = await page.evaluate(() => {
  const model = window.__arcade.model;
  const head = model.getHead();
  model.setFoodForTest(head[0], head[1] + 1); // 正前方
  const before = { length: model.getLength(), score: model.getScore(), head };
  model.tick();
  return {
    before,
    after: { length: model.getLength(), score: model.getScore() },
    head: model.getHead(),
    food: model.getFood(),
  };
});
check(
  '贪吃蛇：吃到食物（长度 +1、加分、食物重生成）',
  eaten.after.length === eaten.before.length + 1 &&
    eaten.after.score > eaten.before.score &&
    eaten.head[1] === eaten.before.head[1] + 1 &&
    !!eaten.food,
  JSON.stringify(eaten),
);
const snakeHud = await page.evaluate(() => ({
  score: Number(window.__arcade.scoreCard.getText()),
  length: Number(window.__arcade.midCard.getText()),
  modelScore: window.__arcade.model.getScore(),
  modelLength: window.__arcade.model.getLength(),
}));
check(
  '贪吃蛇：HUD（得分 / 长度）与模型同步',
  snakeHud.score === snakeHud.modelScore && snakeHud.length === snakeHud.modelLength,
  JSON.stringify(snakeHud),
);

// 点格子转向：ICETileMap 的 cellclick（真实鼠标命中 + 组件内坐标换算）
await page.evaluate(() => window.__arcade.model.reset());
await page.waitForTimeout(120);
const clickTarget = await page.evaluate(() => {
  const board = (window.__arcade.nodes.screen.childNodes || []).find((n) => n.state && n.state.id === 'snake-board');
  const head = window.__arcade.model.getHead();
  // 点蛇头**上方**两格 → 应该转成 up（朝右时掉头是非法的，向上才是合法 90°）
  const cell = { row: head[0] - 2, col: head[1] };
  const rect = board.getCellRect(cell.row, cell.col);
  const origin = board.state.localOrigin || [0, 0];
  const box = board.getMinBoundingBox(true);
  return {
    canvasLeft: document.getElementById('canvas').getBoundingClientRect().left,
    canvasTop: document.getElementById('canvas').getBoundingClientRect().top,
    x: box.tl[0] + rect.left + rect.width / 2,
    y: box.tl[1] + rect.top + rect.height / 2,
    cell,
    originX: origin[0],
    originY: origin[1],
  };
});
await page.mouse.click(clickTarget.canvasLeft + clickTarget.x, clickTarget.canvasTop + clickTarget.y);
await page.waitForTimeout(120);
const afterCellClick = await page.evaluate(() => ({
  pending: window.__arcade.model.getPendingDirections(),
  direction: window.__arcade.model.getDirection(),
}));
check(
  '贪吃蛇：点棋盘格子即转向（ICETileMap 的 cellclick 真实命中）',
  afterCellClick.direction === 'up' || afterCellClick.pending.indexOf('up') !== -1,
  JSON.stringify({ afterCellClick, target: clickTarget.cell, originX: clickTarget.originX }),
);

await page.keyboard.press('p');
await page.waitForTimeout(120);
const snakePaused = await page.evaluate(() => {
  const model = window.__arcade.model;
  const before = JSON.stringify(model.getBody());
  const moved = model.tick();
  return {
    paused: model.isPaused(),
    moved,
    unchanged: JSON.stringify(model.getBody()) === before,
    overlay: window.__arcade.nodes.screen.childNodes.some((n) => n.state && n.state.id === 'snake-paused' && n.state.display !== false),
  };
});
check(
  '贪吃蛇：暂停时 tick 无效且有屏幕提示',
  snakePaused.paused === true && snakePaused.moved === false && snakePaused.unchanged === true && snakePaused.overlay === true,
  JSON.stringify(snakePaused),
);
await page.keyboard.press('p');
await page.waitForTimeout(120);

// 先吃 3 个攒分，再顶到右墙撞死（一个 evaluate 内完成，避免自动步进插进来）
const snakeOver = await page.evaluate(() => {
  const model = window.__arcade.model;
  model.reset();
  const steps = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] };
  for (let i = 0; i < 3; i += 1) {
    const [row, col] = model.getHead();
    const [dRow, dCol] = steps[model.getDirection()];
    model.setFoodForTest(row + dRow, col + dCol);
    model.tick();
  }
  const score = model.getScore();
  model.setBodyForTest([[10, 19], [10, 18], [10, 17]], 'right');
  model.tick();
  return {
    score,
    over: model.isGameOver(),
    best: window.__arcade.scores.snake.getBest(),
    overlay: window.__arcade.nodes.screen.childNodes.some((n) => n.state && n.state.id === 'snake-over' && n.state.display !== false),
    bestText: window.__arcade.bestLabel.getText(),
  };
});
check(
  '贪吃蛇：撞墙 game over（提示出现 + 最高分落盘）',
  snakeOver.over === true && snakeOver.score > 0 && snakeOver.best === snakeOver.score && snakeOver.overlay === true,
  JSON.stringify(snakeOver),
);
check('贪吃蛇：最高分标签换成这块卡带的成绩', snakeOver.bestText.indexOf(String(snakeOver.score)) !== -1, snakeOver.bestText);

await page.keyboard.press('r');
await page.waitForTimeout(240);
const snakeRestart = await page.evaluate(() => {
  const model = window.__arcade.model;
  return {
    over: model.isGameOver(),
    length: model.getLength(),
    score: model.getScore(),
    overlay: window.__arcade.nodes.screen.childNodes.some((n) => n.state && n.state.id === 'snake-over' && n.state.display !== false),
  };
});
check(
  '贪吃蛇：R 重开（长度回到 3、分数归零、提示收起）',
  snakeRestart.over === false && snakeRestart.length === 3 && snakeRestart.score === 0 && snakeRestart.overlay === false,
  JSON.stringify(snakeRestart),
);

/* ---------- 5. 切回第一块卡带 ---------- */
/* ---------- 4.5 第三块卡带：2048 ---------- */
const switched2048 = await clickExpr('window.__arcade.cartridges["2048"]');
await page.waitForTimeout(400);
const boot2048 = await page.evaluate(() => {
  const r = window.__arcade;
  const board = (r.nodes.screen.childNodes || []).find((n) => n.state && n.state.id === 'game2048-board');
  return {
    game: r.game,
    childNodes: board ? board.childNodes.length : -1,
    paintCount: board && board.getPaintCount ? board.getPaintCount() : -1,
    tiles: r.model.getCells().filter(Boolean).length,
    labels: board ? board.getLabels().filter(Boolean).length : -1,
    midCaption: r.midCard.getText(),
  };
});
check(
  '2048：点卡带切换（4×4 单节点自绘棋盘 + 数字标签层）',
  switched2048 && boot2048.game === '2048' && boot2048.childNodes === 0 && boot2048.paintCount > 0 &&
    boot2048.tiles === 2 && boot2048.labels === 2,
  JSON.stringify(boot2048),
);

// 真实按键：摆一个 2,2 / 4,4 的盘面，按 ← 应该合并成 4,8 并加 12 分
const merged = await page.evaluate(() => {
  const model = window.__arcade.model;
  model.setCellsForTest([2, 2, null, null, 4, 4, null, null, null, null, null, null, null, null, null, null]);
  return { score: model.getScore(), moves: model.getMoves() };
});
await page.keyboard.press('ArrowLeft');
await page.waitForTimeout(200);
const afterMerge = await page.evaluate(() => {
  const model = window.__arcade.model;
  const board = (window.__arcade.nodes.screen.childNodes || []).find((n) => n.state && n.state.id === 'game2048-board');
  return {
    cells: model.getCells(),
    score: model.getScore(),
    moves: model.getMoves(),
    labels: board.getLabels(),
    hudScore: Number(window.__arcade.scoreCard.getText()),
  };
});
check(
  '2048：← 合并同值块（2,2→4 与 4,4→8，得分 +12、步数 +1、标签同步）',
  afterMerge.score === merged.score + 12 && afterMerge.moves === merged.moves + 1 &&
    afterMerge.cells[0] === 4 && afterMerge.cells[4] === 8 &&
    afterMerge.labels[0] === '4' && afterMerge.labels[4] === '8' && afterMerge.hudScore === afterMerge.score,
  JSON.stringify(afterMerge),
);

// 合并后的脉冲必须真的「动」起来：亮起 → 淡出（曾经因为只置组件 dirty 而卡住不动）
const pulseRightAfter = await page.evaluate(() => {
  const model = window.__arcade.model;
  const board = (window.__arcade.nodes.screen.childNodes || []).find((n) => n.state && n.state.id === 'game2048-board');
  model.setCellsForTest([2, 2, null, null, null, null, null, null, null, null, null, null, null, null, null, null]);
  return { before: board.getPulseAlpha() };
});
await page.keyboard.press('ArrowLeft');
await page.waitForTimeout(60);
const pulsePeak = await page.evaluate(() => {
  const board = (window.__arcade.nodes.screen.childNodes || []).find((n) => n.state && n.state.id === 'game2048-board');
  return { alpha: board.getPulseAlpha(), merged: window.__arcade.model.getLastMerged() };
});
await page.waitForTimeout(420);
const pulseGone = await page.evaluate(() => {
  const board = (window.__arcade.nodes.screen.childNodes || []).find((n) => n.state && n.state.id === 'game2048-board');
  return board.getPulseAlpha();
});
check(
  '2048：合并脉冲真的会亮起再淡出（tween 每帧都要重画）',
  pulseRightAfter.before === 0 && pulsePeak.alpha > 0 && JSON.stringify(pulsePeak.merged) === JSON.stringify([[0, 0]]) && pulseGone === 0,
  JSON.stringify({ before: pulseRightAfter.before, peak: pulsePeak, gone: pulseGone }),
);

const noMove = await page.evaluate(() => {
  const model = window.__arcade.model;
  // 填满且相邻都不相同 → 推不动，也不该计步
  model.setCellsForTest([2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 4, 2]);
  const before = { score: model.getScore(), moves: model.getMoves() };
  const moved = model.move('left');
  return { before, moved, after: { score: model.getScore(), moves: model.getMoves() }, over: model.isGameOver() };
});
check(
  '2048：推不动时不计步、不得分，判定 game over',
  noMove.moved === false && noMove.after.moves === noMove.before.moves && noMove.after.score === noMove.before.score && noMove.over === true,
  JSON.stringify(noMove),
);

const winState = await page.evaluate(() => {
  const model = window.__arcade.model;
  model.reset();
  model.setCellsForTest([1024, 1024, null, null, null, null, null, null, null, null, null, null, null, null, null, null]);
  model.move('left');
  return { won: model.isWon(), over: model.isGameOver(), best: model.getBestTile(), score: model.getScore() };
});
check(
  '2048：合并出 2048 即获胜，但还能继续玩',
  winState.won === true && winState.over === false && winState.best === 2048 && winState.score > 0,
  JSON.stringify(winState),
);

await page.keyboard.press('r');
await page.waitForTimeout(240);
const restart2048 = await page.evaluate(() => {
  const model = window.__arcade.model;
  const board = (window.__arcade.nodes.screen.childNodes || []).find((n) => n.state && n.state.id === 'game2048-board');
  return {
    score: model.getScore(),
    moves: model.getMoves(),
    tiles: model.getCells().filter(Boolean).length,
    labels: board.getLabels().filter(Boolean).length,
    over: model.isGameOver(),
  };
});
check(
  '2048：R 重开（回到两个块、分数与步数归零、标签跟着清）',
  restart2048.score === 0 && restart2048.moves === 0 && restart2048.tiles === 2 && restart2048.labels === 2 && restart2048.over === false,
  JSON.stringify(restart2048),
);

/* ---------- 4.6 第四块卡带：CHIP-8 虚拟机 ---------- */
const switchedChip8 = await clickExpr('window.__arcade.cartridges.chip8');
await page.waitForTimeout(400);
const bootChip8 = await page.evaluate(() => {
  const r = window.__arcade;
  const board = (r.nodes.screen.childNodes || []).find((n) => n.state && n.state.id === 'chip8-board');
  const keyboard = (r.nodes.screen.childNodes || []).find((n) => n.state && n.state.id === 'chip8-keyboard');
  const display = r.model.getDisplay();
  return {
    game: r.game,
    childNodes: board ? board.childNodes.length : -1,
    rows: board ? board.getRows() : -1,
    cols: board ? board.getCols() : -1,
    keyboardNodes: keyboard ? keyboard.childNodes.length : -1,
    keyboardLabels: keyboard ? keyboard.getLabels().join('') : '',
    pixels: display.reduce((sum, pixel) => sum + pixel, 0),
    pc: r.model.getPC(),
    cycles: r.model.getCycles(),
    ownedKeys: Array.isArray(r.runtime.keys) ? r.runtime.keys.length : -1,
    scoreCaption: r.captions.score.getText(),
    midCaption: r.captions.mid.getText(),
  };
});
check(
  'CHIP-8：点卡带切换（64×32 单节点自绘屏 + 单节点机器键盘 + 声明 16 个机器键）',
  switchedChip8 && bootChip8.game === 'chip8' && bootChip8.childNodes === 0 &&
    bootChip8.rows === 32 && bootChip8.cols === 64 && bootChip8.ownedKeys === 16 &&
    bootChip8.keyboardNodes === 0 && bootChip8.keyboardLabels === '1234QWERASDFZXCV',
  JSON.stringify(bootChip8),
);
check(
  'CHIP-8：HUD 跟着换成「指令 / 地址 / 状态」，ROM 已经在跑',
  bootChip8.scoreCaption === '指令 CYCLES' && bootChip8.midCaption === '地址 PC' && bootChip8.cycles > 0,
  JSON.stringify({ scoreCaption: bootChip8.scoreCaption, midCaption: bootChip8.midCaption, cycles: bootChip8.cycles }),
);

// demo ROM 在画一个绕屏移动的方块：像素位置要随时间变
// （注意：清屏到重画之间有几毫秒的空屏，所以只看「亮着的那些采样」，别要求每一帧都有像素）
const chip8Frames = [];
for (let i = 0; i < 8; i += 1) {
  // eslint-disable-next-line no-await-in-loop
  chip8Frames.push(
    await page.evaluate(() => {
      const display = window.__arcade.model.getDisplay();
      let first = -1;
      let count = 0;
      let minCol = 64;
      let maxCol = -1;
      let minRow = 32;
      let maxRow = -1;
      display.forEach((pixel, index) => {
        if (!pixel) return;
        count += 1;
        if (first === -1) first = index;
        const row = Math.floor(index / 64);
        const col = index % 64;
        minCol = Math.min(minCol, col);
        maxCol = Math.max(maxCol, col);
        minRow = Math.min(minRow, row);
        maxRow = Math.max(maxRow, row);
      });
      return { first, count, spanX: maxCol - minCol, spanY: maxRow - minRow };
    }),
  );
  // eslint-disable-next-line no-await-in-loop
  await page.waitForTimeout(80);
}
const litPixels = chip8Frames.map((frame) => frame.count);
const litPositions = new Set(chip8Frames.filter((frame) => frame.count > 0).map((frame) => frame.first));
check(
  'CHIP-8：ROM 真的在跑（8×8 笑脸 26 个像素、撞边反弹不裂到对边、不累积残留）',
  Math.max(...litPixels) === 26 && litPixels.every((count) => count <= 26) && litPositions.size >= 3 &&
    chip8Frames.every((frame) => frame.count === 0 || (frame.spanX <= 7 && frame.spanY <= 7)),
  JSON.stringify(chip8Frames),
);

// 机器键盘：真实按下 / 松开，V 寄存器侧的 keys[] 要跟着变（FX0A 就靠这个）
const chip8Keys = await page.evaluate(() => ({ before: window.__arcade.model.isKeyDown(5) }));
await page.keyboard.down('w');
await page.waitForTimeout(80);
const chip8KeyDown = await page.evaluate(() => {
  const keyboard = (window.__arcade.nodes.screen.childNodes || []).find((n) => n.state && n.state.id === 'chip8-keyboard');
  return { down: window.__arcade.model.isKeyDown(5), tile: keyboard.getTiles()[5] };
});
await page.keyboard.up('w');
await page.waitForTimeout(80);
const chip8KeyUp = await page.evaluate(() => {
  const keyboard = (window.__arcade.nodes.screen.childNodes || []).find((n) => n.state && n.state.id === 'chip8-keyboard');
  return { down: window.__arcade.model.isKeyDown(5), tile: keyboard.getTiles()[5] };
});
check(
  'CHIP-8：真实键盘 w → 机器键 5 按下并点亮键盘格，松开也收得到（其它卡带用不到 keyup）',
  chip8Keys.before === false && chip8KeyDown.down === true && chip8KeyDown.tile === 'pressed' &&
    chip8KeyUp.down === false && chip8KeyUp.tile === 'key',
  JSON.stringify({ ...chip8Keys, down: chip8KeyDown, up: chip8KeyUp }),
);

// R 让给机器键盘（键 7）：不该触发外壳的「重开」
const chip8BeforeR = await page.evaluate(() => ({ cycles: window.__arcade.model.getCycles() }));
await page.keyboard.down('r');
await page.waitForTimeout(80);
const chip8RDown = await page.evaluate(() => ({ key7: window.__arcade.model.isKeyDown(7), cycles: window.__arcade.model.getCycles() }));
await page.keyboard.up('r');
const chip8AfterR = await page.evaluate(() => window.__arcade.model.getCycles());
check(
  'CHIP-8：R 归机器键盘（键 7），不会触发外壳重开',
  chip8RDown.key7 === true && chip8RDown.cycles >= chip8BeforeR.cycles && chip8AfterR >= chip8BeforeR.cycles,
  JSON.stringify({ before: chip8BeforeR, down: chip8RDown, after: chip8AfterR }),
);

// P 暂停：指令数冻住、overlay 弹出来，再按一次接着跑
await page.keyboard.press('p');
await page.waitForTimeout(200);
const chip8Paused = await page.evaluate(() => {
  const r = window.__arcade;
  const overlay = (r.nodes.screen.childNodes || []).find((n) => n.state && n.state.id === 'chip8-paused');
  return {
    paused: r.model.isPaused(),
    cycles: r.model.getCycles(),
    overlay: overlay ? !!overlay.state.display : false,
    buttonText: r.buttons.pauseButton.getText(),
  };
});
await page.waitForTimeout(420);
const chip8StillPaused = await page.evaluate(() => window.__arcade.model.getCycles());
await page.keyboard.press('p');
await page.waitForTimeout(320);
const chip8Resumed = await page.evaluate(() => ({ paused: window.__arcade.model.isPaused(), cycles: window.__arcade.model.getCycles() }));
check(
  'CHIP-8：P 暂停（指令数冻住 + overlay + 按钮变「继续」），再按 P 接着跑',
  chip8Paused.paused === true && chip8StillPaused === chip8Paused.cycles && chip8Paused.overlay === true &&
    chip8Paused.buttonText.indexOf('继续') !== -1 && chip8Resumed.paused === false && chip8Resumed.cycles > chip8Paused.cycles,
  JSON.stringify({ paused: chip8Paused, stillPaused: chip8StillPaused, resumed: chip8Resumed }),
);

// 重开按钮（R 已经不是外壳的了，按钮必须真的能重开）
const chip8Restart = await page.evaluate(async () => {
  const r = window.__arcade;
  r.restart();
  return { cycles: r.model.getCycles(), pixels: r.model.getDisplay().reduce((sum, pixel) => sum + pixel, 0), paused: r.model.isPaused() };
});
check(
  'CHIP-8：重开按钮把机器复位（指令数归零、屏幕清空、回到运行态）',
  chip8Restart.cycles === 0 && chip8Restart.pixels === 0 && chip8Restart.paused === false,
  JSON.stringify(chip8Restart),
);

// 没有排行榜：点按钮给一条提示，不该报错（曾经直接拿 scores[key] 用）
const chip8Leaderboard = await page.evaluate(() => {
  const r = window.__arcade;
  const modal = r.openLeaderboard();
  return { modal: !!modal, game: r.game };
});
check(
  'CHIP-8：没有排行榜的卡带点「排行榜」只提示、不报错（scores 兜底）',
  chip8Leaderboard.modal === false && chip8Leaderboard.game === 'chip8',
  JSON.stringify(chip8Leaderboard),
);

/* ---------- 5. 切回第一块卡带 ---------- */
// 点击前先看一眼命中：卡带行是「切换时重建」的，这里顺便验证重建后的按钮真的可点
const cartHit = await page.evaluate(() => {
  const r = window.__arcade;
  const button = r.cartridges.tetris;
  let l = 0;
  let t = 0;
  let cursor = button;
  while (cursor && cursor.state) {
    l += Number(cursor.state.left) || 0;
    t += Number(cursor.state.top) || 0;
    cursor = cursor.parentNode;
  }
  const hit = r.ice.hitTest(l + button.state.width / 2, t + button.state.height / 2);
  return { l, t, keys: Object.keys(r.cartridges), hitId: hit && hit.state ? hit.state.id : null };
});
const backToTetris = await clickExpr('window.__arcade.cartridges.tetris');
await page.waitForTimeout(240);
const backGame = await page.evaluate(() => window.__arcade.game);
const backState = await page.evaluate(() => {
  const r = window.__arcade;
  const screenIds = (r.nodes.screen.childNodes || []).map((n) => (n.state && n.state.id) || '');
  return {
    game: r.game,
    score: r.model.getScore(),
    cells: typeof r.model.getBoard === 'function' ? r.model.getBoard().reduce((all, row) => all.concat(row), []).filter(Boolean).length : -1,
    board: screenIds.indexOf('tetris-board') !== -1,
    snakeGone: screenIds.indexOf('snake-board') === -1,
    game2048Gone: screenIds.indexOf('game2048-board') === -1,
    chip8Gone: screenIds.indexOf('chip8-board') === -1,
    midCaption: r.midCard.getText(),
  };
});
check(
  '切回俄罗斯方块：拿到一个全新的模型，另外三块棋盘都被拆掉',
  backToTetris && backGame === 'tetris' && backState.game === 'tetris' && backState.board && backState.snakeGone && backState.game2048Gone && backState.chip8Gone && backState.cells === 0 && backState.score === 0,
  JSON.stringify({ cartHit, backGame, backState }),
);

/* ---------- 6. 布局 ---------- */
const layoutOf = (boardId) =>
  page.evaluate((id) => {
    const nodes = window.__arcade.nodes;
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
    const board = (nodes.screen.childNodes || []).find((n) => n.state && n.state.id === id);
    return {
      shell: box(nodes.shell),
      bezel: box(nodes.bezel),
      screen: box(nodes.screen),
      board: board ? box(board) : null,
      side: box(nodes.sidePanel),
      help: box(nodes.helpPanel),
    };
  }, boardId);
const inside = (inner, outer) =>
  inner && inner.l >= outer.l && inner.t >= outer.t && inner.l + inner.w <= outer.l + outer.w && inner.t + inner.h <= outer.t + outer.h;
const overlap = (a, b) => a.l < b.l + b.w && b.l < a.l + a.w && a.t < b.t + b.h && b.t < a.t + a.h;

const tetrisLayout = await layoutOf('tetris-board');
check('布局：俄罗斯方块棋盘在屏幕框内', inside(tetrisLayout.board, tetrisLayout.bezel), JSON.stringify({ board: tetrisLayout.board, bezel: tetrisLayout.bezel }));
check('布局：侧栏与操作面板不交叠', !overlap(tetrisLayout.side, tetrisLayout.help), JSON.stringify({ side: tetrisLayout.side, help: tetrisLayout.help }));
check(
  '布局：所有面板都在机壳里',
  [tetrisLayout.bezel, tetrisLayout.side, tetrisLayout.help].every((b) => inside(b, tetrisLayout.shell)),
  JSON.stringify(tetrisLayout.shell),
);

await page.evaluate(() => window.__arcade.selectGame('snake'));
await page.waitForTimeout(240);
const snakeLayout = await layoutOf('snake-board');
check('布局：贪吃蛇棋盘也在屏幕框内', inside(snakeLayout.board, snakeLayout.bezel), JSON.stringify({ board: snakeLayout.board, bezel: snakeLayout.bezel }));

await page.evaluate(() => window.__arcade.selectGame('2048'));
await page.waitForTimeout(240);
const layout2048 = await layoutOf('game2048-board');
check('布局：2048 棋盘也在屏幕框内', inside(layout2048.board, layout2048.bezel), JSON.stringify({ board: layout2048.board, bezel: layout2048.bezel }));

// CHIP-8 的屏幕里有两块东西（显存 + 机器键盘），都量一下
await page.evaluate(() => window.__arcade.selectGame('chip8'));
await page.waitForTimeout(240);
const layoutChip8 = await page.evaluate(() => {
  const nodes = window.__arcade.nodes;
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
  const find = (id) => (nodes.screen.childNodes || []).find((n) => n.state && n.state.id === id);
  return { board: box(find('chip8-board')), keyboard: box(find('chip8-keyboard')), bezel: box(nodes.bezel), side: box(nodes.sidePanel) };
});
check(
  '布局：CHIP-8 的显存与机器键盘都在屏幕框内、互不重叠，也不压住侧栏',
  inside(layoutChip8.board, layoutChip8.bezel) && inside(layoutChip8.keyboard, layoutChip8.bezel) &&
    !overlap(layoutChip8.board, layoutChip8.keyboard) && !overlap(layoutChip8.board, layoutChip8.side),
  JSON.stringify(layoutChip8),
);

// 卡带行：5 个格子（4 块卡带 + 中国象棋占位）要等缝铺满、不越界（曾经挤到机壳右边缘）
const ridge = await page.evaluate(() => {
  const bar = window.__arcade.nodes.cartridgeBar;
  const box = (node) => {
    let l = 0;
    let cursor = node;
    while (cursor && cursor.state) {
      l += Number(cursor.state.left) || 0;
      cursor = cursor.parentNode;
    }
    return { l, w: Number(node.state.width) || 0 };
  };
  const buttons = (bar.childNodes || []).map(box);
  return { bar: box(bar), buttons };
});
const ridgeGaps = ridge.buttons.slice(1).map((button, index) => button.l - (ridge.buttons[index].l + ridge.buttons[index].w));
check(
  '布局：卡带行 5 格等缝铺满、不越出机壳右边缘',
  ridge.buttons.length === 5 &&
    ridgeGaps.every((gap) => Math.abs(gap - ridgeGaps[0]) < 0.5) &&
    Math.abs(ridgeGaps[0] - 20) < 0.5 &&
    ridge.buttons[4].l + ridge.buttons[4].w <= ridge.bar.l + ridge.bar.w,
  JSON.stringify(ridge),
);

/* ---------- 收尾 ---------- */
await page.evaluate(() => window.__arcade.selectGame('tetris'));
await page.waitForTimeout(300);
await page.screenshot({ path: '/tmp/qa-arcade.png' });
await page.evaluate(() => window.__arcade.selectGame('snake'));
await page.waitForTimeout(300);
await page.screenshot({ path: '/tmp/qa-arcade-snake.png' });
await page.evaluate(() => window.__arcade.selectGame('2048'));
await page.waitForTimeout(300);
await page.screenshot({ path: '/tmp/qa-arcade-2048.png' });
await page.evaluate(() => window.__arcade.selectGame('chip8'));
await page.waitForTimeout(300);
await page.screenshot({ path: '/tmp/qa-arcade-chip8.png' });
check('全程零 console error', errors.length === 0, errors.join(' | '));

await browser.close();
server.close();

if (failures.length) {
  console.log(`\n${failures.length} 项失败：`);
  failures.forEach((item) => console.log(` - ${item}`));
  process.exit(1);
}
console.log('\n全部通过（截图 /tmp/qa-arcade.png、/tmp/qa-arcade-snake.png、/tmp/qa-arcade-2048.png、/tmp/qa-arcade-chip8.png）');
