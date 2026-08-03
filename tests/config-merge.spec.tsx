import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, onErrorCaptured, ref } from 'vue'

import { GridLayout, useGridLayout } from '../src'
import { horizontalCompactor } from '../src/core/compactors'
import { absoluteStrategy, transformStrategy } from '../src/core/position-strategies'

import type { Layout } from '../src/helpers/types'

const baseLayout: Layout = [{ x: 0, y: 0, w: 2, h: 2, i: '0' }]

describe('Config 合并逻辑（需求 8.5, 8.6）', () => {
  it('扁平 props 优先级高于分组 gridConfig', () => {
    const wrapper = mount(GridLayout, {
      props: {
        layout: baseLayout,
        colNum: 6,
        gridConfig: { colNum: 10 },
      },
    })

    const vm = wrapper.vm as any
    expect(vm.effectiveConfig.colNum).toBe(6)
    wrapper.unmount()
  })

  it('autoHeight 遵循扁平 props 优先于 gridConfig 的规则', () => {
    const wrapper = mount(GridLayout, {
      props: {
        layout: baseLayout,
        autoHeight: false,
        gridConfig: { autoHeight: true },
      },
    })

    expect((wrapper.vm as any).effectiveConfig.autoHeight).toBe(false)
    wrapper.unmount()

    const grouped = mount(GridLayout, {
      props: {
        layout: baseLayout,
        gridConfig: { autoHeight: true },
      },
    })
    expect((grouped.vm as any).effectiveConfig.autoHeight).toBe(true)
    grouped.unmount()
  })

  it('扁平 props 优先级高于分组 dragConfig', () => {
    const wrapper = mount(GridLayout, {
      props: {
        layout: baseLayout,
        isDraggable: false,
        dragConfig: { isDraggable: true },
      },
    })

    const vm = wrapper.vm as any
    expect(vm.effectiveConfig.isDraggable).toBe(false)
    wrapper.unmount()
  })

  it('扁平 props 优先级高于分组 resizeConfig', () => {
    const wrapper = mount(GridLayout, {
      props: {
        layout: baseLayout,
        isResizable: false,
        resizeConfig: { isResizable: true },
      },
    })

    const vm = wrapper.vm as any
    expect(vm.effectiveConfig.isResizable).toBe(false)
    wrapper.unmount()
  })

  it('扁平 props 优先级高于分组 dropConfig', () => {
    const wrapper = mount(GridLayout, {
      props: {
        layout: baseLayout,
        isDroppable: true,
        dropConfig: { isDroppable: false },
      },
    })

    const vm = wrapper.vm as any
    expect(vm.effectiveConfig.isDroppable).toBe(true)
    wrapper.unmount()
  })

  it('仅传分组 config 时正确生效（gridConfig）', () => {
    const wrapper = mount(GridLayout, {
      props: {
        layout: baseLayout,
        gridConfig: { rowHeight: 200 },
      },
    })

    const vm = wrapper.vm as any
    // 扁平 prop 未传入，分组 config 生效
    expect(vm.effectiveConfig.rowHeight).toBe(200)
    expect(vm.$props.gridConfig).toEqual({ rowHeight: 200 })
    wrapper.unmount()
  })

  it('两者都不传时使用默认值', () => {
    const wrapper = mount(GridLayout, {
      props: {
        layout: baseLayout,
      },
    })

    const vm = wrapper.vm as any
    expect(vm.effectiveConfig.colNum).toBe(12)
    expect(vm.effectiveConfig.autoHeight).toBe(false)
    expect(vm.effectiveConfig.rowHeight).toBe(150)
    expect(vm.effectiveConfig.isDraggable).toBe(true)
    expect(vm.effectiveConfig.isResizable).toBe(true)
    expect(vm.effectiveConfig.isDroppable).toBe(false)
    expect(vm.effectiveConfig.dragThreshold).toBe(0)
    expect(vm.effectiveConfig.restoreOnDrag).toBe(false)
    wrapper.unmount()
  })

  it('GridLayout 与 headless 使用相同 Compactor 方向语义', async () => {
    const layout: Layout = [
      { x: 0, y: 0, w: 1, h: 1, i: '1' },
      { x: 1, y: 0, w: 1, h: 1, i: '2' },
    ]
    const headless = useGridLayout({
      layout: layout.map(item => ({ ...item })),
      cols: 12,
      compactor: horizontalCompactor,
    })
    const expected = headless.moveItem('1', 1, 0)
    const wrapper = mount(GridLayout, {
      props: {
        layout,
        compactor: horizontalCompactor,
        isDraggable: true,
      },
    })

    await nextTick()
    await nextTick()
    const vm = wrapper.vm as any
    vm.dragEvent('dragstart', '1', 1, 0, 1, 1)

    expect(expected.status).toBe('unchanged')
    expect(layout).toEqual(expected.layout)
    wrapper.unmount()
  })

  it('restoreOnDrag 默认预览 Compactor，flat/grouped true 显式固定 active', async () => {
    const cases = [
      { label: 'default', props: {}, expectedStatic: undefined },
      { label: 'flat true', props: { restoreOnDrag: true }, expectedStatic: true },
      {
        label: 'grouped true',
        props: { dragConfig: { restoreOnDrag: true } },
        expectedStatic: true,
      },
    ] as const

    for (const testCase of cases) {
      const compact = vi.fn((layout: Layout) => layout.map(item => ({ ...item })))
      const wrapper = mount(GridLayout, {
        props: {
          layout: [
            { x: 0, y: 0, w: 1, h: 1, i: '1' },
            { x: 1, y: 0, w: 1, h: 1, i: '2' },
          ],
          compactor: { compact },
          isDraggable: true,
          ...testCase.props,
        },
      })

      await nextTick()
      await nextTick()
      const callCount = compact.mock.calls.length
      const vm = wrapper.vm as any
      vm.dragEvent('dragstart', '1', 1, 0, 1, 1)

      expect(compact.mock.calls.length, testCase.label).toBeGreaterThan(callCount)
      expect(
        compact.mock.calls.at(-1)?.[0].find(item => item.i === '1')?.static,
        testCase.label,
      ).toBe(testCase.expectedStatic)
      wrapper.unmount()
    }
  })

  it('运行时切换 positionStrategy 会立即重算 GridItem 样式', async () => {
    const wrapper = mount(GridLayout, {
      props: {
        layout: baseLayout,
        positionStrategy: transformStrategy,
        width: 1200,
      },
      slots: {
        item: ({ item }: { item: { i: string | number } }) => h('span', String(item.i)),
      },
      attachTo: document.body,
    })

    await nextTick()
    await nextTick()

    const item = wrapper.find('.vgl-item:not(.vgl-item--placeholder)')
    expect(item.attributes('style')).toContain('transform:')

    await wrapper.setProps({ positionStrategy: absoluteStrategy })
    await nextTick()
    await nextTick()

    expect(item.attributes('style')).not.toContain('transform:')
    expect(item.attributes('style')).toContain('left:')
    wrapper.unmount()
  })

  it('style preflight 将派生几何溢出归类为 geometry，而不是 PositionStrategy', async () => {
    const errors: Array<Record<string, unknown>> = []
    const rejected: Array<Record<string, unknown>> = []
    const terminals: Array<Record<string, unknown>> = []
    const wrapper = mount(GridLayout, {
      props: {
        layout: [{ i: 'geometry', x: 0, y: 0, w: 1, h: 1 }],
        width: Number.MAX_VALUE,
        containerPadding: [Number.MAX_VALUE, 0],
        onError: error => errors.push(error as unknown as Record<string, unknown>),
        onOperationRejected: payload =>
          rejected.push(payload as unknown as Record<string, unknown>),
        onInteractionEnd: payload => terminals.push(payload as unknown as Record<string, unknown>),
      },
      slots: {
        item: ({ item }: { item: { i: string | number } }) => h('span', String(item.i)),
      },
    })
    await nextTick()
    await nextTick()
    await nextTick()

    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatchObject({
      code: 'derived-geometry-overflow',
      source: 'geometry',
      path: 'geometry.containerPadding[0]',
      revision: null,
    })
    expect((errors[0].cause as { name?: unknown })?.name).toBe('GridLayoutValidationError')
    expect(rejected).toHaveLength(0)
    expect(terminals).toHaveLength(0)
    expect(
      wrapper.find('.vgl-item:not(.vgl-item--placeholder)').attributes('style') ?? '',
    ).not.toContain('transform:')

    wrapper.unmount()
  })

  it('active style preflight 几何失败共享 evaluationId 并以 geometry-error 终止', async () => {
    const errors: Array<Record<string, unknown>> = []
    const rejected: Array<Record<string, unknown>> = []
    const terminals: Array<Record<string, unknown>> = []
    const layout: Layout = [{ i: 'geometry', x: 0, y: 0, w: 1, h: 1 }]
    const wrapper = mount(GridLayout, {
      props: {
        layout,
        width: Number.MAX_VALUE,
        containerPadding: [10, 10],
        onError: error => errors.push(error as unknown as Record<string, unknown>),
        onOperationRejected: payload =>
          rejected.push(payload as unknown as Record<string, unknown>),
        onInteractionEnd: payload => terminals.push(payload as unknown as Record<string, unknown>),
      },
    })
    await nextTick()
    await nextTick()
    await nextTick()

    const vm = wrapper.vm as any
    vm.dragEvent('dragstart', 'geometry', 0, 0, 1, 1)
    await wrapper.setProps({ containerPadding: [Number.MAX_VALUE, 0] })
    await nextTick()
    await nextTick()
    await nextTick()

    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatchObject({
      code: 'derived-geometry-overflow',
      source: 'geometry',
      path: 'geometry.containerPadding[0]',
    })
    expect(rejected).toHaveLength(1)
    expect(rejected[0]).toMatchObject({
      operation: 'config',
      reason: 'invalid-input',
      layout,
    })
    expect(rejected[0].evaluationId).toBe(errors[0].evaluationId)
    expect(terminals).toHaveLength(1)
    expect(terminals[0]).toMatchObject({
      status: 'cancelled',
      reason: 'geometry-error',
      layout,
    })

    wrapper.unmount()
  })

  it('动态 width 派生几何失败后不向子组件传播无效宽度', async () => {
    const errors: Array<Record<string, unknown>> = []
    const rejected: Array<Record<string, unknown>> = []
    const terminals: Array<Record<string, unknown>> = []
    const capturedErrors: unknown[] = []
    const width = ref(800)
    const layout: Layout = [{ i: 'geometry', x: 0, y: 0, w: 2, h: 1 }]
    const Host = defineComponent({
      setup() {
        onErrorCaptured(error => {
          capturedErrors.push(error)
          return false
        })

        return () =>
          h(
            GridLayout,
            {
              layout,
              width: width.value,
              onError: (error: unknown) => errors.push(error as unknown as Record<string, unknown>),
              onOperationRejected: (payload: unknown) =>
                rejected.push(payload as unknown as Record<string, unknown>),
              onInteractionEnd: (payload: unknown) =>
                terminals.push(payload as unknown as Record<string, unknown>),
            },
            {
              item: ({ item }: { item: { i: string | number } }) => h('span', String(item.i)),
            },
          )
      },
    })
    const wrapper = mount(Host)
    await nextTick()
    await nextTick()
    await nextTick()

    const grid = wrapper.findComponent(GridLayout)
    const item = wrapper.find('.vgl-item:not(.vgl-item--placeholder)')
    const validStyle = item.attributes('style')
    ;(grid.vm as any).dragEvent('dragstart', 'geometry', 0, 0, 1, 2)
    width.value = Number.MAX_VALUE
    await nextTick()
    await nextTick()
    await nextTick()

    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatchObject({
      code: 'derived-geometry-overflow',
      source: 'geometry',
      path: 'layoutItem.w',
    })
    expect(rejected).toHaveLength(1)
    expect(rejected[0]).toMatchObject({
      operation: 'config',
      reason: 'invalid-input',
      layout,
    })
    expect(rejected[0].evaluationId).toBe(errors[0].evaluationId)
    expect(terminals).toHaveLength(1)
    expect(terminals[0]).toMatchObject({
      status: 'cancelled',
      reason: 'geometry-error',
      layout,
    })
    expect(capturedErrors).toEqual([])
    expect(item.attributes('style')).toBe(validStyle)

    wrapper.unmount()
  })
})
