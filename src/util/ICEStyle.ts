import { ICEText, resolveThemeValue, tokenValue, type ICEThemeTokenRef } from 'ice-render';
import type { ICEThemeTokens } from '../theme/ICETheme';
import { iceUIManager } from '../core/ICEManager';

export type ICEStatusColor = 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info';

/**
 * 读**画出来的颜色**：解析样式里的主题引用。
 *
 * 组件样式里的色值现在有两种形态：普通字符串，或**主题引用**（`token('ui.colors.text')`，
 * 见 `ICEThemeBridge`）—— 后者是热切换与"每个 ICE 实例各自主题"的实现方式。
 * 但引用是个对象，直接 `String(style.fillStyle)` 会得到 `[object Object]`
 * （QA / 调试接口断言颜色时就是这么踩的），所以公开的读数接口一律走这个helper。
 */
export function resolvedStyleColor(
  node: any,
  key: 'fillStyle' | 'strokeStyle' = 'fillStyle',
  fallback = ''
): string {
  const raw = node && node.state && node.state.style ? node.state.style[key] : undefined;
  if (raw === undefined || raw === null) return fallback;
  const theme = node && node.ice && typeof node.ice.getTheme === 'function' ? node.ice.getTheme() : undefined;
  let resolved = theme ? resolveThemeValue(raw, theme) : raw;
  if (resolved === raw && resolved !== null && typeof resolved === 'object') {
    /**
     * 没挂到引擎上（单测 / 构造期就调这个读数接口）时，`resolveThemeValue` 没地方查表。
     * 组件里的引用清一色是 `ui.…`（指向本库 token），所以这里退一步用**当前 UI 主题**解析 ——
     * 否则调用方拿到的是 `[object Object]`。
     */
    const path = raw && typeof raw === 'object' && typeof (raw as any).$token === 'string' ? String((raw as any).$token) : null;
    if (path && path.indexOf('ui.') === 0) {
      resolved = tokenValue(path, { semantic: { ui: iceUIManager.getTheme() } } as any);
    }
  }
  return String(resolved === undefined || resolved === null ? fallback : resolved);
}

/**
 * 极简文本宽度估算（给「按最长文字定容器宽度」用的）。
 *
 * 画布文本**没有裁剪**：容器（tooltip / dropdown 面板）算窄了，中文会直接压出色块外面。
 * 中日韩与全角字符按 1em、其余按 0.6em 估算——够用且不依赖 ctx（构造期就能算）。
 */
export function estimateTextWidth(text: string, fontSize: number): number {
  let width = 0;
  for (const char of String(text ?? '')) {
    width += /[\u2e80-\u9fff\u3000-\u303f\uff00-\uffef]/.test(char) ? fontSize : fontSize * 0.6;
  }
  return Math.ceil(width);
}

/**
 * 从 `hoverchange` 事件里读取 hovered。
 *
 * 引擎的 `trigger(name, evt, param)` 把第三个参数放进 `event.param`（不是平铺在事件上），
 * 而手写的 `trigger('hoverchange', { hovered })` 又是平铺的 —— 两种都要兼容。
 * 只读 `evt.hovered` 会永远拿到 undefined，表现为「悬停反馈静默失效」。
 */
export function readHovered(evt: any): boolean {
  if (!evt) {
    return false;
  }
  return !!(evt.param ? evt.param.hovered : evt.hovered);
}

/**
 * 圆角矩形路径（手写 `arcTo`，不依赖较新的 `ctx.roundRect`，老环境也能跑）。
 *
 * 谁在用：自绘组件的 painter（`ICESkeleton` 的占位条）与引擎 `ctx` 自绘的 `ICETileMap`
 * —— 之前是 TileMap 里的私有函数，painter 也要画圆角后提取到公共工具。
 */
export function roundRectPath(
  ctx: any,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  ctx.beginPath();
  if (r <= 0) {
    ctx.rect(x, y, width, height);
    return;
  }
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.arcTo(x + width, y, x + width, y + r, r);
  ctx.lineTo(x + width, y + height - r);
  ctx.arcTo(x + width, y + height, x + width - r, y + height, r);
  ctx.lineTo(x + r, y + height);
  ctx.arcTo(x, y + height, x, y + height - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

export type ICEStatusColors = {
  background: string;
  border: string;
  /** 状态实色（白底上的文字 / 进度条等填充） */
  text: string;
  /** subtle 浅底上的强调文字色（Bootstrap `*-text-emphasis`） */
  strong: string;
  /** 实底填充（Bootstrap `.text-bg-*` 的 background） */
  solid: string;
  /** 实底上的文字色（亮色底为黑字） */
  onSolid: string;
};

export function getStatusColors(theme: ICEThemeTokens, status: ICEStatusColor = 'default') {
  // `text` = 状态实色（用在白底上，如统计卡的涨跌数字）
  // `strong` = 强调文字色（用在 subtle 浅底上，如 Alert/Tag/Badge 的文字）
  // `solid` / `onSolid` = Bootstrap 的 `.text-bg-*`（实底 + 白字，亮色底配黑字）
  if (status === 'success') {
    return {
      background: theme.colors.successBg,
      border: theme.colors.successBorder,
      text: theme.colors.success,
      strong: theme.colors.successTextEmphasis,
      solid: theme.colors.success,
      onSolid: '#ffffff',
    };
  }
  if (status === 'warning') {
    return {
      background: theme.colors.warningBg,
      border: theme.colors.warningBorder,
      text: theme.colors.warning,
      strong: theme.colors.warningTextEmphasis,
      solid: theme.colors.warning,
      // Bootstrap `.text-bg-warning` 用黑字（亮黄底白字看不清）
      onSolid: '#000000',
    };
  }
  if (status === 'error') {
    return {
      background: theme.colors.errorBg,
      border: theme.colors.errorBorder,
      text: theme.colors.error,
      strong: theme.colors.errorTextEmphasis,
      solid: theme.colors.error,
      onSolid: '#ffffff',
    };
  }
  if (status === 'info') {
    return {
      background: theme.colors.infoBg,
      border: theme.colors.infoBorder,
      text: theme.colors.info,
      strong: theme.colors.infoTextEmphasis,
      solid: theme.colors.info,
      onSolid: '#000000',
    };
  }
  if (status === 'primary') {
    return {
      background: theme.colors.primaryBg,
      border: theme.colors.primaryBorder,
      text: theme.colors.primary,
      strong: theme.colors.primaryTextEmphasis,
      solid: theme.colors.primary,
      onSolid: '#ffffff',
    };
  }
  return {
    background: theme.colors.surface,
    border: theme.colors.border,
    text: theme.colors.textSecondary,
    strong: theme.colors.text,
    // Bootstrap 的 `.text-bg-secondary`
    solid: theme.colors.textSecondary,
    onSolid: '#ffffff',
  };
}

/**
 * 创建一段按照 ICE 约定居中显示的文本。
 * width/height 不传时交给 ICEText 自动测量，并保持左上角文本语义。
 */
export function createTextNode(props: {
  text?: string;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  /** 允许直接给色值，也允许给引擎的主题引用（`token('ui.colors.text')`）—— 后者才能热切换。 */
  fillStyle?: string | ICEThemeTokenRef;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string;
  align?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
}) {
  const {
    text = '',
    left = 0,
    top = 0,
    width,
    height,
    fillStyle,
    fontFamily,
    fontSize,
    fontWeight,
    align = 'left',
    verticalAlign = 'top',
  } = props;

  const style: any = {
    fillStyle,
    fontFamily,
    fontSize,
    fontWeight,
  };

  if (align === 'center') {
    style.textAlign = 'center';
  } else if (align === 'right') {
    style.textAlign = 'right';
  }

  if (verticalAlign === 'middle') {
    style.textBaseline = 'middle';
  } else if (verticalAlign === 'bottom') {
    style.textBaseline = 'bottom';
  }

  return new ICEText({
    left,
    top,
    text,
    width,
    height,
    stroke: false,
    style,
  });
}

export function centerTextNode(
  text: string,
  theme: ICEThemeTokens,
  width: number,
  height: number,
  options: { fontSize?: number; fontWeight?: string; fillStyle?: string | ICEThemeTokenRef } = {},
) {
  return createTextNode({
    text,
    left: 0,
    top: 0,
    width,
    height,
    fillStyle: options.fillStyle ?? theme.colors.text,
    fontFamily: theme.font.family,
    fontSize: options.fontSize ?? theme.font.size,
    fontWeight: options.fontWeight ?? theme.font.weightNormal,
    align: 'center',
    verticalAlign: 'middle',
  });
}
