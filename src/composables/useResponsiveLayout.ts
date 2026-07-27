import { computed, ref, watch } from 'vue'

import { verticalCompactor } from '../core/compactors'
import {
  findOrGenerateResponsiveLayout,
  getBreakpointFromWidth,
  getColsFromBreakpoint,
} from '../helpers/responsive'

import type { Ref } from 'vue'
import type {
  Breakpoint,
  Breakpoints,
  CollisionMode,
  Compactor,
  Layout,
  ResponsiveLayout,
} from '../helpers/types'

export interface UseResponsiveLayoutOptions {
  breakpoints: Breakpoints
  cols: Breakpoints
  width: Ref<number>
  layouts: Ref<Partial<ResponsiveLayout>>
  compactor?: Compactor
  collisionMode?: CollisionMode
  originalLayout: Ref<Layout>
}

export interface UseResponsiveLayoutReturn {
  currentBreakpoint: Ref<Breakpoint>
  currentCols: Ref<number>
  currentLayout: Ref<Layout>
}

/**
 * 响应式断点管理 composable。
 * 不依赖浏览器 DOM API，可在 SSR 环境中使用。
 *
 * @param options 配置参数
 * @returns 响应式断点、列数和布局
 */
export function useResponsiveLayout(
  options: UseResponsiveLayoutOptions,
): UseResponsiveLayoutReturn {
  const {
    breakpoints,
    cols,
    width,
    layouts,
    compactor: comp = verticalCompactor,
    collisionMode,
    originalLayout,
  } = options
  const allowOverlap = collisionMode === 'overlap' || (!collisionMode && comp.allowOverlap === true)

  const currentBreakpoint = ref<Breakpoint>(getBreakpointFromWidth(breakpoints, width.value))

  const currentCols = computed(() => getColsFromBreakpoint(currentBreakpoint.value, cols))

  const currentLayout = ref<Layout>(
    findOrGenerateResponsiveLayout(
      originalLayout.value,
      layouts.value as ResponsiveLayout,
      breakpoints,
      currentBreakpoint.value,
      currentBreakpoint.value,
      currentCols.value,
      comp,
      allowOverlap,
    ),
  )

  watch(width, newWidth => {
    const newBp = getBreakpointFromWidth(breakpoints, newWidth)

    if (newBp !== currentBreakpoint.value) {
      // 保存当前断点的布局到缓存
      layouts.value = {
        ...layouts.value,
        [currentBreakpoint.value]: currentLayout.value,
      }

      const lastBp = currentBreakpoint.value
      currentBreakpoint.value = newBp

      const newCols = getColsFromBreakpoint(newBp, cols)

      // 查找或生成新断点的布局，使用 compactor 进行压缩
      const generated = findOrGenerateResponsiveLayout(
        originalLayout.value,
        layouts.value as ResponsiveLayout,
        breakpoints,
        newBp,
        lastBp,
        newCols,
        comp,
        allowOverlap,
      )

      currentLayout.value = generated
    }
  })

  return {
    currentBreakpoint,
    currentCols,
    currentLayout,
  }
}
