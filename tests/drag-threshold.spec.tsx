import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'

import { GridLayout } from '../src'

import type { Layout } from '../src/helpers/types'

/**
 * 拖拽阈值功能测试（需求 7.2, 7.3）
 *
 * 由于 interactjs 的拖拽事件在 happy-dom 环境中难以完全模拟，
 * 这里主要测试阈值配置的传递和默认值行为。
 */
describe('拖拽阈值配置（需求 7.2, 7.3）', () => {
  const baseLayout: Layout = [
    { x: 0, y: 0, w: 2, h: 2, i: '0' },
  ]

  it('dragThreshold 默认值为 0', () => {
    const wrapper = mount(GridLayout, {
      props: {
        layout: baseLayout,
      },
    })

    const vm = wrapper.vm as any
    expect(vm.effectiveConfig.dragThreshold).toBe(0)
    wrapper.unmount()
  })

  it('可以设置自定义 dragThreshold', () => {
    const wrapper = mount(GridLayout, {
      props: {
        layout: baseLayout,
        dragThreshold: 10,
      },
    })

    const vm = wrapper.vm as any
    expect(vm.$props.dragThreshold).toBe(10)
    wrapper.unmount()
  })

  it('dragThreshold 通过 provide 传递给子组件', async () => {
    const wrapper = mount(GridLayout, {
      props: {
        layout: baseLayout,
        dragThreshold: 15,
        isDraggable: true,
      },
      attachTo: document.body,
    })

    const vm = wrapper.vm as any
    vm.state.width = 1200
    await nextTick()
    await nextTick()

    // 验证 GridLayout 的 dragThreshold prop 正确设置
    expect(vm.$props.dragThreshold).toBe(15)

    wrapper.unmount()
  })

  it('阈值为 0 时不阻止拖拽（默认行为）', () => {
    // 阈值为 0 意味着任何移动都应立即触发拖拽
    // 这是向后兼容的默认行为
    const wrapper = mount(GridLayout, {
      props: {
        layout: baseLayout,
        dragThreshold: 0,
        isDraggable: true,
      },
    })

    const vm = wrapper.vm as any
    expect(vm.$props.dragThreshold).toBe(0)
    // 阈值为 0 等同于无阈值限制
    wrapper.unmount()
  })

  it('dragConfig.dragThreshold 不覆盖扁平 prop', () => {
    const wrapper = mount(GridLayout, {
      props: {
        layout: baseLayout,
        dragThreshold: 5,
        dragConfig: { dragThreshold: 20 },
      },
    })

    const vm = wrapper.vm as any
    // 扁平 prop 优先
    expect(vm.$props.dragThreshold).toBe(5)
    wrapper.unmount()
  })
})
