/**
 * 无障碍（a11y）规格：控件的可读名称 + DOM 镜像层。
 *
 * 背景（见引擎 `14-accessibility.md`）：canvas 内容对屏幕阅读器完全不可见，所以必须有一层
 * 隐藏 DOM 镜像。引擎负责「产出可访问节点快照」（id / 角色建议 / `state.ariaLabel` / 屏幕盒 /
 * tab 顺序），**组件库负责两件事**：
 * 1. 关键控件给出**有意义的可读名称**（按钮用文字、输入框用占位符/标签、勾选用标签……），
 *    不要退化成「读 id」；
 * 2. 提供一个可直接挂上的镜像层 `mountICEAccessibilityMirror`：把快照渲染成定位好的
 *    `role` 元素，点/聚焦能映射回画布组件（`ice.setFocusedComponent` + `activate()`）。
 *
 * 这一层用假 document 单测（本仓库的惯例），真实浏览器里的表现由 gallery 的 QA 守着。
 */
import { ICEWidget } from '../src/core/ICEWidget';
import { ICEButton } from '../src/components/ICEButton';
import { ICECheckBox } from '../src/components/ICECheckBox';
import { ICETextField } from '../src/components/ICETextField';
import { mountICEAccessibilityMirror } from '../src/util/ICEAccessibilityMirror';

/** 极简 document：记录创建出来的元素与它们的监听器。 */
const makeDoc = () => {
  const created: any[] = [];
  const body = {
    children: [] as any[],
    appendChild(element: any) {
      body.children.push(element);
      element.parentNode = body;
    },
    removeChild(element: any) {
      const index = body.children.indexOf(element);
      if (index >= 0) body.children.splice(index, 1);
      element.parentNode = null;
    },
  };
  const doc = {
    body,
    createElement(tag: string) {
      const element: any = {
        tagName: String(tag).toUpperCase(),
        style: {},
        attributes: {} as Record<string, string>,
        children: [] as any[],
        listeners: {} as Record<string, Array<(evt: any) => void>>,
        parentNode: null,
        setAttribute(name: string, value: string) {
          element.attributes[name] = String(value);
        },
        removeAttribute(name: string) {
          delete element.attributes[name];
        },
        appendChild(child: any) {
          element.children.push(child);
          child.parentNode = element;
        },
        removeChild(child: any) {
          const index = element.children.indexOf(child);
          if (index >= 0) element.children.splice(index, 1);
        },
        addEventListener(type: string, handler: (evt: any) => void) {
          element.listeners[type] = element.listeners[type] || [];
          element.listeners[type].push(handler);
        },
        removeEventListener() {},
        dispatch(type: string, evt: any = {}) {
          (element.listeners[type] || []).slice().forEach((handler: (evt: any) => void) => handler(evt));
        },
        querySelectorAll(selector: string) {
          const results: any[] = [];
          const walk = (node: any) => {
            (node.children || []).forEach((child: any) => {
              const role = child.attributes && child.attributes.role;
              if (selector === '[role]' && role) results.push(child);
              walk(child);
            });
          };
          walk(element);
          return results;
        },
        get firstChild() {
          return element.children[0] || null;
        },
      };
      created.push(element);
      return element;
    },
  };
  return { doc, body, created };
};

/** 假的 a11y 快照：镜像层只吃 `ice.getAccessibilityTree()` 的产物 + `getComponentById`。 */
const makeFakeIce = (nodes: any[]) => {
  const activated: string[] = [];
  const focused: string[] = [];
  const components: Record<string, any> = {};
  nodes.forEach((node) => {
    components[node.id] = {
      state: { id: node.id },
      activate: () => activated.push(node.id),
      trigger: (name: string) => {
        if (name === 'click') activated.push(node.id);
      },
    };
  });
  return {
    activated,
    focused,
    ice: {
      canvasWidth: 800,
      canvasHeight: 600,
      dirty: false,
      // 场景树：镜像层靠遍历它建 id → 组件映射
      childNodes: nodes.map((node) => components[node.id]),
      getAccessibilityTree: () => nodes,
      setFocusedComponent: (component: any) => {
        focused.push(component ? component.state.id : 'null');
        return this;
      },
    },
  };
};

const NODES = [
  { id: 'btn-ok', role: 'graphic', label: '保存', box: { x: 10, y: 20, width: 96, height: 32 }, visible: true, interactive: true, focusable: true, tabIndex: 0, selected: false, level: 1, parentId: null },
  { id: 'label-1', role: 'text', label: '标题', box: { x: 10, y: 70, width: 120, height: 20 }, visible: true, interactive: false, focusable: false, tabIndex: -1, selected: false, level: 1, parentId: null },
];

describe('控件自带可读名称', () => {
  it('按钮用文字当 aria-label（不让屏幕阅读器读 id）', () => {
    const button = new ICEButton({ id: 'save-btn', text: '保存' });
    expect(button.getAriaLabel()).toBe('保存');
    button.setText('保存并关闭');
    expect(button.getAriaLabel()).toBe('保存并关闭');
  });

  it('输入框用占位符兜底，显式 ariaLabel 优先', () => {
    const field = new ICETextField({ placeholder: '请输入客户名称' });
    expect(field.getAriaLabel()).toBe('请输入客户名称');
    field.setAriaLabel('客户名称');
    expect(field.getAriaLabel()).toBe('客户名称');
  });

  it('勾选框用标签文本', () => {
    const box = new ICECheckBox({ label: '同意服务条款' });
    expect(box.getAriaLabel()).toBe('同意服务条款');
  });

  it('任何组件都能显式设置 ariaLabel（state.ariaLabel 正是引擎读的字段）', () => {
    const widget = new ICEWidget({});
    expect(widget.getAriaLabel()).toBe('');
    widget.setAriaLabel('自定义区域');
    expect(widget.getAriaLabel()).toBe('自定义区域');
    expect(widget.state.ariaLabel).toBe('自定义区域');
  });
});

describe('DOM 镜像层', () => {
  it('把快照渲染成定位好的 role 元素，并带上 aria-label / data-ice-id / tabindex', () => {
    const env = makeFakeIce(NODES);
    const { doc, body } = makeDoc();
    const mirror = mountICEAccessibilityMirror(env.ice, { doc });
    const container = body.children[0];
    expect(container).toBeTruthy();
    const elements = mirror.getElements();
    expect(elements).toHaveLength(2);
    expect(elements[0].style.position).toBe('absolute');
    expect([elements[0].style.left, elements[0].style.top, elements[0].style.width, elements[0].style.height]).toEqual(['10px', '20px', '96px', '32px']);
    expect(elements[0].attributes['aria-label']).toBe('保存');
    expect(elements[0].attributes['data-ice-id']).toBe('btn-ok');
    expect(elements[0].attributes.tabindex).toBe('0');
    expect(elements[1].attributes.tabindex).toBeUndefined();
    expect(mirror.isMounted()).toBe(true);
    mirror.unmount();
    expect(body.children).toHaveLength(0);
    expect(mirror.isMounted()).toBe(false);
  });

  it('角色映射：可交互控件给 button，文本给 text（引擎建议 + 组件能力一起看）', () => {
    const env = makeFakeIce(NODES);
    const { doc } = makeDoc();
    const mirror = mountICEAccessibilityMirror(env.ice, { doc });
    const elements = mirror.getElements();
    expect(elements[0].attributes.role).toBe('button');
    expect(elements[1].attributes.role).toBe('text');
  });

  it('点镜像元素 = 聚焦并激活画布组件（屏幕阅读器/键盘用户点得到）', () => {
    const env = makeFakeIce(NODES);
    const { doc } = makeDoc();
    const mirror = mountICEAccessibilityMirror(env.ice, { doc });
    mirror.getElements()[0].dispatch('click');
    expect(env.focused).toEqual(['btn-ok']);
    expect(env.activated).toEqual(['btn-ok']);
  });

  it('refresh 会按最新快照重建（元素数量跟着变）', () => {
    const env = makeFakeIce(NODES);
    const { doc } = makeDoc();
    const mirror = mountICEAccessibilityMirror(env.ice, { doc });
    expect(mirror.getElements()).toHaveLength(2);
    env.ice.getAccessibilityTree = () => NODES.slice(0, 1);
    mirror.refresh();
    expect(mirror.getElements()).toHaveLength(1);
  });

  it('没有 document 时是空操作（Node 下不炸）', () => {
    const env = makeFakeIce(NODES);
    const mirror = mountICEAccessibilityMirror(env.ice, { doc: null });
    expect(mirror.isMounted()).toBe(false);
    expect(() => mirror.refresh()).not.toThrow();
    mirror.unmount();
  });
});
