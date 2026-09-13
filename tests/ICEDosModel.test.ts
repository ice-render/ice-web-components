/**
 * DOS 终端的纯逻辑规格（虚拟文件系统 + 命令解释器，不碰 DOM）。
 *
 * 页面只做三件事：把 `run()` 返回的行画成文字、把键盘输入交给模型、按 `effect` 做副作用
 * （`cls` 清屏 / `exit` 退出）。所以「命令怎么解析、路径怎么算、文件怎么改」全都能在 node 里断言。
 *
 * 约定：
 * - 路径分隔符 `\` 和 `/` 等价；支持绝对（`\GAMES`）、相对（`GAMES`）、`.`、`..`；
 * - 命令大小写不敏感（`DIR` = `dir`），参数里的文件名也大小写不敏感；
 * - 输出行分两类：`output`（普通）与 `error`（Bad command / 找不到文件…），页面按类型上色；
 * - `run()` 不抛：任何坏输入都变成一行 error，终端不会因为打错字崩掉；
 * - 历史与 Tab 补全是模型的一部分（真终端也有），页面只管按键。
 */
import { ICEDosModel } from '../src/model/ICEDosModel';

const makeDos = () => new ICEDosModel();
const textOf = (result: { lines: Array<{ text: string }> }) => result.lines.map((line) => line.text).join('\n');

describe('开机与提示符', () => {
  it('初始状态：C 盘根目录、有开机横幅、提示符是 C:\\>', () => {
    const dos = makeDos();
    expect(dos.getCwd()).toBe('C:\\');
    expect(dos.getPrompt()).toBe('C:\\>');
    expect(dos.getBanner().length).toBeGreaterThan(2);
    expect(dos.getBanner().join('\n')).toContain('ICE-DOS');
  });

  it('dir：列出目录与文件（大小 / 日期），并给出文件数汇总', () => {
    const dos = makeDos();
    const out = textOf(dos.run('dir'));
    expect(out).toContain('AUTOEXEC.BAT');
    expect(out).toContain('<DIR>');
    expect(out).toContain('DOS');
    expect(out).toMatch(/个文件/);
  });

  it('dir 指定路径：dir \\GAMES 列出子目录内容', () => {
    const dos = makeDos();
    const out = textOf(dos.run('dir \\GAMES'));
    expect(out).toContain('TETRIS.EXE');
    expect(out).toContain('CHIP8');
    expect(out).not.toContain('COMMAND.COM');
  });
});

describe('目录导航', () => {
  it('cd 进出目录、cd .. 回上级、cd \\ 回根、cd . 原地', () => {
    const dos = makeDos();
    expect(dos.run('cd GAMES').lines.some((line) => line.type === 'error')).toBe(false);
    expect(dos.getCwd()).toBe('C:\\GAMES');
    expect(dos.getPrompt()).toBe('C:\\GAMES>');
    dos.run('cd CHIP8');
    expect(dos.getCwd()).toBe('C:\\GAMES\\CHIP8');
    dos.run('cd ..');
    expect(dos.getCwd()).toBe('C:\\GAMES');
    dos.run('cd ..\\..');
    expect(dos.getCwd()).toBe('C:\\');
    dos.run('cd GAMES');
    dos.run('cd .');
    expect(dos.getCwd()).toBe('C:\\GAMES');
    dos.run('cd \\');
    expect(dos.getCwd()).toBe('C:\\');
  });

  it('cd 到不存在的目录 / 到文件：报错且不改变当前目录', () => {
    const dos = makeDos();
    const missing = dos.run('cd NOPE');
    expect(missing.lines[0].type).toBe('error');
    expect(dos.getCwd()).toBe('C:\\');
    const notDir = dos.run('cd AUTOEXEC.BAT');
    expect(notDir.lines[0].type).toBe('error');
    expect(dos.getCwd()).toBe('C:\\');
  });
});

describe('看图与改文件', () => {
  it('type：打印文件内容；对目录或缺失文件报错', () => {
    const dos = makeDos();
    const out = textOf(dos.run('type README.TXT'));
    expect(out).toContain('ICE-DOS');
    expect(dos.run('type DOS').lines[0].type).toBe('error');
    expect(dos.run('type GHOST.TXT').lines[0].type).toBe('error');
  });

  it('echo > 新建 / >> 追加，内容能 type 回来', () => {
    const dos = makeDos();
    dos.run('echo hello > NOTE.TXT');
    expect(textOf(dos.run('type NOTE.TXT'))).toBe('hello');
    dos.run('echo world >> NOTE.TXT');
    expect(textOf(dos.run('type NOTE.TXT'))).toBe('hello\nworld');
    expect(dos.run('dir').lines.map((line) => line.text).join(' ')).toContain('NOTE.TXT');
  });

  it('md / rd：建目录、删空目录，删非空目录报错', () => {
    const dos = makeDos();
    expect(dos.run('md WORK').lines.some((line) => line.type === 'error')).toBe(false);
    dos.run('cd WORK');
    dos.run('echo temp > A.TXT');
    dos.run('cd ..');
    expect(dos.run('rd WORK').lines[0].type).toBe('error'); // 非空
    dos.run('del WORK\\A.TXT');
    expect(dos.run('rd WORK').lines.some((line) => line.type === 'error')).toBe(false);
  });

  it('copy / ren / del：复制、改名、删除，都能在 dir / type 里看到结果', () => {
    const dos = makeDos();
    expect(dos.run('copy README.TXT COPY.TXT').lines.some((line) => line.type === 'error')).toBe(false);
    expect(textOf(dos.run('type COPY.TXT'))).toContain('ICE-DOS');
    expect(dos.run('ren COPY.TXT MANUAL.TXT').lines.some((line) => line.type === 'error')).toBe(false);
    expect(dos.run('type COPY.TXT').lines[0].type).toBe('error');
    expect(dos.run('del MANUAL.TXT').lines.some((line) => line.type === 'error')).toBe(false);
    expect(dos.run('type MANUAL.TXT').lines[0].type).toBe('error');
  });

  it('tree：递归列出子目录（缩进体现层级）', () => {
    const dos = makeDos();
    const out = textOf(dos.run('tree'));
    expect(out).toContain('GAMES');
    expect(out).toContain('CHIP8');
    expect(out.indexOf('CHIP8')).toBeGreaterThan(out.indexOf('GAMES'));
  });

  it('受保护的目标不给删：根目录、不存在的文件都报错', () => {
    const dos = makeDos();
    expect(dos.run('del \\').lines[0].type).toBe('error');
    expect(dos.run('del GHOST.TXT').lines[0].type).toBe('error');
  });
});

describe('系统命令与副作用', () => {
  it('ver / date / time / help 都有输出，help 列出所有内置命令', () => {
    const dos = makeDos();
    expect(textOf(dos.run('ver'))).toContain('ICE-DOS');
    expect(textOf(dos.run('date'))).toMatch(/\d{4}/);
    expect(textOf(dos.run('time'))).toMatch(/\d{1,2}:\d{2}/);
    const help = textOf(dos.run('help'));
    ['dir', 'cd', 'type', 'echo', 'cls', 'tree', 'del'].forEach((cmd) => {
      // 帮助里命令名是大写（DOS 的老规矩），这里不区分大小写地找
      expect(help.toLowerCase()).toContain(cmd);
    });
  });

  it('cls / exit 返回副作用而不是文字（页面据此清屏 / 退出）', () => {
    const dos = makeDos();
    expect(dos.run('cls').effect).toEqual({ clear: true });
    expect(dos.run('exit').effect).toEqual({ exit: true });
  });

  it('未知命令 / 空输入：一行 error，且不抛', () => {
    const dos = makeDos();
    expect(textOf(dos.run('foobar'))).toContain('Bad command');
    expect(dos.run('').lines).toEqual([]);
    expect(dos.run('   ').lines).toEqual([]);
    expect(() => dos.run('del >')).not.toThrow();
  });

  it('命令大小写不敏感，参数里的文件名也是', () => {
    const dos = makeDos();
    expect(textOf(dos.run('DIR')).length).toBeGreaterThan(0);
    expect(textOf(dos.run('TyPe rEaDmE.tXt'))).toContain('ICE-DOS');
  });

  it('format 拒绝执行（演示机不能格盘），给一行 error', () => {
    const dos = makeDos();
    const out = dos.run('format c:');
    expect(out.lines[0].type).toBe('error');
    expect(out.lines[0].text).toContain('拒绝');
  });
});

describe('历史与补全', () => {
  it('历史记录：空命令不进历史，重复的相邻命令也只记一条，↑↓ 前后翻', () => {
    const dos = makeDos();
    dos.run('dir');
    dos.run('   ');
    dos.run('ver');
    dos.run('ver');
    expect(dos.getHistory()).toEqual(['dir', 'ver']);
    expect(dos.historyPrev()).toBe('ver');
    expect(dos.historyPrev()).toBe('dir');
    expect(dos.historyPrev()).toBe('dir'); // 到顶就停在最旧的
    expect(dos.historyNext()).toBe('ver');
    expect(dos.historyNext()).toBe('');
  });

  it('Tab 补全：命令名、文件名、目录名各自补到唯一前缀', () => {
    const dos = makeDos();
    expect(dos.complete('di')).toBe('DIR '); // 补全成大写 + 一个空格（DOS 的手感）
    expect(dos.complete('ty')).toBe('TYPE ');
    expect(dos.complete('type REA')).toBe('type README.TXT');
    expect(dos.complete('cd GAM')).toBe('cd GAMES');
    expect(dos.complete('cd \\GAMES\\CH')).toBe('cd \\GAMES\\CHIP8');
    expect(dos.complete('type ZZ')).toBe('type ZZ'); // 没匹配就不动
  });

  it('Tab 补全：补的是**当前目录**里的名字，不会把 cwd 前缀写进命令行', () => {
    const dos = makeDos();
    dos.run('cd GAMES');
    // C:\GAMES 里有 TETRIS.EXE；补全结果不该是 GAMES\TETRIS.EXE（那会被当成再进一层 GAMES）
    expect(dos.complete('type TET')).toBe('type TETRIS.EXE');
    // 根目录才有的文件，在子目录里补不出来
    expect(dos.complete('type READ')).toBe('type READ');
    // 带路径的补全仍然按相对路径来
    expect(dos.complete('type ..\\REA')).toBe('type ..\\README.TXT');
  });
});
