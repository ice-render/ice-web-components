/**
 * workbench.html（客服工单工作台）的浏览器端 QA。
 *
 * 用法：
 *   npm run qa:workbench
 *   PLAYWRIGHT_PATH=/path/to/playwright npm run qa:workbench
 *
 * 检查项（全部走真实鼠标 / 键盘事件，命中检测与焦点流程都覆盖）：
 * 1. 三栏零交叠、无 console error；
 * 2. 队列：默认 4 条 → 选工单 → 右侧客户档案跟随 → 筛选「未分配」只剩 1 条且出现空态逻辑；
 * 3. 会话：输入回复 → 发送 → 消息数 +1、输入框清空；
 * 4. 快捷回复下拉：选中模板 → 填入输入框；
 * 5. 标签多选 / 满意度评分 / 坐席状态分段；
 * 6. 新手引导（悬浮按钮 → 3 步 → Esc 关闭）；
 * 7. 回到顶部（会话滚到底后出现 → 点击回顶）；
 * 8. 分隔条拖动改宽度。
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
  throw new Error('qa-workbench 需要 playwright：npm i -D playwright，或用 PLAYWRIGHT_PATH 指定');
}

const { chromium } = loadPlaywright();
const URL = 'file://' + path.resolve(process.cwd(), 'examples/workbench.html');

const failures = [];
const check = (name, ok, detail = '') => {
  if (!ok) failures.push(`${name}${detail ? ' — ' + detail : ''}`);
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? '  ' + detail : ''}`);
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 1 });
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
  await page.waitForTimeout(320);
  return true;
};
const topOverlayBox = async () =>
  page.evaluate(() => {
    const layer = window.ICEWEB.getICEOverlayManager(window.__result.ice).getLayer();
    if (!layer) return null;
    const kids = (layer.childNodes || []).filter((c) => c.state);
    const node = kids[kids.length - 1];
    if (!node) return null;
    let l = 0;
    let t = 0;
    let cursor = node;
    while (cursor && cursor.state) {
      l += Number(cursor.state.left) || 0;
      t += Number(cursor.state.top) || 0;
      cursor = cursor.parentNode;
    }
    return { l, t, w: Number(node.state.width) || 0, h: Number(node.state.height) || 0 };
  });

/* ---------- 1. 布局：三栏 + 顶栏互不交叠（悬浮按钮是刻意浮在上面的，不参与） ---------- */
const overlaps = await page.evaluate(() => {
  const shell = window.__result.shell;
  const header = shell.childNodes[0];
  const workbench = shell.childNodes[1];
  const leftSplitter = workbench.childNodes[0];
  const rightPanel = workbench.childNodes[1];
  const nodes = [header, leftSplitter, rightPanel];
  const boxes = nodes.map((node, index) => {
    let l = 0;
    let t = 0;
    let cursor = node;
    while (cursor && cursor.state) {
      l += Number(cursor.state.left) || 0;
      t += Number(cursor.state.top) || 0;
      cursor = cursor.parentNode;
    }
    return {
      id: (node.state && node.state.id) || `#${index}`,
      l,
      t,
      w: Number(node.state.width) || 0,
      h: Number(node.state.height) || 0,
    };
  });
  const hits = [];
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const a = boxes[i];
      const b = boxes[j];
      const ox = Math.min(a.l + a.w, b.l + b.w) - Math.max(a.l, b.l);
      const oy = Math.min(a.t + a.h, b.t + b.h) - Math.max(a.t, b.t);
      if (ox > 1 && oy > 1) hits.push(`${a.id} × ${b.id}`);
    }
  }
  return hits;
});
check('工作台顶层元素零交叠', overlaps.length === 0, overlaps.join(', '));

/* ---------- 2. 队列与客户档案 ---------- */
const queueInit = await page.evaluate(() => ({
  items: window.__result.queueList.getItems().length,
  hint: window.__result.queueHint.getText(),
}));
check('队列默认 4 条待处理', queueInit.items === 4 && /4 个待处理/.test(queueInit.hint), JSON.stringify(queueInit));

const picked = await clickExpr("window.__result.queueList.getRowNode('T-2043')");
const profile = await page.evaluate(() => ({
  title: window.__result.customerTitle.getText(),
  order: window.__result.customerInfo.getRowNodes ? '' : '',
  current: window.__result.state.current,
}));
check('点队列 → 客户档案跟随', picked && profile.title === 'Mia Rodriguez' && profile.current === 'T-2043', JSON.stringify(profile));

const filterClicked = await clickExpr("window.__result.queueFilter.getSegmentNode('unassigned')");
await page.waitForTimeout(500);
const filtered = await page.evaluate(() => ({
  items: window.__result.queueList.getItems().length,
  hint: window.__result.queueHint.getText(),
}));
check('筛选「未分配」只剩 1 条', filterClicked && filtered.items === 1, JSON.stringify(filtered));
await clickExpr("window.__result.queueFilter.getSegmentNode('all')");
await page.waitForTimeout(500);

/* ---------- 3. 会话回复 ---------- */
const before = await page.evaluate(() => window.__result.TICKETS.find((t) => t.key === window.__result.state.current).messages.length);
const inputBox = await boxOf('window.__result.replyInput');
let typedDraft = '';
for (let attempt = 0; attempt < 3 && !typedDraft; attempt += 1) {
  // 前一串交互可能把焦点留在别处：点进输入框 → 打字 → 校验，没进去就再点一次
  await page.mouse.click(rect.left + inputBox.l + 40, rect.top + inputBox.t + 20);
  await page.waitForTimeout(220);
  // 注意：canvas 文本框目前只处理单字符 keydown（IME 组字未支持），
  // 所以浏览器测试用 ASCII 文本；中文输入走系统输入法时不会触发这些按键事件。
  await page.keyboard.type('Noted, warehouse already pushed.');
  await page.waitForTimeout(220);
  typedDraft = await page.evaluate(() => window.__result.replyInput.getValue());
}
const sendClicked = await clickExpr('window.__result.sendButton');
const afterSend = await page.evaluate(() => ({
  count: window.__result.TICKETS.find((t) => t.key === window.__result.state.current).messages.length,
  draft: window.__result.replyInput.getValue(),
  bubbles: window.__result.conversationScroll.getContent().childNodes.length,
}));
check(
  '输入回复 → 发送 → 消息 +1 且清空输入框',
  sendClicked &&
    typedDraft.length > 0 &&
    afterSend.count === before + 1 &&
    afterSend.draft === '' &&
    afterSend.bubbles === afterSend.count,
  `${JSON.stringify(afterSend)} typed=${JSON.stringify(typedDraft)}`,
);

/* ---------- 4. 快捷回复下拉 ---------- */
const quickClicked = await clickExpr('window.__result.quickReplies');
const quickPanel = await topOverlayBox();
check('快捷回复下拉可打开', quickClicked && !!quickPanel);
const templateClicked = await page.evaluate(() => {
  const layer = window.ICEWEB.getICEOverlayManager(window.__result.ice).getLayer();
  const kids = (layer.childNodes || []).filter((c) => c.state);
  const panel = kids[kids.length - 1];
  let target = null;
  const walk = (n) => {
    (n.childNodes || []).forEach((child) => {
      if (child.state && child.state.text === '退款政策') target = child;
      walk(child);
    });
  };
  walk(panel);
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
if (templateClicked) {
  await page.mouse.click(rect.left + templateClicked.l + templateClicked.w / 2, rect.top + templateClicked.t + templateClicked.h / 2);
  await page.waitForTimeout(320);
}
const draftAfterTemplate = await page.evaluate(() => window.__result.replyInput.getValue());
check('选模板 → 填入输入框', /退款/.test(draftAfterTemplate), String(draftAfterTemplate).slice(0, 24));
await page.keyboard.press('Escape');
await page.waitForTimeout(260);

/* ---------- 5. 标签 / 满意度 / 坐席状态 ---------- */
const tagClicked = await clickExpr("window.__result.tagGroup.getItemNode('退款')");
const tagValue = await page.evaluate(() => window.__result.tagGroup.getValue().join(','));
check('工单标签多选可勾选', tagClicked && tagValue.indexOf('退款') !== -1, tagValue);

const rateBox = await boxOf('window.__result.satisfaction');
await page.mouse.click(rect.left + rateBox.l + rateBox.w - 6, rect.top + rateBox.t + rateBox.h / 2);
await page.waitForTimeout(320);
const rateValue = await page.evaluate(() => window.__result.satisfaction.getValue());
check('满意度评分可点击（点最右侧 → 5 星）', rateValue === 5, String(rateValue));

const statusClicked = await clickExpr("window.__result.shell.childNodes[0].childNodes[1].getSegmentNode('busy')");
const statusValue = await page.evaluate(() => window.__result.shell.childNodes[0].childNodes[1].getValue());
check('坐席状态切换到「忙碌」', statusClicked && statusValue === 'busy', String(statusValue));

/* ---------- 6. 新手引导 ---------- */
const fabOpened = await clickExpr('window.__result.fab');
const tourStarted = await clickExpr("window.__result.fab.getItemNode('tour')");
const tourState = await page.evaluate(() => ({ open: window.__result.tour.isOpen(), counter: window.__result.tour.getCounterText() }));
check('悬浮按钮 → 新手引导打开', fabOpened && tourStarted && tourState.open && tourState.counter === '1/3', JSON.stringify(tourState));
await page.keyboard.press('Escape');
await page.waitForTimeout(320);
check('引导 Esc 关闭', !(await page.evaluate(() => window.__result.tour.isOpen())));

/* ---------- 7. 回到顶部 ---------- */
// 先切回消息最多的那单（会话内容要真的超过视口高度，才可能滚动）
await page.evaluate(() => window.__result.selectTicket('T-2041'));
await page.waitForTimeout(400);
await page.evaluate(() => window.__result.conversationScroll.setScroll(0, 99999));
await page.waitForTimeout(300);
const backTopVisible = await page.evaluate(() => window.__result.backTop.isVisible());
const backTopClicked = await clickExpr('window.__result.backTop');
const backTopY = await page.evaluate(() => window.__result.conversationScroll.getScroll()[1]);
check('会话滚到底 → 回到顶部出现并可回顶', backTopVisible && backTopClicked && backTopY === 0, `visible=${backTopVisible} y=${backTopY}`);

/* ---------- 8. 分隔条拖动 ---------- */
const sizeBefore = await page.evaluate(() => window.__result.leftSplitter.getSize());
const divider = await boxOf('window.__result.leftSplitter.getDividerNode()');
await page.mouse.move(rect.left + divider.l + divider.w / 2, rect.top + divider.t + divider.h / 2);
await page.mouse.down();
await page.mouse.move(rect.left + divider.l + divider.w / 2 + 60, rect.top + divider.t + divider.h / 2, { steps: 6 });
await page.mouse.up();
await page.waitForTimeout(320);
const sizeAfter = await page.evaluate(() => window.__result.leftSplitter.getSize());
check('拖动分隔条改队列宽度', sizeBefore === 340 && sizeAfter > sizeBefore, `${sizeBefore} → ${sizeAfter}`);

check('无 console error / pageerror', errors.length === 0, errors.slice(0, 3).join(' | '));

await page.screenshot({ path: '/tmp/qa-workbench.png' });
await browser.close();

if (failures.length) {
  console.error(`\nWorkbench QA 未通过（${failures.length} 项）：`);
  failures.forEach((item) => console.error('  - ' + item));
  process.exit(1);
}
console.log('\nWorkbench QA 通过（截图在 /tmp/qa-workbench.png）');
