/**
 * 浮层定位：纯函数，不依赖 canvas / ICE，便于单测。
 *
 * 语义参照 业界组件库：placement 由「边」+「对齐」组成（如 bottomLeft = 锚点下方、左对齐），
 * 空间不够时自动翻到对侧（flip），最后再夹到容器可见范围内（clamp）。
 */

export type ICEOverlayPlacement =
  | 'top'
  | 'topLeft'
  | 'topRight'
  | 'bottom'
  | 'bottomLeft'
  | 'bottomRight'
  | 'left'
  | 'leftTop'
  | 'leftBottom'
  | 'right'
  | 'rightTop'
  | 'rightBottom';

export interface ICEOverlayBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface ICEOverlayPositionInput {
  /** 锚点盒（世界坐标） */
  anchor: ICEOverlayBox;
  /** 浮层内容尺寸 */
  content: { width: number; height: number };
  /**
   * 可见容器（世界坐标）。默认左上角在原点；带视口平移时传 left/top，
   * 内部会在「容器局部坐标」里计算再换回世界坐标。
   */
  container: { width: number; height: number; left?: number; top?: number };
  placement?: ICEOverlayPlacement;
  /** 浮层与锚点的间距（默认 8） */
  offset?: number;
  /** 浮层与容器边缘的最小留白（默认 4） */
  padding?: number;
  /** 空间不足时是否翻到对侧（默认 true） */
  flip?: boolean;
}

export interface ICEOverlayPosition {
  left: number;
  top: number;
  /** 实际使用的 placement（可能因 flip 与请求值不同） */
  placement: ICEOverlayPlacement;
  /** 是否发生了翻转 */
  flipped: boolean;
}

const OPPOSITE: Record<string, ICEOverlayPlacement> = {
  top: 'bottom',
  topLeft: 'bottomLeft',
  topRight: 'bottomRight',
  bottom: 'top',
  bottomLeft: 'topLeft',
  bottomRight: 'topRight',
  left: 'right',
  leftTop: 'rightTop',
  leftBottom: 'rightBottom',
  right: 'left',
  rightTop: 'leftTop',
  rightBottom: 'leftBottom',
};

function sideOf(placement: ICEOverlayPlacement): string {
  return placement.replace(/(Left|Right|Top|Bottom)$/, '') || placement;
}

function alignOf(placement: ICEOverlayPlacement): string {
  const match = /(Left|Right|Top|Bottom)$/.exec(placement);
  return match ? match[1] : '';
}

/** 按 placement 算出未夹取的位置。 */
function place(input: ICEOverlayPositionInput, placement: ICEOverlayPlacement): { left: number; top: number } {
  const { anchor, content } = input;
  const offset = input.offset ?? 8;
  const side = sideOf(placement);
  const align = alignOf(placement);
  const centerX = anchor.left + anchor.width / 2;
  const centerY = anchor.top + anchor.height / 2;
  const right = anchor.left + anchor.width;
  const bottom = anchor.top + anchor.height;

  if (side === 'bottom' || side === 'top') {
    const top = side === 'bottom' ? bottom + offset : anchor.top - offset - content.height;
    let left = centerX - content.width / 2;
    if (align === 'Left') left = anchor.left;
    else if (align === 'Right') left = right - content.width;
    return { left, top };
  }

  const left = side === 'right' ? right + offset : anchor.left - offset - content.width;
  let top = centerY - content.height / 2;
  if (align === 'Top') top = anchor.top;
  else if (align === 'Bottom') top = bottom - content.height;
  return { left, top };
}

/**
 * 该 placement 是否放得下。
 *
 * 判定按「主轴 + 交叉轴」拆开：主轴（top/bottom 的纵向、left/right 的横向）必须真的放得下，
 * 交叉轴允许先夹进容器再判定 —— 否则浮层只要贴着右边界（或下边界）就会被误判成「空间不足」
 * 而整体翻到对侧，出现「明明下方很空却弹到上方」的怪象。交叉轴的最终位置仍由末尾的夹取决定。
 */
function fits(
  input: ICEOverlayPositionInput,
  placement: ICEOverlayPlacement,
  pos: { left: number; top: number },
): boolean {
  const padding = input.padding ?? 4;
  const { content, container } = input;
  const side = sideOf(placement);
  const vertical = side === 'top' || side === 'bottom';
  const maxLeft = Math.max(padding, container.width - padding - content.width);
  const maxTop = Math.max(padding, container.height - padding - content.height);
  const left = vertical ? Math.min(Math.max(pos.left, padding), maxLeft) : pos.left;
  const top = vertical ? pos.top : Math.min(Math.max(pos.top, padding), maxTop);
  return (
    left >= padding &&
    top >= padding &&
    left + content.width <= container.width - padding &&
    top + content.height <= container.height - padding
  );
}

/**
 * 计算浮层位置：优先用请求的 placement；放不下且 flip 打开时翻到对侧；
 * 最后把结果夹进容器（内容比容器还大时夹到起始边，保证左上角可见）。
 */
export function resolveICEOverlayPosition(input: ICEOverlayPositionInput): ICEOverlayPosition {
  const originLeft = input.container.left ?? 0;
  const originTop = input.container.top ?? 0;
  // 统一在「容器局部坐标」里算，最后再换回世界坐标（这样带视口平移也正确）
  const local: ICEOverlayPositionInput = {
    ...input,
    anchor: {
      left: input.anchor.left - originLeft,
      top: input.anchor.top - originTop,
      width: input.anchor.width,
      height: input.anchor.height,
    },
    container: { width: input.container.width, height: input.container.height },
  };
  const requested = local.placement || 'bottom';
  const padding = local.padding ?? 4;
  const flip = local.flip !== false;
  const { content, container } = local;

  let placement = requested;
  let pos = place(local, placement);
  let flipped = false;

  if (!fits(local, placement, pos) && flip) {
    const opposite = OPPOSITE[requested];
    if (opposite) {
      const alt = place(local, opposite);
      if (fits(local, opposite, alt) || !fits(local, requested, pos)) {
        placement = opposite;
        pos = alt;
        flipped = true;
      }
    }
  }

  const maxLeft = Math.max(padding, container.width - padding - content.width);
  const maxTop = Math.max(padding, container.height - padding - content.height);
  return {
    left: Math.min(Math.max(pos.left, padding), maxLeft) + originLeft,
    top: Math.min(Math.max(pos.top, padding), maxTop) + originTop,
    placement,
    flipped,
  };
}
