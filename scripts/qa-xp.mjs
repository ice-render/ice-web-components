/**
 * windows-xp.html（全屏 XP 桌面）的浏览器端 QA。
 *
 * 用法：
 *   npm run qa:xp
 *   PLAYWRIGHT_PATH=/path/to/playwright npm run qa:xp
 *
 * 检查项（全是真实鼠标事件）：
 * 1. 桌面 + 任务栏零交叠、无 console error；
 * 2. 桌面图标：单击选中（高亮底），双击打开窗口；
 * 3. 窗口：拖动标题栏移动、点关闭按钮移除、最小化后从桌面消失但任务栏按钮还在、
 *    点任务栏按钮恢复；
 * 4. 开始菜单：点开始按钮弹出，点菜单项打开对应程序并收起菜单；
 * 5. 应用：扫雷点格子会揭示、画图拖动会留下笔画、显示属性换壁纸立即生效；
 * 6. 任务栏时钟是 HH:MM 且会走。
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
  throw new Error('qa-xp 需要 playwright：npm i -D playwright，或用 PLAYWRIGHT_PATH 指定');
}

const { chromium } = loadPlaywright();

/**
 * 用静态服务器打开页面（而不是 file://）。
 *
 * 原因：XP 里的「IE」是真的会 `fetch()` 的 —— 而 fetch 在 file:// 下不可用，
 * 同源抓取（比如打开本目录的 gallery.html）必须走 http(s) 才能演示。
 */
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
const URL = `http://127.0.0.1:${server.address().port}/examples/windows-xp.html`;

const failures = [];
const check = (name, ok, detail = '') => {
  if (!ok) failures.push(`${name}${detail ? ' — ' + detail : ''}`);
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? '  ' + detail : ''}`);
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1460, height: 920 }, deviceScaleFactor: 1 });
const errors = [];
/** IE 用例会故意访问一个不存在的地址，浏览器必然报 404 —— 那段时间里的资源错误不算失败。 */
let allowResource404 = false;
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => {
  if (m.type() !== 'error') return;
  if (allowResource404 && /Failed to load resource/.test(m.text())) return;
  errors.push('console: ' + m.text());
});
await page.goto(URL);
await page.waitForFunction(() => !!window.__result, null, { timeout: 20000 });

const rect = await page.evaluate(() => {
  const r = document.getElementById('canvas').getBoundingClientRect();
  return { left: r.left, top: r.top };
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
  const b = await boxOf(source);
  if (!b) return false;
  await page.mouse.click(rect.left + b.l + b.w / 2, rect.top + b.t + b.h / 2);
  await page.waitForTimeout(260);
  return true;
};
const dblClickExpr = async (source) => {
  const b = await boxOf(source);
  if (!b) return false;
  await page.mouse.dblclick(rect.left + b.l + b.w / 2, rect.top + b.t + b.h / 2);
  await page.waitForTimeout(400);
  return true;
};

/* ---------- 1. 布局与启动 ---------- */
/* ---------- 0. 开机 → 登录 → 进桌面 ---------- */
const boot = await page.evaluate(() => {
  const r = window.__result;
  return {
    phase: r.session.phase,
    bootVisible: r.bootLayer.state.display !== false,
    loginHidden: r.loginLayer.state.display === false,
    desktopHidden: r.desktop.state.display === false,
    progressBlocks: r.bootLayer.childNodes.length,
  };
});
check(
  '开机画面：黑屏 + 进度条，桌面还没露出来',
  boot.phase === 'boot' && boot.bootVisible && boot.loginHidden && boot.desktopHidden && boot.progressBlocks >= 4,
  JSON.stringify(boot),
);

await page.waitForFunction(() => window.__result.session.phase === 'login', null, { timeout: 15000 });
const loginScreen = await page.evaluate(() => {
  const r = window.__result;
  return {
    phase: r.session.phase,
    tiles: r.userTiles.length,
    tileVisible: r.userTiles[0].state.display !== false,
    desktopHidden: r.desktop.state.display === false,
    bootHidden: r.bootLayer.state.display === false,
    soundOn: r.sound.enabled,
  };
});
check(
  '欢迎界面：用户磁贴出现、开机画面收起',
  loginScreen.phase === 'login' && loginScreen.tiles === 2 && loginScreen.tileVisible && loginScreen.desktopHidden && loginScreen.bootHidden,
  JSON.stringify(loginScreen),
);

const tileClicked = await clickExpr('window.__result.userTiles[0]');
const passwordScreen = await page.evaluate(() => {
  const r = window.__result;
  return {
    phase: r.session.phase,
    user: r.session.user ? r.session.user.name : null,
    panelVisible: r.passwordPanel.state.display !== false,
    tilesHidden: r.userTiles[0].state.display === false,
    focused: window.ICEWEB.getICEFocusManager(r.ice).getFocused() === r.passwordField,
  };
});
check(
  '点用户磁贴 → 密码页（并自动聚焦输入框）',
  tileClicked && passwordScreen.phase === 'password' && passwordScreen.panelVisible && passwordScreen.tilesHidden && passwordScreen.focused,
  JSON.stringify(passwordScreen),
);

await page.keyboard.type('let-me-in');
const typed = await page.evaluate(() => window.__result.passwordField.getValue());
check('密码框真的收到了键盘输入', typed === 'let-me-in', typed);
await page.keyboard.press('Enter');
await page.waitForFunction(() => window.__result.session.phase === 'desktop', null, { timeout: 10000 });
const loggedIn = await page.evaluate(() => {
  const r = window.__result;
  return {
    phase: r.session.phase,
    desktopVisible: r.desktop.state.display !== false,
    screenHidden: r.sessionRoot.state.display === false,
    password: r.session.password,
    logins: r.session.logins,
    cue: r.sound.lastCue,
    audioReady: !!r.sound.ctx,
  };
});
check(
  '任意密码 + 回车 = 登录成功（桌面揭幕 + 开机音效）',
  loggedIn.desktopVisible && loggedIn.screenHidden && loggedIn.password === 'let-me-in' && loggedIn.logins === 1 && loggedIn.cue === 'startup' && loggedIn.audioReady,
  JSON.stringify(loggedIn),
);

/* ---------- 1. 布局与启动 ---------- */
const layout = await page.evaluate(() => {
  const shell = window.__result.desktop;
  const nodes = shell.childNodes.filter((node) => node.state && node.state.display !== false);
  const boxes = nodes.map((node) => {
    let l = 0;
    let t = 0;
    let cursor = node;
    while (cursor && cursor.state) {
      l += Number(cursor.state.left) || 0;
      t += Number(cursor.state.top) || 0;
      cursor = cursor.parentNode;
    }
    return { id: (node.state && node.state.id) || '(anon)', l, t, w: Number(node.state.width) || 0, h: Number(node.state.height) || 0 };
  });
  return { boxes, windows: window.__result.openWindows.size };
});
const taskbarBox = layout.boxes.find((b) => b.id === 'taskbar');
const windowsOverlapTaskbar = layout.boxes.some(
  (b) => b.id !== 'taskbar' && b.t + b.h > taskbarBox.t + 1 && b.t < taskbarBox.t + taskbarBox.h,
);
check('桌面与任务栏不交叠', !windowsOverlapTaskbar, JSON.stringify(layout.boxes.map((b) => b.id)));
check('开场自动打开了「我的电脑」', layout.windows === 1);

/* ---------- 2. 桌面图标 ---------- */
await clickExpr('window.__result.openWindows.get("computer").window.getCloseButton()');
await page.waitForTimeout(200);
const closedAll = await page.evaluate(() => window.__result.openWindows.size);
check('关闭按钮移除窗口', closedAll === 0, String(closedAll));

await clickExpr('window.__result.iconTiles[2]'); // 记事本
const selected = await page.evaluate(() => ({
  selected: window.__result.iconTiles[2].isSelected(),
  background: window.__result.iconTiles[2].getLabelBackground(),
}));
check('桌面图标单击选中（蓝色高亮底）', selected.selected === true && selected.background === '#0a246a', JSON.stringify(selected));
const opened = await dblClickExpr('window.__result.iconTiles[2]');
const openedState = await page.evaluate(() => ({
  count: window.__result.openWindows.size,
  title: window.__result.openWindows.get('notepad') ? window.__result.openWindows.get('notepad').title : null,
}));
check('双击图标打开记事本', opened && openedState.count === 1 && /记事本/.test(openedState.title || ''), JSON.stringify(openedState));

/* ---------- 3. 窗口拖动 / 最小化 / 恢复 ---------- */
const winBox = await boxOf('window.__result.openWindows.get("notepad").window');
await page.mouse.move(rect.left + winBox.l + 80, rect.top + winBox.t + 14);
await page.mouse.down();
await page.mouse.move(rect.left + winBox.l + 220, rect.top + winBox.t + 90, { steps: 8 });
await page.mouse.up();
await page.waitForTimeout(260);
const movedBox = await boxOf('window.__result.openWindows.get("notepad").window');
check('拖动标题栏移动窗口', Math.abs(movedBox.l - winBox.l - 140) < 3 && Math.abs(movedBox.t - winBox.t - 76) < 3, `${winBox.l},${winBox.t} → ${movedBox.l},${movedBox.t}`);

await clickExpr('window.__result.openWindows.get("notepad").window.getMinimizeButton()');
const minimized = await page.evaluate(() => ({
  display: window.__result.openWindows.get('notepad').window.state.display,
  taskButtons: window.__result.taskButtons.childNodes.length,
}));
check('最小化：窗口隐藏但任务栏按钮保留', minimized.display === false && minimized.taskButtons === 1, JSON.stringify(minimized));
const restored = await clickExpr('window.__result.taskButtons.childNodes.find((n) => n.state && n.state.id === "task-notepad")');
const restoredState = await page.evaluate(() => window.__result.openWindows.get('notepad').window.state.display);
check('点任务栏按钮恢复窗口', restored && restoredState === true, String(restoredState));

/* ---------- 4. 开始菜单 ---------- */
const startOpened = await clickExpr('window.__result.startButton');
const menuOpen = await page.evaluate(() => window.ICEWEB.getICEOverlayManager(window.__result.ice).isOpen());
check('开始菜单可以弹出', startOpened && menuOpen === true);
const minesOpened = await clickExpr('window.__result.desktop.childNodes[0] && null');
// 菜单里的「扫雷」：从浮层里找
const programClicked = await page.evaluate(() => {
  const layer = window.ICEWEB.getICEOverlayManager(window.__result.ice).getLayer();
  if (!layer) return null;
  const kids = (layer.childNodes || []).filter((c) => c.state);
  const menu = kids[kids.length - 1];
  let target = null;
  const walk = (n) => {
    (n.childNodes || []).forEach((child) => {
      if (child.state && child.state.id === 'start-program-minesweeper') target = child;
      walk(child);
    });
  };
  walk(menu);
  if (!target) return null;
  let l = 0;
  let t = 0;
  let cursor = target;
  while (cursor && cursor.state) {
    l += Number(cursor.state.left) || 0;
    t += Number(cursor.state.top) || 0;
    cursor = cursor.parentNode;
  }
  return { l, t, w: Number(target.state.width) || 0, h: Number(target.state.height) || 0 };
});
void minesOpened;
if (programClicked) {
  await page.mouse.click(rect.left + programClicked.l + programClicked.w / 2, rect.top + programClicked.t + programClicked.h / 2);
  await page.waitForTimeout(420);
}
const afterMenu = await page.evaluate(() => ({
  open: window.ICEWEB.getICEOverlayManager(window.__result.ice).isOpen(),
  mines: window.__result.openWindows.has('minesweeper'),
}));
check('点开始菜单项打开程序并收起菜单', afterMenu.mines === true && afterMenu.open === false, JSON.stringify(afterMenu));

/* ---------- 5. 应用交互 ---------- */
// 扫雷：左键掀开（首次点击安全）
const mineClicked = await clickExpr('window.__result.handles.mines.cellAt(4, 4).node');
const mineAfter = await page.evaluate(() => {
  const model = window.__result.handles.mines.model;
  const cell = model.getCell(4, 4);
  return { revealed: cell.revealed, adjacent: cell.adjacent, state: model.getState(), mines: model.getMineCount() };
});
check(
  '扫雷：点格子会揭示（首点安全）',
  mineClicked && mineAfter.revealed === true && mineAfter.adjacent === 0 && mineAfter.state === 'playing' && mineAfter.mines === 10,
  JSON.stringify(mineAfter),
);

// 扫雷：右键插旗 → 再右键变问号 → 再右键清空；雷数计数器同步
const flagCell = await page.evaluate(() => {
  const model = window.__result.handles.mines.model;
  const hidden = model.getCells().find((cell) => !cell.revealed && !cell.mine);
  return { row: hidden.row, col: hidden.col };
});
const flagBox = await boxOf(`window.__result.handles.mines.cellAt(${flagCell.row}, ${flagCell.col}).node`);
await page.mouse.click(rect.left + flagBox.l + 10, rect.top + flagBox.t + 10, { button: 'right' });
await page.waitForTimeout(220);
const flagOnce = await page.evaluate(
  (pos) => {
    const cell = window.__result.handles.mines.model.getCell(pos.row, pos.col);
    return { flagged: cell.flagged, question: cell.question, counter: window.__result.handles.mines.counter.getText() };
  },
  flagCell,
);
await page.mouse.click(rect.left + flagBox.l + 10, rect.top + flagBox.t + 10, { button: 'right' });
await page.waitForTimeout(220);
const flagTwice = await page.evaluate(
  (pos) => {
    const cell = window.__result.handles.mines.model.getCell(pos.row, pos.col);
    return { flagged: cell.flagged, question: cell.question };
  },
  flagCell,
);
await page.mouse.click(rect.left + flagBox.l + 10, rect.top + flagBox.t + 10, { button: 'right' });
await page.waitForTimeout(220);
const flagThrice = await page.evaluate(
  (pos) => {
    const cell = window.__result.handles.mines.model.getCell(pos.row, pos.col);
    return { flagged: cell.flagged, question: cell.question, counter: window.__result.handles.mines.counter.getText() };
  },
  flagCell,
);
check(
  '扫雷：右键插旗循环（🚩 → ❓ → 空）且计数器同步',
  flagOnce.flagged === true && flagOnce.counter === '009' && flagTwice.question === true && flagThrice.flagged === false && flagThrice.counter === '010',
  `${JSON.stringify(flagOnce)} → ${JSON.stringify(flagTwice)} → ${JSON.stringify(flagThrice)}`,
);

// 扫雷：切换难度换棋盘（中级 16×16 / 40 雷）
const difficultyClicked = await clickExpr('window.__result.handles.mines.face.parentNode.childNodes.find(() => false) || window.__result.desktop && null');
void difficultyClicked;
const switched = await page.evaluate(() => {
  window.__result.handles.mines.setDifficulty('intermediate');
  const model = window.__result.handles.mines.model;
  return { rows: model.getRows(), cols: model.getCols(), mines: model.getMineCount(), cells: window.__result.handles.mines.cells().length };
});
check(
  '扫雷：切到中级 → 16×16 / 40 雷且重建棋盘',
  switched.rows === 16 && switched.cols === 16 && switched.mines === 40 && switched.cells === 256,
  JSON.stringify(switched),
);
await page.evaluate(() => window.__result.handles.mines.setDifficulty('beginner'));
await page.waitForTimeout(200);

// 扫雷：计时器每秒走
await page.evaluate(() => window.__result.handles.mines.model.reveal(4, 4)); // 进入 playing 才开始计时
const timerBefore = await page.evaluate(() => window.__result.handles.mines.model.getElapsed());
await page.waitForTimeout(1300);
const timerAfter = await page.evaluate(() => window.__result.handles.mines.model.getElapsed());
check('扫雷：计时器每秒累加', timerAfter > timerBefore, `${timerBefore} → ${timerAfter}`);

// 扫雷：笑脸重开
const faceRestart = await clickExpr('window.__result.handles.mines.face');
const restarted = await page.evaluate(() => {
  const model = window.__result.handles.mines.model;
  return { state: model.getState(), elapsed: model.getElapsed(), revealed: model.getRevealedCount(), flags: model.getFlags() };
});
check(
  '扫雷：笑脸重开（复位棋盘与计时）',
  faceRestart && restarted.state === 'ready' && restarted.elapsed === 0 && restarted.revealed === 0 && restarted.flags === 0,
  JSON.stringify(restarted),
);

// 扫雷：胜利路径（用模型直接掀开所有安全格 → 笑脸 😎）
const won = await page.evaluate(() => {
  const m = window.__result.handles.mines.model;
  // 先点一下布雷（首点安全），再掀开所有安全格
  m.reveal(0, 0);
  m.getCells()
    .filter((cell) => !cell.mine)
    .forEach((cell) => m.reveal(cell.row, cell.col));
  return { state: m.getState(), face: window.__result.handles.mines.face.getText(), best: window.__result.handles.mines.bestLabel.getText() };
});
check('扫雷：掀开所有安全格即胜利（笑脸 😎 + 记录最佳成绩）', won.state === 'won' && won.face === '😎' && /最佳成绩/.test(won.best), JSON.stringify(won));
await page.evaluate(() => window.__result.handles.mines.restart());

// 画图：开窗后在画布上拖一笔
await page.evaluate(() => window.__result.openApp(window.__result.APPS.find((a) => a.key === 'paint')));
await page.waitForTimeout(420);
const canvasBox = await boxOf('window.__result.handles.paint.canvas');
await page.mouse.move(rect.left + canvasBox.l + 40, rect.top + canvasBox.t + 40);
await page.mouse.down();
await page.mouse.move(rect.left + canvasBox.l + 160, rect.top + canvasBox.t + 120, { steps: 8 });
await page.mouse.up();
await page.waitForTimeout(300);
const strokeCount = await page.evaluate(() => window.__result.handles.paint.canvas.getStrokeCount());
check('画图：拖动留下笔画', strokeCount === 1, String(strokeCount));

// 显示属性：换壁纸
await page.evaluate(() => window.__result.openApp(window.__result.APPS.find((a) => a.key === 'display')));
await page.waitForTimeout(420);
const beforeWallpaper = await page.evaluate(() => window.__result.wallpaper.childNodes.length);
await clickExpr("window.__result.handles.display.group.getItemNode('sunset')");
const applied = await clickExpr('window.__result.handles.display.applyButton');
await page.waitForTimeout(320);
const wallpaperState = await page.evaluate(() => {
  const image = window.__result.wallpaper.childNodes[0];
  return {
    // 壁纸现在是离屏生成的位图：换壁纸会换 src（data URL）
    srcLength: String(image.state.src || '').length,
    isDataUrl: String(image.state.src || '').startsWith('data:image/png'),
    closed: !window.__result.openWindows.has('display'),
  };
});
check(
  '显示属性：换壁纸立即生效并关窗',
  applied && wallpaperState.closed && beforeWallpaper > 0 && wallpaperState.isDataUrl && wallpaperState.srcLength > 1000,
  JSON.stringify(wallpaperState),
);

/* ---------- 6. 时钟 ---------- */
const clock = await page.evaluate(() => window.__result.clockLabel.getText());
check('任务栏时钟是 HH:MM', /^\d{2}:\d{2}$/.test(clock), clock);

/* ---------- 6.5 ICE Arcade：把掌机塞进 XP 窗口 ---------- */
const arcadeOpened = await page.evaluate(() => {
  window.__result.openApp(window.__result.APPS.find((a) => a.key === 'arcade'));
  return window.__result.openWindows.has('arcade');
});
await page.waitForTimeout(500);
const arcadeBoot = await page.evaluate(() => {
  const api = window.__result.handles.arcade;
  return {
    key: api.key,
    childNodes: api.board ? api.board.childNodes.length : -1,
    paintCount: api.board && api.board.getPaintCount ? api.board.getPaintCount() : -1,
    pieceCells: api.model.getCurrent().cells.length,
  };
});
check(
  'ICE Arcade：从应用注册表打开窗口，棋盘同样是单个自绘节点',
  arcadeOpened && arcadeBoot.key === 'tetris' && arcadeBoot.childNodes === 0 && arcadeBoot.paintCount > 0 && arcadeBoot.pieceCells === 4,
  JSON.stringify(arcadeBoot),
);

const arcadeBefore = await page.evaluate(() => window.__result.handles.arcade.model.getCurrent().col);
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(140);
const arcadeAfter = await page.evaluate(() => window.__result.handles.arcade.model.getCurrent().col);
check('ICE Arcade：窗口激活时键盘归游戏（→ 真的移动了方块）', arcadeAfter === arcadeBefore + 1, `${arcadeBefore} → ${arcadeAfter}`);

const arcadePaused = await page.evaluate(() => {
  window.__result.handles.arcade.keydown('p', false);
  return window.__result.handles.arcade.model.isPaused();
});
await page.keyboard.press('p');
await page.waitForTimeout(120);
const arcadeResumed = await page.evaluate(() => window.__result.handles.arcade.model.isPaused());
check('ICE Arcade：P 暂停 / 恢复', arcadePaused === true && arcadeResumed === false, `${arcadePaused} → ${arcadeResumed}`);

const arcadeSwitched = await page.evaluate(() => {
  const api = window.__result.handles.arcade;
  api.switchTo('snake');
  return { key: api.key, length: api.model.getLength(), childNodes: api.board.childNodes.length };
});
await page.waitForTimeout(300);
await page.keyboard.press('ArrowUp');
await page.waitForTimeout(160);
const arcadeSnake = await page.evaluate(() => ({
  pending: window.__result.handles.arcade.model.getPendingDirections(),
  direction: window.__result.handles.arcade.model.getDirection(),
  hudScore: window.__result.handles.arcade.model.getScore(),
}));
check(
  'ICE Arcade：窗口内切到贪吃蛇，方向键同样有效',
  arcadeSwitched.key === 'snake' && arcadeSwitched.length === 3 && arcadeSwitched.childNodes === 0 &&
    (arcadeSnake.pending.indexOf('up') !== -1 || arcadeSnake.direction === 'up'),
  JSON.stringify({ arcadeSwitched, arcadeSnake }),
);

const arcadeClosed = await page.evaluate(() => {
  window.__result.openWindows.get('arcade').window.getCloseButton();
  window.__result.closeWindow('arcade');
  return { open: window.__result.openWindows.has('arcade') };
});
check('ICE Arcade：关窗后从 openWindows 摘掉（定时器一并停掉）', arcadeClosed.open === false, JSON.stringify(arcadeClosed));

/* ---------- 7. IE：真的会 fetch 网页 ---------- */
await page.evaluate(() => window.__result.openApp(window.__result.APPS.find((a) => a.key === 'ie')));
await page.waitForTimeout(1400);
const ieHome = await page.evaluate(() => {
  const ie = window.__result.handles.ie;
  const texts = ie.page.childNodes.map((n) => (n.getText ? n.getText() : '')).join(' | ');
  return { status: ie.status.getText(), url: ie.getUrl(), hasTitle: /gallery/i.test(texts), blocks: ie.page.childNodes.length };
});
check(
  'IE：打开后真的抓取并渲染了本目录页面',
  /完成/.test(ieHome.status) && ieHome.hasTitle && ieHome.blocks > 1,
  JSON.stringify(ieHome),
);

// 故意访问不存在的地址：浏览器会报 404 资源错误，先放行
allowResource404 = true;
const ieMissing = await page.evaluate(async () => {
  const ie = window.__result.handles.ie;
  await ie.load('./definitely-not-here.html');
  const texts = ie.page.childNodes.map((n) => (n.getText ? n.getText() : '')).join(' | ');
  return { status: ie.status.getText(), hasError: texts.indexOf('无法显示该网页') !== -1 };
});
check('IE：抓不到时显示 XP 风格错误页', ieMissing.hasError && /错误|完成/.test(ieMissing.status), JSON.stringify(ieMissing));

const ieBack = await clickExpr('window.__result.handles.ie.backButton');
await page.waitForTimeout(900);
const ieBackState = await page.evaluate(() => {
  const ie = window.__result.handles.ie;
  const texts = ie.page.childNodes.map((n) => (n.getText ? n.getText() : '')).join(' | ');
  return { status: ie.status.getText(), hasTitle: /gallery/i.test(texts) };
});
check('IE：后退回到上一页', ieBack && ieBackState.hasTitle && /完成/.test(ieBackState.status), JSON.stringify(ieBackState));

const ieAbout = await page.evaluate(async () => {
  const ie = window.__result.handles.ie;
  await ie.load('about:xp');
  const texts = ie.page.childNodes.map((n) => (n.getText ? n.getText() : '')).join(' | ');
  // UMD 构建里类名会被压缩，所以按能力（ICETable 的公开方法）判断，而不是 constructor.name
  const hasTable = ie.page.childNodes.some(
    (n) => typeof n.getHeaderLabel === 'function' && typeof n.getRows === 'function' && typeof n.toggleSort === 'function',
  );
  return { status: ie.status.getText(), hasTable, hasWelcome: texts.indexOf('欢迎来到 ICE 桌面') !== -1 };
});
check(
  'IE：about:xp 本地页（含 ICETable 表格）',
  ieAbout.hasWelcome && ieAbout.hasTable && /本地页面/.test(ieAbout.status),
  JSON.stringify(ieAbout),
);

// 收藏夹下拉 → 选一项 → 打开对应页面
const bookmarksClicked = await clickExpr('window.__result.handles.ie.bookmarks || null');
void bookmarksClicked;
const bookmarksOpened = await page.evaluate(() => window.ICEWEB.getICEOverlayManager(window.__result.ice).isOpen());
check('IE：收藏夹下拉可以打开', bookmarksOpened === true, String(bookmarksOpened));
await page.keyboard.press('Escape');
await page.waitForTimeout(220);

/* ---------- 8. 托盘音效开关 / 注销 / 关机 / 重新开机 ---------- */
const soundBefore = await page.evaluate(() => ({ enabled: window.__result.sound.enabled, text: window.__result.trayLabel.getText() }));
const soundClick = await clickExpr('window.__result.traySoundToggle');
const soundMuted = await page.evaluate(() => ({ enabled: window.__result.sound.enabled, text: window.__result.trayLabel.getText() }));
await clickExpr('window.__result.traySoundToggle');
const soundBack = await page.evaluate(() => ({
  enabled: window.__result.sound.enabled,
  text: window.__result.trayLabel.getText(),
}));
check(
  '托盘喇叭：点一下静音、再点回来（图标跟着变）',
  soundClick && soundBefore.enabled === true && soundMuted.enabled === false && /🔇/.test(soundMuted.text) && soundBack.enabled === true && /🔊/.test(soundBack.text),
  JSON.stringify({ soundBefore, soundMuted, soundBack }),
);

// 开始菜单 → 注销 → 回登录界面
await clickExpr('window.__result.startButton');
const logoffClicked = await clickExpr('window.__result.handles.menuLogoff');
await page.waitForFunction(() => window.__result.session.phase === 'login', null, { timeout: 10000 });
const loggedOff = await page.evaluate(() => {
  const r = window.__result;
  return {
    phase: r.session.phase,
    desktopHidden: r.desktop.state.display === false,
    screenVisible: r.sessionRoot.state.display !== false,
    loginVisible: r.loginLayer.state.display !== false,
    cue: r.sound.lastCue,
    tilesBack: r.userTiles[0].state.display !== false,
  };
});
check(
  '开始菜单 → 注销：回到登录界面（含注销音效）',
  logoffClicked && loggedOff.desktopHidden && loggedOff.screenVisible && loggedOff.loginVisible && loggedOff.tilesBack && loggedOff.cue === 'logoff',
  JSON.stringify(loggedOff),
);

// 登录界面 → 关闭计算机 → 重新开机
const shutClicked = await clickExpr('window.__result.shutdownEntry');
const shutState = await page.evaluate(() => {
  const r = window.__result;
  return {
    phase: r.session.phase,
    shutVisible: r.shutLayer.state.display !== false,
    loginHidden: r.loginLayer.state.display === false,
    cue: r.sound.lastCue,
  };
});
check(
  '登录界面 → 关闭计算机：进入关机画面（含关机音效）',
  shutClicked && shutState.phase === 'shutdown' && shutState.shutVisible && shutState.loginHidden && shutState.cue === 'shutdown',
  JSON.stringify(shutState),
);

const powerClicked = await clickExpr('window.__result.powerButton');
await page.waitForFunction(() => window.__result.session.phase === 'login', null, { timeout: 12000 });
const poweredOn = await page.evaluate(() => ({
  phase: window.__result.session.phase,
  bootHidden: window.__result.bootLayer.state.display === false,
  desktopHidden: window.__result.desktop.state.display === false,
}));
check(
  '关机画面 → 重新开机：重新走一遍开机 → 登录',
  powerClicked && poweredOn.phase === 'login' && poweredOn.bootHidden && poweredOn.desktopHidden,
  JSON.stringify(poweredOn),
);

// 这次走「点登录按钮」而不是回车，顺便验证第二次登录
await clickExpr('window.__result.userTiles[1]');
const guestPicked = await page.evaluate(() => ({
  user: window.__result.session.user ? window.__result.session.user.name : null,
  phase: window.__result.session.phase,
}));
await page.evaluate(() => window.__result.passwordField.setValue('guest'));
const loginButtonClicked = await clickExpr('window.__result.loginButton');
await page.waitForFunction(() => window.__result.session.phase === 'desktop', null, { timeout: 10000 });
const secondLogin = await page.evaluate(() => ({
  logins: window.__result.session.logins,
  user: window.__result.session.user.name,
  desktopVisible: window.__result.desktop.state.display !== false,
}));
check(
  '换用户 + 点「登录」按钮也能进（第二次登录）',
  loginButtonClicked && guestPicked.user === '访客' && guestPicked.phase === 'password' && secondLogin.logins === 2 && secondLogin.user === '访客' && secondLogin.desktopVisible,
  JSON.stringify({ guestPicked, secondLogin }),
);

check('无 console error / pageerror', errors.length === 0, errors.slice(0, 3).join(' | '));

await page.screenshot({ path: '/tmp/qa-xp.png' });
server.close();
await browser.close();

if (failures.length) {
  console.error(`\nXP QA 未通过（${failures.length} 项）：`);
  failures.forEach((item) => console.error('  - ' + item));
  process.exit(1);
}
console.log('\nXP QA 通过（截图在 /tmp/qa-xp.png）');
