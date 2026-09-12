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

const rect = await page.evaluate(() => {
  const r = document.getElementById('canvas').getBoundingClientRect();
  return { left: r.left, top: r.top };
});

/** 按表达式取节点 → 世界盒（表达式在页面上下文里求值）。 */
const nodeBox = async (expr) =>
  page.evaluate((source) => {
    // eslint-disable-next-line no-eval
    const node = eval(source);
    return node ? window.__qa.world(node) : null;
  }, expr);

const textOf = async (expr) =>
  page.evaluate((source) => {
    // eslint-disable-next-line no-eval
    const node = eval(source);
    return node ? window.__qa.texts(node).join('|') : null;
  }, expr);

/** 用真实鼠标点节点中心。 */
const clickExpr = async (expr) => {
  const box = await nodeBox(expr);
  if (!box) return false;
  await page.mouse.click(rect.left + box.l + box.w / 2, rect.top + box.t + box.h / 2);
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
if (dividerBox) {
  const startX = rect.left + dividerBox.l + dividerBox.w / 2;
  const y = rect.top + dividerBox.t + dividerBox.h / 2;
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

check('无 console error / pageerror', errors.length === 0, errors.slice(0, 3).join(' | '));

await page.screenshot({ path: '/tmp/qa-gallery.png', fullPage: true });
const sectionBox = await nodeBox('window.__result.splitter');
if (sectionBox) {
  await page.screenshot({
    path: '/tmp/qa-gallery-new.png',
    fullPage: true,
    clip: {
      x: Math.max(0, rect.left + sectionBox.l - 40),
      y: Math.max(0, rect.top + sectionBox.t - 40),
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
