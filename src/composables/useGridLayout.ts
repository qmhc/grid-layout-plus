import { computed, isRef, ref, watch } from 'vue'

import { cloneLayout, correctBounds, getLayoutItem, moveElement } from '../helpers/common'
import { verticalCompactor } from '../core/compactors'

import type { Ref } from 'vue'
import type { Compactor, Layout, LayoutItem } from '../helpers/types'

export interface UseGridLayoutOptions {
  layout: Ref<Layout> | Layout
  cols?: number
  rowHeight?: number
  compactor?: Compactor
  preventCollision?: boolean
}

export interface UseGridLayoutReturn {
  currentLayout: Ref<Layout>
  moveItem: (i: number | string, x: number, y: number) => void
  resizeItem: (i: number | string, w: number, h: number) => void
  addItem: (item: LayoutItem) => void
  removeItem: (i: number | string) => void
}

/**
 * 核心布局状态管理 composable。
 * 不依赖浏览器 DOM API，可在 SSR 环境中使用。
 *
 * @param options 配置参数
 * @returns 响应式布局状态和操作方法
 */
export function useGridLayout(options: UseGridLayoutOptions): UseGridLayoutReturn {
  const { cols = 12, compactor: comp = verticalCompactor, preventCollision = false } = options

  const layoutSource = isRef(options.layout) ? options.layout : ref(options.layout)

  /** 内部原始布局（操作直接修改此数组） */
  const rawLayout = ref<Layout>(cloneLayout(layoutSource.value))

  /** 经过压缩后的当前布局 */
  const currentLayout = computed(() => {
    return comp.compact(correctBounds(cloneLayout(rawLayout.value), { cols }), cols)
  })

  // 当外部 layout 引用变化时，同步更新内部布局
  watch(layoutSource, newLayout => {
    rawLayout.value = cloneLayout(newLayout)
  })

  function moveItem(i: number | string, x: number, y: number): void {
    const layout = cloneLayout(rawLayout.value)
    const item = getLayoutItem(layout, i)
    if (!item) return
    moveElement(layout, item, x, y, true, preventCollision, comp.type ?? 'vertical')
    rawLayout.value = layout
  }

  function resizeItem(i: number | string, w: number, h: number): void {
    const layout = cloneLayout(rawLayout.value)
    const item = getLayoutItem(layout, i)
    if (!item) return
    item.w = w
    item.h = h
    rawLayout.value = layout
  }

  function addItem(item: LayoutItem): void {
    const layout = cloneLayout(rawLayout.value)
    layout.push({ ...item })
    rawLayout.value = layout
  }

  function removeItem(i: number | string): void {
    const layout = cloneLayout(rawLayout.value)
    const idx = layout.findIndex(l => l.i === i)
    if (idx === -1) return
    layout.splice(idx, 1)
    rawLayout.value = layout
  }

  return {
    currentLayout,
    moveItem,
    resizeItem,
    addItem,
    removeItem,
  }
}
