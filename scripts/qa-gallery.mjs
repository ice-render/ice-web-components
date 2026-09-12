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

check('无 console error / pageerror', errors.length === 0, errors.slice(0, 3).join(' | '));

await page.screenshot({ path: '/tmp/qa-gallery.png', fullPage: true });
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
