import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, reactive, ref, shallowRef } from 'vue'

import { GridLayout } from '../src'

import type {
  CompleteResponsiveLayouts,
  Layout,
  ReadonlyLayout,
  ResponsiveLayoutsInput,
} from '../src/helpers/types'
import type {
  GridLayoutRuntimeError,
  OperationRejectedPayload,
} from '../src/composables/useGridLayout'
import type { DefineComponent } from 'vue'
import type {
  GridLayoutExpose,
  GridLayoutProps,
  WidthChangedPayload,
} from '../src/components/types'

const MobileGridLayout = GridLayout as unknown as DefineComponent<GridLayoutProps<'mobile'>>
const OpenBreakpointGridLayout = GridLayout as unknown as DefineComponent<GridLayoutProps<string>>

async function flushUpdates(count = 6): Promise<void> {
  for (let index = 0; index < count; index++) await nextTick()
}

describe('Phase 3 review regressions', () => {
  it('unresolved responsive 延后 Compactor 到真实 width 解析', async () => {
    const compact = vi.fn(() => {
      throw new Error('responsive compactor failed')
    })
    const errors: GridLayoutRuntimeError[] = []
    const rejected: Array<{ operation: string; reason: string }> = []
    const input: Layout = [{ i: 'item', x: 20, y: 3, w: 1, h: 1 }]
    const responsiveProps = {
      layout: input,
      responsive: true,
      breakpoints: { mobile: 0 },
      cols: { mobile: 24 },
      compactor: { type: 'vertical' as const, compact },
    }
    const wrapper = mount(MobileGridLayout, {
      props: {
        ...responsiveProps,
        onError: (error: GridLayoutRuntimeError) => errors.push(error),
        onOperationRejected: (payload: OperationRejectedPayload) => rejected.push(payload),
      },
    })

    await flushUpdates()
    expect(compact).not.toHaveBeenCalled()
    expect(wrapper.emitted('layout-before-mount')?.[0]?.[0]).toEqual(input)
    const unresolved = wrapper.vm as unknown as GridLayoutExpose
    const unresolvedResults = [
      unresolved.setLayout([{ i: 'item', x: 1, y: 0, w: 1, h: 1 }]),
      unresolved.moveItem('item', 21, 3),
      unresolved.removeItem(''),
    ]
    const expectedIds = [null, 'item', null]
    const rejectedEvents = wrapper.emitted('operation-rejected') ?? []
    for (const [index, result] of unresolvedResults.entries()) {
      expect(result).toMatchObject({
        status: 'rejected',
        reason: 'disabled',
        id: expectedIds[index],
        candidate: null,
      })
      if (result.status !== 'rejected') throw new Error('Expected a rejected command result')
      expect(rejectedEvents[index]?.[0]).toMatchObject({
        operation: result.operation,
        reason: result.reason,
        id: result.id,
        candidate: result.candidate,
        previousLayout: result.previousLayout,
        layout: result.layout,
      })
    }
    expect(wrapper.emitted('update:layout')).toBeUndefined()
    expect(wrapper.emitted('update:responsive-layouts')).toBeUndefined()
    expect(rejectedEvents).toHaveLength(3)
    expect(wrapper.props('layout')).toEqual(input)

    await wrapper.setProps({ width: 400 })
    await flushUpdates(8)

    expect(compact).toHaveBeenCalled()
    expect(errors.at(-1)).toMatchObject({
      code: 'extension-error',
      source: 'compactor',
    })
    expect(rejected.at(-1)).toMatchObject({
      operation: 'config',
      reason: 'extension-error',
    })
    expect(wrapper.emitted('layout-ready')).toHaveLength(1)
    expect(wrapper.props('layout')).toEqual(input)
    wrapper.unmount()

    const width = ref<number>()
    const corrected = ref<Layout>([{ i: 'item', x: 20, y: 3, w: 1, h: 1 }])
    const layouts = ref<ResponsiveLayoutsInput<'mobile'>>({})
    const correctedErrors: GridLayoutRuntimeError[] = []
    const correctedBreakpoints = { mobile: 0 }
    const correctedCols = { mobile: 4 }
    const updateResponsiveLayouts = vi.fn((value: ResponsiveLayoutsInput<'mobile'>) => {
      layouts.value = value
    })
    const Host = defineComponent(
      () => () =>
        h(MobileGridLayout, {
          layout: corrected.value,
          responsive: true,
          width: width.value,
          breakpoints: correctedBreakpoints,
          cols: correctedCols,
          responsiveLayouts: layouts.value,
          'onUpdate:layout': (value: ReadonlyLayout) => {
            corrected.value = value.map(item => ({ ...item }))
          },
          'onUpdate:responsive-layouts': updateResponsiveLayouts,
          onError: (error: GridLayoutRuntimeError) => correctedErrors.push(error),
        }),
    )
    const correctedWrapper = mount(Host)
    await flushUpdates()
    expect(corrected.value[0]).toMatchObject({ x: 20, y: 3 })

    width.value = 400
    await flushUpdates(10)

    expect(updateResponsiveLayouts).toHaveBeenCalled()
    expect(
      correctedErrors.map(error => ({
        code: error.code,
        source: error.source,
        path: error.path,
        cause: error.cause,
      })),
    ).toEqual([])
    expect(corrected.value[0]).toMatchObject({ x: 3, y: 0 })
    const resolved = correctedWrapper.findComponent(GridLayout).vm as unknown as GridLayoutExpose
    expect(resolved.moveItem('item', 2, 0)).toMatchObject({
      status: 'pending',
      proposal: { status: 'accepted' },
    })
    await flushUpdates()
    expect(corrected.value[0]).toMatchObject({ x: 2, y: 0 })
    correctedWrapper.unmount()
  })

  it('创建期校验 dormant，动态字段变化仅更新 error episode 且不调用 Compactor', async () => {
    expect(() =>
      mount(OpenBreakpointGridLayout, {
        props: {
          layout: [],
          responsive: false,
          breakpoints: { mobile: 0 },
          cols: { mobile: 0 },
          responsiveLayouts: {},
        },
      }),
    ).toThrow(
      expect.objectContaining({
        code: 'invalid-config',
        path: 'config.cols["mobile"]',
      }),
    )

    const responsive = ref(false)
    const width = ref(400)
    const breakpoints = reactive({ mobile: 0 })
    const cols = reactive({ mobile: 2 })
    const responsiveLayouts = reactive({
      legacy: [
        { i: 'first', x: 20, y: 0, w: 2, h: 1 },
        { i: 'second', x: 20, y: 0, w: 2, h: 1 },
      ],
    })
    const errors: GridLayoutRuntimeError[] = []
    const widths: WidthChangedPayload[] = []
    const compact = vi.fn((layout: Layout) => layout.map(item => ({ ...item })))
    const Host = defineComponent(
      () => () =>
        h(OpenBreakpointGridLayout, {
          layout: [{ i: 'item', x: 0, y: 0, w: 1, h: 1 }],
          responsive: responsive.value,
          width: width.value,
          breakpoints,
          cols,
          responsiveLayouts,
          compactor: { type: 'vertical' as const, compact },
          onError: (error: GridLayoutRuntimeError) => errors.push(error),
          onWidthChanged: (payload: WidthChangedPayload) => widths.push(payload),
        }),
    )
    const wrapper = mount(Host)
    await flushUpdates()
    const compactCalls = compact.mock.calls.length

    responsiveLayouts.legacy[0].x = 21
    await flushUpdates()
    expect(compact).toHaveBeenCalledTimes(compactCalls)
    expect(errors).toHaveLength(0)

    cols.mobile = 0
    await flushUpdates()
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatchObject({
      code: 'invalid-config',
      source: 'config',
      path: 'config.cols["mobile"]',
      revision: null,
    })

    responsive.value = true
    await flushUpdates()
    expect(errors).toHaveLength(1)

    width.value = 450
    await flushUpdates()
    expect(widths.at(-1)).toMatchObject({ width: 450, responsive: false })

    cols.mobile = 2
    const mutableResponsiveLayouts = responsiveLayouts as Record<string, Layout>
    delete mutableResponsiveLayouts.legacy
    mutableResponsiveLayouts.mobile = [{ i: 'responsive-item', x: 0, y: 0, w: 1, h: 1 }]
    await flushUpdates(8)
    width.value = 500
    await flushUpdates()
    expect(widths.at(-1)).toMatchObject({ width: 500, responsive: true })

    wrapper.unmount()
  })

  it('responsive false→true 在 post-flush 读取 sibling props 的最终快照', async () => {
    type TestBreakpoint = 'legacy' | 'mobile' | 'desktop'
    const TestBreakpointGridLayout = GridLayout as unknown as DefineComponent<
      GridLayoutProps<TestBreakpoint>
    >
    const responsive = ref(false)
    const layout = ref<Layout>([{ i: 'item', x: 0, y: 0, w: 1, h: 1 }])
    const breakpoints = shallowRef<Record<TestBreakpoint, number>>({
      legacy: 0,
      mobile: 0,
      desktop: 800,
    })
    const cols = shallowRef<Record<TestBreakpoint, number>>({
      legacy: 2,
      mobile: 2,
      desktop: 4,
    })
    const layouts = shallowRef<ResponsiveLayoutsInput<TestBreakpoint>>({
      legacy: layout.value,
    })
    const errors: GridLayoutRuntimeError[] = []
    const breakpointsChanged: Array<string | null> = []
    const Host = defineComponent(
      () => () =>
        h(TestBreakpointGridLayout, {
          layout: layout.value,
          responsive: responsive.value,
          width: 400,
          breakpoints: breakpoints.value,
          cols: cols.value,
          responsiveLayouts: layouts.value,
          'onUpdate:layout': (value: ReadonlyLayout) => {
            layout.value = value.map(item => ({ ...item }))
          },
          'onUpdate:responsiveLayouts': (value: CompleteResponsiveLayouts<TestBreakpoint>) => {
            layouts.value = value
          },
          onError: (error: GridLayoutRuntimeError) => errors.push(error),
          onBreakpointChanged: (breakpoint: TestBreakpoint | null) => {
            breakpointsChanged.push(breakpoint)
          },
        }),
    )
    const wrapper = mount(Host)
    const grid = wrapper.findComponent(GridLayout)
    await flushUpdates()

    responsive.value = true
    breakpoints.value = { mobile: 0, desktop: 800, legacy: 1200 }
    cols.value = { mobile: 2, desktop: 4, legacy: 6 }
    layouts.value = { mobile: layout.value }
    await flushUpdates(10)

    expect({
      errors: errors.map(error => ({
        code: error.code,
        path: error.path,
        revision: error.revision,
        source: error.source,
        cause: error.cause,
      })),
      layoutKeys: Object.keys(layouts.value),
      updateCount: grid.emitted('update:responsive-layouts')?.length ?? 0,
    }).toEqual({ errors: [], layoutKeys: ['mobile', 'desktop', 'legacy'], updateCount: 1 })
    expect(breakpointsChanged).toContain('mobile')

    wrapper.unmount()
  })

  it('true→false 预检失败时保留 effective responsive mode', async () => {
    const responsive = ref(true)
    const width = ref(400)
    const layout = ref<Layout>([{ i: 'item', x: 0, y: 0, w: 1, h: 1 }])
    const layouts = ref<ResponsiveLayoutsInput<'mobile'>>({
      mobile: layout.value,
    })
    const errors: GridLayoutRuntimeError[] = []
    const widths: WidthChangedPayload[] = []
    const Host = defineComponent(
      () => () =>
        h(
          MobileGridLayout,
          {
            layout: layout.value,
            responsive: responsive.value,
            colNum: 2,
            width: width.value,
            breakpoints: { mobile: 0 },
            cols: { mobile: 4 },
            responsiveLayouts: layouts.value,
            'onUpdate:layout': (value: ReadonlyLayout) => {
              layout.value = value.map(item => ({ ...item }))
            },
            'onUpdate:responsiveLayouts': (value: CompleteResponsiveLayouts<'mobile'>) => {
              layouts.value = value
            },
            onError: (error: GridLayoutRuntimeError) => errors.push(error),
            onWidthChanged: (payload: WidthChangedPayload) => widths.push(payload),
          },
          {
            item: ({ item }: { item: { i: string | number } }) => h('span', String(item.i)),
          },
        ),
    )
    const wrapper = mount(Host)
    await flushUpdates(8)

    responsive.value = false
    layout.value = [{ i: 'item', x: 3, y: 0, w: 1, h: 1 }]
    await flushUpdates()
    expect(errors.at(-1)).toMatchObject({
      code: 'invalid-layout',
      path: 'layout[0].w',
      revision: null,
    })
    expect(wrapper.find('.vgl-item:not(.vgl-item--placeholder)').attributes('style')).toContain(
      'translate3d(0px, 0px, 0)',
    )
    expect(layouts.value.mobile).toEqual([{ i: 'item', x: 0, y: 0, w: 1, h: 1 }])

    width.value = 500
    await flushUpdates()
    expect(widths.at(-1)).toMatchObject({ width: 500, responsive: true })

    layout.value = [{ i: 'item', x: 0, y: 0, w: 1, h: 1 }]
    await flushUpdates(8)
    width.value = 600
    await flushUpdates()
    expect(widths.at(-1)).toMatchObject({ width: 600, responsive: false })

    wrapper.unmount()
  })

  it('响应式配置预检失败时不部分提交新的 width', async () => {
    const width = ref(400)
    const gap = shallowRef<Record<'mobile', readonly [number, number]>>({ mobile: [10, 10] })
    const layout = ref<Layout>([{ i: 'item', x: 0, y: 0, w: 1, h: 1 }])
    const layouts = ref<ResponsiveLayoutsInput<'mobile'>>({
      mobile: layout.value,
    })
    const widths: WidthChangedPayload[] = []
    const Host = defineComponent(
      () => () =>
        h(MobileGridLayout, {
          layout: layout.value,
          responsive: true,
          width: width.value,
          breakpoints: { mobile: 0 },
          cols: { mobile: 4 },
          gap: gap.value,
          responsiveLayouts: layouts.value,
          'onUpdate:layout': (value: ReadonlyLayout) => {
            layout.value = value.map(item => ({ ...item }))
          },
          'onUpdate:responsiveLayouts': (value: CompleteResponsiveLayouts<'mobile'>) => {
            layouts.value = value
          },
          onWidthChanged: (payload: WidthChangedPayload) => widths.push(payload),
        }),
    )
    const wrapper = mount(Host)
    await flushUpdates(8)
    const initialWidthEvents = widths.length

    gap.value = { mobile: [Number.NaN, 10] }
    width.value = 500
    await flushUpdates()
    expect(widths).toHaveLength(initialWidthEvents)

    gap.value = { mobile: [10, 10] }
    width.value = 600
    await flushUpdates(8)
    expect(widths.at(-1)?.width).toBe(600)
    expect(widths.some(payload => payload.width === 500)).toBe(false)

    wrapper.unmount()
  })
})
