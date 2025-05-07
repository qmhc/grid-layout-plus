# Responsive

Since enabling responsive will create new layout object inside the component, the layout data passed via `v-model` must be defined using `ref` (not `reactive`), otherwise synchronization will not work.

## Effect

<ClientOnly>
  <DemoResponsive></DemoResponsive>
</ClientOnly>

## Source

<<< @/demos/responsive.vue
