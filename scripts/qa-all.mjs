/**
 * 八套浏览器 QA 的顺序执行器（`npm run qa:all`）。
 *
 * 为什么要有它：`qa:*` 各套原先**不在任何门禁里**，于是"改公共 API 忘了改 QA 脚本"
 * 这类问题能烂很久没人发现 —— 2026-09-15 实测就踩到两次：`ICEList.getRowNode` 删除后
 * `qa-workbench` / `qa-admin` 从那以后一直是失败的（脚本先崩、后面几十项根本没跑），
 * 而 `npm run verify` 全绿。现在 `verify:full` 会跑这一串，红线才真的连上。
 *
 * 用法：
 *   npm run qa:all                 # 八套全跑
 *   node scripts/qa-all.mjs gallery pixel   # 只跑指定几套（调试用）
 *
 * 每套脚本自己起静态服务器（端口 0 = 系统分配）并自带截图，所以顺序跑不会串端口。
 * 任一套失败 → 整体非 0 退出；每套的输出原样透传（失败时不用再单独跑一遍找原因）。
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/** 全量清单（文档 `docs/guides/testing.md` 里的表格与之对应）。 */
const ALL = ['gallery', 'admin', 'workbench', 'xp', 'arcade', 'pixel', 'algo', 'dos'];

const requested = process.argv.slice(2).filter((arg) => !arg.startsWith('-'));
const suites = requested.length ? requested : ALL;

const unknown = suites.filter((name) => !ALL.includes(name));
if (unknown.length) {
  console.error(`[qa:all] 不认识的套件：${unknown.join(', ')}（可选：${ALL.join(' / ')}）`);
  process.exit(2);
}

const started = Date.now();
const failed = [];
const results = [];

for (const name of suites) {
  const file = path.join(ROOT, 'scripts', `qa-${name}.mjs`);
  if (!fs.existsSync(file)) {
    failed.push(name);
    results.push({ name, ok: false, ms: 0 });
    console.error(`[qa:all] 缺少脚本：${path.relative(ROOT, file)}`);
    continue;
  }
  console.log(`\n===== qa:${name} =====`);
  const at = Date.now();
  const res = spawnSync(process.execPath, [file], { stdio: 'inherit', cwd: ROOT });
  const ms = Date.now() - at;
  const ok = res.status === 0;
  if (!ok) {
    failed.push(name);
  }
  results.push({ name, ok, ms });
}

console.log('\n===== qa:all 汇总 =====');
for (const item of results) {
  console.log(`${item.ok ? '✓' : '✗'} qa:${item.name}  ${(item.ms / 1000).toFixed(1)}s`);
}
console.log(`合计 ${((Date.now() - started) / 1000).toFixed(1)}s，${suites.length - failed.length}/${suites.length} 通过`);

if (failed.length) {
  console.error(`\nqa:all 失败：${failed.map((name) => `qa:${name}`).join(', ')}`);
  process.exit(1);
}
