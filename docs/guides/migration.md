# 迁移说明（破坏性变更）

本项目处在快速演进阶段，下面是已经发生过的破坏性变更与替代写法。

## 1. 所有组件从 `UI*` 改名为 `ICE*`

```ts
// 之前
import { UIButton, UILabel, UIManager, uiManager } from 'ice-web-components';
// 之后
import { ICEButton, ICELabel, ICEUIManager, iceUIManager } from 'ice-web-components';
```

命名规则：`UI` + 大写字母或 `_` 一律替换为 `ICE`
（`UI_LIGHT_THEME` → `ICE_LIGHT_THEME`、`getUIOverlayManager` → `getICEOverlayManager`）。
文件也同名重命名（`src/components/UIButton.ts` → `ICEButton.ts`）。

## 2. 与引擎同名的两个类避开了

引擎也有 `ICEComponent` / `ICEImage`，为避免“同名不同物”，本库改成：

| 之前 | 现在 | 说明 |
|---|---|---|
| `UIComponent` → `ICEComponent` | **`ICEWidget`** | UI 组件基类（继承引擎 `ICEGroup`） |
| `UIImage` → `ICEImage` | **`ICEImageView`** | 图片**控件**（引擎的 `ICEImage` 是图片原语） |

实例数据用 `ICEComponent` 表示“任意组件”的地方，改成 `ICEWidget`。

## 3. 布局类不再从本库导出

```ts
// 之前
import { ICEBoxLayout, ICEFlowLayout } from 'ice-web-components';
// 之后：它们属于引擎
import { ICEBoxLayout, ICEFlowLayout } from 'ice-render';
```

`ICELayoutManager` 也是引擎的类型。这样本包的运行时导出与引擎**完全不重叠**（有回归测试守着），
两个包可以随便一起 import。

## 4. `setUILayout` → `setLayout`

```ts
panel.setLayout(new ICEFlowLayout({ gap: 8 }));   // 对齐引擎 ICEGroup.setLayout，可链式
```

## 5. 主题从 业界组件库 换到 Bootstrap 5

* 语义色换成 Bootstrap 取值：`primary #0d6efd`、`success #198754`、`warning #ffc107`、
  `error #dc3545`、`info #0dcaf0`；
* 新增 `*TextEmphasis` 强调文字色（浅底文字必须用它，亮黄色当文字读不出来）；
* `shadows` 从“引擎预设名”改成显式的 `shadowColor/shadowBlur/shadowOffset*` 数值；
* 新增 `focusRing`（`#86b7fe`），焦点环与输入框聚焦边框改用它；
* 遮罩从 `rgba(0,0,0,0.45)` 调整为 `0.5`（Bootstrap 的 backdrop 不透明度）。

## 6. `ICETag` / `ICEBadge` 默认变成实底

```ts
new ICETag({ text: 'Paid', status: 'success' });                  // 实底（新默认）
new ICETag({ text: 'Paid', status: 'success', variant: 'soft' }); // 旧观感
```

## 7. 其他小改动

| 变更 | 说明 |
|---|---|
| `ICEModal` 新增 `closeOnConfirm` | 默认仍是“确定后自动关”；异步校验场景传 `false`，自己调 `close()` |
| `ICETabs` 新增 `onChange` / `getTabs` | 之前只有 `activeIndex`，无法驱动界面切换 |
| `ICEAutoComplete` 候选超过一屏 | 改为套滚动视口（之前多出的候选会画到面板外） |
| Tooltip / Dropdown 面板宽度 | 改为按文字估算（中文按 1em），长中文不再压出色块 |
| 组件统一转发 `id` | 之前 28 个组件在 `super()` 里丢掉了调用方传的 `id` |
| `ICEDescriptions` / `ICETimeline` 新增 `setItems` | 支持内容随选中项变化（含高度重算） |
