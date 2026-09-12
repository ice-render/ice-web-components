/**
 * 无障碍（a11y）DOM 镜像层。
 *
 * canvas 内容对屏幕阅读器完全不可见（`<canvas>` 只是位图），所以必须有一层隐藏 DOM 把
 * 语义暴露出去。引擎负责产出快照（见引擎 `src/a11y/accessibility.ts`：
 * id / 角色建议 / `state.ariaLabel` / 屏幕盒 / tab 顺序），**这里负责把快照变成 DOM**：
 *
 * ```ts
 * const mirror = mountICEAccessibilityMirror(ice);
 * // 场景变化后（换页、开窗、列表刷新……）调一次
 * mirror.refresh();
 * ```
 *
 * 元素是「透明但存在」的（`opacity: 0`，不是 `display:none` —— 后者会把语义一起藏掉），
 * 位置与画布组件对齐，键盘 Tab 能进去、屏幕阅读器能读到、点它等于点画布组件。
 * 容器默认 `pointer-events: none`，只有可交互元素打开指针事件，避免挡住画布本身。
 */

export interface ICEAccessibleNodeLike {
  id: string;
  role: string;
  label: string;
  box: { x: number; y: number; width: number; height: number };
  visible: boolean;
  interactive: boolean;
  focusable: boolean;
  tabIndex: number;
  selected: boolean;
  level: number;
  parentId: string | null;
}

export interface ICEA11yMirrorOptions {
  /** 注入 document（测试用假对象）；不传取全局 document */
  doc?: any;
  /** 挂载容器（默认挂到 document.body） */
  container?: any;
  /** 容器 id，默认 `ice-a11y-mirror` */
  id?: string;
  /** 是否包含不可见组件（默认 false，跟引擎默认一致） */
  includeHidden?: boolean;
  /** 自定义角色映射：引擎给的是「建议」，产品语义可以覆盖 */
  roleMap?: (node: ICEAccessibleNodeLike, component: any) => string | null;
}

export interface ICEA11yMirrorHandle {
  isMounted(): boolean;
  getContainer(): any;
  getElements(): any[];
  refresh(): void;
  unmount(): void;
}

/** 引擎建议的角色 → 语义化 DOM 角色。可交互的控件一律给 button（点得动的就是按钮）。 */
function resolveRole(node: ICEAccessibleNodeLike, component: any, options: ICEA11yMirrorOptions): string {
  if (options.roleMap) {
    const custom = options.roleMap(node, component);
    if (custom) return custom;
  }
  // 「点得动 / 聚得上焦」的就是按钮；纯展示的按引擎建议走
  if (node.interactive || node.focusable) {
    return 'button';
  }
  if (node.role === 'text') return 'text';
  if (node.role === 'image') return 'img';
  if (node.role === 'link') return 'link';
  if (node.role === 'container') return 'group';
  return 'img';
}

export function mountICEAccessibilityMirror(ice: any, options: ICEA11yMirrorOptions = {}): ICEA11yMirrorHandle {
  const doc = options.doc === undefined ? (globalThis as any).document : options.doc;
  let container: any = null;
  let elements: any[] = [];
  let mounted = false;

  const ensureContainer = () => {
    if (container) return container;
    if (options.container && typeof options.container.appendChild === 'function') {
      container = options.container;
      return container;
    }
    if (!doc || !doc.body || typeof doc.createElement !== 'function') return null;
    container = doc.createElement('div');
    container.id = options.id || 'ice-a11y-mirror';
    container.style.position = 'absolute';
    container.style.left = '0';
    container.style.top = '0';
    container.style.width = `${Number(ice && ice.canvasWidth) || 0}px`;
    container.style.height = `${Number(ice && ice.canvasHeight) || 0}px`;
    container.style.overflow = 'hidden';
    container.style.pointerEvents = 'none';
    container.style.zIndex = '1';
    if (typeof container.setAttribute === 'function') {
      container.setAttribute('role', 'application');
    }
    doc.body.appendChild(container);
    return container;
  };

  const clear = () => {
    elements.forEach((element) => {
      if (container && typeof container.removeChild === 'function') container.removeChild(element);
    });
    elements = [];
  };

  /**
   * 场景里「id → 组件」的映射。
   *
   * 引擎没有 `getComponentById()`（a11y 快照只给 id），所以这里按它同一套遍历方式
   * （`ice.childNodes` + `childNodes` 递归，见引擎 `flattenAllComponents`）现建一份。
   * 每次 refresh 重建：结构可能刚改过，缓存在这里只会带来「点到已经拆掉的组件」。
   */
  const collectById = (): Map<string, any> => {
    const map = new Map<string, any>();
    const walk = (nodes: any[]) => {
      (nodes || []).forEach((node) => {
        if (!node || !node.state) return;
        const id = node.state.id || (node.props && node.props.id);
        if (id) map.set(String(id), node);
        walk(node.childNodes);
      });
    };
    walk(ice && ice.childNodes);
    return map;
  };

  const build = () => {
    const host = ensureContainer();
    if (!host || !ice || typeof ice.getAccessibilityTree !== 'function') return;
    clear();
    const nodes: ICEAccessibleNodeLike[] = ice.getAccessibilityTree({
      includeHidden: options.includeHidden === true,
    }) || [];
    const componentById = collectById();
    nodes.forEach((node) => {
      const component = componentById.get(String(node.id)) || null;
      const element = doc.createElement('div');
      const box = node.box || { x: 0, y: 0, width: 0, height: 0 };
      element.style.position = 'absolute';
      element.style.left = `${Math.round(box.x)}px`;
      element.style.top = `${Math.round(box.y)}px`;
      element.style.width = `${Math.max(1, Math.round(box.width))}px`;
      element.style.height = `${Math.max(1, Math.round(box.height))}px`;
      // 透明但留在可访问性树里：display:none / visibility:hidden 会把语义一起藏掉
      element.style.opacity = '0';
      element.style.color = 'transparent';
      element.style.background = 'transparent';
      element.style.border = 'none';
      element.style.padding = '0';
      element.style.margin = '0';
      element.style.pointerEvents = node.interactive ? 'auto' : 'none';
      if (typeof element.setAttribute === 'function') {
        element.setAttribute('role', resolveRole(node, component, options));
        element.setAttribute('aria-label', node.label || node.id);
        element.setAttribute('data-ice-id', node.id);
        if (node.focusable) element.setAttribute('tabindex', String(Math.max(0, node.tabIndex || 0)));
        if (node.selected) element.setAttribute('aria-selected', 'true');
      }
      const activate = () => {
        if (!component) return;
        if (typeof ice.setFocusedComponent === 'function') ice.setFocusedComponent(component);
        if (typeof component.activate === 'function') component.activate();
        else if (typeof component.trigger === 'function') component.trigger('click');
      };
      if (typeof element.addEventListener === 'function') {
        element.addEventListener('click', activate);
        element.addEventListener('focus', () => {
          if (component && typeof ice.setFocusedComponent === 'function') ice.setFocusedComponent(component);
        });
      }
      host.appendChild(element);
      elements.push(element);
    });
  };

  const handle: ICEA11yMirrorHandle = {
    isMounted: () => mounted,
    getContainer: () => container,
    getElements: () => elements.slice(),
    refresh: () => {
      if (!mounted) return;
      build();
    },
    unmount: () => {
      if (!mounted) return;
      clear();
      if (container && container.parentNode && typeof container.parentNode.removeChild === 'function') {
        container.parentNode.removeChild(container);
      }
      if (!options.container) container = null;
      mounted = false;
    },
  };
  // 首次挂载：没有 document（Node / 小程序）时保持空操作，不抛异常
  if (doc && doc.body && typeof doc.createElement === 'function') {
    mounted = true;
    build();
  }
  return handle;
}
