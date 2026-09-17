import type { ICELayoutManager } from 'ice-render';
import { ICEWidget } from './ICEWidget';

/**
 * 容器型组件基类：**应用层对外的主要入口** —— 页面、面板、工作区的默认基类。
 *
 * - **契约**：继承本类 = ① 我能持有子节点、也能被嵌套；② 我负责把子节点排到正确位置；
 *   ③ 子节点坐标相对本容器的内容区（已扣 `padding`），因此可以无限嵌套。
 * - **选哪条线**：要 `addChild` 并负责排布 → 本类；画不持有子节点、也不负责排布的叶子控件
 *   （指针、状态灯…）→ `ICEWidget`。判定只需问一句：**我要不要给它 `addChild` 并负责排布？**
 * - **布局**：优先挂布局策略（`setLayout`）；不挂才由调用方给绝对坐标（等价 Swing 的
 *   `setLayout(null)`）。库内新增容器必须「挂布局」或「写清豁免原因」二选一，棘轮测试管着。
 * - **不涉及页面 / 路由 / 激活**：谁挂载我、什么时候让我出现，是**宿主**的决定。宿主用
 *   `setState({ display })` 切换可见性，容器收到 `onShow` / `onHide` / `onResize` /
 *   `onMount` / `onUnmount`（定义与分发点见 `ICEWidget`）。`onUpdate(deps)` 不是引擎回调，
 *   是应用层自己的约定：页面自己声明关心哪些值、自己调用它。
 * - **嵌套是能力，不是义务**：具体工程选扁平挂载（页面节点直接挂根、一套绝对坐标）还是
 *   逐层嵌套，属于挂载方的策略，两者不冲突。
 * - **不覆盖 `toJSON()`**：容器是结构，属于文档本身，应当被序列化。要排除内部零件，由组件
 *   自己覆盖（`ICEMenu` / `ICETabs` / `ICEScrollPane` 是范例）。
 * - **应用页面怎么写**：一页一个 `ICEContainer` 子类、`onUpdate()` 由宿主在"数据换新之后"
 *   调用、别在 `onShow()` 里自更新（那一刻数据还是上一轮的）、入口决策表与验收清单 ——
 *   完整口径见 `docs/guides/app-pages.md`。
 * - 完整口径见 `docs/guides/layout.md`。
 */
export class ICEContainer extends ICEWidget {
  constructor(props: any = {}) {
    super(props);
  }

  /** 设置布局策略（引擎 ICEGroup.setLayout 的链式版本）。 */
  public setLayout(layout: ICELayoutManager): this {
    super.setLayout(layout);
    return this;
  }
}
