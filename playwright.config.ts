import { defineConfig } from '@playwright/test';

/**
 * 示例页端到端配置（examples 冒烟回归）。
 *
 * 前置：`npm run build`（示例页加载 `../dist/index.umd.js` 与
 * `../node_modules/ice-render/dist/index.umd.js`，后者是随依赖安装下来的引擎产物）。
 *
 * 与内核仓（ice-render，8090）、ice-entity-designer（8091）、ice-chart（5177）端口错开。
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  reporter: [['list']],
  webServer: {
    command: 'npx http-server . -p 8093 -c-1 --silent',
    port: 8093,
    reuseExistingServer: true,
    timeout: 30_000,
  },
  use: {
    baseURL: 'http://localhost:8093',
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  },
});
