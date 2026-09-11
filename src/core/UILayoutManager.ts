export interface UILayoutManager {
  layoutContainer(container: any): void;
  getPreferredSize?(container: any): [number, number];
  getMinimumSize?(container: any): [number, number];
}
