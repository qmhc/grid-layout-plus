---
aside: false
pageClass: demo-page
---

# Prevent Collision

With `collision-mode="prevent"`, a move or resize stops when the candidate would overlap another item. Add `noCompactor` when fixed obstacles and nearby items must all stay in place.

**Try it:** Drag or resize a movable item toward item 1. The operation is rejected before either item changes position.

<DemoFrame>
<ClientOnly>
  <DemoPreventCollision></DemoPreventCollision>
</ClientOnly>
  <template #minimal-source>

<<< @/snippets/prevent-collision.vue

  </template>
  <template #source>

<<< @/demos/prevent-collision.vue

  </template>
</DemoFrame>
