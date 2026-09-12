/**
 * 组件内置文案跟着语言走（i18n 接线的回归）。
 *
 * 只测「文案确实来自语言包」这条线：切到英文之后，新建的组件用英文；
 * 切回中文之后又变回来。文案在**构造时**读取，所以断言都基于新构造的实例。
 */
import { ICE_DEFAULT_LOCALE, setICELocale, t } from '../src/i18n/ICEI18n';
import { ICETable } from '../src/components/ICETable';
import { ICEUpload } from '../src/components/ICEUpload';

const tableEmptyText = (table: ICETable): string => {
  const empty = (table as any).childNodes.find((node: any) => typeof node.getDescription === 'function');
  return empty ? empty.getDescription() : '';
};

describe('组件内置文案', () => {
  afterEach(() => {
    setICELocale(ICE_DEFAULT_LOCALE);
  });

  it('表格空态：中文 / 英文', () => {
    expect(tableEmptyText(new ICETable({ width: 320, columns: [{ key: 'a', title: 'A' }], data: [] }))).toBe('暂无数据');
    setICELocale('en-US');
    expect(tableEmptyText(new ICETable({ width: 320, columns: [{ key: 'a', title: 'A' }], data: [] }))).toBe('No data');
  });

  it('上传区提示文案跟着语言走', () => {
    const zh = new ICEUpload({ width: 320, height: 120 });
    expect(zh.getHintText()).toBe('点击或拖拽文件到此处上传');
    setICELocale('en-US');
    expect(new ICEUpload({ width: 320, height: 120 }).getHintText()).toBe('Click or drag files here to upload');
  });

  it('t() 直接取用（应用层自己的文案也能放进同一个语言包）', () => {
    expect(t('common.ok')).toBe('确定');
    setICELocale('en-US');
    expect(t('common.ok')).toBe('OK');
  });
});
