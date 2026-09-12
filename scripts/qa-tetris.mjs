/**
 * tetris.html（ICE Arcade 掌机）的浏览器端 QA。
 *
 * 用法：
 *   npm run qa:tetris
 *   PLAYWRIGHT_PATH=/path/to/playwright npm run qa:tetris
 *
 * 检查项（键盘部分全是真实按键，鼠标部分全是真实点击）：
 * 1. 开局：零 console error、200 格空棋盘、HUD 与模型一致；
 * 2. 方向键左右移动 / 撞墙不越界；
 * 3. ↑ 旋转（O 形旋转不变，其余方块形状必变）；
 * 4. ↓ 软降 +1 分；空格硬降锁定并按格加分；
 * 5. 重力会自己走（1.1s 内状态一定变化）；
 * 6. P 暂停时重力与输入都停摆，再按 P 恢复；
 * 7. 消行：造一个只缺当前方块落点的底行 → 硬降必消一行，分数/HUD/闪屏同步；
 * 8. 一路硬降到 game over：overlay 出现、最高分写入 localStorage；
 * 9. R 重开：棋盘清空、分数归零、overlay 收起；
 * 10. 鼠标点「暂停」「重新开始」「音效开关」都有反应；
 * 11. 布局：棋盘在屏幕框内，两块面板互不交叠，所有元素都在机壳里。
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
  throw new Error('qa-tetris 需要 playwright：npm i -D playwright，或用 PLAYWRIGHT_PATH 指定');
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
const URL = `http://127.0.0.1:${server.address().port}/examples/tetris.html`;

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
// UMD 包在冷启动时要解析一会儿，等页面真的挂上句柄再开始（比写死 sleep 稳）
await page.waitForFunction(() => !!window.__arcade, null, { timeout: 20000 });
await page.waitForTimeout(400);

/** 板上已落方块数 + 当前方块行号：用来判断「有没有动」。 */
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

/* ---------- 1. 开局 ---------- */
const boot = await page.evaluate(() => {
  const model = window.__arcade.model;
  return {
    cells: model.getBoard().reduce((all, row) => all.concat(row), []).filter(Boolean).length,
    score: model.getScore(),
    lines: model.getLines(),
    level: model.getLevel(),
    hudScore: document.querySelectorAll('canvas').length,
    scoreText: window.__arcade.scoreCard.getText(),
    pieceCells: model.getCurrent().cells.length,
  };
});
check(
  '开局：空棋盘 + HUD 与模型一致',
  boot.cells === 0 && boot.score === 0 && boot.lines === 0 && boot.level === 1 && boot.scoreText === '0' && boot.pieceCells === 4,
  JSON.stringify(boot),
);
check('零 console error', errors.length === 0, errors.join(' | '));

/* ---------- 2. 左右移动 ---------- */
await ensureRunning();
const beforeMove = await page.evaluate(() => window.__arcade.model.getCurrent().col);
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(80);
const afterRight = await page.evaluate(() => window.__arcade.model.getCurrent().col);
await page.keyboard.press('ArrowLeft');
await page.waitForTimeout(80);
const afterLeft = await page.evaluate(() => window.__arcade.model.getCurrent().col);
check('→ 右移一格、← 左移回原位', afterRight === beforeMove + 1 && afterLeft === beforeMove, `${beforeMove} → ${afterRight} → ${afterLeft}`);

for (let i = 0; i < 14; i += 1) await page.keyboard.press('ArrowLeft');
await page.waitForTimeout(120);
const leftMost = await page.evaluate(() => {
  const model = window.__arcade.model;
  return { min: Math.min(...model.getCurrent().cells.map(([, col]) => col)), col: model.getCurrent().col };
});
check('一路左移撞墙不越界', leftMost.min === 0, JSON.stringify(leftMost));

/* ---------- 3. 旋转 ---------- */
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
  beforeRotate.type === 'O' ? '↑ 旋转：O 形旋转后形状不变' : '↑ 旋转：形状改变且不出右边界',
  beforeRotate.type === 'O' ? afterRotate.cells === beforeRotate.cells : afterRotate.cells !== beforeRotate.cells && afterRotate.max < afterRotate.cols,
  `${beforeRotate.type} ${beforeRotate.cells} → ${afterRotate.cells}`,
);

/* ---------- 4. 软降 / 硬降 ---------- */
await page.evaluate(() => window.__arcade.model.reset());
await ensureRunning();
const beforeSoft = await page.evaluate(() => ({ score: window.__arcade.model.getScore(), row: window.__arcade.model.getCurrent().row }));
await page.keyboard.press('ArrowDown');
await page.waitForTimeout(80);
const afterSoft = await page.evaluate(() => ({ score: window.__arcade.model.getScore(), row: window.__arcade.model.getCurrent().row }));
// 只断言「至少落了一行、正好 +1 分」：同一瞬间自动重力也可能在走，行号不该写死成 +1
check('↓ 软降：往下走、加 1 分', afterSoft.row > beforeSoft.row && afterSoft.score === beforeSoft.score + 1, JSON.stringify(afterSoft));

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
  '空格硬降：锁定入板、切换到下一个方块、分数增加',
  afterHard.type === beforeHard.next && afterHard.locked >= beforeHard.locked + 4 && afterHard.score > beforeHard.score,
  JSON.stringify({ before: beforeHard, after: afterHard }),
);
check('HUD 分数与模型同步', Number(afterHard.hudScore) === afterHard.score, `${afterHard.hudScore} vs ${afterHard.score}`);

/* ---------- 5. 重力 ---------- */
await page.evaluate(() => window.__arcade.model.reset());
await ensureRunning();
const gravityBefore = await signature();
await page.waitForTimeout(1100);
const gravityAfter = await signature();
check('重力自己会走（1.1s 内状态变化）', gravityBefore !== gravityAfter, `${gravityBefore} → ${gravityAfter}`);

/* ---------- 6. 暂停 ---------- */
await page.keyboard.press('p');
await page.waitForTimeout(100);
const pausedState = await page.evaluate(() => ({
  paused: window.__arcade.model.isPaused(),
  overlay: window.__arcade.nodes.boardLayer.childNodes.some((n) => n.state && n.state.id === 'arcade-paused' && n.state.display !== false),
  buttonText: window.__arcade.buttons.pauseButton.getText(),
}));
const pausedSignature = await signature();
await page.waitForTimeout(1100);
await page.keyboard.press('ArrowLeft');
await page.waitForTimeout(60);
const pausedSignature2 = await signature();
check(
  'P 暂停：重力与输入都停摆，棋盘出现暂停提示',
  pausedState.paused === true && pausedState.overlay === true && /继续/.test(pausedState.buttonText) && pausedSignature === pausedSignature2,
  JSON.stringify({ pausedState, pausedSignature, pausedSignature2 }),
);
await page.keyboard.press('p');
await page.waitForTimeout(1100);
const resumedSignature = await signature();
check('再按 P 恢复：重力接着走', resumedSignature !== pausedSignature2, `${pausedSignature2} → ${resumedSignature}`);

/* ---------- 7. 消行 ---------- */
// 用固定随机序列（random 恒为 0 → 洗牌结果固定）让第一块必是 O：
// 只有 O / I / T / J / L 这类「落地那一行就是自身最宽行」的形状才能单独补满一行，
// S/Z 天生跨两行，拿它造题必然失败 —— 这正是之前这条用例偶发翻车的原因。
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
check('消行用例前置：固定随机序列下首块是 O', prepared.type === 'O' && prepared.bottom === 19, JSON.stringify(prepared));
await page.keyboard.press('Space');
await page.waitForTimeout(40);
const cleared = await page.evaluate(() => {
  const model = window.__arcade.model;
  const flash = window.__arcade.nodes.boardLayer.childNodes.find((n) => n.state && n.state.id === 'arcade-flash');
  return {
    lines: model.getLines(),
    last: model.getLastClearedLines(),
    score: model.getScore(),
    flash: flash ? flash.state.display !== false : false,
    leftover: model.getBoard()[19].filter((cell) => cell === 'J').length,
  };
});
check(
  '消一行：行数 +1、底行清空、闪屏亮起',
  cleared.lines === prepared.lines + 1 && cleared.last === 1 && cleared.leftover === 0 && cleared.flash === true,
  JSON.stringify(cleared),
);

/* ---------- 8. 一路硬降到 game over ---------- */
let over = false;
for (let i = 0; i < 80 && !over; i += 1) {
  await page.keyboard.press('Space');
  over = await page.evaluate(() => window.__arcade.model.isGameOver());
}
await page.waitForTimeout(260);
const overState = await page.evaluate(() => ({
  over: window.__arcade.model.isGameOver(),
  overlay: window.__arcade.nodes.boardLayer.childNodes.some((n) => n.state && n.state.id === 'arcade-over' && n.state.display !== false),
  best: localStorage.getItem('ice-arcade-tetris-best'),
  bestText: window.__arcade.bestLabel.getText(),
  score: window.__arcade.model.getScore(),
}));
check(
  '硬降到底触发 game over：提示出现、最高分落盘',
  overState.over === true && overState.overlay === true && Number(overState.best) === overState.score,
  JSON.stringify(overState),
);
check('最高分标签跟着更新', /最高分/.test(overState.bestText) && overState.bestText.indexOf(String(overState.best)) !== -1, overState.bestText);

/* ---------- 9. R 重开 ---------- */
await page.keyboard.press('r');
await page.waitForTimeout(200);
const restarted = await page.evaluate(() => {
  const model = window.__arcade.model;
  return {
    over: model.isGameOver(),
    cells: model.getBoard().reduce((all, row) => all.concat(row), []).filter(Boolean).length,
    score: model.getScore(),
    lines: model.getLines(),
    overlay: window.__arcade.nodes.boardLayer.childNodes.some((n) => n.state && n.state.id === 'arcade-over' && n.state.display !== false),
  };
});
check(
  'R 重开：棋盘清空、分数归零、结束提示收起',
  restarted.over === false && restarted.cells === 0 && restarted.score === 0 && restarted.lines === 0 && restarted.overlay === false,
  JSON.stringify(restarted),
);

/* ---------- 10. 鼠标交互 ---------- */
const clickedPause = await clickExpr('window.__arcade.buttons.pauseButton');
const pausedByClick = await page.evaluate(() => window.__arcade.model.isPaused());
await clickExpr('window.__arcade.buttons.pauseButton');
const resumedByClick = await page.evaluate(() => window.__arcade.model.isPaused());
check('点「暂停 / 继续」按钮可切换', clickedPause && pausedByClick === true && resumedByClick === false, `${pausedByClick} → ${resumedByClick}`);

await page.evaluate(() => window.__arcade.model.hardDrop());
const clickedRestart = await clickExpr('window.__arcade.buttons.restartButton');
const restartedByClick = await page.evaluate(() => ({
  score: window.__arcade.model.getScore(),
  cells: window.__arcade.model.getBoard().reduce((all, row) => all.concat(row), []).filter(Boolean).length,
}));
check('点「重新开始」按钮清空棋盘', clickedRestart && restartedByClick.score === 0 && restartedByClick.cells === 0, JSON.stringify(restartedByClick));

const soundBefore = await page.evaluate(() => window.__arcade.buttons.soundSwitch.isSelected());
await clickExpr('window.__arcade.buttons.soundSwitch');
const soundAfter = await page.evaluate(() => ({ selected: window.__arcade.buttons.soundSwitch.isSelected(), enabled: window.__arcade.sound.enabled }));
check('点音效开关：开关状态与音效开关同步', soundBefore === true && soundAfter.selected === false && soundAfter.enabled === false, JSON.stringify(soundAfter));

/* ---------- 11. 布局 ---------- */
const layout = await page.evaluate(() => {
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
  return {
    shell: box(nodes.shell),
    bezel: box(nodes.bezel),
    board: box(nodes.boardLayer),
    next: box(nodes.nextPanel),
    help: box(nodes.helpPanel),
  };
});
const inside = (inner, outer) =>
  inner.l >= outer.l && inner.t >= outer.t && inner.l + inner.w <= outer.l + outer.w && inner.t + inner.h <= outer.t + outer.h;
const overlap = (a, b) => a.l < b.l + b.w && b.l < a.l + a.w && a.t < b.t + b.h && b.t < a.t + a.h;
check('棋盘完整落在屏幕框内', inside(layout.board, layout.bezel), JSON.stringify({ board: layout.board, bezel: layout.bezel }));
check('「下一批」与「操作」面板不交叠', !overlap(layout.next, layout.help), JSON.stringify({ next: layout.next, help: layout.help }));
check(
  '所有面板都在机壳内',
  [layout.bezel, layout.next, layout.help].every((box) => inside(box, layout.shell)),
  JSON.stringify(layout.shell),
);

/* ---------- 收尾 ---------- */
await page.screenshot({ path: '/tmp/qa-tetris.png' });
check('全程零 console error', errors.length === 0, errors.join(' | '));

await browser.close();
server.close();

if (failures.length) {
  console.log(`\n${failures.length} 项失败：`);
  failures.forEach((item) => console.log(` - ${item}`));
  process.exit(1);
}
console.log('\n全部通过（截图 /tmp/qa-tetris.png）');
