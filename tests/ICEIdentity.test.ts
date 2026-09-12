/**
 * 组件身份 props 回归：`id` 必须被转发到引擎 state。
 *
 * 背景：不少组件的构造函数手写 `super({ fill, stroke, left, top, width, height })`，
 * 把调用方传的 `id` 悄悄丢了 —— 表现是「明明写了 id，场景里却按 id 找不到这个组件」
 * （demo/调试/e2e 都会踩）。这里逐个构造断言 `state.id` 被保留。
 */
import { ICEWidget } from '../src/core/ICEWidget';
import { ICETextField } from '../src/components/ICETextField';
import { ICEAutoComplete } from '../src/components/ICEAutoComplete';
import { ICEAvatarGroup } from '../src/components/ICEAvatarGroup';
import { ICECarousel } from '../src/components/ICECarousel';
import { ICECascader } from '../src/components/ICECascader';
import { ICECollapse } from '../src/components/ICECollapse';
import { ICEColorPicker } from '../src/components/ICEColorPicker';
import { ICEComment } from '../src/components/ICEComment';
import { ICEDatePicker } from '../src/components/ICEDatePicker';
import { ICEDescriptions } from '../src/components/ICEDescriptions';
import { ICEEmpty } from '../src/components/ICEEmpty';
import { ICEForm } from '../src/components/ICEForm';
import { ICEFormItem } from '../src/components/ICEFormItem';
import { ICEImageView } from '../src/components/ICEImageView';
import { ICEInputNumber } from '../src/components/ICEInputNumber';
import { ICEList } from '../src/components/ICEList';
import { ICEPagination } from '../src/components/ICEPagination';
import { ICERate } from '../src/components/ICERate';
import { ICEResult } from '../src/components/ICEResult';
import { ICESegmented } from '../src/components/ICESegmented';
import { ICESelect } from '../src/components/ICESelect';
import { ICESkeleton } from '../src/components/ICESkeleton';
import { ICESteps } from '../src/components/ICESteps';
import { ICETimePicker } from '../src/components/ICETimePicker';
import { ICETimeline } from '../src/components/ICETimeline';
import { ICETransfer } from '../src/components/ICETransfer';
import { ICETree } from '../src/components/ICETree';
import { ICETreeSelect } from '../src/components/ICETreeSelect';
import { ICEUpload } from '../src/components/ICEUpload';

const ID = 'qa-node';

/** [组件名, 工厂]：每个工厂都用 `id: ID` 构造 */
const CASES: Array<[string, () => ICEWidget]> = [
  ['ICEAutoComplete', () => new ICEAutoComplete({ id: ID, options: [] })],
  ['ICEAvatarGroup', () => new ICEAvatarGroup({ id: ID, avatars: [] })],
  ['ICECarousel', () => new ICECarousel({ id: ID, slides: [] })],
  ['ICECascader', () => new ICECascader({ id: ID, options: [] })],
  ['ICECollapse', () => new ICECollapse({ id: ID, items: [] })],
  ['ICEColorPicker', () => new ICEColorPicker({ id: ID })],
  ['ICEComment', () => new ICEComment({ id: ID, author: 'A', content: 'c' })],
  ['ICEDatePicker', () => new ICEDatePicker({ id: ID })],
  ['ICEDescriptions', () => new ICEDescriptions({ id: ID, items: [] })],
  ['ICEEmpty', () => new ICEEmpty({ id: ID })],
  ['ICEForm', () => new ICEForm({ id: ID })],
  ['ICEFormItem', () => new ICEFormItem({ id: ID, name: 'n', control: new ICETextField({}) })],
  ['ICEImageView', () => new ICEImageView({ id: ID })],
  ['ICEInputNumber', () => new ICEInputNumber({ id: ID })],
  ['ICEList', () => new ICEList({ id: ID, items: [] })],
  ['ICEPagination', () => new ICEPagination({ id: ID })],
  ['ICERate', () => new ICERate({ id: ID })],
  ['ICEResult', () => new ICEResult({ id: ID })],
  ['ICESegmented', () => new ICESegmented({ id: ID, options: [] })],
  ['ICESelect', () => new ICESelect({ id: ID, options: [] })],
  ['ICESkeleton', () => new ICESkeleton({ id: ID })],
  ['ICESteps', () => new ICESteps({ id: ID, items: [] })],
  ['ICETimePicker', () => new ICETimePicker({ id: ID })],
  ['ICETimeline', () => new ICETimeline({ id: ID, items: [] })],
  ['ICETransfer', () => new ICETransfer({ id: ID, dataSource: [] })],
  ['ICETree', () => new ICETree({ id: ID, nodes: [] })],
  ['ICETreeSelect', () => new ICETreeSelect({ id: ID, nodes: [] })],
  ['ICEUpload', () => new ICEUpload({ id: ID })],
];

describe('组件身份 props', () => {
  CASES.forEach(([name, make]) => {
    it(`${name} 保留调用方传入的 id`, () => {
      const node = make();
      expect(node.state.id).toBe(ID);
    });
  });

  it('不传 id 时引擎自动生成（不会被写成 undefined）', () => {
    const node = new ICEColorPicker({});
    expect(typeof node.state.id).toBe('string');
    expect(node.state.id.length).toBeGreaterThan(0);
  });
});
