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
const PAGE_KEYS = ['dashboard', 'orders', 'products', 'customers', 'settings'];

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
