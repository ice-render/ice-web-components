/**
 * UI 过渡：极简补间 + 常用动效助手（淡入淡出 / 滑入 / 缩放进入）。
 *
 * 为什么不用引擎的 AnimationManager：那套是「按 props.animations 声明、每帧写 state 的点路径补间」，
 * 适合常驻动画（流动虚线等），但没有**完成回调**与「一次性过渡」的语义。浮层/抽屉/消息这类
 * 「进入-结束-回调」的过渡用它更别扭，所以这里做一层薄薄的 rAF 补间：
 *
 * - 纯函数式：只依赖注入的 frame driver（测试里可手动 step）；
 * - 每个 tween 返回句柄，可 cancel（cancel 不触发 onFinish）；
 * - duration ≤ 0 时同步落到终点并回调。
 *
 * 渐变类动效改的是组件 `state.opacity`（引擎按子树相乘，整棵子树一起透明，见 ice-render 的
 * 子树不透明度支持）；滑块类是直接改 left/top；缩放改 `transform.scale`。
 */

export type ICEEasingName = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';
export type ICEEasing = ICEEasingName | ((t: number) => number);

export interface ICEFrameDriver {
  request(callback: (time: number) => void): any;
  cancel(handle: any): void;
}

export interface ICETweenOptions {
  from?: number;
  to: number;
  /** 毫秒；≤ 0 或非法时同步落到终点 */
  duration?: number;
  delay?: number;
  easing?: ICEEasing;
  onUpdate: (value: number) => void;
  onFinish?: () => void;
  driver?: ICEFrameDriver;
}

/**
 * 减少动效开关（可访问性）。
 *
 * `'auto'`（默认）跟随系统的 `prefers-reduced-motion`；`true` / `false` 强制开关。
 * 生效点在 `tween()`：开了之后时长按 0 处理 —— 所有过渡（淡入淡出、滑入、缩放、卡片翻转…）
 * 都是同步落到终点，而不是「动画变快」。
 */
let reducedMotion: boolean | 'auto' = 'auto';

export function setICEReducedMotion(value: boolean | 'auto'): void {
  reducedMotion = value;
}

export function isICEReducedMotion(): boolean {
  if (reducedMotion !== 'auto') {
    return reducedMotion === true;
  }
  const mq = typeof globalThis !== 'undefined' && typeof (globalThis as any).matchMedia === 'function'
    ? (globalThis as any).matchMedia('(prefers-reduced-motion: reduce)')
    : null;
  return !!(mq && mq.matches);
}

/** 动画时长归一化：减少动效时一律 0（调用方也可以直接用它算自己的时长）。 */
export function resolveICEAnimationDuration(duration: number): number {
  const value = Number(duration);
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return isICEReducedMotion() ? 0 : value;
}

export interface ICETweenHandle {
  cancel(): void;
}

const defaultDriver: ICEFrameDriver = {
  request(callback) {
    const raf = (globalThis as any).requestAnimationFrame;
    if (typeof raf === 'function') {
      return raf(callback);
    }
    return setTimeout(() => callback(Date.now()), 16);
  },
  cancel(handle) {
    const caf = (globalThis as any).cancelAnimationFrame;
    if (typeof caf === 'function') {
      caf(handle);
      return;
    }
    clearTimeout(handle);
  },
};

export function easeInQuad(t: number): number {
  return t * t;
}

export function easeOutCubic(t: number): number {
  const p = 1 - t;
  return 1 - p * p * p;
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function resolveICEEasing(easing?: ICEEasing): (t: number) => number {
  if (typeof easing === 'function') {
    return easing;
  }
  if (easing === 'easeIn') {
    return easeInQuad;
  }
  if (easing === 'easeOut') {
    return easeOutCubic;
  }
  if (easing === 'easeInOut') {
    return easeInOutCubic;
  }
  return (t: number) => t;
}

/** 单值补间（frame driver 可注入，测试里手动 step）。 */
export function tween(options: ICETweenOptions): ICETweenHandle {
  const driver = options.driver || defaultDriver;
  const rawDuration = Number(options.duration);
  const requested = Number.isFinite(rawDuration) && rawDuration > 0 ? rawDuration : 0;
  // 减少动效：时长按 0 处理（同步落到终点），延迟也一并去掉 —— 用户要的是「别晃」
  const duration = resolveICEAnimationDuration(requested);
  const delay = duration === 0 ? 0 : Number(options.delay) || 0;
  const easing = resolveICEEasing(options.easing);
  const from = Number.isFinite(Number(options.from)) ? Number(options.from) : 0;
  const to = Number(options.to);

  let startTime: number | null = null;
  let frame: any = null;
  let finished = false;
  let cancelled = false;

  const handle: ICETweenHandle = {
    cancel() {
      cancelled = true;
      if (frame !== null) {
        driver.cancel(frame);
        frame = null;
      }
    },
  };

  const finish = () => {
    if (finished) {
      return;
    }
    finished = true;
    frame = null;
    if (options.onFinish) {
      options.onFinish();
    }
  };

  const step = (now: number) => {
    frame = null;
    if (cancelled || finished) {
      return;
    }
    if (startTime === null) {
      startTime = now;
    }
    const elapsed = now - startTime - delay;
    if (elapsed < 0) {
      options.onUpdate(from);
      frame = driver.request(step);
      return;
    }
    if (elapsed >= duration) {
      options.onUpdate(to);
      finish();
      return;
    }
    options.onUpdate(from + (to - from) * easing(elapsed / duration));
    frame = driver.request(step);
  };

  if (duration === 0) {
    options.onUpdate(to);
    finish();
    return handle;
  }
  frame = driver.request(step);
  return handle;
}

/** 过渡公共参数（不含 from/to）。 */
export interface ICETransitionOptions {
  duration?: number;
  delay?: number;
  easing?: ICEEasing;
  onFinish?: () => void;
  driver?: ICEFrameDriver;
}

function setOpacity(component: any, value: number): void {
  component.setState({ opacity: value });
}

/** 把不透明度过渡到指定值。 */
export function fadeTo(component: any, to: number, options: ICETransitionOptions = {}): ICETweenHandle {
  const current = Number(component.state.opacity);
  return tween({
    from: Number.isFinite(current) ? current : 1,
    to,
    duration: options.duration ?? 200,
    delay: options.delay,
    easing: options.easing ?? 'easeOut',
    driver: options.driver,
    onUpdate: (value) => setOpacity(component, value),
    onFinish: options.onFinish,
  });
}

/** 淡入：从 0 到 1。 */
export function fadeIn(component: any, options: ICETransitionOptions = {}): ICETweenHandle {
  setOpacity(component, 0);
  return tween({
    from: 0,
    to: 1,
    duration: options.duration ?? 200,
    delay: options.delay,
    easing: options.easing ?? 'easeOut',
    driver: options.driver,
    onUpdate: (value) => setOpacity(component, value),
    onFinish: options.onFinish,
  });
}

/** 淡出：从当前值到 0（完成后通常再移除组件）。 */
export function fadeOut(component: any, options: ICETransitionOptions = {}): ICETweenHandle {
  return fadeTo(component, 0, { duration: 150, ...options });
}

export interface ICESlideOptions extends ICETransitionOptions {
  /** 从哪一侧滑入（目标位置保持不变） */
  from: 'top' | 'bottom' | 'left' | 'right';
  distance?: number;
  /** 是否同时淡入，默认 true */
  fade?: boolean;
}

/** 滑入：从指定方向的偏移位置移到当前位置（可选同时淡入）。 */
export function slideIn(component: any, options: ICESlideOptions): ICETweenHandle {
  const distance = Number(options.distance ?? 12);
  const targetLeft = Number(component.state.left) || 0;
  const targetTop = Number(component.state.top) || 0;
  const startLeft = options.from === 'left' ? targetLeft - distance : options.from === 'right' ? targetLeft + distance : targetLeft;
  const startTop = options.from === 'top' ? targetTop - distance : options.from === 'bottom' ? targetTop + distance : targetTop;

  if (options.fade !== false) {
    setOpacity(component, 0);
  }
  component.setState({ left: startLeft, top: startTop });

  let opacityHandle: ICETweenHandle | null = null;
  if (options.fade !== false) {
    opacityHandle = tween({
      from: 0,
      to: 1,
      duration: options.duration ?? 200,
      delay: options.delay,
      easing: options.easing ?? 'easeOut',
      driver: options.driver,
      onUpdate: (value) => setOpacity(component, value),
    });
  }

  const moveHandle = tween({
    from: 0,
    to: 1,
    duration: options.duration ?? 200,
    delay: options.delay,
    easing: options.easing ?? 'easeOut',
    driver: options.driver,
    onUpdate: (value) => {
      component.setState({
        left: startLeft + (targetLeft - startLeft) * value,
        top: startTop + (targetTop - startTop) * value,
      });
    },
    onFinish: options.onFinish,
  });

  return {
    cancel() {
      moveHandle.cancel();
      if (opacityHandle) {
        opacityHandle.cancel();
      }
    },
  };
}

export interface ICEScaleInOptions extends ICETransitionOptions {
  /** 起始缩放（默认 0.96） */
  from?: number;
  /** 是否同时淡入，默认 true */
  fade?: boolean;
}

/** 缩放进入：scale 从 from 到 1（可选同时淡入）。 */
export function scaleIn(component: any, options: ICEScaleInOptions = {}): ICETweenHandle {
  const from = Number(options.from ?? 0.96);
  const baseTransform = component.state.transform || {};
  if (options.fade !== false) {
    setOpacity(component, 0);
  }
  component.setState({ transform: { ...baseTransform, scale: [from, from] } });

  let opacityHandle: ICETweenHandle | null = null;
  if (options.fade !== false) {
    opacityHandle = tween({
      from: 0,
      to: 1,
      duration: options.duration ?? 200,
      delay: options.delay,
      easing: options.easing ?? 'easeOut',
      driver: options.driver,
      onUpdate: (value) => setOpacity(component, value),
    });
  }

  const scaleHandle = tween({
    from,
    to: 1,
    duration: options.duration ?? 200,
    delay: options.delay,
    easing: options.easing ?? 'easeOut',
    driver: options.driver,
    onUpdate: (value) => {
      component.setState({ transform: { ...baseTransform, scale: [value, value] } });
    },
    onFinish: options.onFinish,
  });

  return {
    cancel() {
      scaleHandle.cancel();
      if (opacityHandle) {
        opacityHandle.cancel();
      }
    },
  };
}
