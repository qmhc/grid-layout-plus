import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'

import { GridLayout } from '../src'

import type { Layout, ResizeHandle } from '../src/helpers/types'

/**
 * 辅助函数：挂载 GridLayout 并等待初始化完成，返回 wrapper。
 */
async function mountGrid(opts: {
  layout: Layout,
  resizeHandles?: ResizeHandle[],
  isResizable?: boolean,
}) {
  const wrapper = mount(GridLayout, {
    props: {
      layout: opts.layout,
      colNum: 12,
      rowHeight: 150,
      margin: [10, 10],
      isDraggable: false,
      isResizable: opts.isResizable ?? true,
      resizeHandles: opts.resizeHandles,
    },
    attachTo: document.body,
  })

  // 设置宽度并等待渲染
  const vm = wrapper.vm as any
  vm.state.width = 1200
  await nextTick()
  await nextTick()
  await nextTick()

  return wrapper
}

describe('GridItem 缩放手柄渲染（需求 5.2, 5.5）', () => {
  const baseLayout: Layout = [
    { x: 0, y: 0, w: 2, h: 2, i: '0' },
  ]

  it('默认 resizeHandles=["se"] 只渲染一个手柄', async () => {
    const wrapper = await mountGrid({ layout: baseLayout })

    const items = wrapper.findAll('.vgl-item')
    // 找到非 placeholder 的 item
    const gridItem = items.find(item => {
      const style = item.attributes('style') || ''
      return !style.includes('display: none') && !style.includes('display:none')
        && !item.classes().includes('vgl-item--placeholder')
    })

    expect(gridItem).toBeDefined()
    const handles = gridItem!.findAll('.vgl-item__resizer')
    expect(handles.length).toBe(1)
    expect(handles[0].classes()).toContain('vgl-item__resizer--se')

    wrapper.unmount()
  })

  it('resizeHandles=["se","nw"] 渲染两个手柄', async () => {
    const wrapper = await mountGrid({
      layout: baseLayout,
      resizeHandles: ['se', 'nw'],
    })

    const items = wrapper.findAll('.vgl-item')
    const gridItem = items.find(item => {
      return !item.classes().includes('vgl-item--placeholder')
    })

    expect(gridItem).toBeDefined()
    const handles = gridItem!.findAll('.vgl-item__resizer')
    expect(handles.length).toBe(2)

    const classes = handles.map(h => h.classes()).flat()
    expect(classes).toContain('vgl-item__resizer--se')
    expect(classes).toContain('vgl-item__resizer--nw')

    wrapper.unmount()
  })

  it('resizeHandles 包含所有 8 个方向时渲染 8 个手柄', async () => {
    const allHandles: ResizeHandle[] = ['s', 'w', 'e', 'n', 'sw', 'nw', 'se', 'ne']
    const wrapper = await mountGrid({
      layout: baseLayout,
      resizeHandles: allHandles,
    })

    const items = wrapper.findAll('.vgl-item')
    const gridItem = items.find(item => {
      return !item.classes().includes('vgl-item--placeholder')
    })

    expect(gridItem).toBeDefined()
    const handles = gridItem!.findAll('.vgl-item__resizer')
    expect(handles.length).toBe(8)

    for (const dir of allHandles) {
      const hasClass = handles.some(h => h.classes().includes(`vgl-item__resizer--${dir}`))
      expect(hasClass, `应包含方向 ${dir} 的手柄`).toBe(true)
    }

    wrapper.unmount()
  })

  it('isResizable=false 时不渲染任何手柄', async () => {
    const wrapper = await mountGrid({
      layout: baseLayout,
      isResizable: false,
    })

    const items = wrapper.findAll('.vgl-item')
    const gridItem = items.find(item => {
      return !item.classes().includes('vgl-item--placeholder')
    })

    expect(gridItem).toBeDefined()
    const handles = gridItem!.findAll('.vgl-item__resizer')
    expect(handles.length).toBe(0)

    wrapper.unmount()
  })

  it('每个手柄都有基础 CSS 类名', async () => {
    const wrapper = await mountGrid({
      layout: baseLayout,
      resizeHandles: ['n', 'e'],
    })

    const items = wrapper.findAll('.vgl-item')
    const gridItem = items.find(item => {
      return !item.classes().includes('vgl-item--placeholder')
    })

    expect(gridItem).toBeDefined()
    const handles = gridItem!.findAll('.vgl-item__resizer')
    expect(handles.length).toBe(2)

    // 每个手柄都应有基础类名
    for (const handle of handles) {
      expect(handle.classes()).toContain('vgl-item__resizer')
    }

    wrapper.unmount()
  })
})
