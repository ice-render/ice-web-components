# 画布内布局

## 坐标从哪来

组件的 `left` / `top` 是**相对父容器**的偏移，`state.width/height` 是自己的盒子。
渲染与命中都按这个盒子来，所以“位置算错”通常就是盒子算错。

引擎提供两种现成的排布方式：

```ts
import { ICEFlowLayout, ICEBoxLayout } from 'ice-render';   // 属于引擎，不在本库导出

panel.setLayout(new ICEFlowLayout({ gap: 8, align: 'left' }));   // 流式
panel.setLayout(new ICEBoxLayout({ axis: 'y', gap: 12 }));       // 盒式
```

## zIndex 与创建顺序（最常见的坑）

引擎按 `zIndex` **全局**排序渲染，而 `zIndex` 默认取**创建顺序**。所以：

* 正确顺序：**先建容器，再建子组件**；
* 反例：`new ICEPanel()` 之前先 `new ICEButton()`（比如把按钮当参数传进面板），
  按钮的 zIndex 更低 → 被面板底色整块盖住，表现为「组件不见了」。

确实需要「先有子组件」的场景（调用方传入的节点、轮播幻灯片、卡片 `extra`、弹窗内容），
做法是把**整棵子树统一抬到容器之上**：

```ts
const raise = (node: any, z: number) => {
  if (!node || !node.state) return;
  node.state.zIndex = z;
  (node.childNodes || []).forEach((child: any) => raise(child, z));
};
raise(callerProvidedNode, (Number(panel.state.zIndex) || 0) + 1);
```

> 用**同一个值**是有讲究的：同 zIndex 内按树的“先父后子”顺序绘制；逐个分配不同值反而会把子节点压到父节点下面。

## 示例页里的“簇 + 货架”流式布局

两个示例页都用了一段手写布局（约 60 行），思路是把页面拆成 **cluster**：

* cluster = 一组「必须贴在一起」的组件（「输入框 + 它的提示文字」「图片 + 图注」）；
* cluster **内部保持相对位置**（作者按局部坐标写，整体平移）；
* cluster 之间按“货架”排：优先回填到还放得下的上一行，放不下才换行，行内可顶对齐或垂直居中；
* 度量一个 cluster 的包围盒时**要含后代**（如 Spin 右侧的 tip 文字），
  但遇到 `clipChildren` 容器就以它自身为界（否则轮播里排在屏外的幻灯片会把宽度撑爆）。

```js
// examples/gallery.html / admin.html 里的 flowSections()：可直接抄
flow(node, [
  { title: '筛选', items: [segmented, keywordField, searchButton] },   // 每个 item 一个簇
  { title: '订单列表', items: [table, pagination] },
]);
```

两个实践细节：

1. 宽度比较留 **2~3px 容差**：文字实测宽度常比标称宽零点几像素，恰好铺满时会莫名换行；
2. 内容会变的组件（时间轴、描述列表）首帧后才算出高度 —— 布局函数写成**幂等**的，
   首帧渲染后再跑一次即可（示例页用 `requestAnimationFrame` 跑第二遍）。

## 裁剪与滚动

`ICEScrollPane` 是画布里的滚动视口：内容超出视口的部分靠引擎的 `clipChildren` 裁掉，
滚出去的子组件也命不中。

```ts
const pane = new ICEScrollPane({ width: 300, height: 120, scrollbar: true });
pane.setContent(contentNode);                 // 内容尺寸自动跟随该节点
pane.setScroll(0, 40); pane.scrollBy(0, 20);  // 程序式滚动（滚轮也支持）
```

需要「浮层/预览被容器裁掉」的效果，直接给容器 `clipChildren: true` 也行
（`ICEImageView` 的 cover 裁剪就是这么做的）。

## 尺寸什么时候才准

* 组件在**构造结束**时就应该有正确的 `state.width/height`（本库的约定）；
* 例外是要靠 ctx 量文本的（`ICETable` 的单元格对齐、`ICELabel` 未显式给宽时），
  它们会在首次渲染后再校正一次；
* 因此在“构造后立刻测量”的场景（流式布局、截图脚本），最好在**首帧之后**再量一遍。
