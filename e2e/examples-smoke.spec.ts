/**
 * examples 冒烟回归（永久）。
 *
 * 遍历 `examples/` 下所有页面，逐页校验：
 *  1) 无 pageerror、无 console error；
 *  2) 页面上至少有一张 canvas，且画布上确实有像素输出（不是空白页）。
 *
 * 覆盖的 9 个页面都是"整套组件摆在一起"的合成页（admin / gallery / workbench / windows-xp /
 * arcade / pixel-editor / algorithm-sandbox / dos-terminal / custom-component），
 * 它们同时也是本仓对外最直观的示例，坏掉最难被发现 —— 所以用真浏览器逐页钉住。
 *
 * 注意：示例页从 `node_modules/ice-render/dist/index.umd.js` 取引擎产物，
 * 即**随依赖装下来的那一版引擎**（本仓 devDependency 为 `^2.2.0`）；这不是笔误，
 * 是"应用仓按发布版本对齐引擎"的既定做法（见 README 的依赖约定）。
 *
 * 前置：`npm run build`；运行：`npm run test:e2e`（内部会自己 build）。
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..');

/** 收集 examples 下的页面（跳过 assets 等非示例目录与导航页 index.html）。 */
function collectPages(dir: string, rel = ''): string[] {
  const out: string[] = [];
  for (const name of fs.readdirSync(dir).sort()) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) {
      if (name === 'assets' || name === 'node_modules') continue;
      out.push(...collectPages(full, rel ? `${rel}/${name}` : name));
    } else if (name.endsWith('.html') && name !== 'index.html') {
      out.push(rel ? `${rel}/${name}` : name);
    }
  }
  return out;
}

const pages = collectPages(path.join(ROOT, 'examples'));

test.describe('examples 冒烟', () => {
  for (const rel of pages) {
    test(`${rel}：无页面错误且画布有输出`, async ({ page }) => {
      const errs: string[] = [];
      page.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`.slice(0, 300)));
      page.on('console', (m) => {
        if (m.type() === 'error') errs.push(`console: ${m.text()}`.slice(0, 300));
      });

      await page.goto(`/examples/${rel}`, { waitUntil: 'load' });
      // 等首帧上屏（含字体测量与入场动画）
      await page.waitForTimeout(1200);

      const painted = await page.evaluate(() => {
        const canvases = Array.from(document.querySelectorAll('canvas'));
        if (!canvases.length) return false;
        return canvases.some((c) => {
          const ctx = c.getContext('2d');
          if (!ctx || !c.width || !c.height) return false;
          const data = ctx.getImageData(0, 0, c.width, c.height).data;
          // 不需要逐像素比对：采样到任意一个不透明像素即视为"画上了"
          for (let i = 3; i < data.length; i += 4 * 97) {
            if (data[i] > 0) return true;
          }
          return false;
        });
      });

      expect(painted, `${rel}：画布没有像素输出（空白页 / 脚本没跑起来）`).toBe(true);
      expect(errs, `${rel}：页面报错`).toEqual([]);
    });
  }
});
