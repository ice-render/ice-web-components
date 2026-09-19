/**
 * ICE 内核的移动类事件为了性能不会在 mousemove 时做全量命中检测，
 * 因此 Canvas 组件没有内置 mouseenter/mouseleave 语义。
 *
 * ICEHoverManager 通过事件总线的 mousemove + ice.hitTest() 自己维护当前 hover 组件，
 * 并把状态同步到带 setHovered() 的 ICEWidget 上，实现接近 HTML 组件的 hover 效果。
 */
export class ICEHoverManager {
  private ice: any;
  private current: any = null;
  private running = false;
  private lastX = 0;
  private lastY = 0;
  private rafId: any = null;
  private __onMouseMove: (evt: any) => void;
  private __onLeave: () => void;

  constructor(ice: any) {
    this.ice = ice;
    this.__onMouseMove = (evt: any) => {
      if (!evt || typeof evt.offsetX !== 'number' || typeof evt.offsetY !== 'number') {
        return;
      }
      this.lastX = evt.offsetX;
      this.lastY = evt.offsetY;
      this.__schedule();
    };
    this.__onLeave = () => this.setHovered(null);
  }

  public start(): this {
    if (this.running || !this.ice || !this.ice.evtBus) {
      return this;
    }
    this.running = true;
    this.ice.evtBus.on('mousemove', this.__onMouseMove, this);
    const el = this.ice.canvasEl;
    if (el && typeof el.addEventListener === 'function') {
      el.addEventListener('mouseleave', this.__onLeave);
      el.addEventListener('pointerleave', this.__onLeave);
    }
    return this;
  }

  public stop(): this {
    if (!this.running) {
      return this;
    }
    if (this.ice && this.ice.evtBus) {
      this.ice.evtBus.off('mousemove', this.__onMouseMove, this);
    }
    const el = this.ice && this.ice.canvasEl;
    if (el && typeof el.removeEventListener === 'function') {
      el.removeEventListener('mouseleave', this.__onLeave);
      el.removeEventListener('pointerleave', this.__onLeave);
    }
    if (this.rafId !== null) {
      this.__cancelRaf(this.rafId);
      this.rafId = null;
    }
    this.setHovered(null);
    this.running = false;
    return this;
  }

  public getHoveredComponent(): any {
    return this.current;
  }

  private __schedule(): void {
    if (this.rafId !== null) {
      return;
    }
    const root: any = this.ice && this.ice.root ? this.ice.root : null;
    const raf = root && typeof root.requestAnimationFrame === 'function' ? root.requestAnimationFrame.bind(root) : null;
    if (raf) {
      this.rafId = raf(() => {
        this.rafId = null;
        this.__flush();
      });
    } else {
      this.rafId = setTimeout(() => {
        this.rafId = null;
        this.__flush();
      }, 16);
    }
  }

  private __cancelRaf(id: any): void {
    const root: any = this.ice && this.ice.root ? this.ice.root : null;
    if (root && typeof root.cancelAnimationFrame === 'function' && typeof id === 'number') {
      root.cancelAnimationFrame(id);
    } else if (typeof clearTimeout === 'function') {
      clearTimeout(id);
    }
  }

  private __flush(): void {
    if (!this.running || !this.ice) {
      return;
    }
    const target = this.__findHoverTarget();
    this.setHovered(target || null);
  }

  private __findHoverTarget(): any {
    const ice = this.ice;
    if (!ice || typeof ice.screenToWorld !== 'function') {
      return null;
    }
    const [wx, wy] = ice.screenToWorld(this.lastX, this.lastY);
    /**
     * hover 高亮必须命中**最上层**的可悬停组件，而"最上层"就是**绘制顺序的最后**那个：
     * 引擎 v2.13.0 起是「树序（先父后子）+ 兄弟按 zIndex」，且**工具层整体在组件层之上**
     * （见引擎 AGENTS「渲染顺序铁律」）。所以这里直接用渲染队列，不再自己按 zIndex 全局排序 ——
     * 全局排序会把深层节点的 zIndex 拿来跟祖先的兄弟比，出现「高亮了一个被盖住的组件」。
     *
     * 只扫 `childNodes` 也不行：鼠标会 hover 穿透遮罩，落到被挡住的组件上。
     */
    const collect = (nodes: any[], out: any[]) => {
      for (const node of nodes || []) {
        if (node && typeof node.setHovered === 'function' && node.state && node.state.interactive) {
          out.push(node);
        }
        if (node && node.childNodes && node.childNodes.length) {
          collect(node.childNodes, out);
        }
      }
    };
    const renderer: any = ice.renderer;
    let ordered: any[];
    if (renderer && typeof renderer.getOrderedQueues === 'function') {
      // 快路径：与渲染/命中同一个队列（组件层在前、工具层在后 = 由下到上）。
      // ⚠️ 队列**已经是展平**的，不要再递归 childNodes —— 那会把后代重复收一遍。
      const q = renderer.getOrderedQueues();
      const hoverable = (n: any) => n && typeof n.setHovered === 'function' && n.state && n.state.interactive;
      ordered = (q.components || []).filter(hoverable).concat((q.tools || []).filter(hoverable));
    } else {
      // 回退（headless / 未 init 的夹具）：按同一语义自己走一遍
      const byZ = (nodes: any[]) =>
        (nodes || []).slice().sort((a: any, b: any) => (Number(a.state.zIndex) || 0) - (Number(b.state.zIndex) || 0));
      const walk = (nodes: any[], out: any[]) => {
        for (const node of byZ(nodes)) {
          if (node && typeof node.setHovered === 'function' && node.state && node.state.interactive) {
            out.push(node);
          }
          if (node && node.childNodes && node.childNodes.length) {
            walk(node.childNodes, out);
          }
        }
      };
      ordered = [];
      walk(ice.childNodes || [], ordered);
      walk(ice.toolNodes || [], ordered);
    }
    let found: any = null;
    for (const component of ordered) {
      if (component.containsPoint && component.containsPoint(wx, wy)) {
        found = component;
      }
    }
    return found;
  }

  private setHovered(component: any): void {
    if (component === this.current) {
      return;
    }
    if (this.current && typeof this.current.setHovered === 'function') {
      this.current.setHovered(false);
    }
    this.current = component;
    if (component && typeof component.setHovered === 'function') {
      component.setHovered(true);
    }
  }
}
