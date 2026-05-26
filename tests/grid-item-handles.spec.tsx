import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'

import { GridLayout } from '../src'

import type { Layout } from '../src/helpers/types'

/**
 * 辅助函数：挂载 GridLayout 并等待初始化完成，返回 wrapper。
 */
async function mountGrid(opts: {
  layout: Layout,
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

describe('GridItem 缩放手柄渲染', () => {
  const baseLayout: Layout = [
    { x: 0, y: 0, w: 2, h: 2, i: '0' },
  ]

  it('默认可缩放时只渲染一个 se 手柄', async () => {
    const wrapper = await mountGrid({ layout: baseLayout })

    const items = wrapper.findAll('.vgl-item')
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

  it('se 手柄有基础 CSS 类名', async () => {
    const wrapper = await mountGrid({ layout: baseLayout })

    const items = wrapper.findAll('.vgl-item')
    const gridItem = items.find(item => {
      return !item.classes().includes('vgl-item--placeholder')
    })

    expect(gridItem).toBeDefined()
    const handle = gridItem!.find('.vgl-item__resizer')
    expect(handle).toBeDefined()
    expect(handle!.classes()).toContain('vgl-item__resizer')
    expect(handle!.classes()).toContain('vgl-item__resizer--se')

    wrapper.unmount()
  })
})
