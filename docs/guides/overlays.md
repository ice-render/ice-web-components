# 浮层：弹窗、抽屉、下拉、提示

所有弹出类组件共用一套 `ICEOverlayManager`：内容挂在引擎的**工具层**（递归绘制、永远在业务层之上、不参与业务层命中）。

## 三种用法

### 1. 命令式打开（弹窗 / 抽屉）

```ts
import { openModal, openDrawer } from 'ice-web-components';

const modal = openModal(ice, {
  title: '确认删除？',
  content: '删除后不可恢复。',          // 字符串，或 () => 组件
  confirmText: '删除',
  closeOnConfirm: false,               // 异步校验/等接口时不要自动关
  onConfirm: () => {
    submit().then((ok) => ok && modal.close());
  },
});

openDrawer(ice, { title: '订单详情', width: 420, content: () => buildDetail() });
```

### 2. 挂到某个组件上（下拉 / 气泡 / 提示）

```ts
import { attachTooltip, attachPopover, attachPopconfirm, attachDropdown } from 'ice-web-components';

attachTooltip(ice, button, { title: '导出为 CSV', placement: 'top' });
attachPopover(ice, button, { title: '打印设置', content: '默认 A4' });
attachPopconfirm(ice, button, { title: '确认下架？', danger: true, onConfirm: () => {} });
attachDropdown(ice, button, { items: [{ key: 'a', label: '选项 A' }], onSelect: (item) => {} });
```

### 3. 组件自带浮层（字段类）

`ICESelect` / `ICEAutoComplete` / `ICECascader` / `ICETreeSelect` / `ICEDatePicker` / `ICETimePicker`
自己管理浮层，你只管用字段 API：

```ts
new ICEDatePicker({ width: 180, value: '2026-09-12', onChange: (v) => {} });
```

## 定位

12 种 placement（`top` / `topLeft` / `bottom` / `rightTop` …）：优先用请求的位置，
放不下会自动翻到对侧，最后夹进可见世界矩形。判定分两条轴：

* **主轴**（`top/bottom` 的纵向、`left/right` 的横向）必须真的放得下，否则翻转；
* **交叉轴**允许先夹取再判定 —— 否则贴右边界时会被误判成“空间不足”而整体翻上去。

也可以直接用纯函数算位置（不依赖 ICE 实例）：

```ts
import { resolveICEOverlayPosition } from 'ice-web-components';

resolveICEOverlayPosition({ anchor, content: { width, height }, container, placement: 'bottomLeft' });
// → { left, top, placement, flipped }
```

## 关闭策略

| 选项 | 默认 | 说明 |
|---|---|---|
| `closeOnOutsideClick` | `true` | 点浮层与锚点之外关闭 |
| `closeOnEsc` | `true` | Esc 关闭 |
| `exclusive` | `true` | 打开新浮层时关掉旧的 |
| `blocking` | `false` | 模态遮罩：挡住下层交互 |
| `keyboardCaptured` | `false` | 浮层接管 Enter/Space（下拉选中用） |
| `maskClosable` | `true` | Modal / Drawer：点遮罩关闭 |

> **浮层里要点击行时**：不要依赖 `closeOnOutsideClick` —— 它按盒子判定，可能在 `click` 派发**之前**
> 就把浮层关掉。这类组件的做法是 `closeOnOutsideClick: false` + 自己监听 `mousedown` 判点外
> （`ICESelect` / `ICEDatePicker` / `ICETimePicker` / `ICECascader` / `ICETreeSelect` / `ICEAutoComplete` 都这么做）。

## 动画

```ts
overlay.open({
  anchor, content,
  enterAnimation: 'scale',   // 'none' | 'fade' | 'scale'
  exitAnimation: 'fade',
  animation: { duration: 180, easing: 'easeOut', driver: myFrameDriver },  // driver 可注入（测试用）
});
```

## 自定义浮层内容

`content` 除了字符串还能传**工厂函数**，在浮层打开时创建组件树 —— 这样内容的创建顺序晚于浮层面板，
zIndex 天然在上层：

```ts
openModal(ice, {
  title: '新建订单',
  height: 500,
  content: () => {
    const pane = new ICEWidget({ width: 380, height: 380, fill: false, stroke: false });
    const form = new ICEForm({ width: 360, gap: 12 });   // 在工厂里建
    pane.addChild(form, false);
    return pane;
  },
});
```

## 消息与通知

```ts
import { ICEMessage, ICENotification } from 'ice-web-components';

ICEMessage.success(ice, '已保存');        // 顶部居中的轻提示（自动消失）
ICEMessage.show(ice, '同步中…', { type: 'loading', duration: 0 });
ICENotification.open(ice, { title: '导出完成', description: 'reports.csv 已生成' });
```

## 测试

浮层相关逻辑在 node 环境可测：现有的测试用「假 ICE + 真 `ICEOverlayManager`」验证位置、
关闭原因（`outside` / `esc` / `mask` / `api`）、动画帧推进（注入 frame driver）。
见 `tests/ICEModal.test.ts`、`tests/ICEDrawer.test.ts`、`tests/ICEOverlay.test.ts`、`tests/ICEPopover.test.ts`。
