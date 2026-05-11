import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'

import { GridLayout } from '../src'

import type { Layout } from '../src/helpers/types'

const baseLayout: Layout = [
  { x: 0, y: 0, w: 2, h: 2, i: '0' },
]

/**
 * 创建模拟的 DragEvent。
 * happy-dom 对 DragEvent 支持有限，使用 MouseEvent 模拟基本属性。
 */
function createDragEvent(type: string, opts: { clientX?: number, clientY?: number } = {}) {
  const event = new Event(type, { bubbles: true, cancelable: true }) as any
  event.clientX = opts.clientX ?? 100
  event.clientY = opts.clientY ?? 100
  event.dataTransfer = { dropEffect: 'none', effectAllowed: 'all' }
  event.preventDefault = () => {}
  return event
}

describe('外部拖入功能（需求 6.1-6.6）', () => {
  it('isDroppable=false 时不触发 drop-drag-over 事件', async () => {
    const wrapper = mount(GridLayout, {
      props: {
        layout: baseLayout,
        isDroppable: false,
      },
      attachTo: document.body,
    })

    const vm = wrapper.vm as any
    vm.state.width = 1200
    await nextTick()
    await nextTick()

    const layoutEl = wrapper.find('.vgl-layout')
    await layoutEl.trigger('dragover')

    expect(wrapper.emitted('drop-drag-over')).toBeUndefined()

    wrapper.unmount()
  })

  it('isDroppable=true 时 dragover 触发 drop-drag-over 事件', async () => {
    const wrapper = mount(GridLayout, {
      props: {
        layout: baseLayout,
        isDroppable: true,
        dropItem: { w: 2, h: 2 },
        colNum: 12,
        rowHeight: 150,
        margin: [10, 10],
      },
      attachTo: document.body,
    })

    const vm = wrapper.vm as any
    vm.state.width = 1200
    await nextTick()
    await nextTick()

    const layoutEl = wrapper.find('.vgl-layout')
    const event = createDragEvent('dragover', { clientX: 100, clientY: 100 })
    layoutEl.element.dispatchEvent(event)
    await nextTick()

    const emitted = wrapper.emitted('drop-drag-over')
    expect(emitted).toBeDefined()
    expect(emitted!.length).toBeGreaterThanOrEqual(1)

    // 事件参数应包含网格坐标
    const [coords] = emitted![0] as any[]
    expect(typeof coords.x).toBe('number')
    expect(typeof coords.y).toBe('number')
    expect(coords.x).toBeGreaterThanOrEqual(0)
    expect(coords.y).toBeGreaterThanOrEqual(0)

    wrapper.unmount()
  })

  it('drop 事件触发 drop 自定义事件', async () => {
    const wrapper = mount(GridLayout, {
      props: {
        layout: baseLayout,
        isDroppable: true,
        dropItem: { w: 1, h: 1 },
        colNum: 12,
        rowHeight: 150,
        margin: [10, 10],
      },
      attachTo: document.body,
    })

    const vm = wrapper.vm as any
    vm.state.width = 1200
    await nextTick()
    await nextTick()

    const layoutEl = wrapper.find('.vgl-layout')

    // 先触发 dragover 以设置 dropPlaceholder
    const dragoverEvent = createDragEvent('dragover', { clientX: 100, clientY: 100 })
    layoutEl.element.dispatchEvent(dragoverEvent)
    await nextTick()

    // 然后触发 drop
    const dropEvent = createDragEvent('drop', { clientX: 100, clientY: 100 })
    layoutEl.element.dispatchEvent(dropEvent)
    await nextTick()

    const emitted = wrapper.emitted('drop')
    expect(emitted).toBeDefined()
    expect(emitted!.length).toBeGreaterThanOrEqual(1)

    const [coords] = emitted![0] as any[]
    expect(typeof coords.x).toBe('number')
    expect(typeof coords.y).toBe('number')
    expect(typeof coords.w).toBe('number')
    expect(typeof coords.h).toBe('number')

    wrapper.unmount()
  })

  it('dragover 时显示占位符', async () => {
    const wrapper = mount(GridLayout, {
      props: {
        layout: baseLayout,
        isDroppable: true,
        dropItem: { w: 2, h: 2 },
        colNum: 12,
        rowHeight: 150,
        margin: [10, 10],
      },
      attachTo: document.body,
    })

    const vm = wrapper.vm as any
    vm.state.width = 1200
    await nextTick()
    await nextTick()

    // 初始状态无 drop 占位符
    expect(vm.state.dropPlaceholder).toBeNull()

    const layoutEl = wrapper.find('.vgl-layout')
    const event = createDragEvent('dragover', { clientX: 200, clientY: 200 })
    layoutEl.element.dispatchEvent(event)
    await nextTick()

    // dragover 后应有占位符
    expect(vm.state.dropPlaceholder).not.toBeNull()
    expect(vm.state.dropPlaceholder.w).toBe(2)
    expect(vm.state.dropPlaceholder.h).toBe(2)

    wrapper.unmount()
  })

  it('drop 后移除占位符', async () => {
    const wrapper = mount(GridLayout, {
      props: {
        layout: baseLayout,
        isDroppable: true,
        dropItem: { w: 1, h: 1 },
      },
      attachTo: document.body,
    })

    const vm = wrapper.vm as any
    vm.state.width = 1200
    await nextTick()
    await nextTick()

    const layoutEl = wrapper.find('.vgl-layout')

    // dragover 设置占位符
    const dragoverEvent = createDragEvent('dragover', { clientX: 100, clientY: 100 })
    layoutEl.element.dispatchEvent(dragoverEvent)
    await nextTick()
    expect(vm.state.dropPlaceholder).not.toBeNull()

    // drop 移除占位符
    const dropEvent = createDragEvent('drop', { clientX: 100, clientY: 100 })
    layoutEl.element.dispatchEvent(dropEvent)
    await nextTick()
    expect(vm.state.dropPlaceholder).toBeNull()

    wrapper.unmount()
  })

  it('坐标 clamp 到有效范围（x 不超过 cols - w）', async () => {
    const wrapper = mount(GridLayout, {
      props: {
        layout: baseLayout,
        isDroppable: true,
        dropItem: { w: 3, h: 1 },
        colNum: 12,
        rowHeight: 150,
        margin: [10, 10],
      },
      attachTo: document.body,
    })

    const vm = wrapper.vm as any
    vm.state.width = 1200
    await nextTick()
    await nextTick()

    const layoutEl = wrapper.find('.vgl-layout')

    // 使用非常大的 clientX 来模拟超出右边界
    const event = createDragEvent('dragover', { clientX: 9999, clientY: 100 })
    layoutEl.element.dispatchEvent(event)
    await nextTick()

    expect(vm.state.dropPlaceholder).not.toBeNull()
    // x 应被 clamp 到 cols - w = 12 - 3 = 9
    expect(vm.state.dropPlaceholder.x).toBeLessThanOrEqual(12 - 3)
    expect(vm.state.dropPlaceholder.x).toBeGreaterThanOrEqual(0)

    wrapper.unmount()
  })

  it('dropItem 默认尺寸为 { w: 1, h: 1 }', () => {
    const wrapper = mount(GridLayout, {
      props: {
        layout: baseLayout,
        isDroppable: true,
      },
    })

    const vm = wrapper.vm as any
    expect(vm.effectiveConfig.dropItem).toEqual({ w: 1, h: 1 })

    wrapper.unmount()
  })
})
