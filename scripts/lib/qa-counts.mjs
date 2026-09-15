/**
 * QA 断言数统计（静态解析，不跑浏览器）。
 *
 * 为什么要它：文档里的「qa:admin 52 项 / 八套 281 项」是手写的，已经写错过一次
 * （把 +4 记成 +5）。数字要有唯一来源 —— 这个脚本从各 `qa-*.mjs` 里数 `check(` 调用点，
 * 再把「包在 `for (const x of ARRAY)` 里、会按数组长度重复执行」的那些折算进去。
 *
 * 解析规则（够用且可解释）：
 * - 每个 `check(` 记 1 项；
 * - 若某个 `check(` 落在 `for (const X of NAME)` 的块里，且同文件能找到 `const NAME = [...]`，
 *   则该处按 `数组长度` 项计（原先按 1 记，故补 `长度 - 1`）。
 *
 * 用法：
 *   node scripts/qa-counts.mjs            # 打印表格
 *   node scripts/qa-counts.mjs --check    # 与 docs/guides/testing.md 里标记块的数字比对（CI 门禁用）
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const START = '<!-- qa-counts:start -->';
const END = '<!-- qa-counts:end -->';

/** 统计单个 QA 脚本的断言数。 */
export function countAssertions(source) {
  const checkCount = (source.match(/\bcheck\(/g) || []).length;
  let bonus = 0;
  // 把「循环里的 check」按数组长度折算
  const loop = /for \(const \w+ of ([A-Z_][A-Z0-9_]*)\)/g;
  let match = loop.exec(source);
  while (match) {
    const [, name] = match;
    const blockStart = source.indexOf('{', match.index);
    // 块尾要**配对花括号**：循环体里通常还嵌着回调，直接找第一个 `}` 会提前截断
    let blockEnd = -1;
    let depth = 0;
    for (let i = blockStart; i !== -1 && i < source.length; i += 1) {
      if (source[i] === '{') depth += 1;
      else if (source[i] === '}') {
        depth -= 1;
        if (depth === 0) {
          blockEnd = i;
          break;
        }
      }
    }
    const body = blockStart === -1 || blockEnd === -1 ? '' : source.slice(blockStart, blockEnd);
    if (/\bcheck\(/.test(body)) {
      const arrayMatch = source.match(new RegExp(`const ${name} = \\[([^\\]]*)\\]`));
      if (arrayMatch) {
        const items = arrayMatch[1].split(',').map((item) => item.trim()).filter(Boolean).length;
        if (items > 1) bonus += items - 1;
      }
    }
    match = loop.exec(source);
  }
  return { total: checkCount + bonus, callSites: checkCount, loopBonus: bonus };
}

/** 扫一遍 scripts/qa-*.mjs。 */
export function collectCounts() {
  const dir = path.join(ROOT, 'scripts');
  return fs
    .readdirSync(dir)
    // `qa-all.mjs` 是**执行器**（顺序跑各套 + 汇总），自己不是一套 QA，别统计进来。
    .filter((name) => /^qa-.*\.mjs$/.test(name) && name !== 'qa-all.mjs')
    .sort()
    .map((name) => {
      const key = name.replace(/^qa-/, '').replace(/\.mjs$/, '');
      const stats = countAssertions(fs.readFileSync(path.join(dir, name), 'utf8'));
      return { key, ...stats };
    });
}

export function renderBlock(counts) {
  const total = counts.reduce((sum, item) => sum + item.total, 0);
  const rows = counts.map((item) => `| \`qa:${item.key}\` | ${item.total} |`).join('\n');
  return [START, `<!-- 由 scripts/lib/qa-counts.mjs 生成，请勿手改：八套合计 ${total} 项 -->`, '| 脚本 | 断言数 |', '|---|---|', rows, `| **合计** | **${total}** |`, END].join('\n');
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const counts = collectCounts();
  const block = renderBlock(counts);
  const checkMode = process.argv.includes('--check');
  const docPath = path.join(ROOT, 'docs', 'guides', 'testing.md');
  const doc = fs.readFileSync(docPath, 'utf8');
  const start = doc.indexOf(START);
  const end = doc.indexOf(END);
  if (checkMode) {
    if (start === -1 || end === -1) {
      console.error('qa:counts 文档里找不到标记块');
      process.exit(1);
    }
    const current = doc.slice(start, end + END.length);
    if (current.trim() !== block.trim()) {
      console.error('qa:counts 与 docs/guides/testing.md 不一致，请运行 `node scripts/qa-counts.mjs --write`');
      process.exit(1);
    }
    console.log(`qa:counts 一致：八套合计 ${counts.reduce((sum, item) => sum + item.total, 0)} 项`);
  } else if (process.argv.includes('--write')) {
    const next = start === -1 ? doc + '\n' + block + '\n' : doc.slice(0, start) + block + doc.slice(end + END.length);
    fs.writeFileSync(docPath, next, 'utf8');
    console.log('qa:counts 已写入 docs/guides/testing.md');
  } else {
    counts.forEach((item) => console.log(`  qa:${item.key.padEnd(10)} ${String(item.total).padStart(3)}  （调用点 ${item.callSites}${item.loopBonus ? ` + 循环 ${item.loopBonus}` : ''}）`));
    console.log(`  合计 ${counts.reduce((sum, item) => sum + item.total, 0)}`);
  }
}
