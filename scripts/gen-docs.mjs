/**
 * 从源码生成 API 参考（docs/api/*.md）。
 *
 * 为什么要生成而不是手写：73 个导出 + 各自的 Options 接口与公開方法，手抄必然漂移。
 * 这里用 TypeScript 编译器 API 解析 `src/**`，抽出
 *   - 组件的类注释（一句话 + 要点）
 *   - `ICEXxxOptions` 的每个字段（名称 / 类型 / 注释）
 *   - public 方法（签名 + 注释）
 * 再按分组写成 markdown。字段没写注释时只输出类型（类型本身通常已足够自解释）。
 *
 * 用法：`npm run docs:api`（也会在 `npm run docs` 里被调用）
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'docs', 'api');

/** 分组：顺序即文档顺序。每个组件都必须出现在这里，否则脚本报错。 */
const GROUPS = [
  {
    file: 'basic',
    title: '基础组件',
    intro: '所有组件的最小构件：面板、按钮、文本、图标与分隔线。',
    entries: [
      'ICEWidget',
      'ICEContainer',
      'ICEPanel',
      'ICESpace',
      'ICEGrid',
      'ICEGridCol',
      'ICEButton',
      'ICELabel',
      'ICETypography',
      'ICEIcon',
      'ICESvgIcon',
      'ICEIconTile',
      'ICESeparator',
    ],
  },
  {
    file: 'data-entry',
    title: '数据录入',
    intro: '表单控件。统一遵循「`getFormValue` / `setFormValue` + `change` 事件」约定，可直接接入 `ICEForm`。',
    entries: [
      'ICETextField',
      'ICETextArea',
      'ICEPasswordField',
      'ICEInputNumber',
      'ICECheckBox',
      'ICERadioButton',
      'ICERadioGroup',
      'ICECheckboxGroup',
      'ICESwitch',
      'ICESlider',
      'ICESegmented',
      'ICERate',
      'ICEUpload',
      'ICEFormItem',
      'ICEForm',
    ],
  },
  {
    file: 'data-entry-popups',
    title: '数据录入（浮层类）',
    intro: '字段 + 浮层的组合。浮层统一走 `ICEOverlayManager`：工具层渲染、点外/Esc 关闭、空间不足自动翻转并夹进可见区。',
    entries: ['ICESelect', 'ICEAutoComplete', 'ICECascader', 'ICETreeSelect', 'ICEDatePicker', 'ICETimePicker', 'ICEColorPicker', 'ICETransfer'],
  },
  {
    file: 'data-display',
    title: '数据展示',
    intro: '把数据画出来：表格、列表、树、卡片、统计卡、进度、时间轴、标签等。',
    entries: [
      'ICETable',
      'ICEList',
      'ICETree',
      'ICECard',
      'ICEStatCard',
      'ICEStatistic',
      'ICEDescriptions',
      'ICETimeline',
      'ICEProgressBar',
      'ICEImageView',
      'ICEImagePreview',
      'ICECalendar',
      'ICEAvatar',
      'ICEAvatarGroup',
      'ICETag',
      'ICEBadge',
      'ICECarousel',
      'ICECollapse',
      'ICEComment',
      'ICEWatermark',
    ],
  },
  {
    file: 'feedback',
    title: '反馈与状态',
    intro: '提示、确认、弹出层与占位状态。',
    entries: [
      'ICEAlert',
      'ICEModal',
      'ICEDrawer',
      'ICEMessage',
      'ICENotification',
      'ICETooltip',
      'ICEPopover',
      'ICEPopconfirm',
      'ICEResult',
      'ICEEmpty',
      'ICESkeleton',
      'ICESpin',
      'ICESteps',
      'ICETour',
      'ICEFloatButton',
    ],
  },
  {
    file: 'navigation',
    title: '导航',
    intro: '菜单、面包屑、锚点导航、回到顶部、下拉触发、分页与标签页。',
    entries: ['ICEMenu', 'ICEBreadcrumb', 'ICEAnchor', 'ICEBackTop', 'ICEDropdown', 'ICEPagination', 'ICETabs'],
  },
  {
    file: 'core',
    title: '核心与布局',
    intro: '不直接出现在业务页面里，但决定一切的东西：组件基类、滚动视口、浮层/焦点/消息管理器，以及布局与动画工具。',
    entries: [
      'ICEScrollPane',
      'ICESplitter',
      'ICEWindow',
      'ICEOverlayManager',
      'ICEFocusManager',
      'ICEHoverManager',
      'ICEMessageManager',
      'ICEManager',
    ],
  },
  {
    file: 'helpers',
    title: '工具函数',
    intro: '挂载浮层、开弹窗/抽屉、做过渡动画的便捷入口。',
    entries: [
      'attachTooltip',
      'attachPopover',
      'attachPopconfirm',
      'attachDropdown',
      'openModal',
      'openDrawer',
      'getICEOverlayManager',
      'getICEFocusManager',
      'getICEMessageManager',
      'getICEWorldBox',
      'tween',
      'fadeIn',
      'fadeOut',
      'fadeTo',
      'slideIn',
      'scaleIn',
      'estimateTextWidth',
      'formatStatisticValue',
      'formatCountdown',
      'truncateTextLines',
      'openImagePreview',
      'formatCalendarDate',
      'buildMonthGrid',
      'tooltipPanelWidth',
      'readHovered',
      'createTextNode',
      'centerTextNode',
      'getStatusColors',
      'resolveICEEasing',
      'easeInQuad',
      'easeOutCubic',
      'easeInOutCubic',
      'resolveICEOverlayPosition',
      'isPointInsideICEBox',
      'iceUIManager',
      'ICE_LIGHT_THEME',
      'ICE_DARK_THEME',
    ],
  },
  {
    file: 'models',
    title: '模型',
    intro: '纯逻辑、不碰 canvas：状态与校验规则集中在这里，组件只负责「画出来」。',
    entries: [
      'ICEButtonModel',
      'ICEToggleModel',
      'ICEBoundedRangeModel',
      'ICESelectionModel',
      'ICEFormModel',
      'ICEMinesweeperModel',
      'ICE_MINESWEEPER_DIFFICULTIES',
    ],
  },
];

/** 收集所有要解析的源文件（组件 + core + model + util）。 */
function collectSources(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectSources(full, out);
    } else if (entry.name.endsWith('.ts')) {
      out.push(full);
    }
  }
  return out;
}

/** 取节点上方的 JSDoc 注释正文（去掉星号与首尾空行）。 */
function leadingDoc(sourceFile, node) {
  const ranges = ts.getLeadingCommentRanges(sourceFile.text, node.getFullStart()) || [];
  const block = [...ranges].reverse().find((r) => sourceFile.text.startsWith('/**', r.pos));
  if (!block) {
    return '';
  }
  return sourceFile.text
    .slice(block.pos, block.end)
    .replace(/^\/\*\*|\*\/$/g, '')
    .split('\n')
    .map((line) => line.replace(/^\s*\* ?/, '').replace(/\s+$/, ''))
    .join('\n')
    .trim();
}

/** JSDoc 的第一段作为一句话摘要，其余作为要点列表。 */
function splitDoc(doc) {
  if (!doc) {
    return { summary: '', bullets: [] };
  }
  const lines = doc.split('\n');
  const summary = [];
  let index = 0;
  while (index < lines.length && !lines[index].trim().startsWith('-')) {
    summary.push(lines[index]);
    index += 1;
  }
  const bullets = [];
  for (const line of lines.slice(index)) {
    const match = /^\s*-\s*(.*)$/.exec(line);
    if (match) {
      bullets.push(match[1]);
    } else if (line.trim() && bullets.length) {
      bullets[bullets.length - 1] += ' ' + line.trim();
    }
  }
  return { summary: summary.join(' ').trim(), bullets };
}

function typeText(node, sourceFile) {
  return node.type ? node.type.getText(sourceFile).replace(/\s+/g, ' ') : '';
}

function paramsText(member, sourceFile) {
  return member.parameters
    .map((param) => {
      const name = param.name.getText(sourceFile);
      const optional = param.questionToken ? '?' : '';
      const type = typeText(param, sourceFile);
      return `${name}${optional}${type ? ': ' + type : ''}`;
    })
    .join(', ');
}

/** 解析单个文件，抽出类 / interface 两棵树。 */
function parseFile(file) {
  const text = fs.readFileSync(file, 'utf8');
  const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  // 有些文件的组件说明写在文件开头（紧跟第一个 `export interface`），类主体在其下方，
  // 此时类上方取不到注释 —— 就找「后面紧跟着 export interface/type 的那个 JSDoc 块」兜底。
  // 注意不能用「文件第一个 JSDoc 块」：那可能是某个字段的注释。
  const fileDoc = (() => {
    const blocks = text.match(/\/\*\*[\s\S]*?\*\//g) || [];
    for (const block of blocks) {
      const after = text.slice(text.indexOf(block) + block.length);
      if (/^\s*export (interface|type)\b/.test(after)) {
        return block
          .replace(/^\/\*\*|\*\/$/g, '')
          .split('\n')
          .map((l) => l.replace(/^\s*\* ?/, '').replace(/\s+$/, ''))
          .join('\n')
          .trim();
      }
    }
    return '';
  })();
  const SKIP_METHODS = new Set(['afterAddHandler', 'doRender', 'render', 'revalidate', 'then']);
  const isInternal = (name) => name.startsWith('__') || SKIP_METHODS.has(name);
  const classes = new Map();
  const interfaces = new Map();
  const functions = new Map();
  const consts = new Map();
  const exported = (node) =>
    !!node.modifiers && node.modifiers.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
  sourceFile.forEachChild((node) => {
    if (ts.isFunctionDeclaration(node) && node.name && exported(node)) {
      functions.set(node.name.text, {
        name: node.name.text,
        signature: `${node.name.text}(${paramsText(node, sourceFile)})`,
        returns: typeText(node, sourceFile),
        doc: leadingDoc(sourceFile, node).split('\n')[0] || '',
      });
      return;
    }
    if (ts.isVariableStatement(node) && exported(node)) {
      node.declarationList.declarations.forEach((decl) => {
        if (!ts.isIdentifier(decl.name)) {
          return;
        }
        const members = [];
        if (decl.initializer && ts.isObjectLiteralExpression(decl.initializer)) {
          decl.initializer.properties.forEach((prop) => {
            if (ts.isMethodDeclaration(prop) && prop.name && !isInternal(prop.name.getText(sourceFile))) {
              members.push({
                name: prop.name.getText(sourceFile),
                signature: `${prop.name.getText(sourceFile)}(${paramsText(prop, sourceFile)})`,
                returns: typeText(prop, sourceFile),
                doc: leadingDoc(sourceFile, prop).split('\n')[0] || '',
              });
            }
          });
        }
        consts.set(decl.name.text, {
          name: decl.name.text,
          doc: leadingDoc(sourceFile, node),
          members,
          file,
        });
      });
      return;
    }
    if (ts.isClassDeclaration(node) && node.name && exported(node)) {
      const name = node.name.text;
      const methods = [];
      node.members.forEach((member) => {
        if (!ts.isMethodDeclaration(member) || !member.name) {
          return;
        }
        const isPrivate = member.modifiers && member.modifiers.some((m) => m.kind === ts.SyntaxKind.PrivateKeyword);
        const isStatic = member.modifiers && member.modifiers.some((m) => m.kind === ts.SyntaxKind.StaticKeyword);
        if (isPrivate || isStatic || isInternal(member.name.getText(sourceFile))) {
          return;
        }
        methods.push({
          name: member.name.getText(sourceFile),
          signature: `${member.name.getText(sourceFile)}(${paramsText(member, sourceFile)})`,
          returns: typeText(member, sourceFile),
          doc: leadingDoc(sourceFile, member).split('\n')[0] || '',
        });
      });
      classes.set(name, { name, doc: leadingDoc(sourceFile, node) || fileDoc, methods, file });
    } else if (ts.isInterfaceDeclaration(node) && node.name) {
      const name = node.name.text;
      const props = [];
      node.members.forEach((member) => {
        if (!ts.isPropertySignature(member) || !member.name) {
          return;
        }
        props.push({
          name: member.name.getText(sourceFile),
          optional: !!member.questionToken,
          type: typeText(member, sourceFile),
          doc: leadingDoc(sourceFile, member).split('\n')[0] || '',
        });
      });
      interfaces.set(name, { name, doc: leadingDoc(sourceFile, node), props });
    }
  });
  return { classes, interfaces, functions, consts };
}

/* ---------- 汇总 ---------- */
const sources = collectSources(SRC);
const classes = new Map();
const interfaces = new Map();
const functions = new Map();
const consts = new Map();
for (const file of sources) {
  const parsed = parseFile(file);
  parsed.classes.forEach((value, key) => classes.set(key, value));
  parsed.interfaces.forEach((value, key) => interfaces.set(key, value));
  parsed.functions.forEach((value, key) => functions.set(key, value));
  parsed.consts.forEach((value, key) => consts.set(key, value));
}

/**
 * 常见字段的兜底说明：源码里没写 JSDoc 时用它填表，避免出现大片空单元格。
 * 只覆盖「名字即语义」的通用字段；组件特有的字段还是应该在源码里写注释。
 */
const COMMON_PROP_DOCS = {
  id: '组件 id（引擎用它做唯一标识；e2e/调试时可按 id 定位）',
  left: '相对父容器的左边距',
  top: '相对父容器的上边距',
  width: '宽度（不传用组件默认值）',
  height: '高度（不传用组件默认值）',
  left2: '',
  disabled: '是否禁用（禁用后不响应交互、不可聚焦）',
  focusable: '是否参与 Tab 焦点轮转',
  onChange: '值变化回调',
  onSelect: '选中回调',
  onClose: '关闭回调',
  onAction: '操作按钮回调',
  onClick: '点击回调',
  value: '当前值',
  options: '候选项',
  items: '数据项',
  nodes: '树节点',
  dataSource: '数据源',
  columns: '列定义',
  placeholder: '占位文案',
  manager: '浮层管理器（一般不用传，组件会取共享实例）',
  style: '覆盖样式（fillStyle / strokeStyle / lineWidth / shadow …）',
  radius: '圆角半径',
  interactive: '是否参与命中检测',
  color: '颜色',
  status: '状态色：default / primary / success / warning / error / info',
  variant: '外观变体',
  text: '文案',
  title: '标题',
  content: '内容（纯文本，或返回组件的工厂函数）',
  size: '尺寸',
  rows: '行数',
  count: '数量',
  tip: '提示文案',
  open: '是否展开 / 打开',
};

const documented = new Set(GROUPS.flatMap((group) => group.entries));
// 类必须全部有文档；工具函数/常量允许有内部实现细节没列进分组表，只提示
const known = new Set([...classes.keys(), ...functions.keys(), ...consts.keys()]);
const missingClasses = [...classes.keys()].filter((name) => !documented.has(name));
const missingHelpers = [...functions.keys(), ...consts.keys()].filter((name) => !documented.has(name));
const unknown = [...documented].filter((name) => !known.has(name));
if (missingClasses.length || unknown.length) {
  console.error('docs: 分组表与源码不一致');
  if (missingClasses.length) console.error('  组件类未收录：', missingClasses.join(', '));
  if (unknown.length) console.error('  分组表有、源码缺：', unknown.join(', '));
  process.exit(1);
}
if (missingHelpers.length) {
  console.log(`docs: ${missingHelpers.length} 个工具函数/常量未收录（内部实现细节，按需补）：${missingHelpers.join(', ')}`);
}

fs.mkdirSync(OUT, { recursive: true });

const index = [
  '# API 参考',
  '',
  '> 本目录由 `npm run docs:api` 从源码生成（解析 `src/**` 的类注释、`ICEXxxOptions` 字段与 public 方法），',
  '> 请勿手改；要改说明就改源码里的 JSDoc。',
  '',
  '所有组件都导出为 `ICE` 前缀的类，包内运行时导出与 `ice-render` 零重叠（有回归测试守着）。',
  '',
];

for (const group of GROUPS) {
  const lines = [`# ${group.title}`, '', group.intro, ''];
  for (const name of group.entries) {
    // 工具函数 / 常量：单独一小节
    const fn = functions.get(name);
    if (fn) {
      lines.push(`### \`${name}\` — 函数`);
      lines.push('');
      if (fn.doc) {
        lines.push(fn.doc);
        lines.push('');
      }
      lines.push('```ts');
      lines.push(`${fn.signature}${fn.returns ? ': ' + fn.returns : ''}`);
      lines.push('```');
      lines.push('');
      continue;
    }
    const constant = consts.get(name);
    if (constant) {
      const { summary: cSummary } = splitDoc(constant.doc);
      lines.push(`### \`${name}\` — 常量`);
      lines.push('');
      if (cSummary) {
        lines.push(cSummary);
        lines.push('');
      }
      if (constant.members.length) {
        lines.push('| 成员 | 返回 | 说明 |');
        lines.push('|---|---|---|');
        constant.members.forEach((member) => {
          const returns = member.returns ? '`' + member.returns.replace(/\|/g, '\\|') + '`' : '';
          lines.push(`| \`${member.signature}\` | ${returns} | ${member.doc} |`);
        });
        lines.push('');
      }
      lines.push(`源码：\`${path.relative(ROOT, constant.file)}\``);
      lines.push('');
      continue;
    }
    const cls = classes.get(name);
    const optionsName = name + 'Options';
    const options = interfaces.get(optionsName);
    const { summary, bullets } = splitDoc(cls.doc);
    lines.push(`## \`${name}\``);
    lines.push('');
    if (summary) {
      lines.push(summary);
      lines.push('');
    }
    if (bullets.length) {
      bullets.forEach((bullet) => lines.push(`- ${bullet}`));
      lines.push('');
    }
    lines.push(
      `源码：[\`${path.relative(ROOT, cls.file)}\`](../../${path.relative(ROOT, cls.file)})`,
    );
    lines.push('');
    if (options && options.props.length) {
      const optsDoc = splitDoc(options.doc).summary;
      lines.push(`**构造参数** \`${optionsName}\`${optsDoc ? ' — ' + optsDoc : ''}`);
      lines.push('');
      lines.push('| 参数 | 类型 | 说明 |');
      lines.push('|---|---|---|');
      options.props.forEach((prop) => {
        const type = '`' + (prop.type || 'any').replace(/\|/g, '\\|') + '`';
        const doc = prop.doc || COMMON_PROP_DOCS[prop.name] || '';
        lines.push(`| \`${prop.name}${prop.optional ? '?' : ''}\` | ${type} | ${doc} |`);
      });
      lines.push('');
    }
    const methods = cls.methods.filter((method) => method.name !== 'constructor');
    if (methods.length) {
      lines.push('**方法**');
      lines.push('');
      lines.push('| 方法 | 返回 | 说明 |');
      lines.push('|---|---|---|');
      methods.forEach((method) => {
        const returns = method.returns ? '`' + method.returns.replace(/\|/g, '\\|') + '`' : '';
        const signature = method.signature.replace(/\|/g, '\\|');
        lines.push(`| \`${signature}\` | ${returns} | ${method.doc} |`);
      });
      lines.push('');
    }
  }
  fs.writeFileSync(path.join(OUT, group.file + '.md'), lines.join('\n'), 'utf8');
  index.push(`- [${group.title}](./${group.file}.md) — ${group.entries.map((n) => '`' + n + '`').join(' ')}`);
}

fs.writeFileSync(path.join(OUT, 'README.md'), index.join('\n') + '\n', 'utf8');

/* ---------- 组件总览（用于 README / docs 导航） ---------- */
const overview = [
  '# 组件速查',
  '',
  '> 由 `npm run docs:api` 从源码生成。点组件名进入对应 API 页；每条的说明取自源码里的类注释首句。',
  '',
  '| 分组 | 组件 | 说明 |',
  '|---|---|---|',
];
for (const group of GROUPS) {
  if (group.file === 'helpers' || group.file === 'models') continue;
  group.entries.forEach((name, index) => {
    const cls = classes.get(name);
    if (!cls) return;
    const { summary } = splitDoc(cls.doc);
    const groupCell = index === 0 ? `[${group.title}](./api/${group.file}.md)` : '';
    overview.push(`| ${groupCell} | [\`${name}\`](./api/${group.file}.md#${name.toLowerCase()}) | ${summary} |`);
  });
}
overview.push('');
overview.push('模型与工具函数见 [API 参考](./api/README.md)。');
fs.writeFileSync(path.join(ROOT, 'docs', 'components.md'), overview.join('\n') + '\n', 'utf8');

const counts = GROUPS.map((g) => `${g.file}: ${g.entries.length}`).join(', ');
console.log(`docs:api 已生成 ${GROUPS.length} 个页面（${counts}）→ docs/api/`);
