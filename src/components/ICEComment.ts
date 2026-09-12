import { ICEButton } from './ICEButton';
import { ICELabel } from './ICELabel';
import { ICEComponent } from '../core/ICEComponent';
import { iceUIManager } from '../core/ICEManager';

/**
 * 评论（业界组件库 Comment 的最小版）：文字头像 + 作者 + 时间 + 正文 + 操作按钮 + 嵌套回复。
 *
 * 布局自上而下：头像在左，右侧依次是「作者 · 时间」「正文」「操作」「回复（缩进）」。
 * 高度按内容自动累加（正文单行 20px，多行请自行用 content 组件工厂）。
 */

export interface ICECommentAction {
  key: string;
  text: string;
}

export interface ICECommentOptions {
  author: string;
  content: string;
  time?: string;
  /** 文字头像（默认取 author 首字） */
  avatarText?: string;
  avatarColor?: string;
  actions?: ICECommentAction[];
  onAction?: (key: string) => void;
  replies?: ICECommentOptions[];
  left?: number;
  top?: number;
  width?: number;
  indent?: number;
}

const PADDING = 12;
const AVATAR_SIZE = 32;
const LINE_HEIGHT = 20;
const GAP = 6;

export class ICEComment extends ICEComponent {
  private actionButtons = new Map<string, ICEButton>();
  private replyNodes: ICEComment[] = [];

  constructor(props: ICECommentOptions) {
    const theme = iceUIManager.getTheme();
    const width = props.width ?? 400;
    const replies = props.replies || [];
    const hasActions = !!(props.actions && props.actions.length);
    // 高度：作者行 + 正文 + （操作行）+ 回复
    let height = AVATAR_SIZE + GAP + LINE_HEIGHT;
    if (hasActions) {
      height += 28 + GAP;
    }
    const replyHeight = replies.reduce((sum, reply) => sum + estimateReplyHeight(reply), 0);
    height += replyHeight;
    super({
      fill: true,
      stroke: false,
      left: props.left,
      top: props.top,
      width,
      height,
      radius: theme.radius.md,
      style: { fillStyle: 'rgba(0,0,0,0)' },
    });

    const avatarText = props.avatarText || props.author.slice(0, 1).toUpperCase();
    const avatar = new ICEComponent({
      left: 0,
      top: 0,
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      radius: AVATAR_SIZE / 2,
      fill: true,
      stroke: false,
      interactive: false,
      style: { fillStyle: props.avatarColor || theme.colors.primary },
    });
    avatar.addChild(
      new ICELabel({
        interactive: false,
        left: 0,
        top: 0,
        width: AVATAR_SIZE,
        height: AVATAR_SIZE,
        align: 'center',
        verticalAlign: 'middle',
        text: avatarText,
        style: { fontSize: 13, fontWeight: '600', fillStyle: theme.colors.primaryText },
      }),
      false,
    );
    this.addChild(avatar, false);

    const contentLeft = AVATAR_SIZE + PADDING;
    const contentWidth = Math.max(0, width - contentLeft);
    this.addChild(
      new ICELabel({
        interactive: false,
        left: contentLeft,
        top: 2,
        width: contentWidth - 80,
        height: LINE_HEIGHT,
        verticalAlign: 'middle',
        text: props.author,
        style: { fontSize: 13, fontWeight: '600', fillStyle: theme.colors.text },
      }),
      false,
    );
    if (props.time) {
      this.addChild(
        new ICELabel({
          interactive: false,
          left: width - 80,
          top: 2,
          width: 80,
          height: LINE_HEIGHT,
          align: 'right',
          verticalAlign: 'middle',
          text: props.time,
          style: { fontSize: 12, fillStyle: theme.colors.textTertiary },
        }),
        false,
      );
    }
    this.addChild(
      new ICELabel({
        interactive: false,
        left: contentLeft,
        top: AVATAR_SIZE + GAP - 4,
        width: contentWidth,
        height: LINE_HEIGHT,
        verticalAlign: 'middle',
        text: props.content,
        style: { fontSize: 13, fillStyle: theme.colors.textSecondary },
      }),
      false,
    );

    let cursor = AVATAR_SIZE + GAP + LINE_HEIGHT;
    if (hasActions) {
      let left = contentLeft;
      (props.actions as ICECommentAction[]).forEach((action) => {
        const button = new ICEButton({
          left,
          top: cursor,
          width: Math.max(48, action.text.length * 14 + 16),
          height: 26,
          text: action.text,
          variant: 'text',
          size: 'small',
        });
        button.on('click', () => {
          if (props.onAction) {
            props.onAction(action.key);
          }
        });
        this.addChild(button, false);
        this.actionButtons.set(action.key, button);
        left += Math.max(48, action.text.length * 14 + 16) + 8;
      });
      cursor += 28 + GAP;
    }

    const indent = props.indent ?? 44;
    replies.forEach((reply) => {
      const node = new ICEComment({
        ...reply,
        left: indent,
        top: cursor,
        width: Math.max(0, width - indent),
      });
      this.addChild(node, false);
      this.replyNodes.push(node);
      cursor += Number(node.state.height) || 0;
    });
  }

  public getActionButton(key: string): ICEButton | null {
    return this.actionButtons.get(key) || null;
  }

  public getReplyNodes(): ICEComment[] {
    return this.replyNodes.slice();
  }
}

/** 估算回复高度（避免构造前拿不到子项高度导致父高度偏小）。 */
function estimateReplyHeight(reply: ICECommentOptions): number {
  const hasActions = !!(reply.actions && reply.actions.length);
  const replies = reply.replies || [];
  let height = AVATAR_SIZE + GAP + LINE_HEIGHT + (hasActions ? 28 + GAP : 0);
  height += replies.reduce((sum, item) => sum + estimateReplyHeight(item), 0);
  return height;
}
