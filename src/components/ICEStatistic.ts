import { ICEWidget } from '../core/ICEWidget';
import { ICELabel } from './ICELabel';
import { iceUIManager } from '../core/ICEManager';
import { getStatusColors } from '../util/ICEStyle';
import { tween, ICETweenHandle } from '../util/ICEAnimation';

/**
 * 数值格式化：精度 + 可选千分位；非数字（如「暂缺」）原样返回。
 * 负数先取绝对值分组，再把符号补回去（`-1234567.5` → `-1,234,567.5`）。
 */
export function formatStatisticValue(value: number | string, precision: number = 0, group: boolean = false): string {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return String(value ?? '');
  }
  const digits = Math.max(0, Math.floor(Number(precision) || 0));
  const fixed = numeric.toFixed(digits);
  if (!group) {
    return fixed;
  }
  const negative = fixed.startsWith('-');
  const [integer, fraction] = (negative ? fixed.slice(1) : fixed).split('.');
  const withGroup = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negative ? '-' : ''}${withGroup}${fraction ? `.${fraction}` : ''}`;
}

/**
 * 倒计时格式：`N 天 HH:mm:ss`；不足一天时省略「N 天」。
 * 负数按 0 处理（归零后不再显示 -00:00:01 这种反人类文案）。
 */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(Number(ms) || 0));
  const totalSeconds = Math.floor(total / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  const clock = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return days > 0 ? `${days} 天 ${clock}` : clock;
}

/**
 * 统计数值：标题 + 大号数字 + 前缀/后缀，支持千分位与精度。
 *
 * 传 `countdown`（剩余毫秒）时进入倒计时模式：按「N 天 HH:mm:ss」显示剩余时间，
 * 归零触发 `finish` 事件与 `onFinish` 回调。
 */
export interface ICEStatisticOptions {
  /** 组件 id（引擎会用它做唯一标识，e2e/调试时可按 id 定位） */
  id?: string;
  title?: string;
  value?: number | string;
  /** 小数位数，默认 0 */
  precision?: number;
  /** 千分位分隔，默认 false */
  groupSeparator?: boolean;
  prefix?: string;
  suffix?: string;
  /** 数值颜色状态（默认正文色） */
  status?: 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info';
  /** 倒计时剩余毫秒；给了就进入倒计时模式 */
  countdown?: number;
  /** 倒计时是否自动开始（默认 true；测试里可关掉，避免挂定时器） */
  autoStart?: boolean;
  /** 倒计时归零回调（与 `finish` 事件同义） */
  onFinish?: () => void;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  fontSize?: number;
}

const TITLE_HEIGHT = 20;
const VALUE_GAP = 2;

export class ICEStatistic extends ICEWidget {
  private titleNode: ICELabel;
  private valueNode: ICELabel;
  private precision: number;
  private group: boolean;
  private prefix: string;
  private suffix: string;
  private countdownMode: boolean;
  private remaining = 0;
  private running = false;
  private handle: ICETweenHandle | null = null;
  private onFinish: (() => void) | null;
  private rawValue: number | string;

  constructor(props: ICEStatisticOptions) {
    const theme = iceUIManager.getTheme();
    const fontSize = props.fontSize ?? 24;
    const height = props.height ?? TITLE_HEIGHT + VALUE_GAP + fontSize + 8;
    super({
      id: props.id,
      fill: false,
      stroke: false,
      left: props.left,
      top: props.top,
      width: props.width ?? 200,
      height,
    });
    this.precision = Math.max(0, Math.floor(Number(props.precision) || 0));
    this.group = props.groupSeparator === true;
    this.prefix = props.prefix ?? '';
    this.suffix = props.suffix ?? '';
    this.countdownMode = props.countdown !== undefined;
    this.rawValue = props.value ?? 0;
    this.onFinish = typeof props.onFinish === 'function' ? props.onFinish : null;
    const valueColor = props.status ? getStatusColors(theme, props.status).text : theme.colors.text;

    this.titleNode = new ICELabel({
      interactive: false,
      left: 0,
      top: 0,
      width: Number(this.state.width) || 200,
      height: TITLE_HEIGHT,
      text: props.title ?? '',
      verticalAlign: 'middle',
      style: {
        fontSize: theme.font.sizeSmall,
        fontFamily: theme.font.family,
        fillStyle: theme.colors.textSecondary,
      },
    });
    this.valueNode = new ICELabel({
      interactive: false,
      left: 0,
      top: TITLE_HEIGHT + VALUE_GAP,
      width: Number(this.state.width) || 200,
      height: fontSize + 8,
      text: '',
      verticalAlign: 'middle',
      style: {
        fontSize,
        fontFamily: theme.font.family,
        fontWeight: theme.font.weightSemibold,
        fillStyle: valueColor,
      },
    });
    this.addChild(this.titleNode, false);
    this.addChild(this.valueNode, false);

    if (this.countdownMode) {
      this.remaining = Math.max(0, Math.floor(Number(props.countdown) || 0));
      this.__syncCountdownText();
      if (props.autoStart !== false && this.remaining > 0) {
        this.start();
      }
    } else {
      this.__syncValueText();
    }
  }

  /**
   * 尺寸变化时把标题/数值两个标签的宽度跟上（`ICEWidget.__syncInternalLayout()`）。
   *
   * 构造期用 `Number(this.state.width) || 200` 给两个标签设了宽度就再没对过账：
   * 父层布局改尺寸后标签还是旧宽度，`verticalAlign: middle` 与后续对齐都按旧盒子算，
   * 文字于是画到组件外（等分网格里的统计项必现）。高度是常量，不用动。
   */
  protected __syncInternalLayout(): void {
    const width = Number(this.state.width) || 200;
    if (this.titleNode) {
      this.titleNode.setState({ width });
    }
    if (this.valueNode) {
      this.valueNode.setState({ width });
    }
  }

  public getTitleText(): string {
    return this.titleNode.getText();
  }

  public getValueText(): string {
    return this.valueNode.getText();
  }

  public setTitle(title: string): this {
    this.titleNode.setText(title ?? '');
    this.revalidate();
    return this;
  }

  /** 普通模式：改数值（字符串原样显示）。 */
  public setValue(value: number | string): this {
    if (this.countdownMode) {
      return this;
    }
    this.rawValue = value;
    this.__syncValueText();
    this.revalidate();
    return this;
  }

  public getValue(): number | string {
    return this.rawValue;
  }

  public isCountdown(): boolean {
    return this.countdownMode;
  }

  public getRemaining(): number {
    return this.remaining;
  }

  public isRunning(): boolean {
    return this.running;
  }

  /**
   * 设置剩余毫秒。≤ 0 视为归零：文案变 `00:00:00`，停止计时并触发完成回调。
   */
  public setCountdown(ms: number): this {
    this.countdownMode = true;
    const next = Math.max(0, Math.floor(Number(ms) || 0));
    this.remaining = next;
    if (next <= 0) {
      this.__stopTween();
      this.running = false;
      this.__syncCountdownText();
      this.__finish();
      return this;
    }
    this.__syncCountdownText();
    if (this.running) {
      this.start();
    }
    return this;
  }

  /** 开始（或继续）倒计时。 */
  public start(): this {
    if (!this.countdownMode || this.remaining <= 0) {
      return this;
    }
    this.__stopTween();
    this.running = true;
    const from = this.remaining;
    this.handle = tween({
      from,
      to: 0,
      duration: from,
      easing: 'linear',
      onUpdate: (value) => {
        this.remaining = Math.max(0, Math.round(value));
        this.__syncCountdownText();
      },
      onFinish: () => {
        this.handle = null;
        this.running = false;
        this.remaining = 0;
        this.__syncCountdownText();
        this.__finish();
      },
    });
    return this;
  }

  /** 暂停倒计时（保留剩余时间）。 */
  public stop(): this {
    if (!this.running) {
      return this;
    }
    this.__stopTween();
    this.running = false;
    return this;
  }

  private __stopTween(): void {
    if (this.handle) {
      this.handle.cancel();
      this.handle = null;
    }
  }

  private __syncCountdownText(): void {
    this.valueNode.setText(`${this.prefix}${formatCountdown(this.remaining)}${this.suffix}`);
  }

  private __syncValueText(): void {
    const body =
      typeof this.rawValue === 'number'
        ? formatStatisticValue(this.rawValue, this.precision, this.group)
        : String(this.rawValue ?? '');
    this.valueNode.setText(`${this.prefix}${body}${this.suffix}`);
  }

  private __finish(): void {
    this.trigger('finish', null, {});
    if (this.onFinish) {
      this.onFinish();
    }
  }
}
