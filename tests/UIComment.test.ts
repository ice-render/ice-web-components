/**
 * UIComment 单测。
 *
 * 规格：
 * - 单条评论：头像（文字头像）+ 作者 + 时间 + 正文 + 可选操作按钮；
 * - 嵌套回复：缩进渲染，父评论高度包含回复；
 * - 操作按钮点击回调 onAction(key)；高度按内容自动计算（正文/操作/回复）。
 */
import { UIComment } from '../src/components/UIComment';

function textsOf(node: any): string[] {
  const out: string[] = [];
  const walk = (current: any) => {
    const text = current.state && current.state.text;
    if (typeof text === 'string' && text && out.indexOf(text) === -1) out.push(text);
    (current.childNodes || []).forEach(walk);
  };
  walk(node);
  return out;
}

describe('UIComment', () => {
  it('渲染作者/时间/正文/头像与操作按钮', () => {
    let clicked = '';
    const comment = new UIComment({
      width: 400,
      author: '张三',
      avatarText: '张',
      time: '2 小时前',
      content: '这条评论用于验证基本渲染。',
      actions: [
        { key: 'reply', text: '回复' },
        { key: 'like', text: '点赞' },
      ],
      onAction: (key) => (clicked = key),
    });
    const texts = textsOf(comment);
    ['张', '张三', '2 小时前', '这条评论用于验证基本渲染。', '回复', '点赞'].forEach((text) => {
      expect(texts).toContain(text);
    });
    comment.getActionButton('like')!.trigger('click', null, {});
    expect(clicked).toBe('like');
    void clicked;
  });

  it('嵌套回复缩进渲染，父高度包含回复', () => {
    const comment = new UIComment({
      width: 400,
      author: '张三',
      content: '主评论',
      replies: [{ author: '李四', content: '回复内容' }],
    });
    const texts = textsOf(comment);
    expect(texts).toContain('主评论');
    expect(texts).toContain('回复内容');
    const replies = comment.getReplyNodes();
    expect(replies.length).toBe(1);
    expect(replies[0].state.left).toBeGreaterThan(0);
    expect(comment.state.height).toBeGreaterThan(replies[0].state.top);
  });

  it('无操作/无时间时高度更小', () => {
    const small = new UIComment({ width: 300, author: 'A', content: '正文' });
    const big = new UIComment({ width: 300, author: 'A', content: '正文', time: '刚刚', actions: [{ key: 'x', text: '操作' }] });
    expect(small.state.height).toBeLessThan(big.state.height);
  });
});
