/**
 * 流式布局：直接复用引擎实现。
 *
 * 本库不再包一层空子类 —— 引擎（ice-render）导出的 `ICEFlowLayout` 就是同一套策略，
 * 直接再导出可以避免「同一个 ICE 前缀名字在两个包里是两个不同的类」这种坑。
 */
export { ICEFlowLayout } from 'ice-render';
