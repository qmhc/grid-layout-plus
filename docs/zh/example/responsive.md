# 响应式

因为开启 responsive 后组件会创建全新的 layout 对象，所以传入 `v-model` 中的数据需要使用 `ref` 定义（不是 `reactive`），否则将无法同步。

## 效果

<ClientOnly>
  <DemoResponsive></DemoResponsive>
</ClientOnly>

## 源码

<<< @/demos/responsive.vue
