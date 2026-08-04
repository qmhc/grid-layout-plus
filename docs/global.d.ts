export {}

declare module 'vue' {
  interface GlobalComponents {
    GridItem: (typeof import('grid-layout-plus'))['GridItem']
    GridLayout: (typeof import('grid-layout-plus'))['GridLayout']
  }
}
