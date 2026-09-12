/**
 * UITransfer 单测（穿梭框）。
 *
 * 规格：
 * - 按 targetKeys 把数据分成「源 / 目标」两栏；
 * - 点行切换勾选；勾选后可用中间按钮右移 / 左移，移动后清空勾选并回调 onChange；
 * - 没有勾选时按钮不可用（点击无效果、不回调）；
 * - disabled 的行不能勾选、不会被移动；
 * - 表单取值约定（值 = targetKeys 数组）+ 错误态。
 */
import { UITransfer } from '../src/components/UITransfer';

const dataSource = [
  { key: 'a', title: '苹果' },
  { key: 'b', title: '香蕉' },
  { key: 'c', title: '樱桃' },
  { key: 'd', title: '榴莲', disabled: true },
];

function setup(props: any = {}) {
  const changes: Array<{ keys: string[]; direction: string; moveKeys: string[] }> = [];
  const transfer = new UITransfer({
    left: 0,
    top: 0,
    width: 420,
    dataSource,
    targetKeys: ['b'],
    onChange: (keys: string[], direction: string, moveKeys: string[]) =>
      changes.push({ keys, direction, moveKeys }),
    ...props,
  });
  return { transfer, changes };
}

describe('UITransfer', () => {
  it('按 targetKeys 分区，行节点可查', () => {
    const { transfer } = setup();
    expect(transfer.getSourceKeys()).toEqual(['a', 'c', 'd']);
    expect(transfer.getTargetKeys()).toEqual(['b']);
    expect(transfer.getSourceNode('a')).not.toBeNull();
    expect(transfer.getSourceNode('b')).toBeNull();
    expect(transfer.getTargetNode('b')).not.toBeNull();
    expect(transfer.getTargetNode('a')).toBeNull();
    expect(transfer.getMoveRightButton()).not.toBeNull();
    expect(transfer.getMoveLeftButton()).not.toBeNull();
  });

  it('勾选后可右移：目标新增、源减少、清空勾选并回调', () => {
    const { transfer, changes } = setup();
    expect(transfer.isMoveRightEnabled()).toBe(false);

    transfer.getSourceNode('a')!.trigger('click', null, {});
    expect(transfer.isChecked('a')).toBe(true);
    expect(transfer.isMoveRightEnabled()).toBe(true);

    transfer.getSourceNode('c')!.trigger('click', null, {});
    expect(transfer.getCheckedKeys().sort()).toEqual(['a', 'c']);

    transfer.moveRight();
    expect(transfer.getTargetKeys()).toEqual(['b', 'a', 'c']);
    expect(transfer.getSourceKeys()).toEqual(['d']);
    expect(transfer.getCheckedKeys()).toEqual([]);
    expect(transfer.isMoveRightEnabled()).toBe(false);
    expect(changes.length).toBe(1);
    expect(changes[0].direction).toBe('right');
    expect(changes[0].moveKeys.sort()).toEqual(['a', 'c']);
    expect(changes[0].keys).toEqual(['b', 'a', 'c']);
  });

  it('目标行可勾选左移回源', () => {
    const { transfer, changes } = setup();
    transfer.getTargetNode('b')!.trigger('click', null, {});
    expect(transfer.isChecked('b')).toBe(true);
    transfer.moveLeft();
    expect(transfer.getSourceKeys()).toEqual(['a', 'b', 'c', 'd']);
    expect(transfer.getTargetKeys()).toEqual([]);
    expect(changes[0].direction).toBe('left');
    expect(changes[0].moveKeys).toEqual(['b']);
  });

  it('disabled 行不可勾选、不会被移动；无勾选时移动无效果', () => {
    const { transfer, changes } = setup();
    transfer.getSourceNode('d')!.trigger('click', null, {});
    expect(transfer.isChecked('d')).toBe(false);
    expect(transfer.getCheckedKeys()).toEqual([]);

    transfer.moveRight();
    expect(transfer.getTargetKeys()).toEqual(['b']);
    expect(changes.length).toBe(0);
  });

  it('targetKeys 可重复设置；表单取值与错误态', () => {
    const { transfer } = setup();
    transfer.setTargetKeys(['c']);
    expect(transfer.getSourceKeys()).toEqual(['a', 'b', 'd']);
    expect(transfer.getTargetKeys()).toEqual(['c']);
    expect(transfer.getFormValue()).toEqual(['c']);
    transfer.setFormValue(['a', 'd']);
    expect(transfer.getTargetKeys()).toEqual(['a', 'd']);
    transfer.setValidateStatus('error');
    expect(transfer.getValidateStatus()).toBe('error');
  });
});
