/**
 * ICELayout（布局骨架）单测。
 *
 * 后台外壳（顶栏 + 侧栏 + 内容 + 页脚）现在每个示例都在手搭：算坐标、算剩余宽度、
 * 侧栏收起时还要手动把内容挪过去。这里把它沉淀成一个件：
 * - 四个区域可选：没给的不占空间（没页脚时内容直接到底）；
 * - 侧栏可以在左 / 在右；
 * - 区域尺寸随容器尺寸变化自动重排（不是一次性算完就固定）；
 * - `getRegionBox()` 把版式暴露出来，测试与几何审计都能断言「区域之间不交叠」。
 */
import { ICELayout } from '../src/components/ICELayout';
import { ICEWidget } from '../src/core/ICEWidget';

const region = () => new ICEWidget({ width: 10, height: 10 });

function setup(props: any = {}) {
  return new ICELayout({ width: 1000, height: 600, ...props });
}

describe('ICELayout：区域版式', () => {
  it('四个区域各就各位：顶栏与页脚通栏、侧栏在左、内容占剩下的', () => {
    const layout = setup({
      header: region(),
      sider: region(),
      content: region(),
      footer: region(),
      headerHeight: 56,
      footerHeight: 40,
      siderWidth: 220,
    });
    expect(layout.getRegionBox('header')).toEqual({ left: 0, top: 0, width: 1000, height: 56 });
    expect(layout.getRegionBox('sider')).toEqual({ left: 0, top: 56, width: 220, height: 504 });
    expect(layout.getRegionBox('content')).toEqual({ left: 220, top: 56, width: 780, height: 504 });
    expect(layout.getRegionBox('footer')).toEqual({ left: 0, top: 560, width: 1000, height: 40 });
  });

  it('没给的区域不占空间：没有顶栏/侧栏/页脚时内容铺满', () => {
    const layout = setup({ content: region() });
    expect(layout.getRegionBox('content')).toEqual({ left: 0, top: 0, width: 1000, height: 600 });
    expect(layout.getHeader()).toBe(null);
    expect(layout.getSider()).toBe(null);
    expect(layout.getFooter()).toBe(null);
  });

  it('侧栏可以在右：内容贴左、侧栏贴右', () => {
    const layout = setup({ sider: region(), content: region(), siderWidth: 200, siderPosition: 'right' });
    expect(layout.getRegionBox('content')).toEqual({ left: 0, top: 0, width: 800, height: 600 });
    expect(layout.getRegionBox('sider')).toEqual({ left: 800, top: 0, width: 200, height: 600 });
  });

  it('区域节点被真的摆到那个盒子里（不是只算不摆）', () => {
    const header = region();
    const content = region();
    const layout = setup({ header, content, siderWidth: 0 });
    expect(header.state.left).toBe(0);
    expect(header.state.top).toBe(0);
    expect(header.state.width).toBe(1000);
    expect(header.state.height).toBe(56);
    expect(content.state.left).toBe(0);
    expect(content.state.top).toBe(56);
    expect(content.state.width).toBe(1000);
    expect(content.state.height).toBe(544);
  });
});

describe('ICELayout：变更与自适应', () => {
  it('容器尺寸变了自动重排（不是一次性算完就固定）', () => {
    const layout = setup({ header: region(), sider: region(), content: region() });
    layout.setState({ width: 800, height: 400 });
    layout.layout();
    expect(layout.getRegionBox('content')).toEqual({ left: 220, top: 56, width: 580, height: 344 });
  });

  it('侧栏收起（隐藏）→ 内容占满宽度，再展开又让回去', () => {
    const layout = setup({ sider: region(), content: region(), siderWidth: 220 });
    layout.setSiderVisible(false);
    expect(layout.isSiderVisible()).toBe(false);
    expect(layout.getRegionBox('content')).toEqual({ left: 0, top: 0, width: 1000, height: 600 });
    layout.setSiderVisible(true);
    expect(layout.getRegionBox('content').left).toBe(220);
    layout.setSiderWidth(0);
    expect(layout.getRegionBox('content').left).toBe(0);
  });

  it('setContent 换内容：旧节点被摘掉，新节点接上', () => {
    const first = region();
    const second = region();
    const layout = setup({ content: first });
    expect(layout.getContent()).toBe(first);
    layout.setContent(second);
    expect(layout.getContent()).toBe(second);
    expect(layout.childNodes.indexOf(first)).toBe(-1);
    expect(layout.childNodes.indexOf(second)).toBeGreaterThan(-1);
  });

  it('传 null 可以清掉区域（页面切到没有侧栏的形态）', () => {
    const layout = setup({ sider: region(), content: region(), siderWidth: 220 });
    layout.setSider(null);
    expect(layout.getSider()).toBe(null);
    expect(layout.getRegionBox('content').width).toBe(1000);
  });

  it('区域之间不交叠（几何审计口径）', () => {
    const layout = setup({ header: region(), sider: region(), content: region(), footer: region() });
    const keys = ['header', 'sider', 'content', 'footer'] as const;
    const boxes = keys.map((key) => layout.getRegionBox(key));
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        const overlapX = Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left);
        const overlapY = Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top);
        expect(overlapX <= 0 || overlapY <= 0).toBe(true);
      }
    }
  });
});
