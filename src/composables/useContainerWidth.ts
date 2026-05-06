import { onScopeDispose, ref, watch } from 'vue'

import type { Ref } from 'vue'

/**
 * 监听容器元素宽度变化的 composable。
 *
 * @param el 容器元素的响应式引用，为 null 时返回 width = -1
 * @returns 响应式的 width 值
 */
export function useContainerWidth(el: Ref<HTMLElement | null>): { width: Ref<number> } {
  const width = ref(-1)
  let observer: ResizeObserver | null = null

  function cleanup() {
    if (observer) {
      observer.disconnect()
      observer = null
    }
  }

  watch(
    el,
    (newEl) => {
      cleanup()

      if (!newEl) {
        width.value = -1
        return
      }

      observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          width.value = entry.contentRect.width
        }
      })
      observer.observe(newEl)
    },
    { immediate: true },
  )

  onScopeDispose(cleanup)

  return { width }
}
