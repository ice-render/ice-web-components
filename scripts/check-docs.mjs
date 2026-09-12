/**
 * 文档链接检查：README + docs/**\/*.md 里的相对链接（markdown 与图片）是否都存在。
 *
 * 用法：`npm run docs:check`（也包含在 `npm run docs` 里）
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();

function collect(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collect(full, out);
    } else if (entry.name.endsWith('.md')) {
      out.push(full);
    }
  }
  return out;
}

const files = [path.join(ROOT, 'README.md'), ...collect(path.join(ROOT, 'docs'))];
const problems = [];
let checked = 0;

for (const file of files) {
  if (!fs.existsSync(file)) {
    problems.push(`缺少文件：${path.relative(ROOT, file)}`);
    continue;
  }
  const text = fs.readFileSync(file, 'utf8');
  const links = [
    ...text.matchAll(/\]\(([^)\s]+)\)/g), // markdown 链接 / 图片
  ].map((match) => match[1]);
  for (const target of links) {
    if (/^(https?:|mailto:|#)/.test(target)) {
      continue;
    }
    const [relative, anchor] = target.split('#');
    checked += 1;
    const resolved = path.resolve(path.dirname(file), relative);
    if (!fs.existsSync(resolved)) {
      problems.push(`${path.relative(ROOT, file)} → 链接不存在：${target}`);
      continue;
    }
    // 锚点（#section）只在同文件或 md 文件里检查是否存在对应标题
    if (anchor && resolved.endsWith('.md')) {
      const targetText = fs.readFileSync(resolved, 'utf8');
      const headings = [...targetText.matchAll(/^#{1,6}\s+(.*)$/gm)].map((m) =>
        m[1]
          .trim()
          .toLowerCase()
          .replace(/[^\w\u4e00-\u9fa5 -]/g, '')
          .replace(/\s+/g, '-'),
      );
      if (!headings.includes(anchor.toLowerCase())) {
        problems.push(`${path.relative(ROOT, file)} → 锚点不存在：${target}`);
      }
    }
  }
}

console.log(`docs:check 检查了 ${files.length} 个文件 / ${checked} 个相对链接`);
if (problems.length) {
  problems.forEach((problem) => console.error('  ✗ ' + problem));
  process.exit(1);
}
console.log('  所有相对链接与锚点都存在 ✓');
