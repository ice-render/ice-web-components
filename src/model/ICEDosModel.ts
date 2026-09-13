/**
 * DOS 终端（虚拟文件系统 + 命令解释器，纯逻辑，不碰 DOM）。
 *
 * 页面只做三件事：把 `run()` 返回的行画成文字、把键盘输入交给模型、按 `effect` 做副作用
 * （`cls` 清屏 / `exit` 退出）。所以「命令怎么解析、路径怎么算、文件怎么改」全都能在 node 里断言。
 *
 * 约定：
 * - 路径分隔符 `\` 与 `/` 等价；支持绝对（`\GAMES`）、相对（`GAMES`）、`.`、`..`；
 * - 命令大小写不敏感（`DIR` = `dir`），参数里的文件名也大小写不敏感；
 * - `run()` 从不抛：任何坏输入都变成一行 `error`，终端不会因为打错字崩掉；
 * - `echo x > a.txt` / `echo x >> a.txt` 也是模型的一部分（重定向在解析层处理掉）；
 * - 历史和 Tab 补全归模型管（真终端也有这两个），页面只管按键。
 */

export type ICEDosLineType = 'output' | 'error';

export interface ICEDosLine {
  text: string;
  type: ICEDosLineType;
}

export interface ICEDosEffect {
  clear?: boolean;
  exit?: boolean;
}

export interface ICEDosResult {
  lines: ICEDosLine[];
  effect?: ICEDosEffect;
}

export interface ICEDosOptions {
  /** 时间源（`date` / `time` 用），测试可注入固定时间 */
  now?: () => Date;
}

interface ICEDosFile {
  type: 'file';
  name: string;
  content: string;
  /** 显示的日期（DOS 的 dir 里那一列） */
  date: string;
}

interface ICEDosDir {
  type: 'dir';
  name: string;
  children: Map<string, ICEDosNode>;
}

type ICEDosNode = ICEDosFile | ICEDosDir;

const COMMANDS: Array<[string, string]> = [
  ['DIR', '列出目录内容'],
  ['CD', '切换目录（cd .. / cd \\ / cd 名字）'],
  ['MD', '新建目录（mkdir 同义）'],
  ['RD', '删除空目录'],
  ['TYPE', '显示文本文件内容'],
  ['ECHO', '显示文字；echo x > a.txt 写文件，>> 追加'],
  ['COPY', '复制文件'],
  ['REN', '重命名文件'],
  ['DEL', '删除文件'],
  ['TREE', '递归列出目录树'],
  ['CLS', '清屏'],
  ['VER', '显示版本'],
  ['DATE', '显示日期'],
  ['TIME', '显示时间'],
  ['HELP', '看这份帮助'],
  ['EXIT', '退出终端'],
];

export class ICEDosModel {
  private root: ICEDosDir;
  private cwd: string[] = [];
  private history: string[] = [];
  private historyIndex = 0;
  private now: () => Date;

  constructor(options: ICEDosOptions = {}) {
    this.now = options.now || (() => new Date());
    this.root = this.__createSeed();
  }

  // ------------------------------------------------------------------ 查询
  public getCwd(): string {
    return this.cwd.length ? `C:\\${this.cwd.join('\\')}` : 'C:\\';
  }

  public getPrompt(): string {
    return `${this.getCwd()}>`;
  }

  public getBanner(): string[] {
    return [
      'ICE-DOS Version 6.22  (ICE Edition)',
      'Copyright (C) 1981-2026 ICE Web Components',
      '',
      '输入 HELP 看命令列表，TAB 补全，↑↓ 翻历史。',
    ];
  }

  public getHistory(): string[] {
    return this.history.slice();
  }

  // ------------------------------------------------------------------ 主入口
  /** 执行一行命令。永不抛：坏输入变成一行 error。 */
  public run(input: string): ICEDosResult {
    const raw = String(input === undefined || input === null ? '' : input);
    const trimmed = raw.trim();
    if (!trimmed) return { lines: [] };
    if (this.history[this.history.length - 1] !== trimmed) this.history.push(trimmed);
    this.historyIndex = this.history.length;

    // 重定向：echo hello > a.txt / >> a.txt（只在 echo 上支持，够用且不引入 shell 复杂度）
    const redirect = trimmed.match(/^(.*?)\s*(>>|>)\s*(\S+)\s*$/);
    if (redirect && /^echo\b/i.test(redirect[1])) {
      return this.__echo(redirect[1].replace(/^echo\b/i, '').trim(), redirect[3], redirect[2] === '>>');
    }

    const parts = trimmed.split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);
    try {
      switch (command) {
        case 'help':
        case '?':
          return this.__lines([...this.getBanner(), '', ...COMMANDS.map(([name, desc]) => `  ${name.padEnd(7)}${desc}`)]);
        case 'ver':
          return this.__lines(['ICE-DOS Version 6.22 (ICE Edition)']);
        case 'date':
          return this.__lines([`当前日期: ${this.__formatDate(this.now())}`]);
        case 'time':
          return this.__lines([`当前时间: ${this.__formatTime(this.now())}`]);
        case 'cls':
          return { lines: [], effect: { clear: true } };
        case 'exit':
          return { lines: [{ text: '再见！', type: 'output' }], effect: { exit: true } };
        case 'dir':
          return this.__dir(args[0]);
        case 'cd':
        case 'chdir':
          return this.__cd(args[0]);
        case 'md':
        case 'mkdir':
          return this.__mkdir(args[0]);
        case 'rd':
        case 'rmdir':
          return this.__rmdir(args[0]);
        case 'type':
          return this.__type(args[0]);
        case 'echo':
          return this.__echo(args.join(' '), null, false);
        case 'copy':
          return this.__copy(args[0], args[1]);
        case 'ren':
        case 'rename':
          return this.__rename(args[0], args[1]);
        case 'del':
        case 'erase':
          return this.__del(args[0]);
        case 'tree':
          return this.__tree(args[0]);
        case 'format':
          return this.__error('拒绝执行：这是演示机，格盘就没得玩了（真实 DOS 里 format 会抹掉整块盘）');
        default:
          return this.__error(`Bad command or file name: ${parts[0]}`);
      }
    } catch (error) {
      return this.__error(`命令执行失败: ${(error as Error).message}`);
    }
  }

  // ------------------------------------------------------------------ 历史 / 补全
  public historyPrev(): string {
    if (!this.history.length) return '';
    this.historyIndex = Math.max(0, this.historyIndex - 1);
    return this.history[this.historyIndex] || '';
  }

  public historyNext(): string {
    if (!this.history.length) return '';
    this.historyIndex = Math.min(this.history.length, this.historyIndex + 1);
    return this.history[this.historyIndex] || '';
  }

  /**
   * Tab 补全：命令名补到唯一前缀（带空格），路径按当前目录补（目录名不带空格，方便继续往下打）。
   * 没有匹配 / 多个匹配时原样返回（真 DOS 会再按一次列出候选，这里从简）。
   */
  public complete(input: string): string {
    const text = String(input === undefined || input === null ? '' : input);
    if (!text) return text;
    const parts = text.split(/\s+/);
    if (parts.length === 1) {
      const lower = parts[0].toLowerCase();
      const names = Array.from(new Set(COMMANDS.map(([name]) => name.toLowerCase())));
      const matches = names.filter((name) => name.startsWith(lower));
      if (matches.length === 1) return `${matches[0].toUpperCase()} `;
      return text;
    }
    const command = parts[0].toLowerCase();
    const fragment = parts[parts.length - 1];
    if (!['cd', 'dir', 'type', 'del', 'md', 'rd', 'tree', 'ren', 'copy'].includes(command)) return text;
    const resolved = this.__completePath(fragment);
    if (resolved === null) return text;
    const next = parts.slice(0, -1).concat(resolved).join(' ');
    return next;
  }

  // ------------------------------------------------------------------ 命令实现
  private __dir(arg?: string): ICEDosResult {
    const target = arg ? this.__resolve(arg) : this.__current();
    if (!target) return this.__error('File not found');
    if (target.type === 'file') return this.__lines([this.__fileRow(target)]);
    const entries = this.__sortedChildren(target);
    const lines: string[] = [` ${this.__volumeLabel()}`, ''];
    entries.forEach((node) => lines.push(` ${node.name.padEnd(16)}${node.type === 'dir' ? '<DIR>        ' : `${this.__fileSize(node)}  `}${node.type === 'dir' ? '  ' : '  '}${this.__nodeDate(node)}`));
    const files = entries.filter((node) => node.type === 'file');
    const dirs = entries.filter((node) => node.type === 'dir');
    const bytes = files.reduce((sum, file) => sum + (file.type === 'file' ? file.content.length : 0), 0);
    lines.push(
      '',
      `       ${files.length} 个文件  ${bytes.toLocaleString('en-US')} 字节`,
      `       ${dirs.length} 个目录   1,048,576 字节可用`,
    );
    return this.__lines(lines);
  }

  private __cd(arg?: string): ICEDosResult {
    if (!arg || arg === '.') return { lines: [] };
    if (arg === '..') {
      this.cwd.pop();
      return { lines: [] };
    }
    const target = this.__resolve(arg);
    if (!target) return this.__error('Invalid directory');
    if (target.type !== 'dir') return this.__error('Invalid directory');
    this.cwd = this.__pathOf(target);
    return { lines: [] };
  }

  private __mkdir(arg?: string): ICEDosResult {
    if (!arg) return this.__error('必需参数缺失');
    const parent = this.__resolveParent(arg);
    if (!parent) return this.__error('Invalid path');
    const name = this.__baseName(arg);
    if (!name) return this.__error('Invalid path');
    if (parent.children.has(name.toLowerCase())) return this.__error('Duplicate directory name');
    parent.children.set(name.toLowerCase(), { type: 'dir', name: name.toUpperCase(), children: new Map() });
    return { lines: [] };
  }

  private __rmdir(arg?: string): ICEDosResult {
    if (!arg) return this.__error('必需参数缺失');
    const target = this.__resolve(arg);
    if (!target) return this.__error('File not found');
    if (target.type !== 'dir') return this.__error('Not a directory');
    if (target.children.size) return this.__error('Directory not empty');
    if (!this.__removeChild(arg)) return this.__error('Invalid path');
    return { lines: [] };
  }

  private __type(arg?: string): ICEDosResult {
    if (!arg) return this.__error('必需参数缺失');
    const target = this.__resolve(arg);
    if (!target) return this.__error('File not found');
    if (target.type !== 'file') return this.__error('Access denied');
    return this.__lines(target.content.split('\n'));
  }

  private __echo(text: string, target: string | null, append: boolean): ICEDosResult {
    if (!target) return this.__lines([text]);
    const existing = this.__resolve(target);
    if (existing && existing.type === 'dir') return this.__error('Access denied');
    if (existing) {
      if (existing.type === 'file') existing.content = append ? `${existing.content}\n${text}` : text;
      return { lines: [] };
    }
    const parent = this.__resolveParent(target);
    if (!parent) return this.__error('Invalid path');
    const name = this.__baseName(target);
    if (!name) return this.__error('Invalid path');
    parent.children.set(name.toLowerCase(), {
      type: 'file',
      name: name.toUpperCase(),
      content: text,
      date: this.__formatDate(this.now()),
    });
    return { lines: [] };
  }

  private __copy(from?: string, to?: string): ICEDosResult {
    if (!from || !to) return this.__error('必需参数缺失');
    const source = this.__resolve(from);
    if (!source) return this.__error('File not found');
    if (source.type !== 'file') return this.__error('Access denied');
    const parent = this.__resolveParent(to);
    if (!parent) return this.__error('Invalid path');
    const name = this.__baseName(to);
    if (!name) return this.__error('Invalid path');
    parent.children.set(name.toLowerCase(), { ...source, name: name.toUpperCase(), date: this.__formatDate(this.now()) });
    return this.__lines(['        1 个文件已复制']);
  }

  private __rename(from?: string, to?: string): ICEDosResult {
    if (!from || !to) return this.__error('必需参数缺失');
    const source = this.__resolve(from);
    if (!source) return this.__error('File not found');
    if (to.includes('\\') || to.includes('/')) return this.__error('只支持同目录改名');
    const parent = this.__parentOf(source);
    if (!parent) return this.__error('Invalid path');
    const name = this.__baseName(to);
    if (!name) return this.__error('Invalid path');
    parent.children.delete(source.name.toLowerCase());
    source.name = name.toUpperCase();
    parent.children.set(name.toLowerCase(), source);
    return { lines: [] };
  }

  private __del(arg?: string): ICEDosResult {
    if (!arg) return this.__error('必需参数缺失');
    if (arg === '\\' || arg === '/' || /^c:$/i.test(arg)) return this.__error('Access denied');
    const target = this.__resolve(arg);
    if (!target) return this.__error('File not found');
    if (target.type !== 'file') return this.__error('Access denied');
    if (!this.__removeChild(arg)) return this.__error('Invalid path');
    return { lines: [] };
  }

  private __tree(arg?: string): ICEDosResult {
    const start = arg ? this.__resolve(arg) : this.__current();
    if (!start) return this.__error('Invalid path');
    if (start.type !== 'dir') return this.__error('Not a directory');
    const lines: string[] = [`${this.__pathOf(start).join('\\') || 'C:'}`];
    const walk = (dir: ICEDosDir, prefix: string) => {
      const children = this.__sortedChildren(dir);
      children.forEach((node, index) => {
        const last = index === children.length - 1;
        lines.push(`${prefix}${last ? '└── ' : '├── '}${node.name}`);
        if (node.type === 'dir') walk(node, `${prefix}${last ? '    ' : '│   '}`);
      });
    };
    walk(start, '');
    return this.__lines(lines);
  }

  // ------------------------------------------------------------------ 路径
  private __current(): ICEDosDir {
    let node: ICEDosDir = this.root;
    this.cwd.forEach((name) => {
      const next = node.children.get(name.toLowerCase());
      if (next && next.type === 'dir') node = next;
    });
    return node;
  }

  private __resolve(path: string): ICEDosNode | null {
    const segments = this.__segments(path);
    let node: ICEDosNode = this.root;
    for (const segment of segments) {
      if (node.type !== 'dir') return null;
      const next = node.children.get(segment.toLowerCase());
      if (!next) return null;
      node = next;
    }
    return node;
  }

  private __resolveParent(path: string): ICEDosDir | null {
    const segments = this.__segments(path);
    segments.pop();
    let node: ICEDosNode = this.root;
    for (const segment of segments) {
      if (node.type !== 'dir') return null;
      const next = node.children.get(segment.toLowerCase());
      if (!next) return null;
      node = next;
    }
    return node.type === 'dir' ? node : null;
  }

  private __parentOf(target: ICEDosNode): ICEDosDir | null {
    const path = this.__pathOf(target);
    path.pop();
    let node: ICEDosNode = this.root;
    for (const segment of path) {
      if (node.type !== 'dir') return null;
      const next = node.children.get(segment.toLowerCase());
      if (!next) return null;
      node = next;
    }
    return node.type === 'dir' ? node : null;
  }

  /** 目标节点在树里的路径（从根目录起算，不含 C:）。 */
  private __pathOf(target: ICEDosNode): string[] {
    const walk = (dir: ICEDosDir, trail: string[]): string[] | null => {
      if (dir === target) return trail;
      for (const child of dir.children.values()) {
        if (child === target) return [...trail, child.name];
        if (child.type === 'dir') {
          const found = walk(child, [...trail, child.name]);
          if (found) return found;
        }
      }
      return null;
    };
    return walk(this.root, []) || [];
  }

  /** 相对路径 → 分段（处理 `.` / `..` / 绝对路径）。 */
  private __segments(path: string): string[] {
    const text = String(path || '').trim();
    const absolute = /^[\\/]/.test(text) || /^c:[\\/]?/i.test(text);
    const cleaned = text.replace(/^c:/i, '');
    const parts = cleaned.split(/[\\/]+/).filter((part) => part && part !== '.');
    const segments: string[] = absolute ? [] : this.cwd.slice();
    parts.forEach((part) => {
      if (part === '..') segments.pop();
      else segments.push(part);
    });
    return segments;
  }

  private __baseName(path: string): string {
    const segments = this.__segments(path);
    return segments.length ? segments[segments.length - 1] : '';
  }

  private __removeChild(path: string): boolean {
    const parent = this.__resolveParent(path);
    if (!parent) return false;
    const name = this.__baseName(path);
    return parent.children.delete(name.toLowerCase());
  }

  private __completePath(fragment: string): string | null {
    /**
     * 把「目录部分」和「名字部分」拆开补：
     * 目录部分保留**原样**（`..\` / `\GAMES\` / 空=当前目录），名字部分在当前目录或指定目录里补 ——
     * 这样 `..\REA` 补出来是 `..\README.TXT`（而不是丢掉前缀的 `README.TXT`：那在子目录里根本不存在）。
     */
    const lastSeparator = Math.max(fragment.lastIndexOf('\\'), fragment.lastIndexOf('/'));
    const dirPart = lastSeparator === -1 ? '' : fragment.slice(0, lastSeparator + 1);
    const namePart = lastSeparator === -1 ? fragment : fragment.slice(lastSeparator + 1);
    const dir = dirPart ? this.__resolve(dirPart) : this.__current();
    if (!dir || dir.type !== 'dir') return null;
    const matches = Array.from(dir.children.values()).filter((child) => child.name.toLowerCase().startsWith(namePart.toLowerCase()));
    if (matches.length !== 1) return null;
    return `${dirPart}${matches[0].name}`;
  }

  // ------------------------------------------------------------------ 小工具
  private __sortedChildren(dir: ICEDosDir): ICEDosNode[] {
    return Array.from(dir.children.values()).sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }

  private __fileSize(file: ICEDosFile): string {
    return String(file.content.length).padStart(9, ' ');
  }

  private __fileRow(file: ICEDosFile): string {
    return ` ${file.name.padEnd(16)}${this.__fileSize(file)}  ${file.date}`;
  }

  private __nodeDate(node: ICEDosNode): string {
    return node.type === 'file' ? node.date : '  <DIR>     ';
  }

  private __volumeLabel(): string {
    return `C 盘（ICE-DOS 演示盘）卷标是 ICE-DOS`;
  }

  private __formatDate(date: Date): string {
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  private __formatTime(date: Date): string {
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }

  private __lines(lines: string[]): ICEDosResult {
    return { lines: lines.map((text) => ({ text, type: 'output' as const })) };
  }

  private __error(text: string): ICEDosResult {
    return { lines: [{ text, type: 'error' }] };
  }

  /** 出厂文件系统：一个像样的小 DOS 盘（命令都能玩起来）。 */
  private __createSeed(): ICEDosDir {
    const file = (name: string, content: string, date = '2026-09-13'): ICEDosFile => ({ type: 'file', name, content, date });
    const dir = (name: string, children: ICEDosNode[] = []): ICEDosDir => ({
      type: 'dir',
      name,
      children: new Map(children.map((child) => [child.name.toLowerCase(), child])),
    });
    return dir('C:', [
      file('AUTOEXEC.BAT', '@ECHO OFF\nPROMPT $P$G\nPATH C:\\DOS;C:\\GAMES\nSET BLASTER=A220 I5 D1\nECHO 欢迎回到 1995。'),
      file('CONFIG.SYS', 'DEVICE=C:\\DOS\\HIMEM.SYS\nDOS=HIGH,UMB\nFILES=40\nBUFFERS=20'),
      file('README.TXT', 'ICE-DOS 演示盘\n------------\n这是一个纯逻辑的 DOS 终端模型：文件系统、命令解析、路径、历史、Tab 补全。\n试试 DIR / CD GAMES / TYPE README.TXT / TREE，还有 FORMAT C:（它会拒绝你）。'),
      dir('DOS', [
        file('COMMAND.COM', '(二进制)'),
        file('EDIT.COM', '(二进制)'),
        file('HIMEM.SYS', '(驱动程序)'),
      ]),
      dir('GAMES', [
        file('TETRIS.EXE', '(二进制)'),
        file('SNAKE.EXE', '(二进制)'),
        file('2048.EXE', '(二进制)'),
        dir('CHIP8', [file('DEMO.ROM', '(ROM 二进制)')]),
      ]),
      dir('ART', [file('SMILEY.SVG', '<svg viewBox="0 0 8 8"><rect width="8" height="8" fill="#fff"/></svg>')]),
    ]);
  }
}

export default ICEDosModel;
