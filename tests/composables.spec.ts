/**
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'

import { useGridLayout } from '../src/composables/useGridLayout'
import { useResponsiveLayout } from '../src/composables/useResponsiveLayout'
import { horizontalCompactor, noCompactor, verticalCompactor } from '../src/core/compactors'
import {
  getBreakpointFromWidth,
  getColsFromBreakpoint,
} from '../src/helpers/responsive'

import type { Breakpoints, Layout } from '../src/helpers/types'

// ─── useGridLayout ──────────────────────────────────────────

describe('useGridLayout', () => {
  /** 在 effectScope 中运行以支持 onScopeDispose */
  function withScope<T>(fn: () => T): T {
    let result!: T
    const scope = effectScope()
    scope.run(() => {
      result = fn()
    })
    return result
  }

  it('初始化后 currentLayout 为压缩后的布局', () => {
    const layout: Layout = [
      { i: '1', x: 0, y: 2, w: 1, h: 1 },
      { i: '2', x: 1, y: 0, w: 1, h: 1 },
    ]

    const { currentLayout } = withScope(() =>
      useGridLayout({ layout, cols: 12, compactor: verticalCompactor }),
    )

    // 垂直压缩后，元素 '1' 应被向上压缩到 y=0
    const item1 = currentLayout.value.find(l => l.i === '1')!
    expect(item1.y).toBe(0)
  })

  it('使用 noCompactor 时布局位置不变', () => {
    const layout: Layout = [
      { i: '1', x: 0, y: 5, w: 1, h: 1 },
      { i: '2', x: 1, y: 3, w: 1, h: 1 },
    ]

    const { currentLayout } = withScope(() =>
      useGridLayout({ layout, cols: 12, compactor: noCompactor }),
    )

    expect(currentLayout.value.find(l => l.i === '1')!.y).toBe(5)
    expect(currentLayout.value.find(l => l.i === '2')!.y).toBe(3)
  })

  it('moveItem 后布局正确更新并重新压缩', async () => {
    const layout: Layout = [
      { i: '1', x: 0, y: 0, w: 2, h: 1 },
      { i: '2', x: 2, y: 0, w: 2, h: 1 },
    ]

    const { currentLayout, moveItem } = withScope(() =>
      useGridLayout({ layout, cols: 12, compactor: verticalCompactor }),
    )

    moveItem('1', 0, 3)
    await nextTick()

    const item1 = currentLayout.value.find(l => l.i === '1')!
    // 垂直压缩后，移动到 y=3 但上方无障碍物，应被压缩到 y=0
    expect(item1.x).toBe(0)
    expect(item1.y).toBe(0)
  })

  it('resizeItem 后布局正确更新并重新压缩', async () => {
    const layout: Layout = [
      { i: '1', x: 0, y: 0, w: 1, h: 1 },
    ]

    const { currentLayout, resizeItem } = withScope(() =>
      useGridLayout({ layout, cols: 12, compactor: verticalCompactor }),
    )

    resizeItem('1', 4, 3)
    await nextTick()

    const item1 = currentLayout.value.find(l => l.i === '1')!
    expect(item1.w).toBe(4)
    expect(item1.h).toBe(3)
  })


  it('addItem 后元素数量增加 1', async () => {
    const layout: Layout = [
      { i: '1', x: 0, y: 0, w: 1, h: 1 },
    ]

    const { currentLayout, addItem } = withScope(() =>
      useGridLayout({ layout, cols: 12, compactor: verticalCompactor }),
    )

    const before = currentLayout.value.length
    addItem({ i: '2', x: 2, y: 0, w: 1, h: 1 })
    await nextTick()

    expect(currentLayout.value.length).toBe(before + 1)
    expect(currentLayout.value.find(l => l.i === '2')).toBeTruthy()
  })

  it('removeItem 后元素数量减少 1', async () => {
    const layout: Layout = [
      { i: '1', x: 0, y: 0, w: 1, h: 1 },
      { i: '2', x: 1, y: 0, w: 1, h: 1 },
    ]

    const { currentLayout, removeItem } = withScope(() =>
      useGridLayout({ layout, cols: 12, compactor: verticalCompactor }),
    )

    const before = currentLayout.value.length
    removeItem('2')
    await nextTick()

    expect(currentLayout.value.length).toBe(before - 1)
    expect(currentLayout.value.find(l => l.i === '2')).toBeUndefined()
  })

  it('moveItem — id 不存在时静默忽略', async () => {
    const layout: Layout = [
      { i: '1', x: 0, y: 0, w: 1, h: 1 },
    ]

    const { currentLayout, moveItem } = withScope(() =>
      useGridLayout({ layout, cols: 12, compactor: verticalCompactor }),
    )

    const before = JSON.stringify(currentLayout.value)
    moveItem('nonexistent', 5, 5)
    await nextTick()

    expect(JSON.stringify(currentLayout.value)).toBe(before)
  })

  it('removeItem — id 不存在时静默忽略', async () => {
    const layout: Layout = [
      { i: '1', x: 0, y: 0, w: 1, h: 1 },
    ]

    const { currentLayout, removeItem } = withScope(() =>
      useGridLayout({ layout, cols: 12, compactor: verticalCompactor }),
    )

    const before = currentLayout.value.length
    removeItem('nonexistent')
    await nextTick()

    expect(currentLayout.value.length).toBe(before)
  })

  it('外部 layout ref 变化时自动重新压缩', async () => {
    const layoutRef = ref<Layout>([
      { i: '1', x: 0, y: 5, w: 1, h: 1 },
    ])

    const { currentLayout } = withScope(() =>
      useGridLayout({ layout: layoutRef, cols: 12, compactor: verticalCompactor }),
    )

    // 初始压缩后 y 应为 0
    expect(currentLayout.value.find(l => l.i === '1')!.y).toBe(0)

    // 更新外部 ref
    layoutRef.value = [
      { i: '1', x: 0, y: 10, w: 1, h: 1 },
      { i: '2', x: 1, y: 8, w: 1, h: 1 },
    ]
    await nextTick()

    expect(currentLayout.value.length).toBe(2)
    // 两个不重叠的元素，垂直压缩后都应在 y=0
    expect(currentLayout.value.find(l => l.i === '1')!.y).toBe(0)
    expect(currentLayout.value.find(l => l.i === '2')!.y).toBe(0)
  })

  it('使用 horizontalCompactor 时水平压缩生效', () => {
    const layout: Layout = [
      { i: '1', x: 5, y: 0, w: 1, h: 1 },
      { i: '2', x: 3, y: 1, w: 1, h: 1 },
    ]

    const { currentLayout } = withScope(() =>
      useGridLayout({ layout, cols: 12, compactor: horizontalCompactor }),
    )

    // 水平压缩后，元素应向左靠拢
    expect(currentLayout.value.find(l => l.i === '1')!.x).toBe(0)
    expect(currentLayout.value.find(l => l.i === '2')!.x).toBe(0)
  })
})


// ─── useResponsiveLayout ────────────────────────────────────

describe('useResponsiveLayout', () => {
  const breakpoints: Breakpoints = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }
  const cols: Breakpoints = { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }

  function withScope<T>(fn: () => T): T {
    let result!: T
    const scope = effectScope()
    scope.run(() => {
      result = fn()
    })
    return result
  }

  it('不同 width 值对应正确的断点和列数', () => {
    const width = ref(1400)
    const layouts = ref({})
    const originalLayout = ref<Layout>([
      { i: '1', x: 0, y: 0, w: 1, h: 1 },
    ])

    const { currentBreakpoint, currentCols } = withScope(() =>
      useResponsiveLayout({
        breakpoints,
        cols,
        width,
        layouts,
        originalLayout,
      }),
    )

    expect(currentBreakpoint.value).toBe(getBreakpointFromWidth(breakpoints, 1400))
    expect(currentBreakpoint.value).toBe('lg')
    expect(currentCols.value).toBe(getColsFromBreakpoint('lg', cols))
    expect(currentCols.value).toBe(12)
  })

  it('width 变化导致断点切换时布局自动生成', async () => {
    const width = ref(1400)
    const layouts = ref({})
    const originalLayout = ref<Layout>([
      { i: '1', x: 0, y: 0, w: 2, h: 1 },
      { i: '2', x: 2, y: 0, w: 2, h: 1 },
    ])

    const { currentBreakpoint, currentCols, currentLayout } = withScope(() =>
      useResponsiveLayout({
        breakpoints,
        cols,
        width,
        layouts,
        originalLayout,
      }),
    )

    expect(currentBreakpoint.value).toBe('lg')

    // 切换到 sm 断点
    width.value = 800
    await nextTick()

    expect(currentBreakpoint.value).toBe('sm')
    expect(currentCols.value).toBe(6)
    // 布局应该被生成且包含所有元素
    expect(currentLayout.value.length).toBe(2)
  })

  it('切换回已缓存断点时恢复布局', async () => {
    const width = ref(1400)
    const layouts = ref({})
    const originalLayout = ref<Layout>([
      { i: '1', x: 0, y: 0, w: 2, h: 1 },
      { i: '2', x: 2, y: 0, w: 2, h: 1 },
    ])

    const { currentBreakpoint, currentLayout } = withScope(() =>
      useResponsiveLayout({
        breakpoints,
        cols,
        width,
        layouts,
        originalLayout,
      }),
    )

    // 记录 lg 断点的布局
    const lgLayout = JSON.parse(JSON.stringify(currentLayout.value))

    // 切换到 sm
    width.value = 800
    await nextTick()
    expect(currentBreakpoint.value).toBe('sm')

    // lg 布局应被缓存
    expect(layouts.value).toHaveProperty('lg')

    // 切换回 lg
    width.value = 1400
    await nextTick()
    expect(currentBreakpoint.value).toBe('lg')

    // 恢复的布局应与之前的 lg 布局一致（元素 id 和位置）
    for (const item of lgLayout) {
      const restored = currentLayout.value.find((l: any) => l.i === item.i)
      expect(restored).toBeTruthy()
      expect(restored!.x).toBe(item.x)
      expect(restored!.y).toBe(item.y)
      expect(restored!.w).toBe(item.w)
      expect(restored!.h).toBe(item.h)
    }
  })

  it('width 变化但断点不变时不触发布局更新', async () => {
    const width = ref(1400)
    const layouts = ref({})
    const originalLayout = ref<Layout>([
      { i: '1', x: 0, y: 0, w: 1, h: 1 },
    ])

    const { currentBreakpoint, currentLayout } = withScope(() =>
      useResponsiveLayout({
        breakpoints,
        cols,
        width,
        layouts,
        originalLayout,
      }),
    )

    const layoutBefore = currentLayout.value

    // 同一断点内的 width 变化
    width.value = 1300
    await nextTick()

    expect(currentBreakpoint.value).toBe('lg')
    // 布局引用应不变（未触发更新）
    expect(currentLayout.value).toBe(layoutBefore)
  })

  it('多次断点切换后缓存正确累积', async () => {
    const width = ref(1400)
    const layouts = ref({})
    const originalLayout = ref<Layout>([
      { i: '1', x: 0, y: 0, w: 1, h: 1 },
    ])

    const { currentBreakpoint } = withScope(() =>
      useResponsiveLayout({
        breakpoints,
        cols,
        width,
        layouts,
        originalLayout,
      }),
    )

    // lg → sm
    width.value = 800
    await nextTick()
    expect(currentBreakpoint.value).toBe('sm')
    expect(layouts.value).toHaveProperty('lg')

    // sm → xs
    width.value = 500
    await nextTick()
    expect(currentBreakpoint.value).toBe('xs')
    expect(layouts.value).toHaveProperty('sm')

    // 应同时有 lg 和 sm 的缓存
    expect(layouts.value).toHaveProperty('lg')
    expect(layouts.value).toHaveProperty('sm')
  })
})
