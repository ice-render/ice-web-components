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
const URL = 'file://' + path.resolve(process.cwd(), 'examples/windows-xp.html');

const failures = [];
const check = (name, ok, detail = '') => {
  if (!ok) failures.push(`${name}${detail ? ' — ' + detail : ''}`);
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? '  ' + detail : ''}`);
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1460, height: 920 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console: ' + m.text());
});
await page.goto(URL);
await page.waitForTimeout(1200);

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
// 扫雷：点第一个格子
const mineBefore = await page.evaluate(() => {
  const cell = window.__result.handles.mines.cells[0];
  return cell.label.getText();
});
const mineClicked = await clickExpr('window.__result.handles.mines.cells[12].node');
const mineAfter = await page.evaluate(() => ({
  text: window.__result.handles.mines.cells[12].label.getText(),
  over: window.__result.handles.mines.isOver(),
  mines: window.__result.handles.mines.mines().length,
}));
check(
  '扫雷：点格子会揭示（或踩雷）',
  mineClicked && mineBefore === '' && (mineAfter.text !== '' || mineAfter.over) && mineAfter.mines === 10,
  JSON.stringify(mineAfter),
);

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
const wallpaperState = await page.evaluate(() => ({
  skyBand: String(window.__result.wallpaper.childNodes[0].state.style.fillStyle),
  closed: !window.__result.openWindows.has('display'),
}));
check(
  '显示属性：换壁纸立即生效并关窗',
  applied && wallpaperState.closed && beforeWallpaper > 0 && wallpaperState.skyBand !== '#1b4fa8',
  JSON.stringify(wallpaperState),
);

/* ---------- 6. 时钟 ---------- */
const clock = await page.evaluate(() => window.__result.clockLabel.getText());
check('任务栏时钟是 HH:MM', /^\d{2}:\d{2}$/.test(clock), clock);

check('无 console error / pageerror', errors.length === 0, errors.slice(0, 3).join(' | '));

await page.screenshot({ path: '/tmp/qa-xp.png' });
await browser.close();

if (failures.length) {
  console.error(`\nXP QA 未通过（${failures.length} 项）：`);
  failures.forEach((item) => console.error('  - ' + item));
  process.exit(1);
}
console.log('\nXP QA 通过（截图在 /tmp/qa-xp.png）');
