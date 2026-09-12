/**
 * 表格改宽度后必须重算列宽（回归）。
 *
 * 背景：`__render()` 只在 setData / 排序 / 分页时跑，单改 `state.width` 只会触发
 * `revalidate()`（重排文字位置）——列宽还是旧的，窗口一拉宽/缩窄，单元格文字就互相重叠。
 * 工作台与 XP 桌面里的「窗口内表格」正好踩到这个。
 */
import { ICETable } from '../src/components/ICETable';

const columns = [
  { key: 'name', title: '名称' },
  { key: 'type', title: '类型', width: 120 },
  { key: 'size', title: '大小', width: 100, align: 'right' as const },
];

const data = [
  { name: '季度总结.doc', type: 'Word', size: '248 KB' },
  { name: '预算表.xls', type: 'Excel', size: '96 KB' },
];

describe('ICETable 宽度变化', () => {
  it('setState({ width }) 后列宽重算，第二列起点随宽度变化', () => {
    const table = new ICETable({ columns, data, width: 400, rowHeight: 32 });
    // 宽度变化会整表重渲染，所以要每次重新取表头节点
    const secondCellOf = () => {
      const header = table.childNodes[0];
      return header.childNodes.find((node: any) => node.state && node.state.text === '类型');
    };
    const before = Number(secondCellOf().state.left);
    table.setState({ width: 800 });
    const after = Number(secondCellOf().state.left);
    expect(after).toBeGreaterThan(before);
    // 第一列自动列宽 = 800 - 120 - 100 = 580，所以第二列起点是 580
    expect(after).toBe(580);
  });

  it('缩窄时列宽同步缩小（文字不会互相重叠）', () => {
    const table = new ICETable({ columns, data, width: 800, rowHeight: 32 });
    table.setState({ width: 400 });
    const header = table.childNodes[0];
    const second = header.childNodes.find((node: any) => node.state && node.state.text === '类型');
    expect(Number(second.state.left)).toBe(180);
  });

  it('多选列也在重算范围内（内容列整体右移 40px）', () => {
    const table = new ICETable({ columns, data, width: 400, rowHeight: 32, rowSelection: 'multiple' });
    table.setState({ width: 800 });
    const header = table.childNodes[0];
    const second = header.childNodes.find((node: any) => node.state && node.state.text === '类型');
    // 选择列 40 + 自动列宽 (800 - 40 - 120 - 100) = 40 + 540 = 580
    expect(Number(second.state.left)).toBe(580);
  });
});
