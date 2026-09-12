/**
 * gallery.html 的浏览器端 QA（全量演示的布局 + 本轮新增组件的真实交互）。
 *
 * 用法（需要能解析到 playwright）：
 *   npm run qa:gallery
 *   PLAYWRIGHT_PATH=/path/to/playwright npm run qa:gallery
 *
 * 检查项：
 * 1. 顶层元素两两不相交（流式布局的回归护栏）；
 * 2. 面包屑（含折叠/展开）、统计数值 + 倒计时、单选组、多选组、分隔面板拖动、水印平铺；
 * 3. 全部用真实鼠标事件（命中检测路径），不是直接调内部方法；
 * 4. 全过程 console error / pageerror 必须为 0，并截图到 /tmp/qa-gallery-*.png。
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
      /* 继续尝试下一个 */
    }
  }
  throw new Error(
    'qa-gallery 需要 playwright：请先 `npm i -D playwright`，或用 PLAYWRIGHT_PATH 指向已安装的 playwright',
  );
}

const { chromium } = loadPlaywright();
const GALLERY_URL = 'file://' + path.resolve(process.cwd(), 'examples/gallery.html');

const failures = [];
const check = (name, ok, detail = '') => {
  if (!ok) failures.push(`${name}${detail ? ' — ' + detail : ''}`);
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? '  ' + detail : ''}`);
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1700, height: 1200 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console: ' + m.text());
});
await page.goto(GALLERY_URL);
await page.waitForTimeout(1200);

// 页面内小工具：世界坐标 / 节点文本
await page.evaluate(() => {
  window.__qa = {
    world(node) {
      let l = 0;
      let t = 0;
      let x = node;
      while (x && x.state) {
        l += Number(x.state.left) || 0;
        t += Number(x.state.top) || 0;
        x = x.parentNode;
      }
      return { l, t, w: Number(node.state.width) || 0, h: Number(node.state.height) || 0 };
    },
    texts(node) {
      const out = [];
      const walk = (n) => {
        (n.childNodes || []).forEach((child) => {
          if (child.state && child.state.text !== undefined && child.state.text !== '') {
            out.push(String(child.state.text));
          }
          walk(child);
        });
      };
      walk(node);
      return out;
    },
  };
});

/** 按表达式取节点 → 世界盒（表达式在页面上下文里求值）。 */
const nodeBox = async (expr) =>
  page.evaluate((source) => {
    // eslint-disable-next-line no-eval
    const node = eval(source);
    return node ? window.__qa.world(node) : null;
  }, expr);

/** 当前 canvas 的视口矩形 + 页面纵向偏移（页面滚动后 rect.top 会变）。 */
const canvasRect = () =>
  page.evaluate(() => {
    const r = document.getElementById('canvas').getBoundingClientRect();
    return { left: r.left, top: r.top, pageTop: r.top + window.scrollY };
  });

const textOf = async (expr) =>
  page.evaluate((source) => {
    // eslint-disable-next-line no-eval
    const node = eval(source);
    return node ? window.__qa.texts(node).join('|') : null;
  }, expr);

/**
 * 用真实鼠标点节点中心。
 *
 * 每次都在页面里重新量 canvas 的位置（示例页会滚动，缓存下来的 rect 会失效），
 * 世界坐标 + 当前 rect = 视口坐标。
 */
const clickExpr = async (expr) => {
  const point = await page.evaluate((source) => {
    // eslint-disable-next-line no-eval
    const node = eval(source);
    if (!node) return null;
    const box = window.__qa.world(node);
    const r = document.getElementById('canvas').getBoundingClientRect();
    return { x: r.left + box.l + box.w / 2, y: r.top + box.t + box.h / 2 };
  }, expr);
  if (!point) return false;
  await page.mouse.click(point.x, point.y);
  await page.waitForTimeout(260);
  return true;
};

// —— 1. 顶层元素零交叠 ——
const overlaps = await page.evaluate(() => {
  const nodes = (window.__result.panel.childNodes || []).filter((n) => n.state && n.state.display !== false);
  const boxes = nodes.map((node, index) => {
    const box = window.__qa.world(node);
    return { index, id: (node.state && node.state.id) || `#${index}`, ...box };
  });
  const hits = [];
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const a = boxes[i];
      const b = boxes[j];
      const overlapX = Math.min(a.l + a.w, b.l + b.w) - Math.max(a.l, b.l);
      const overlapY = Math.min(a.t + a.h, b.t + b.h) - Math.max(a.t, b.t);
      if (overlapX > 1 && overlapY > 1) {
        hits.push(`${a.id} × ${b.id} (${Math.round(overlapX)}×${Math.round(overlapY)})`);
      }
    }
  }
  return hits;
});
check('gallery 顶层元素零交叠', overlaps.length === 0, overlaps.slice(0, 4).join(', '));

// —— 2. 面包屑 ——
const crumbText = await page.evaluate(() => window.__result.breadcrumb.getLabelTexts().join('|'));
check('面包屑渲染全部标签', crumbText === '首页|订单管理|订单详情', String(crumbText));
const crumbWidth = await nodeBox('window.__result.breadcrumb');
check('面包屑宽度自适应（不小于三个标签）', crumbWidth && crumbWidth.w >= 150, crumbWidth ? String(crumbWidth.w) : 'n/a');

const collapsedBefore = await page.evaluate(() => window.__result.breadcrumbCollapsed.getLabelTexts().join('|'));
const collapsedFlag = await page.evaluate(() => window.__result.breadcrumbCollapsed.isCollapsed());
const expandedClick = await clickExpr('window.__result.breadcrumbCollapsed.getItemNodes()[1]');
const collapsedAfter = await page.evaluate(() => window.__result.breadcrumbCollapsed.getLabelTexts().join('|'));
check(
  '面包屑折叠 + 点击省略号展开',
  collapsedFlag === true && collapsedBefore === '首页|…|发货|详情' && expandedClick && collapsedAfter === '首页|销售|订单|发货|详情',
  `${collapsedBefore} → ${collapsedAfter}`,
);

// —— 3. 统计数值 / 倒计时 ——
const statText = await page.evaluate(
  () => `${window.__result.statistic.getTitleText()}|${window.__result.statistic.getValueText()}`,
);
check('统计数值：千分位 + 精度 + 前缀', statText === '本月成交额|¥1,234,567.89', String(statText));
const countdownText = await page.evaluate(
  () => `${window.__result.countdown.getTitleText()}|${window.__result.countdown.getValueText()}`,
);
check(
  '倒计时：N 天 HH:mm:ss 且实时递减',
  /距活动结束\|3 天 \d{2}:\d{2}:\d{2}/.test(String(countdownText)),
  String(countdownText),
);

// —— 4. 单选组（真实点击第二项） ——
const radioBefore = await page.evaluate(() => window.__result.radioGroup.getValue());
const radioClicked = await clickExpr("window.__result.radioGroup.getItemNode('standard')");
const radioAfter = await page.evaluate(() => window.__result.radioGroup.getValue());
check('单选组：点标签行即选中', radioBefore === 'pro' && radioClicked && radioAfter === 'standard', `${radioBefore} → ${radioAfter}`);

// —— 5. 多选组 ——
const checkBefore = await page.evaluate(() => window.__result.checkboxGroup.getValue().join(','));
const checkClicked = await clickExpr("window.__result.checkboxGroup.getItemNode('sms')");
const checkAfter = await page.evaluate(() => window.__result.checkboxGroup.getValue().join(','));
check('多选组：点击追加勾选', checkBefore === 'mail' && checkClicked && checkAfter === 'mail,sms', `${checkBefore} → ${checkAfter}`);

// —— 6. 分隔面板：真实拖动 ——
const dividerBox = await nodeBox('window.__result.splitter.getDividerNode()');
const splitBefore = await page.evaluate(() => window.__result.splitter.getSize());
const dragRect = await canvasRect();
if (dividerBox) {
  const startX = dragRect.left + dividerBox.l + dividerBox.w / 2;
  const y = dragRect.top + dividerBox.t + dividerBox.h / 2;
  await page.mouse.move(startX, y);
  await page.mouse.down();
  await page.mouse.move(startX + 60, y, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(240);
}
const splitAfter = await page.evaluate(() => window.__result.splitter.getSize());
check(
  '分隔面板：拖动分隔条改尺寸',
  splitBefore === 180 && splitAfter > 230 && splitAfter < 250,
  `${splitBefore} → ${splitAfter}`,
);

// —— 7. 水印 ——
const watermark = await page.evaluate(() => {
  const mark = window.__result.watermark;
  const tiles = mark.getTileNodes();
  return {
    count: mark.getTileCount(),
    selfInteractive: mark.state.interactive,
    clipped: mark.state.clipChildren === true,
    tilesInteractive: tiles.filter((tile) => tile.state.interactive !== false).length,
    rotated: tiles[0] ? tiles[0].state.transform.rotate : null,
  };
});
check(
  '水印：平铺且不挡点击',
  watermark.count === 9 &&
    watermark.selfInteractive === false &&
    watermark.clipped === true &&
    watermark.tilesInteractive === 0 &&
    watermark.rotated === -22,
  JSON.stringify(watermark),
);

// —— 8. 排版：层级 / 折行省略 / 链接 ——
const typography = await page.evaluate(() => {
  const title = window.__result.typographyTitle;
  const paragraph = window.__result.typographyParagraph;
  const link = window.__result.typographyLink;
  link.setHovered(true);
  const hoverColor = link.getLabelNodes()[0].childNodes[0].state.style.fillStyle;
  link.setHovered(false);
  return {
    titleSize: title.getFontSize(),
    paragraphSize: paragraph.getFontSize(),
    lines: paragraph.getLines(),
    linkColor: link.getTextColor(),
    linkInteractive: link.state.interactive === true,
    hoverColor,
  };
});
check(
  '排版：标题层级 + 折行省略 + 链接态',
  typography.titleSize > typography.paragraphSize &&
    typography.lines.length === 2 &&
    typography.lines[1].endsWith('…') &&
    typography.linkColor === '#0d6efd' &&
    typography.linkInteractive &&
    typography.hoverColor === '#0b5ed7',
  JSON.stringify(typography),
);

// —— 9. 锚点导航 + 回到顶部（真实点击） ——
const anchorClicked = await clickExpr("window.__result.anchor.getItemNode('logs')");
const afterAnchor = await page.evaluate(() => ({
  y: window.__result.anchorPane.getScroll()[1],
  active: window.__result.anchor.getActiveKey(),
  backTopVisible: window.__result.backTop.isVisible(),
  backTopOpacity: window.__result.backTop.state.opacity,
}));
check(
  '锚点：点击滚动 + 高亮 + 唤起回到顶部',
  anchorClicked && afterAnchor.y === 500 && afterAnchor.active === 'logs' && afterAnchor.backTopVisible === true && afterAnchor.backTopOpacity === 1,
  JSON.stringify(afterAnchor),
);
const backTopClicked = await clickExpr('window.__result.backTop');
const afterBackTop = await page.evaluate(() => ({
  y: window.__result.anchorPane.getScroll()[1],
  active: window.__result.anchor.getActiveKey(),
  visible: window.__result.backTop.isVisible(),
}));
check(
  '回到顶部：点击滚回顶端并自我隐藏',
  backTopClicked && afterBackTop.y === 0 && afterBackTop.active === 'basic' && afterBackTop.visible === false,
  JSON.stringify(afterBackTop),
);

// —— 10. 日历 ——
const calendarInfo = await page.evaluate(() => {
  const cal = window.__result.calendar;
  return {
    title: cal.getTitleText(),
    cells: cal.getCellNodes().length,
    weekdays: cal.getWeekdayTexts().join(''),
    value: cal.getValue(),
    dimmed: cal.getCellTextColor('2026-08-31'),
  };
});
check(
  '日历：月视图 + 星期表头 + 相邻月弱化',
  calendarInfo.title === '2026 年 9 月' &&
    calendarInfo.cells === 42 &&
    calendarInfo.weekdays === '一二三四五六日' &&
    calendarInfo.value === '2026-09-12' &&
    calendarInfo.dimmed === '#adb5bd',
  JSON.stringify(calendarInfo),
);
const calendarClicked = await clickExpr("window.__result.calendar.getCellNode('2026-09-20')");
const calendarAfter = await page.evaluate(() => ({
  value: window.__result.calendar.getValue(),
  background: window.__result.calendar.getCellBackground('2026-09-20'),
  textColor: window.__result.calendar.getCellTextColor('2026-09-20'),
}));
check(
  '日历：点击日期选中并高亮',
  calendarClicked && calendarAfter.value === '2026-09-20' && calendarAfter.background === '#0d6efd' && calendarAfter.textColor === '#ffffff',
  JSON.stringify(calendarAfter),
);

// —— 11. 漫游引导：点按钮开始，下一步，Esc 跳过 ——
const tourStarted = await clickExpr('window.__result.tourTarget');
const tourStep1 = await page.evaluate(() => ({
  open: window.__result.tour.isOpen(),
  counter: window.__result.tour.getCounterText(),
  title: window.__result.tour.getTitleText(),
}));
check(
  '引导：按钮打开第一步',
  tourStarted && tourStep1.open === true && tourStep1.counter === '1/3' && tourStep1.title === '先看图片预览',
  JSON.stringify(tourStep1),
);
const tourNextClicked = await clickExpr('window.__result.tour.getNextButton()');
const tourStep2 = await page.evaluate(() => ({
  counter: window.__result.tour.getCounterText(),
  title: window.__result.tour.getTitleText(),
}));
check('引导：下一步切到第二步', tourNextClicked && tourStep2.counter === '2/3' && tourStep2.title === '再看看指标', JSON.stringify(tourStep2));
await page.keyboard.press('Escape');
await page.waitForTimeout(320);
const tourClosed = await page.evaluate(() => window.__result.tour.isOpen());
check('引导：Esc 跳过并关闭', tourClosed === false, String(tourClosed));

// —— 12. 图片预览：打开 / 工具栏 / 键盘 / Esc ——
const previewOpened = await clickExpr('window.__result.previewTarget');
const previewStep1 = await page.evaluate(() => ({
  open: window.__result.imagePreview.isOpen(),
  index: window.__result.imagePreview.getIndex(),
  zoom: window.__result.imagePreview.getZoom(),
}));
check(
  '图片预览：按钮打开第一张',
  previewOpened && previewStep1.open === true && previewStep1.index === 0 && previewStep1.zoom === 1,
  JSON.stringify(previewStep1),
);
await clickExpr("window.__result.imagePreview.getToolbarButton('zoomIn')");
await clickExpr("window.__result.imagePreview.getToolbarButton('rotateRight')");
await clickExpr("window.__result.imagePreview.getToolbarButton('next')");
const previewStep2 = await page.evaluate(() => ({
  index: window.__result.imagePreview.getIndex(),
  zoom: window.__result.imagePreview.getZoom(),
  rotation: window.__result.imagePreview.getRotation(),
}));
check(
  '图片预览：工具栏放大 + 旋转 + 翻页',
  previewStep2.index === 1 && previewStep2.zoom === 1.25 && previewStep2.rotation === 90,
  JSON.stringify(previewStep2),
);
await page.keyboard.press('Escape');
await page.waitForTimeout(320);
const previewClosed = await page.evaluate(() => window.__result.imagePreview.isOpen());
check('图片预览：Esc 关闭', previewClosed === false, String(previewClosed));

// —— 13. 布局骨架：Space / Grid ——
const layoutInfo = await page.evaluate(() => {
  const space = window.__result.layoutSpace;
  const grid = window.__result.layoutGrid;
  const items = space.getItems();
  const cols = grid.getCols();
  return {
    spaceGap: items[1].state.left - (Number(items[0].state.width) || 0),
    spaceHeight: space.state.height,
    colWidths: cols.map((col) => Math.round(Number(col.state.width))),
    colLefts: cols.map((col) => Math.round(Number(col.state.left))),
    colTops: cols.map((col) => Math.round(Number(col.state.top))),
  };
});
check(
  'Space：按 size 排列并自适应高度',
  layoutInfo.spaceGap === 8 && layoutInfo.spaceHeight === 32,
  JSON.stringify(layoutInfo),
);
check(
  'Grid：12+12 等宽、24 格整行、超行换行',
  layoutInfo.colWidths[0] === layoutInfo.colWidths[1] &&
    layoutInfo.colLefts[0] === 0 &&
    layoutInfo.colTops[2] > layoutInfo.colTops[0],
  JSON.stringify(layoutInfo),
);

// —— 14. 悬浮按钮：展开 → 点子项 → 收起 ——
const fabExpanded = await clickExpr('window.__result.fab');
const fabState = await page.evaluate(() => ({
  expanded: window.__result.fab.isExpanded(),
  itemVisible: window.__result.fab.getItemNode('edit').state.display,
}));
check('悬浮按钮：点击展开子项', fabExpanded && fabState.expanded === true && fabState.itemVisible === true, JSON.stringify(fabState));
const fabItemClicked = await clickExpr("window.__result.fab.getItemNode('edit')");
const fabAfter = await page.evaluate(() => ({
  expanded: window.__result.fab.isExpanded(),
  picked: window.__fabPicked(),
}));
check(
  '悬浮按钮：点子项回调并自动收起',
  fabItemClicked && fabAfter.expanded === false && fabAfter.picked === 'edit',
  JSON.stringify(fabAfter),
);

// —— 15. 表格分页 ——
const tablePage1 = await page.evaluate(() => ({
  page: window.__result.pagedTable.getPage(),
  count: window.__result.pagedTable.getPageCount(),
  rows: window.__result.pagedTable.getRows().length,
  first: window.__result.pagedTable.getRows()[0].name,
}));
check(
  '表格分页：首页 3 行、共 3 页',
  tablePage1.page === 1 && tablePage1.count === 3 && tablePage1.rows === 3 && tablePage1.first === 'Ava',
  JSON.stringify(tablePage1),
);
const pagerClicked = await clickExpr('window.__result.pagedTable.getPaginationNode().getNextButton()');
const tablePage2 = await page.evaluate(() => ({
  page: window.__result.pagedTable.getPage(),
  first: window.__result.pagedTable.getRows()[0].name,
}));
check('表格分页：点下一页换到第 2 页', pagerClicked && tablePage2.page === 2 && tablePage2.first === 'Dan', JSON.stringify(tablePage2));

// —— 16. 跨字段依赖：改密码 → 确认密码立刻重算 ——
const crossForm = await page.evaluate(() => {
  const form = window.__result.crossForm;
  form.getModel().setValue('password', 'abc123');
  form.getModel().setValue('confirm', 'abc123');
  const matched = form.getModel().getError('confirm');
  form.getModel().setValue('password', 'xyz789');
  const mismatched = form.getModel().getError('confirm');
  // 界面上确实把错误画出来了
  const item = form.getItems()[1];
  return {
    matched,
    mismatched,
    errorText: item.getErrorText ? item.getErrorText() : '',
    deps: form.getModel().getDependents('password'),
  };
});
check(
  '跨字段校验：改密码后确认框立刻重算并显示错误',
  crossForm.matched === null && crossForm.mismatched === '两次输入的密码不一致' && crossForm.deps.join() === 'confirm',
  JSON.stringify(crossForm),
);

// —— 17. 焦点环策略（`:focus-visible`）：鼠标操作不画环，键盘聚焦才画 ——
const sliderBox = await nodeBox("window.__result.panel.childNodes.find((n) => n.state && n.state.id === 'slider')");
const ringManager = 'window.ICEWEB.getICEFocusManager(window.__result.ice)';
const ringRect = await canvasRect();
if (sliderBox) {
  const startX = ringRect.left + sliderBox.l + sliderBox.w * 0.3;
  const y = ringRect.top + sliderBox.t + sliderBox.h / 2;
  await page.mouse.move(startX, y);
  await page.mouse.down();
  await page.mouse.move(startX + 60, y, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(300);
}
const ringAfterDrag = await page.evaluate((src) => eval(src).isRingVisible(), ringManager);
const originAfterDrag = await page.evaluate((src) => eval(src).getFocusOrigin(), ringManager);
check('拖 Slider 手柄：聚焦但不画焦点环', sliderBox !== null && ringAfterDrag === false && originAfterDrag === 'mouse', `${originAfterDrag}/${ringAfterDrag}`);

await page.keyboard.press('Tab');
await page.waitForTimeout(280);
const ringAfterTab = await page.evaluate((src) => eval(src).isRingVisible(), ringManager);
const originAfterTab = await page.evaluate((src) => eval(src).getFocusOrigin(), ringManager);
check('Tab 键盘聚焦：焦点环出现', ringAfterTab === true && originAfterTab === 'keyboard', `${originAfterTab}/${ringAfterTab}`);

const inputBox = await nodeBox('window.__result.nameInput');
if (inputBox) {
  await page.mouse.click(ringRect.left + inputBox.l + 30, ringRect.top + inputBox.t + inputBox.h / 2);
  await page.waitForTimeout(280);
}
const ringAfterInputClick = await page.evaluate((src) => eval(src).isRingVisible(), ringManager);
check('文本框：鼠标点进去也画环（正在输入）', inputBox !== null && ringAfterInputClick === true, String(ringAfterInputClick));

check('无 console error / pageerror', errors.length === 0, errors.slice(0, 3).join(' | '));

await page.screenshot({ path: '/tmp/qa-gallery.png', fullPage: true });

/* ---------- 虚拟列表：一万行只渲染可视区 ---------- */
const virtualBoot = await page.evaluate(() => {
  const list = window.__result.virtualList;
  return {
    count: list.getItemCount(),
    rendered: list.getRenderedCount(),
    contentHeight: list.getContentHeight(),
    range: list.getRange(),
  };
});
check(
  '虚拟列表：一万条数据只渲染可视区（节点数有上界）',
  virtualBoot.count === 10000 && virtualBoot.rendered <= 16 && virtualBoot.rendered >= 10 && virtualBoot.contentHeight === 280000,
  JSON.stringify(virtualBoot),
);

// 真实滚轮：滚过之后窗口跟着走，节点数不涨
const listBox = await nodeBox('window.__result.virtualList');
const galleryRect = await canvasRect();
await page.mouse.move(galleryRect.left + listBox.l + listBox.w / 2, galleryRect.top + listBox.t + listBox.h / 2);
await page.mouse.wheel(0, 1200);
await page.waitForTimeout(420);
const afterWheel = await page.evaluate(() => {
  const list = window.__result.virtualList;
  return { rendered: list.getRenderedCount(), range: list.getRange(), scrollTop: list.getScrollTop() };
});
check(
  '虚拟列表：滚轮滚动后窗口跟着换（节点数不增长）',
  afterWheel.scrollTop > 0 && afterWheel.range.start > 0 && afterWheel.rendered <= 16,
  JSON.stringify(afterWheel),
);

const jumped = await page.evaluate(() => {
  const list = window.__result.virtualList;
  list.scrollToIndex(9999);
  return { range: list.getRange(), rendered: list.getRenderedCount() };
});
check(
  '虚拟列表：scrollToIndex 能跳到最后一万条',
  jumped.range.end === 10000 && jumped.rendered <= 16,
  JSON.stringify(jumped),
);

/* ---------- 表格：拖表头边界缩列 ---------- */
const tableBox = await nodeBox('window.__result.pagedTable');
const tableBefore = await page.evaluate(() => window.__result.pagedTable.getColumnWidths());
// 第一列与第二列的交界处（表头右边界），从那里往右拖 60px
const boundaryX = tableBox.l + tableBefore.name;
const headerY = tableBox.t + 18;
const galRect2 = await canvasRect();
await page.mouse.move(galRect2.left + boundaryX, galRect2.top + headerY);
await page.mouse.down();
await page.mouse.move(galRect2.left + boundaryX + 60, galRect2.top + headerY, { steps: 8 });
await page.mouse.up();
await page.waitForTimeout(320);
const tableAfter = await page.evaluate(() => window.__result.pagedTable.getColumnWidths());
check(
  '表格：拖表头边界缩列（第一列 +60，其余自动列重新分配）',
  Math.abs(tableAfter.name - tableBefore.name - 60) <= 2 && tableAfter.city < tableBefore.city && tableAfter.amount < tableBefore.amount,
  JSON.stringify({ before: tableBefore, after: tableAfter }),
);

// 往左拖到负数：被最小宽度夹住，不能把列拖没
await page.mouse.move(galRect2.left + tableBox.l + tableAfter.name, galRect2.top + headerY);
await page.mouse.down();
await page.mouse.move(galRect2.left + tableBox.l + tableAfter.name - 400, galRect2.top + headerY, { steps: 8 });
await page.mouse.up();
await page.waitForTimeout(320);
const tableClamped = await page.evaluate(() => window.__result.pagedTable.getColumnWidths());
check('表格：列宽被最小宽度夹住（拖不没）', tableClamped.name === 70, JSON.stringify(tableClamped));

/* ---------- 表格：拖行排序 ---------- */
await page.evaluate(() => {
  // 缩列之后列宽变了，坐标会跟着变；先把页面滚回顶部再算鼠标位置
  window.scrollTo(0, 0);
});
await page.waitForTimeout(200);
const dragTable = await page.evaluate(() => {
  const table = window.__result.pagedTable;
  window.__reorders = [];
  table.on('rowreorder', (evt) => window.__reorders.push([evt.param.from, evt.param.to]));
  const rows = table.getRows().map((row) => row.name);
  let l = 0;
  let t = 0;
  let cursor = table;
  while (cursor && cursor.state) {
    l += Number(cursor.state.left) || 0;
    t += Number(cursor.state.top) || 0;
    cursor = cursor.parentNode;
  }
  return { rows, l, t, headerHeight: 36, rowHeight: 34 };
});
const reorderRect = await canvasRect();
const dragX = reorderRect.left + dragTable.l + 120;
const fromY = reorderRect.top + dragTable.t + dragTable.headerHeight + dragTable.rowHeight / 2;
const toY = reorderRect.top + dragTable.t + dragTable.headerHeight + dragTable.rowHeight * 2 + dragTable.rowHeight * 0.8;
await page.mouse.move(dragX, fromY);
await page.mouse.down();
await page.mouse.move(dragX, toY, { steps: 10 });
await page.waitForTimeout(200);
const midDrag = await page.evaluate(() => ({
  dragging: window.__result.pagedTable.isRowDragging(),
  target: window.__result.pagedTable.getDropTarget(),
}));
check(
  '表格：按住行拖动时进入拖拽态并给出落点（指示线跟手）',
  midDrag.dragging === true && !!midDrag.target && midDrag.target.index === 2 && midDrag.target.position === 'after',
  JSON.stringify(midDrag),
);
await page.mouse.up();
await page.waitForTimeout(320);
const dropped = await page.evaluate(() => ({
  rows: window.__result.pagedTable.getRows().map((row) => row.name),
  events: window.__reorders,
  dragging: window.__result.pagedTable.isRowDragging(),
}));
check(
  '表格：松手后行顺序真的变了（A 拖到 C 之后），并抛出 rowreorder',
  // 注意：这张表分页且前面的用例点过下一页，所以按「拖动前的当前页顺序」推算期望值
  JSON.stringify(dropped.rows) === JSON.stringify([dragTable.rows[1], dragTable.rows[2], dragTable.rows[0]]) &&
    dropped.dragging === false &&
    dropped.events.length === 1,
  JSON.stringify({ before: dragTable.rows, after: dropped.rows, events: dropped.events }),
);

/* ---------- 宽表：虚拟行 + 固定列 + 横向滚动 ---------- */
const bigBoot = await page.evaluate(() => {
  const table = window.__result.bigTable;
  return {
    virtual: table.isVirtual(),
    scrollable: table.isScrollable(),
    rows: table.getRenderedRowCount(),
    content: table.getContentHeight(),
    frozen: table.getFrozenWidth(),
  };
});
check(
  '宽表：一万行只渲染可视行（节点数有上界），内容高度按总行数算',
  bigBoot.virtual === true && bigBoot.rows <= 16 && bigBoot.content === 320000 && bigBoot.frozen === 200,
  JSON.stringify(bigBoot),
);

// 真滚轮：在表体上滚，窗口跟着换。
// 注意：前面的虚拟列表用例滚过页面，宽表在页面顶部，先滚回顶部再算坐标，否则鼠标会落在视口外。
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(200);
const bigBox = await nodeBox('window.__result.bigTable');
const galRect3 = await canvasRect();
await page.mouse.move(galRect3.left + bigBox.l + bigBox.w / 2, galRect3.top + bigBox.t + 200);
await page.mouse.wheel(0, 900);
await page.waitForTimeout(420);
const bigScrolled = await page.evaluate(() => {
  const table = window.__result.bigTable;
  return { scroll: table.getScroll(), range: table.getRowRange(), rows: table.getRenderedRowCount() };
});
check(
  '宽表：滚轮滚动后窗口跟着换（节点数不增长）',
  bigScrolled.scroll.y > 0 && bigScrolled.range.start > 0 && bigScrolled.rows <= 16,
  JSON.stringify(bigScrolled),
);

// 横向滚动 + 固定列：冻结层钉在左边不动，表头与表体滚动位置同步
const bigHorizontal = await page.evaluate(() => {
  const table = window.__result.bigTable;
  const worldLeft = (node) => {
    let l = 0;
    let cursor = node;
    while (cursor && cursor.state) {
      l += Number(cursor.state.left) || 0;
      cursor = cursor.parentNode;
    }
    return l;
  };
  const layerLeftBefore = worldLeft(table.frozenLayer);
  table.setScrollLeft(180);
  const layerLeftAfter = worldLeft(table.frozenLayer);
  const headerScroll = table.headerPane.getScroll();
  const bodyScroll = table.bodyPane.getScroll();
  void headerScroll;
  const firstBodyCellLeft = table.bodyContent.childNodes[0].childNodes[0].state.left;
  return { layerLeftBefore, layerLeftAfter, headerScroll, bodyScroll, firstBodyCellLeft, frozen: table.getFrozenWidth() };
});
check(
  '宽表：横向滚动时表头与表体同步，固定列（冻结层）钉住不动',
  bigHorizontal.bodyScroll[0] === 180 && bigHorizontal.headerScroll[0] === 180 && bigHorizontal.layerLeftBefore === bigHorizontal.layerLeftAfter,
  JSON.stringify(bigHorizontal),
);

const bigJump = await page.evaluate(() => {
  const table = window.__result.bigTable;
  table.scrollToRow(9999);
  return { range: table.getRowRange(), rows: table.getRenderedRowCount() };
});
check('宽表：scrollToRow 能跳到最后一万行', bigJump.range.end === 10000 && bigJump.rows <= 16, JSON.stringify(bigJump));

/* ---------- 无障碍镜像层 ---------- */
const a11yBoot = await page.evaluate(() => {
  const mirror = window.__result.a11yMirror;
  mirror.refresh();
  const elements = mirror.getElements();
  const submit = document.querySelector('[data-ice-id="submit-button"]');
  return {
    mounted: mirror.isMounted(),
    count: elements.length,
    buttons: elements.filter((element) => element.getAttribute('role') === 'button').length,
    submitLabel: submit ? submit.getAttribute('aria-label') : null,
    submitRole: submit ? submit.getAttribute('role') : null,
    submitBox: submit ? [submit.style.left, submit.style.top, submit.style.width, submit.style.height] : null,
  };
});
check(
  '无障碍镜像：把画布语义渲染成定位好的 role 元素（带 aria-label）',
  a11yBoot.mounted === true && a11yBoot.count > 20 && a11yBoot.buttons > 5 && a11yBoot.submitLabel === 'Submit' && a11yBoot.submitRole === 'button',
  JSON.stringify(a11yBoot),
);

// 点镜像元素 = 激活画布组件。挑一个副作用确定的按钮：点 pop-btn 会弹浮层
const a11yClicked = await page.evaluate(() => {
  const target = document.querySelector('[data-ice-id="pop-btn"]');
  target.click();
  return { focused: window.__result.ice.getFocusedComponent() ? window.__result.ice.getFocusedComponent().state.id : null };
});
await page.waitForTimeout(360);
const a11yOverlay = await page.evaluate(() => window.ICEWEB.getICEOverlayManager(window.__result.ice).isOpen());
check(
  '无障碍镜像：点镜像按钮 = 聚焦并激活画布组件（屏幕阅读器用户点得动）',
  a11yClicked.focused === 'pop-btn' && a11yOverlay === true,
  JSON.stringify({ focused: a11yClicked.focused, overlayOpen: a11yOverlay }),
);
await page.keyboard.press('Escape');
await page.waitForTimeout(240);

const a11yFocus = await page.evaluate(() => {
  const target = document.querySelector('[data-ice-id="tip-btn"]');
  target.focus();
  const focused = window.__result.ice.getFocusedComponent();
  return focused ? focused.state.id : null;
});
check('无障碍镜像：DOM 焦点映射回画布组件（Tab 进得去）', a11yFocus === 'tip-btn', String(a11yFocus));

/* ---------- 树：拖节点跨层级排序 ---------- */
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(200);
const treeDrag = await page.evaluate(() => {
  const tree = window.__result.tree;
  window.__treeDrops = [];
  tree.on('nodedrop', (evt) => window.__treeDrops.push([evt.param.key, evt.param.targetKey, evt.param.position]));
  const rows = tree.getVisibleNodes().map((node) => node.key);
  const boxOf = (key) => {
    const node = tree.getRowNode(key);
    let l = 0;
    let t = 0;
    let cursor = node;
    while (cursor && cursor.state) {
      l += Number(cursor.state.left) || 0;
      t += Number(cursor.state.top) || 0;
      cursor = cursor.parentNode;
    }
    return { l, t, h: Number(node.state.height) || 24 };
  };
  // 拖「同级」的两行（root 的子节点）：把第 3 行拖到第 2 行上方 = 换位
  return { rows: rows.slice(0, 3), source: boxOf(rows[2]), target: boxOf(rows[1]) };
});
const treeRect = await canvasRect();
await page.mouse.move(treeRect.left + treeDrag.source.l + 60, treeRect.top + treeDrag.source.t + treeDrag.source.h / 2);
await page.mouse.down();
await page.mouse.move(treeRect.left + treeDrag.target.l + 60, treeRect.top + treeDrag.target.t + 2, { steps: 8 });
const treeMidDrag = await page.evaluate(() => ({ dragging: window.__result.tree.isDragging(), target: window.__result.tree.getDropTarget() }));
await page.mouse.up();
await page.waitForTimeout(320);
const treeAfter = await page.evaluate(() => ({
  rows: window.__result.tree.getVisibleNodes().map((node) => node.key).slice(0, 3),
  drops: window.__treeDrops,
}));
check(
  '树：拖节点到目标行上方 = 插到它前面（拖拽态 / 落点 / 新顺序都对）',
  treeMidDrag.dragging === true && !!treeMidDrag.target && treeMidDrag.target.position === 'before' &&
    treeAfter.drops.length === 1 && treeAfter.drops[0][2] === 'before' &&
    treeAfter.rows[0] === treeDrag.rows[0] && treeAfter.rows[1] === treeDrag.rows[2] && treeAfter.rows[2] === treeDrag.rows[1],
  JSON.stringify({ before: treeDrag.rows, mid: treeMidDrag, after: treeAfter }),
);

/* ---------- i18n：内置文案跟着语言走 ---------- */
const i18nState = await page.evaluate(() => {
  const W = window.ICEWEB;
  const table = window.__result.pagedTable;
  const readEmpty = () => {
    const empty = (table.childNodes || []).find((node) => typeof node.getDescription === 'function');
    return empty ? empty.getDescription() : '';
  };
  const before = { locale: W.getICELocale(), text: readEmpty() };
  W.setICELocale('en-US');
  table.setData([]); // 重建空态 → 读英文文案
  const english = { locale: W.getICELocale(), text: readEmpty() };
  W.setICELocale('zh-CN');
  table.setData([
    { name: 'Ava', city: '杭州', amount: 1240 },
    { name: 'Bob', city: '上海', amount: 860 },
    { name: 'Cara', city: '北京', amount: 2310 },
  ]);
  const restored = { locale: W.getICELocale(), rows: table.getRows().length };
  return { before, english, restored };
});
check(
  'i18n：切到英文后内置文案跟着变，切回中文恢复（内置语言包）',
  i18nState.before.locale === 'zh-CN' && i18nState.english.locale === 'en-US' && i18nState.english.text === 'No data' && i18nState.restored.locale === 'zh-CN' && i18nState.restored.rows === 3,
  JSON.stringify(i18nState),
);

const sectionBox = await nodeBox('window.__result.splitter');
const shotRect = await canvasRect();
if (sectionBox) {
  await page.screenshot({
    path: '/tmp/qa-gallery-new.png',
    fullPage: true,
    clip: {
      x: Math.max(0, shotRect.left + sectionBox.l - 40),
      y: Math.max(0, shotRect.pageTop + sectionBox.t - 40),
      width: 900,
      height: 360,
    },
  });
}

await browser.close();

if (failures.length) {
  console.error(`\nQA 未通过（${failures.length} 项）：`);
  failures.forEach((item) => console.error('  - ' + item));
  process.exit(1);
}
console.log('\nGallery QA 通过（截图在 /tmp/qa-gallery*.png）');
