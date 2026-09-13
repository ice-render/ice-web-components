/**
 * 组件层 i18n 契约（见 ice-render `docs/architecture/17-i18n-boundary.md`）：
 *
 * - 内置文案**可配置**：`props.locale` 按实例指定语言；
 * - **不持全局状态**：两个实例可以各用各的语言，互不影响，也不要求改全局 `setICELocale()`；
 * - 未注册的语言 / 缺失的 key 逐级兜底（→ 默认语言 → key 本身），永远有东西可显示；
 * - 应用层的业务文案不走这套（组件只负责自己内置的那几条）。
 */
import {
  ICE_DEFAULT_LOCALE,
  getICELocale,
  registerICELocale,
  setICELocale,
  t,
  tFor,
} from '../src/i18n/ICEI18n';
import { ICEPagination } from '../src/components/ICEPagination';
import { ICEUpload } from '../src/components/ICEUpload';
import { ICECalendar } from '../src/components/ICECalendar';
import { ICEFormModel } from '../src/model/ICEFormModel';

/** 收集一棵子树里所有 ICELabel 的文本（组件内置文案都渲染成 ICELabel）。 */
function labelTexts(node: any, out: string[] = []): string[] {
  if (node && typeof node.getText === 'function') out.push(node.getText());
  (node && node.childNodes ? node.childNodes : []).forEach((child: any) => labelTexts(child, out));
  return out;
}

describe('tFor：按语言取翻译函数（不依赖全局状态）', () => {
  afterEach(() => {
    setICELocale(ICE_DEFAULT_LOCALE);
  });

  it('指定语言时用该语言；不指定则跟随当前语言', () => {
    expect(tFor('en-US')('table.empty')).toBe('No data');
    expect(tFor('zh-CN')('table.empty')).toBe('暂无数据');
    expect(tFor()('table.empty')).toBe('暂无数据');
    setICELocale('en-US');
    expect(tFor()('table.empty')).toBe('No data');
    // 关键：tFor('zh-CN') 不受全局语言影响
    expect(tFor('zh-CN')('table.empty')).toBe('暂无数据');
  });

  it('未注册的语言 → 当前语言；缺失的 key → 默认语言 → key 本身', () => {
    expect(tFor('xx-XX')('table.empty')).toBe('暂无数据');
    expect(tFor('en-US')('不存在的 key')).toBe('不存在的 key');
    registerICELocale('ja-JP', { 'table.empty': 'データなし' });
    expect(tFor('ja-JP')('table.empty')).toBe('データなし');
    expect(tFor('ja-JP')('common.ok')).toBe('确定'); // 没覆盖的 key 回退默认语言
  });

  it('t() 等价于「当前语言」的 tFor()', () => {
    setICELocale('en-US');
    expect(t('common.ok')).toBe(tFor()('common.ok'));
  });
});

describe('组件内置文案：按实例可配、互不影响', () => {
  afterEach(() => {
    setICELocale(ICE_DEFAULT_LOCALE);
  });

  it('同页两个分页组件可以各用各的语言（全局语言保持不动）', () => {
    const zh = new ICEPagination({ width: 400, total: 42, showTotal: true, locale: 'zh-CN' });
    const en = new ICEPagination({ width: 400, total: 42, showTotal: true, locale: 'en-US' });

    expect(labelTexts(zh)).toContain('共 42 条');
    expect(labelTexts(en)).toContain('42 in total');
    expect(getICELocale()).toBe('zh-CN'); // 没有因为构造英文实例而改全局
  });

  it('上传组件：提示与拒绝原因都跟随 props.locale', () => {
    const zh = new ICEUpload({ width: 320, height: 120, accept: 'image/*', maxSize: 2048 });
    const en = new ICEUpload({ width: 320, height: 120, accept: 'image/*', maxSize: 2048, locale: 'en-US' });
    expect(zh.getHintText()).toBe('点击或拖拽文件到此处上传');
    expect(en.getHintText()).toBe('Click or drag files here to upload');

    expect(zh.addFile({ name: 'a.exe', size: 10 })).toBe(false);
    expect(zh.getLastRejectReason()).toBe('文件类型不支持：a.exe');
    expect(en.addFile({ name: 'a.exe', size: 10 })).toBe(false);
    expect(en.getLastRejectReason()).toBe('Unsupported file type: a.exe');
  });

  it('日历：月份标题与周标题跟随 props.locale', () => {
    const zh = new ICECalendar({ width: 280, height: 260, value: '2026-09-13' });
    const en = new ICECalendar({ width: 280, height: 260, value: '2026-09-13', locale: 'en-US' });
    expect(labelTexts(zh)).toContain('2026 年 9 月');
    expect(labelTexts(en)).toContain('9/2026');
    expect(labelTexts(zh)).toContain('一');
    expect(labelTexts(en)).toContain('Mon');
  });

  it('表单模型的默认校验文案跟随 options.locale（字段级 message 仍可覆盖）', () => {
    const zh = new ICEFormModel();
    zh.addField({ name: 'email', label: '邮箱', rules: [{ required: true }] });
    zh.setValue('email', '', { silent: true });
    expect(zh.validateField('email')).toBe('邮箱不能为空');

    const en = new ICEFormModel({ locale: 'en-US' });
    en.addField({ name: 'email', label: 'Email', rules: [{ required: true }] });
    en.setValue('email', '', { silent: true });
    expect(en.validateField('email')).toBe('Email is required');

    const custom = new ICEFormModel({ locale: 'en-US' });
    custom.addField({ name: 'email', label: 'Email', rules: [{ required: true, message: '自定义文案' }] });
    custom.setValue('email', '', { silent: true });
    expect(custom.validateField('email')).toBe('自定义文案');
  });
});
