import { defineConfig } from '@playwright/test';

/**
 * 示例页端到端配置（examples 冒烟回归）。
 *
 * 前置：`npm run build`（示例页加载 `../dist/index.umd.js` 与
 * `../node_modules/ice-render/dist/index.umd.js`，后者是随依赖安装下来的引擎产物）。
 *
 * 家族端口分配（同一台机器上可同时跑，见引擎仓 AGENTS.md「家族 e2e 端口分配」）：
 * ice-render 8090 / ice-entity-designer 8091 / ice-smart-water 8092 /
 * ice-web-components 8093 / ice-render-dsl 8094 / react-demo 8095 / ice-chart 5177。
 *
 * `reuseExistingServer: false`：端口被别的仓的服务占着时直接响亮失败 ——
 * 曾经因为 true + 端口串号（ice-smart-water 的截图脚本也用 8093），本仓 e2e 静默复用了
 * 它的服务目录，9 个用例全红（`/examples/admin.html` 404）却看起来像代码坏了。
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  reporter: [['list']],
  webServer: {
    command: 'npx http-server . -p 8093 -c-1 --silent',
    port: 8093,
    reuseExistingServer: false,
    timeout: 30_000,
  },
  use: {
    baseURL: 'http://localhost:8093',
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  },
});
