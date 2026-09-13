/**
 * dos-terminal.html（ICE-DOS Terminal）的浏览器端 QA。
 *
 * 用法：
 *   npm run qa:dos
 *   PLAYWRIGHT_PATH=/path/to/playwright npm run qa:dos
 *
 * 检查项（全是真键盘输入）：
 * 1. 开机：横幅、提示符 C:\>、零 console error；
 * 2. 命令：dir（含文件与大小）、cd（提示符跟着变）、type（跨目录 `..\` 路径）；
 * 3. 编辑：TAB 补全（命令名与文件名）、↑ 历史、Backspace、未知命令报错；
 * 4. 重定向：echo hello > note.txt 之后 type 得回 hello；
 * 5. 副作用：Ctrl+L / cls 清屏、exit 退出（任意键重新开机）、「重新开机」按钮；
 * 6. 体验：输出变长之后自动滚到底；
 * 7. 布局：终端窗口与提示栏都在机壳里、互不重叠。
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
  throw new Error('qa-dos 需要 playwright：npm i -D playwright，或用 PLAYWRIGHT_PATH 指定');
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
const URL = `http://127.0.0.1:${server.address().port}/examples/dos-terminal.html`;

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
await page.waitForFunction(() => !!window.__dos, null, { timeout: 20000 });
await page.waitForTimeout(300);

/** 敲一行命令（真键盘）并等一小会儿。 */
const typeLine = async (text) => {
  await page.keyboard.type(text);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(120);
};
const lines = () => page.evaluate(() => window.__dos.getLines());
const textOf = (list) => list.map((line) => line.text).join('\n');
const buffer = () => page.evaluate(() => window.__dos.state.buffer);
const prompt = () => page.evaluate(() => window.__dos.nodes.promptLabel.getText());

/* ---------- 1. 开机 ---------- */
const boot = await page.evaluate(() => ({
  lines: window.__dos.getLines().length,
  prompt: window.__dos.nodes.promptLabel.getText(),
  cwd: window.__dos.getModel().getCwd(),
  exitVisible: !!window.__dos.nodes.exitBox.state.display,
}));
check(
  '开机：横幅打在屏幕上、提示符 C:\\>、没进退出态',
  boot.lines >= 4 && boot.prompt === 'C:\\>' && boot.cwd === 'C:\\' && boot.exitVisible === false,
  JSON.stringify(boot),
);
check('零 console error', errors.length === 0, errors.join(' | '));

/* ---------- 2. 命令 ---------- */
await typeLine('dir');
const afterDir = await lines();
const dirText = textOf(afterDir);
check(
  'dir：真键盘敲 DIR，输出里有文件（带大小）与目录、命令行本身也回显了',
  dirText.indexOf('AUTOEXEC.BAT') !== -1 && dirText.indexOf('<DIR>') !== -1 && dirText.indexOf('C:\\>dir') !== -1 &&
    afterDir.some((line) => line.type === 'echo') && afterDir.length > boot.lines,
  JSON.stringify({ added: afterDir.length - boot.lines, hasEcho: afterDir.some((l) => l.type === 'echo') }),
);

await typeLine('cd games');
check('cd：进子目录之后提示符跟着换', (await prompt()) === 'C:\\GAMES>', await prompt());

await typeLine('type ..\\readme.txt');
const typeText = textOf(await lines());
check(
  'type：跨目录相对路径（..\\readme.txt）也能读到文件内容',
  typeText.indexOf('C:\\GAMES>type ..\\readme.txt') !== -1 && typeText.indexOf('ICE-DOS 演示盘') !== -1,
  JSON.stringify({ tail: typeText.slice(-80) }),
);

/* ---------- 3. 编辑 ---------- */
await page.keyboard.type('ty');
await page.keyboard.press('Tab');
await page.waitForTimeout(80);
const afterTab = await buffer();
await page.keyboard.type('tet'); // C:\GAMES 里有的文件（README.TXT 在根目录）
await page.keyboard.press('Tab');
await page.waitForTimeout(80);
const afterFileTab = await buffer();
check(
  'TAB 补全：`ty` + TAB → `TYPE `，再敲 `tet` + TAB → 补出当前目录里的 TETRIS.EXE',
  afterTab === 'TYPE ' && afterFileTab === 'TYPE TETRIS.EXE',
  JSON.stringify({ afterTab, afterFileTab }),
);

await page.keyboard.press('Backspace');
await page.keyboard.press('Backspace');
await page.waitForTimeout(60);
const afterBackspace = await buffer();
check('Backspace：删掉两个字符（X 与 E）', afterBackspace === 'TYPE TETRIS.E', JSON.stringify({ afterBackspace }));

// 把输入框清干净（按当前长度退格，别写死次数）
const clearTyped = async () => {
  const length = (await buffer()).length;
  for (let i = 0; i < length; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await page.keyboard.press('Backspace');
  }
  await page.waitForTimeout(60);
};
await clearTyped();
await page.waitForTimeout(60);
await page.keyboard.press('ArrowUp');
await page.waitForTimeout(80);
const afterHistory = await buffer();
check(
  '↑ 历史：翻上一条命令（刚才敲过的 type ..\\readme.txt）',
  afterHistory === 'type ..\\readme.txt',
  JSON.stringify({ afterHistory }),
);
await page.keyboard.press('Enter');

await typeLine('foobar');
const unknown = await lines();
const lastLine = unknown[unknown.length - 1];
check(
  '未知命令：一行红色 error（Bad command），终端不崩',
  lastLine.type === 'error' && lastLine.text.indexOf('Bad command') !== -1,
  JSON.stringify(lastLine),
);

/* ---------- 4. 重定向 ---------- */
await typeLine('echo hello > note.txt');
await typeLine('type note.txt');
const redirected = textOf(await lines());
check(
  '重定向：echo hello > note.txt 之后 type 得到 hello',
  /C:\\GAMES>echo hello > note\.txt/.test(redirected) && redirected.trim().endsWith('hello'),
  JSON.stringify({ tail: redirected.slice(-40) }),
);

/* ---------- 5. 副作用 ---------- */
await page.keyboard.down('Control');
await page.keyboard.press('l');
await page.keyboard.up('Control');
await page.waitForTimeout(150);
const afterClear = await page.evaluate(() => ({ lines: window.__dos.getLines().length, prompt: window.__dos.nodes.promptLabel.getText() }));
check('Ctrl+L：清屏（输出行归零，提示符还在）', afterClear.lines === 0 && afterClear.prompt === 'C:\\GAMES>', JSON.stringify(afterClear));

await typeLine('exit');
const exited = await page.evaluate(() => ({ visible: !!window.__dos.nodes.exitBox.state.display, exited: window.__dos.state.exited }));
check('exit：进入退出态（屏幕盖上「已退出」）', exited.visible === true && exited.exited === true, JSON.stringify(exited));

await page.keyboard.press('Enter');
await page.waitForTimeout(200);
const rebooted = await page.evaluate(() => ({
  exited: window.__dos.state.exited,
  lines: window.__dos.getLines().length,
  cwd: window.__dos.getModel().getCwd(),
  visible: !!window.__dos.nodes.exitBox.state.display,
}));
check(
  '退出后按任意键：重新开机（横幅回来、目录回到 C:\\、退出层收起）',
  rebooted.exited === false && rebooted.lines >= 4 && rebooted.cwd === 'C:\\' && rebooted.visible === false,
  JSON.stringify(rebooted),
);

const rebootBox = await page.evaluate(() => {
  const button = window.__dos.nodes.rebootButton;
  let l = 0;
  let t = 0;
  let cursor = button;
  while (cursor && cursor.state) {
    l += Number(cursor.state.left) || 0;
    t += Number(cursor.state.top) || 0;
    cursor = cursor.parentNode;
  }
  return { l, t, w: Number(button.state.width) || 0, h: Number(button.state.height) || 0 };
});
const rect = await page.evaluate(() => {
  const r = document.getElementById('canvas').getBoundingClientRect();
  return { left: r.left, top: r.top };
});
await typeLine('dir');
const beforeReboot = (await lines()).length;
await page.mouse.click(rect.left + rebootBox.l + rebootBox.w / 2, rect.top + rebootBox.t + rebootBox.h / 2);
await page.waitForTimeout(200);
const afterReboot = await page.evaluate(() => ({ lines: window.__dos.getLines().length, dir: window.__dos.getModel().getCwd() }));
check(
  '「重新开机」按钮：输出重置回开机横幅（行数变少、目录回根）',
  beforeReboot > afterReboot.lines && afterReboot.dir === 'C:\\' && afterReboot.lines >= 4,
  JSON.stringify({ beforeReboot, afterReboot }),
);

/* ---------- 6. 自动滚到底 ---------- */
await page.evaluate(() => {
  const dos = window.__dos;
  for (let i = 0; i < 40; i += 1) dos.appendLine(`第 ${i} 行输出 —— 用来把终端撑满`, 'output');
});
await page.waitForTimeout(150);
const scrolled = await page.evaluate(() => {
  const [, max] = window.__dos.nodes.scroll.getScrollRange();
  const [, y] = window.__dos.nodes.scroll.getScroll();
  return { y, max };
});
check(
  '输出变长之后自动滚到底（新输出永远在可视区里）',
  scrolled.max > 0 && Math.abs(scrolled.y - scrolled.max) < 2,
  JSON.stringify(scrolled),
);

/* ---------- 7. 布局 ---------- */
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
  const nodes = window.__dos.nodes;
  return { shell: box(nodes.shell), win: box(nodes.winPanel), hints: box(nodes.hintPanel), screen: box(nodes.screen), scroll: box(nodes.scroll) };
});
const inside = (inner, outer) =>
  inner.l >= outer.l - 0.5 && inner.t >= outer.t - 0.5 && inner.l + inner.w <= outer.l + outer.w + 0.5 && inner.t + inner.h <= outer.t + outer.h + 0.5;
const overlap = (a, b) => a.l < b.l + b.w && b.l < a.l + a.w && a.t < b.t + b.h && b.t < a.t + a.h;
check(
  '布局：终端窗口与提示栏不重叠、都在机壳里，屏幕与滚动视口嵌在窗口内',
  !overlap(layout.win, layout.hints) && inside(layout.win, layout.shell) && inside(layout.hints, layout.shell) &&
    inside(layout.screen, layout.win) && inside(layout.scroll, layout.screen),
  JSON.stringify(layout),
);

check('全程零 console error', errors.length === 0, errors.join(' | '));

await page.screenshot({ path: '/tmp/qa-dos.png' });
await browser.close();
server.close();

if (failures.length) {
  console.log(`\n${failures.length} 项失败：`);
  failures.forEach((item) => console.log(` - ${item}`));
  process.exit(1);
}
console.log('\nDOS Terminal QA 通过（截图 /tmp/qa-dos.png）');
