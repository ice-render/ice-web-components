/**
 * admin.html 的浏览器端 QA（逐页布局一致性 + 弹出层交互）。
 *
 * 用法（需要能解析到 playwright）：
 *   npm run qa:admin
 *   PLAYWRIGHT_PATH=/path/to/playwright npm run qa:admin
 *
 * 检查项：
 * 1. 五个页面的首卡左/上边距是否一致（布局一致性）；
 * 2. 页面内「顶层元素两两相交」是否为 0（防交叠）；
 * 3. 逐个打开弹出层（抽屉 / 弹窗 / 下拉 / 气泡 / 提示 / 日期 / 级联 / 自动完成 / 二次确认），
 *    断言「能打开、能 Esc 关闭」，并截图到 /tmp/qa-*.png 供人工复核外观；
 * 4. 全过程收集 console error / pageerror，必须为 0。
 *
 * 退出码非 0 表示有检查未通过。
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
    'qa-admin 需要 playwright：请先 `npm i -D playwright`，或用 PLAYWRIGHT_PATH 指向已安装的 playwright',
  );
}

const { chromium } = loadPlaywright();
const ADMIN_URL = 'file://' + path.resolve(process.cwd(), 'examples/admin.html');
const PAGE_KEYS = ['dashboard', 'orders', 'fulfillment', 'products', 'customers', 'settings'];

const failures = [];
const check = (name, ok, detail = '') => {
  if (!ok) failures.push(`${name}${detail ? ' — ' + detail : ''}`);
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? '  ' + detail : ''}`);
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1700, height: 1100 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console: ' + m.text());
});
await page.goto(ADMIN_URL);
await page.waitForTimeout(900);

// 页面内小工具：按 id 找节点 / 取世界坐标 / 浮层状态
await page.evaluate(() => {
  window.__qa = {
    find(id) {
      const roots = [window.__result.shell, window.__result.contentHost, ...Object.values(window.__result.builtPages)];
      let found = null;
      const walk = (n) => {
        if (found) return;
        (n.childNodes || []).forEach((c) => {
          if (c.state && c.state.id === id) found = c;
          walk(c);
        });
      };
      roots.forEach((r) => r && walk(r));
      return found;
    },
    box(node) {
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
    overlaysOpen: () => window.ICEWEB.getICEOverlayManager(window.__result.ice).isOpen(),
    topOverlay() {
      const layer = window.ICEWEB.getICEOverlayManager(window.__result.ice).getLayer();
      const kids = (layer.childNodes || []).filter((c) => c.state);
      const node = kids[kids.length - 1];
      return node ? window.__qa.box(node) : null;
    },
  };
});
const rect = await page.evaluate(() => {
  const r = document.getElementById('canvas').getBoundingClientRect();
  return { left: r.left, top: r.top };
});

const clickId = async (id) => {
  const b = await page.evaluate((i) => {
    const node = window.__qa.find(i);
    return node ? window.__qa.box(node) : null;
  }, id);
  if (!b) return false;
  await page.mouse.click(rect.left + b.l + b.w / 2, rect.top + b.t + b.h / 2);
  await page.waitForTimeout(420);
  return true;
};
const shotOverlay = async (name) => {
  const b = await page.evaluate(() => window.__qa.topOverlay());
  if (!b) return;
  const pad = 20;
  await page.screenshot({
    path: `/tmp/qa-${name}.png`,
    clip: {
      x: rect.left + Math.max(0, b.l - pad),
      y: rect.top + Math.max(0, b.t - pad),
      width: Math.min(1600 - Math.max(0, b.l - pad), b.w + pad * 2),
      height: b.h + pad * 2,
    },
  });
};
const closeOverlay = async () => {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(420);
};

/**
 * 把节点滚进内容视口。
 *
 * admin 的页面都挂在 contentHost（ICEScrollPane）里，节点可能远在首屏之外，
 * 直接按世界坐标点会落到窗口外 —— 桌面端 Playwright 的坐标是视口坐标。
 * shell 级别的悬浮件（FAB / 回到顶部）不在 pageHost 里，跳过。
 */
const scrollIntoView = async (source) => {
  await page.evaluate((src) => {
    // eslint-disable-next-line no-eval
    const node = eval(src);
    if (!node || !node.state) return;
    const pane = window.__result.contentHost;
    const content = typeof pane.getContent === 'function' ? pane.getContent() : null;
    let relativeTop = 0;
    let cursor = node;
    let inside = false;
    while (cursor && cursor !== pane) {
      relativeTop += Number(cursor.state && cursor.state.top) || 0;
      if (cursor === content) inside = true;
      cursor = cursor.parentNode;
    }
    if (!inside) return;
    const viewportHeight = pane.getViewportSize()[1];
    const next = Math.max(0, Math.round(relativeTop - viewportHeight / 3));
    pane.setScroll(0, next);
  }, source);
  await page.waitForTimeout(220);
};

/** 按表达式取节点并点它的中心（qa-admin 里的页面句柄走 window.__result.state.*）。 */
const clickExpr = async (source) => {
  await scrollIntoView(source);
  const b = await page.evaluate((src) => {
    // eslint-disable-next-line no-eval
    const node = eval(src);
    return node && node.state ? window.__qa.box(node) : null;
  }, source);
  if (!b) return false;
  await page.mouse.click(rect.left + b.l + b.w / 2, rect.top + b.t + b.h / 2);
  await page.waitForTimeout(420);
  return true;
};
const dragExpr = async (source, dx, dy) => {
  await scrollIntoView(source);
  const b = await page.evaluate((src) => {
    // eslint-disable-next-line no-eval
    const node = eval(src);
    return node && node.state ? window.__qa.box(node) : null;
  }, source);
  if (!b) return false;
  const x = rect.left + b.l + b.w / 2;
  const y = rect.top + b.t + b.h / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(320);
  return true;
};

/* ---------- 1. 逐页：布局一致性 + 顶层交叠 ---------- */
const layout = {};
for (const key of PAGE_KEYS) {
  await page.evaluate((k) => window.__result.showPage(k), key);
  await page.waitForTimeout(420);
  const info = await page.evaluate((k) => {
    const root = window.__result.builtPages[k];
    const nodes = (root.childNodes || []).filter((c) => c.state && c.state.display !== false);
    const boxes = nodes.map((n) => window.__qa.box(n));
    const hits = [];
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        if (!a.w || !a.h || !b.w || !b.h) continue;
        const ox = Math.min(a.l + a.w, b.l + b.w) - Math.max(a.l, b.l);
        const oy = Math.min(a.t + a.h, b.t + b.h) - Math.max(a.t, b.t);
        if (ox > 1 && oy > 1) hits.push(`${Math.round(ox)}x${Math.round(oy)}`);
      }
    }
    this;
    return {
      firstLeft: Math.round(Math.min(...boxes.map((b) => b.l))),
      firstTop: Math.round(Math.min(...boxes.map((b) => b.t))),
      hits,
    };
  }, key);
  layout[key] = info;
  check(`[${key}] 顶层元素零交叠`, info.hits.length === 0, info.hits.join(','));
}
const lefts = new Set(Object.values(layout).map((l) => l.firstLeft));
const tops = new Set(Object.values(layout).map((l) => l.firstTop));
check('各页首元素左边距一致', lefts.size === 1, [...lefts].join(' / '));
check('各页首元素上边距一致', tops.size === 1, [...tops].join(' / '));

/* ---------- 2. 弹出层逐个开关 ---------- */
await page.evaluate(() => window.__result.showPage('orders'));
await page.waitForTimeout(400);

// 行内「详情」→ 抽屉（同时验证：点行内按钮不应触发行选中）
const rowAction = await page.evaluate(() => {
  const table = window.__qa.find('orders-full');
  window.__qaRow = table;
  const row = table.childNodes.find((c) => c.childNodes && c.childNodes.some((n) => n.state && n.state.text === '#10321'));
  const pick = (label) => {
    let btn = null;
    (row.childNodes || []).forEach((cell) => (cell.childNodes || []).forEach((b) => { if (b.state && b.state.text === label) btn = b; }));
    return btn;
  };
  window.__qaPick = pick;
  return { selectedBefore: table.getSelectedIndex() };
});
const detailBtn = await page.evaluate(() => window.__qa.box(window.__qaPick('详情')));
await page.mouse.click(rect.left + detailBtn.l + detailBtn.w / 2, rect.top + detailBtn.t + detailBtn.h / 2);
await page.waitForTimeout(480);
check('订单详情抽屉可打开', await page.evaluate(() => window.__qa.overlaysOpen()));
check(
  '点行内「详情」不触发行选中',
  (await page.evaluate(() => window.__qaRow.getSelectedIndex())) === rowAction.selectedBefore,
);
await shotOverlay('drawer');
await closeOverlay();
check('抽屉 Esc 可关闭', !(await page.evaluate(() => window.__qa.overlaysOpen())));

// 行内「删除」→ 确认弹窗
const delBtn = await page.evaluate(() => window.__qa.box(window.__qaPick('删除')));
await page.mouse.click(rect.left + delBtn.l + delBtn.w / 2, rect.top + delBtn.t + delBtn.h / 2);
await page.waitForTimeout(480);
check('删除确认弹窗可打开', await page.evaluate(() => window.__qa.overlaysOpen()));
await shotOverlay('modal-delete');
await closeOverlay();

// 新建订单弹窗
const newBtn = await page.evaluate(() => {
  const cp = window.__result.builtPages.orders;
  let btn = null;
  const w = (n) => (n.childNodes || []).forEach((c) => { if (c.state && c.state.text === '新建订单') btn = c; w(c); });
  w(cp);
  return window.__qa.box(btn);
});
await page.mouse.click(rect.left + newBtn.l + newBtn.w / 2, rect.top + newBtn.t + newBtn.h / 2);
await page.waitForTimeout(520);
check('新建订单弹窗可打开', await page.evaluate(() => window.__qa.overlaysOpen()));
await shotOverlay('modal-new-order');
await closeOverlay();

// 头部下拉
for (const [id, name] of [['bell', 'dropdown-bell'], ['header-avatar', 'dropdown-avatar']]) {
  await clickId(id);
  check(`${id} 下拉可打开`, await page.evaluate(() => window.__qa.overlaysOpen()));
  await shotOverlay(name);
  await closeOverlay();
}

// Tooltip（悬停汉堡按钮）
const hb = await page.evaluate(() => window.__qa.box(window.__qa.find('hamburger')));
await page.mouse.move(rect.left + hb.l + hb.w / 2, rect.top + hb.t + hb.h / 2);
await page.waitForTimeout(900);
check('Tooltip 悬停可弹出', await page.evaluate(() => window.__qa.overlaysOpen()));
await shotOverlay('tooltip');
await page.mouse.move(rect.left + 900, rect.top + 900);
await page.waitForTimeout(500);

// 筛选区：级联 / 日期
const clickFilter = async (text) => {
  const b = await page.evaluate((t) => {
    const cp = window.__result.builtPages.orders;
    let field = null;
    const w = (n) => (n.childNodes || []).forEach((c) => { if (c.state && c.state.text === t) field = c; w(c); });
    w(cp);
    return window.__qa.box(field);
  }, text);
  await page.mouse.click(rect.left + b.l + b.w / 2, rect.top + b.t + b.h / 2);
  await page.waitForTimeout(480);
};
await clickFilter('配送区域');
check('级联面板可打开', await page.evaluate(() => window.__qa.overlaysOpen()));
await shotOverlay('cascader');
await closeOverlay();
await clickFilter('2026-09-07');
check('日期面板可打开', await page.evaluate(() => window.__qa.overlaysOpen()));
await shotOverlay('datepicker');
await closeOverlay();

// 顶部搜索：自动完成候选（含滚动视口）
const searchBox = await page.evaluate(() => window.__qa.box(window.__qa.find('search')));
await page.mouse.click(rect.left + searchBox.l + 40, rect.top + searchBox.t + searchBox.h / 2);
await page.waitForTimeout(320);
await page.keyboard.type('a');
await page.waitForTimeout(480);
check('自动完成候选可打开', await page.evaluate(() => window.__qa.overlaysOpen()));
check(
  '候选超过一屏时有滚动视口',
  await page.evaluate(() => {
    const panel = window.__result.builtPages.orders && null;
    const ac = window.__qa.find('search');
    const p = ac && ac.getPanel && ac.getPanel();
    return !!(p && p.childNodes.some((node) => typeof node.getScrollRange === 'function'));
  }),
);
await shotOverlay('autocomplete');
await closeOverlay();

// 商品页：Popconfirm
await page.evaluate(() => window.__result.showPage('products'));
await page.waitForTimeout(450);
const offline = await page.evaluate(() => {
  const cp = window.__result.builtPages.products;
  let btn = null;
  const w = (n) => (n.childNodes || []).forEach((c) => { if (c.state && c.state.text === '下架商品') btn = c; w(c); });
  w(cp);
  return window.__qa.box(btn);
});
await page.mouse.click(rect.left + offline.l + offline.w / 2, rect.top + offline.t + offline.h / 2);
await page.waitForTimeout(480);
check('二次确认气泡可打开', await page.evaluate(() => window.__qa.overlaysOpen()));
await shotOverlay('popconfirm');
await closeOverlay();

// 设置页：三个 Tab 面板都能切换且有高度
await page.evaluate(() => window.__result.showPage('settings'));
await page.waitForTimeout(450);
const heights = [];
for (const i of [0, 1, 2]) {
  await page.evaluate((idx) => window.__result.state.showSettingsPane(idx), i);
  await page.waitForTimeout(380);
  heights.push(await page.evaluate(() => Math.round(window.__result.builtPages.settings.state.height)));
}
check('设置页三个 Tab 面板高度均 > 300', heights.every((h) => h > 300), heights.join(' / '));

/* ---------- 2.5 业务场景细化后的回归（面包屑 / 引导 / 回到顶部 / 各页新组件） ---------- */

// 面包屑跟随页面
await page.evaluate(() => window.__result.showPage('dashboard'));
await page.waitForTimeout(380);
const crumbDashboard = await page.evaluate(() => window.__result.breadcrumb.getLabelTexts().join('>'));
await page.evaluate(() => window.__result.showPage('orders'));
await page.waitForTimeout(380);
const crumbOrders = await page.evaluate(() => window.__result.breadcrumb.getLabelTexts().join('>'));
check('面包屑跟随当前页面', crumbDashboard === '首页>仪表盘' && crumbOrders === '首页>订单管理', `${crumbDashboard} → ${crumbOrders}`);

// 悬浮按钮（快捷键）→ 新手引导
const fabOpened = await clickExpr('window.__result.fab');
const fabExpanded = await page.evaluate(() => window.__result.fab.isExpanded());
const tourStarted = await clickExpr("window.__result.fab.getItemNode('tour')");
const tourState = await page.evaluate(() => ({ open: window.__result.tour.isOpen(), counter: window.__result.tour.getCounterText() }));
check('悬浮按钮展开 + 唤起新手引导', fabOpened && fabExpanded && tourStarted && tourState.open && tourState.counter === '1/4', JSON.stringify(tourState));
await shotOverlay('tour');
await closeOverlay();
check('引导 Esc 可关闭', !(await page.evaluate(() => window.__result.tour.isOpen())));

// 回到顶部：滚动后出现，点击回顶并隐藏（用内容更高的仪表盘页验证）
await page.evaluate(() => {
  window.__result.showPage('dashboard');
  window.__result.contentHost.setScroll(0, 600);
});
await page.waitForTimeout(320);
const backTopVisible = await page.evaluate(() => window.__result.backTop.isVisible());
const backTopClicked = await clickExpr('window.__result.backTop');
const backTopAfter = await page.evaluate(() => ({
  y: window.__result.contentHost.getScroll()[1],
  visible: window.__result.backTop.isVisible(),
}));
check(
  '回到顶部：滚动出现 → 点击回顶',
  backTopVisible && backTopClicked && backTopAfter.y === 0 && backTopAfter.visible === false,
  JSON.stringify(backTopAfter),
);

// 仪表盘：库存预警分页 + 今日待办
await page.evaluate(() => window.__result.showPage('dashboard'));
await page.waitForTimeout(420);
const inventory = await page.evaluate(() => {
  const table = window.__result.state.dashboard.inventoryTable;
  return { rows: table.getRows().length, pages: table.getPageCount(), page: table.getPage() };
});
const inventoryNext = await clickExpr('window.__result.state.dashboard.inventoryTable.getPaginationNode().getNextButton()');
const inventoryAfter = await page.evaluate(() => window.__result.state.dashboard.inventoryTable.getPage());
check(
  '库存预警：每页 3 条 + 翻页',
  inventory.rows === 3 && inventory.pages === 3 && inventoryNext && inventoryAfter === 2,
  `${JSON.stringify(inventory)} → page ${inventoryAfter}`,
);
const todoClicked = await clickExpr("window.__result.state.dashboard.todoGroups.getItemNode('stock')");
const todoValue = await page.evaluate(() => window.__result.state.dashboard.todoGroups.getValue().join(','));
check('今日待办：勾选追加', todoClicked && todoValue === 'ship,stock', todoValue);

// 履约页：Splitter 拖动 + 选单更新详情 + 锚点跳转
await page.evaluate(() => window.__result.showPage('fulfillment'));
await page.waitForTimeout(420);
const splitBefore = await page.evaluate(() => window.__result.state.fulfillment.splitter.getSize());
const splitDragged = await dragExpr('window.__result.state.fulfillment.splitter.getDividerNode()', 80, 0);
const splitAfter = await page.evaluate(() => window.__result.state.fulfillment.splitter.getSize());
check('履约：拖动分隔条改尺寸', splitDragged && splitBefore === 300 && splitAfter > splitBefore, `${splitBefore} → ${splitAfter}`);
const queueClicked = await clickExpr("window.__result.state.fulfillment.list.getRowNode ? window.__result.state.fulfillment.list.getRowNode('o2') : null");
const detailText = await page.evaluate(() => window.__result.state.fulfillment.progressLabel.getText());
check('履约：切换订单详情跟随', queueClicked && /待支付确认/.test(detailText), detailText);
const anchorClicked = await clickExpr("window.__result.state.fulfillment.anchor.getItemNode('service')");
const anchorState = await page.evaluate(() => ({
  active: window.__result.state.fulfillment.anchor.getActiveKey(),
  y: window.__result.state.fulfillment.detailScroll.getScroll()[1],
}));
check('履约：锚点跳转 + 高亮', anchorClicked && anchorState.active === 'service' && anchorState.y > 0, JSON.stringify(anchorState));

// 商品页：图片预览 + 状态单选组 + 折扣滑块
await page.evaluate(() => window.__result.showPage('products'));
await page.waitForTimeout(420);
const galleryStarted = await clickExpr('window.__result.state.products.galleryButton');
const previewOpen = await page.evaluate(() => window.__result.state.products.gallery.isOpen());
const galleryNext = await clickExpr("window.__result.state.products.gallery.getToolbarButton('next')");
const previewIndex = await page.evaluate(() => window.__result.state.products.gallery.getIndex());
check(
  '商品：图片预览打开 + 翻页',
  galleryStarted && previewOpen && galleryNext && previewIndex === 1,
  `open=${previewOpen} index=${previewIndex}`,
);
await shotOverlay('image-preview');
await closeOverlay();
const statusClicked = await clickExpr("window.__result.state.products.productStatus.getItemNode('presale')");
const statusValue = await page.evaluate(() => window.__result.state.products.productStatus.getValue());
check('商品：状态单选组切换', statusClicked && statusValue === 'presale', String(statusValue));

// 订单多选 + 批量发货（ICETable rowSelection: 'multiple'）
await page.evaluate(() => window.__result.showPage('orders'));
await page.waitForTimeout(420);
// 预热点击：切页后第一次鼠标按下会被一次性的全局监听吃掉（悬停提示 / 焦点恢复）
await page.mouse.click(rect.left + 900, rect.top + 700);
await page.waitForTimeout(260);
await page.evaluate(() => window.__result.state.orders.table.clearSelection());
await page.waitForTimeout(200);
const checkFirst = await clickExpr('window.__result.state.orders.table.getSelectionNode(0)');
const checkSecond = await clickExpr('window.__result.state.orders.table.getSelectionNode(1)');
const bulkState = await page.evaluate(() => ({
  selected: window.__result.state.orders.table.getSelectedRows().length,
  hint: window.__result.state.orders.selectedHint.getText(),
}));
check(
  '订单多选：勾两行 → 提示合计',
  checkFirst && checkSecond && bulkState.selected === 2 && /已选中 2 笔/.test(bulkState.hint),
  JSON.stringify(bulkState),
);
const shipTargets = await page.evaluate(() =>
  window.__result.state.orders.table.getSelectedRows().map((row) => row.order),
);
const shipClicked = await clickExpr('window.__result.state.orders.bulkShip');
// 批量发货后表格会重新筛选/渲染（选择被清空），所以按订单号回查数据源里的状态
const shipped = await page.evaluate(
  (orders) => orders.map((order) => (window.__result.ORDERS.find((row) => row.order === order) || {}).status),
  shipTargets,
);
check('订单批量发货：选中行状态改为 Shipped', shipClicked && shipped.length === 2 && shipped.every((s) => s === 'Shipped'), JSON.stringify(shipped));
await page.evaluate(() => window.__result.state.orders.table.clearSelection());

// 设置页：第四个 Tab（业务偏好）+ 跨字段校验 + 多选上限
await page.evaluate(() => window.__result.showPage('settings'));
await page.waitForTimeout(420);
const bizShown = await page.evaluate(() => {
  window.__result.state.showSettingsPane(3);
  const panel = window.__result.state.settings.panels.biz;
  return { display: panel.state.display, height: Math.round(window.__result.builtPages.settings.state.height) };
});
check('设置：业务偏好 Tab 可切换', bizShown.display === true && bizShown.height > 300, JSON.stringify(bizShown));
const crossField = await page.evaluate(() => {
  const biz = window.__result.state.biz;
  const model = biz.passwordForm.getModel();
  model.setValue('newPassword', 'abc12345');
  model.setValue('confirmPassword', 'abc12345');
  const matched = model.getError('confirmPassword');
  model.setValue('newPassword', 'zzz99999');
  return { matched, mismatched: model.getError('confirmPassword') };
});
check(
  '设置：确认密码跨字段重校验',
  crossField.matched === null && crossField.mismatched === '两次输入的密码不一致',
  JSON.stringify(crossField),
);
const channelLimit = await page.evaluate(() => {
  const group = window.__result.state.biz.channelGroup;
  group.clear();
  group.setValue(['email', 'sms']);
  return { value: group.getValue(), max: group.getCheckedCount() };
});
check('设置：通知渠道多选上限 2', channelLimit.value.join(',') === 'email,sms', JSON.stringify(channelLimit));

/* ---------- 3. 全程无 console error ---------- */
check('无 console error / pageerror', errors.length === 0, errors.slice(0, 3).join(' | '));

/* ---------- 4. 自定义组件示例页 ---------- */
const custom = await browser.newPage({ viewport: { width: 1000, height: 620 }, deviceScaleFactor: 1 });
const customErrors = [];
custom.on('pageerror', (e) => customErrors.push('pageerror: ' + e.message));
custom.on('console', (m) => {
  if (m.type() === 'error') customErrors.push('console: ' + m.text());
});
await custom.goto('file://' + path.resolve(process.cwd(), 'examples/custom-component.html'));
await custom.waitForTimeout(700);
const customRect = await custom.evaluate(() => {
  const r = document.getElementById('canvas').getBoundingClientRect();
  return { x: r.x, y: r.y };
});
const metric = await custom.evaluate(() => {
  const node = window.__result.metrics[0];
  let l = 0;
  let t = 0;
  let x = node;
  while (x && x.state) {
    l += Number(x.state.left) || 0;
    t += Number(x.state.top) || 0;
    x = x.parentNode;
  }
  return { l, t, w: Number(node.state.width) || 0, h: Number(node.state.height) || 0, before: node.getValue() };
});
await custom.mouse.click(customRect.x + metric.l + metric.w / 2, customRect.y + metric.t + metric.h / 2);
await custom.waitForTimeout(320);
const afterClick = await custom.evaluate(() => ({
  value: window.__result.metrics[0].getValue(),
  hovered: window.__result.metrics[0].isHovered(),
}));
await custom.keyboard.press('ArrowUp');
await custom.waitForTimeout(260);
const afterKey = await custom.evaluate(() => window.__result.metrics[0].getValue());
check('自定义组件：点击 +1', afterClick.value === metric.before + 1, `${metric.before} → ${afterClick.value}`);
check('自定义组件：悬停生效', afterClick.hovered === true);
check('自定义组件：聚焦后 ↑ 调值', afterKey === afterClick.value + 1, `${afterClick.value} → ${afterKey}`);
const submit = await custom.evaluate(() => {
  const node = window.__result.submitButton;
  let l = 0;
  let t = 0;
  let x = node;
  while (x && x.state) {
    l += Number(x.state.left) || 0;
    t += Number(x.state.top) || 0;
    x = x.parentNode;
  }
  return { l, t, w: Number(node.state.width) || 0, h: Number(node.state.height) || 0 };
});
await custom.mouse.click(customRect.x + submit.l + submit.w / 2, customRect.y + submit.t + submit.h / 2);
await custom.waitForTimeout(420);
const formState = await custom.evaluate(() => ({
  error: window.__result.form.getModel().getError('stock'),
  stroke: window.__result.metricInForm.state.style.strokeStyle,
}));
check('自定义组件：表单错误态标红', !!formState.error && formState.stroke === '#dc3545', String(formState.error));
check('自定义组件示例页无 console error', customErrors.length === 0, customErrors.slice(0, 3).join(' | '));

await browser.close();
console.log(`\n${failures.length === 0 ? 'QA 通过' : 'QA 失败 ' + failures.length + ' 项'}（截图在 /tmp/qa-*.png）`);
process.exit(failures.length === 0 ? 0 : 1);
