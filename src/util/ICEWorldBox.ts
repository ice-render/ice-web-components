/**
 * UI 组件的世界盒（`left/top/width/height`）。
 *
 * UI 组件不旋转，父子关系就是简单的偏移叠加：沿父链累加 left/top 即可，
 * 不依赖引擎的 composedMatrix 是否新鲜（浮层定位、焦点环、命中范围判断都要用）。
 */
export interface ICEWorldBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function getICEWorldBox(component: any): ICEWorldBox {
  let left = 0;
  let top = 0;
  let node = component;
  while (node && node.state) {
    left += Number(node.state.left) || 0;
    top += Number(node.state.top) || 0;
    node = node.parentNode;
  }
  return {
    left,
    top,
    width: Number(component && component.state && component.state.width) || 0,
    height: Number(component && component.state && component.state.height) || 0,
  };
}

export function isPointInsideICEBox(box: ICEWorldBox, x: number, y: number): boolean {
  return x >= box.left && x <= box.left + box.width && y >= box.top && y <= box.top + box.height;
}
