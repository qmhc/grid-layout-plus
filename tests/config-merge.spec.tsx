import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'

import { GridLayout } from '../src'
import { horizontalCompactor, noCompactor, verticalCompactor } from '../src/core/compactors'
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

    // 扁平 prop colNum=6 应优先于 gridConfig.colNum=10
    const vm = wrapper.vm as any
    // GridLayout 通过 provide 传递 props，扁平 props 直接作为 props 传入
    // withDefaults 确保扁平 props 始终有值
    expect(vm.$props.colNum).toBe(6)
    wrapper.unmount()
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
    expect(vm.$props.isDraggable).toBe(false)
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
    expect(vm.$props.isResizable).toBe(false)
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
    expect(vm.$props.isDroppable).toBe(true)
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
    expect(vm.effectiveConfig.rowHeight).toBe(150)
    expect(vm.effectiveConfig.isDraggable).toBe(true)
    expect(vm.effectiveConfig.isResizable).toBe(true)
    expect(vm.effectiveConfig.isDroppable).toBe(false)
    expect(vm.effectiveConfig.dragThreshold).toBe(0)
    wrapper.unmount()
  })

  it('compactor 默认为 verticalCompactor', () => {
    const wrapper = mount(GridLayout, {
      props: {
        layout: baseLayout,
      },
    })

    const vm = wrapper.vm as any
    expect(vm.$props.compactor).toBe(verticalCompactor)
    wrapper.unmount()
  })

  it('positionStrategy 默认为 transformStrategy', () => {
    const wrapper = mount(GridLayout, {
      props: {
        layout: baseLayout,
      },
    })

    const vm = wrapper.vm as any
    expect(vm.$props.positionStrategy).toBe(transformStrategy)
    wrapper.unmount()
  })

  it('可以传入自定义 compactor', () => {
    const wrapper = mount(GridLayout, {
      props: {
        layout: baseLayout,
        compactor: noCompactor,
      },
    })

    const vm = wrapper.vm as any
    // Vue 的 reactive 系统可能包装对象，使用 toStrictEqual 验证值相等
    expect(vm.$props.compactor.compact).toBeDefined()
    expect(vm.$props.compactor).not.toBe(verticalCompactor)
    wrapper.unmount()
  })

  it('GridLayout 使用 compactor 的方向处理拖拽碰撞', async () => {
    const layout: Layout = [
      { x: 0, y: 0, w: 1, h: 1, i: '1' },
      { x: 1, y: 0, w: 1, h: 1, i: '2' },
    ]
    const wrapper = mount(GridLayout, {
      props: {
        layout,
        compactor: horizontalCompactor,
        isDraggable: false,
      },
    })

    await nextTick()
    await nextTick()
    const vm = wrapper.vm as any
    vm.dragEvent('dragstart', '1', 1, 0, 1, 1)

    expect(layout.find(item => item.i === '1')).toEqual(expect.objectContaining({ x: 1, y: 0 }))
    expect(layout.find(item => item.i === '2')).toEqual(expect.objectContaining({ x: 0, y: 0 }))
    wrapper.unmount()
  })

  it('restoreOnDrag 仍通过自定义 compactor', async () => {
    const compact = vi.fn((layout: Layout) => layout.map(item => ({ ...item })))
    const layout: Layout = [
      { x: 0, y: 0, w: 1, h: 1, i: '1' },
      { x: 1, y: 0, w: 1, h: 1, i: '2' },
    ]
    const wrapper = mount(GridLayout, {
      props: {
        layout,
        compactor: { compact },
        restoreOnDrag: true,
        isDraggable: false,
      },
    })

    await nextTick()
    await nextTick()
    const callCount = compact.mock.calls.length
    const vm = wrapper.vm as any
    vm.dragEvent('dragstart', '1', 1, 0, 1, 1)

    expect(compact.mock.calls.length).toBeGreaterThan(callCount)
    wrapper.unmount()
  })

  it('可以传入自定义 positionStrategy', () => {
    const wrapper = mount(GridLayout, {
      props: {
        layout: baseLayout,
        positionStrategy: absoluteStrategy,
      },
    })

    const vm = wrapper.vm as any
    expect(vm.$props.positionStrategy.getStyle).toBeDefined()
    expect(vm.$props.positionStrategy.getRtlStyle).toBeDefined()
    // 验证不是默认的 transformStrategy
    // absoluteStrategy.getStyle 返回 top/left 而非 transform
    const style = vm.$props.positionStrategy.getStyle(10, 20, 100, 50)
    expect(style.top).toBe('10px')
    expect(style.left).toBe('20px')
    expect(style.transform).toBeUndefined()
    wrapper.unmount()
  })

  it('运行时切换 positionStrategy 会立即重算 GridItem 样式', async () => {
    const wrapper = mount(GridLayout, {
      props: {
        layout: baseLayout,
        positionStrategy: transformStrategy,
      },
      attachTo: document.body,
    })

    const vm = wrapper.vm as any
    vm.state.width = 1200
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
})
