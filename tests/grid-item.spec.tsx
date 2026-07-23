import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, shallowMount } from '@vue/test-utils'
import { nextTick } from 'vue'

import { GridLayout } from '../src'
import { scaledStrategy } from '../src/core/position-strategies'

import type { Layout } from '../src/helpers/types'

const interactMock = vi.hoisted(() => {
  const interactables = new Map<Element, any>()
  const interact = vi.fn((element: Element) => {
    const listeners = new Map<string, (event: any) => void>()
    const instance: Record<string, any> = { listeners }

    instance.draggable = vi.fn(() => instance)
    instance.resizable = vi.fn(() => instance)
    instance.styleCursor = vi.fn(() => instance)
    instance.unset = vi.fn(() => instance)
    instance.on = vi.fn((types: string, listener: (event: any) => void) => {
      for (const type of types.split(' ')) listeners.set(type, listener)
      return instance
    })

    interactables.set(element, instance)
    return instance
  })

  Object.assign(interact, {
    modifiers: {
      aspectRatio: vi.fn(() => ({})),
    },
  })

  return { interact, interactables }
})

vi.mock('interactjs', () => ({ default: interactMock.interact }))

beforeEach(() => {
  interactMock.interact.mockClear()
  interactMock.interactables.clear()
})

afterEach(() => {
  document.documentElement.removeAttribute('dir')
})

describe('GridLayout test', () => {
  let layout: Layout

  beforeAll(() => {
    const testLayout = [
      {
        x: 0,
        y: 0,
        w: 2,
        h: 2,
        i: '0',
        resizable: true,
        draggable: true,
        static: false,
        minY: 0,
        maxY: 2,
      },
    ]
    layout = JSON.parse(JSON.stringify(testLayout))
  })

  describe('Interface test', () => {
    it('should render correct contents', () => {
      const wrapper = shallowMount(GridLayout, {
        propsData: {
          layout,
        },
      })
      const grid = wrapper.find('.vgl-layout')

      expect(grid.exists()).toBe(true)
    })
  })
})

describe('GridItem interaction', () => {
  function createRect(left: number, top: number, right: number, bottom: number): DOMRect {
    return {
      bottom,
      height: bottom - top,
      left,
      right,
      top,
      width: right - left,
      x: left,
      y: top,
      toJSON: () => ({}),
    }
  }

  async function mountItem(
    props: Partial<InstanceType<typeof GridLayout>['$props']> = {},
    scale = 1,
  ) {
    const wrapper = mount(GridLayout, {
      props: {
        layout: [{ x: 0, y: 0, w: 1, h: 1, i: 'item' }],
        colNum: 12,
        rowHeight: 30,
        margin: [10, 10],
        isResizable: false,
        ...props,
      },
      attachTo: document.body,
    })

    const vm = wrapper.vm as any
    const parent = wrapper.find<HTMLElement>('.vgl-layout')
    Object.defineProperty(parent.element, 'offsetWidth', {
      configurable: true,
      value: 1200,
    })
    vm.state.width = 1200
    await nextTick()
    await nextTick()
    await nextTick()

    const item = wrapper
      .findAll<HTMLElement>('.vgl-item')
      .find(element => !element.classes().includes('vgl-item--placeholder'))!

    Object.defineProperty(item.element, 'offsetParent', {
      configurable: true,
      value: parent.element,
    })
    Object.defineProperty(parent.element, 'getBoundingClientRect', {
      configurable: true,
      value: () => createRect(50, 100, 50 + 1200 * scale, 100 + 600 * scale),
    })
    Object.defineProperty(item.element, 'getBoundingClientRect', {
      configurable: true,
      value: () => createRect(50 + 10 * scale, 100 + 10 * scale, 150, 150),
    })

    const interactable = interactMock.interactables.get(item.element)
    expect(interactable).toBeDefined()

    return { wrapper, item, interactable }
  }

  function dragEvent(type: string, target: HTMLElement, clientX: number, clientY: number) {
    return { type, target, clientX, clientY } as MouseEvent
  }

  it('仅为可缩放项渲染一个 se 手柄', async () => {
    const { wrapper, item } = await mountItem({ isResizable: true })

    expect(item.findAll('.vgl-item__resizer')).toHaveLength(1)
    expect(item.find('.vgl-item__resizer--se').exists()).toBe(true)

    wrapper.unmount()
  })

  it('RTL 模式下为 se 手柄启用镜像样式类', async () => {
    document.documentElement.dir = 'rtl'
    const { wrapper, item } = await mountItem({ isResizable: true })

    expect(item.find('.vgl-item__resizer--se').classes()).toContain('vgl-item__resizer--rtl')

    wrapper.unmount()
  })

  it('未达到拖拽阈值时不开始拖拽，达到阈值时开始', async () => {
    const { wrapper, item, interactable } = await mountItem({ dragThreshold: 10 })
    const listener = interactable.listeners.get('dragstart')!

    listener(dragEvent('dragstart', item.element, 100, 100))
    listener(dragEvent('dragmove', item.element, 105, 108))
    await nextTick()
    expect(item.classes()).not.toContain('vgl-item--dragging')

    listener(dragEvent('dragmove', item.element, 106, 108))
    await nextTick()
    expect(item.classes()).toContain('vgl-item--dragging')

    listener(dragEvent('dragend', item.element, 106, 108))
    await nextTick()
    expect(item.classes()).not.toContain('vgl-item--dragging')

    wrapper.unmount()
  })

  it('dragThreshold 为 0 时在 dragstart 立即开始拖拽', async () => {
    const { wrapper, item, interactable } = await mountItem({ dragThreshold: 0 })
    const listener = interactable.listeners.get('dragstart')!

    listener(dragEvent('dragstart', item.element, 100, 100))
    await nextTick()

    expect(item.classes()).toContain('vgl-item--dragging')
    wrapper.unmount()
  })

  it('scaledStrategy 将视觉指针位移还原到布局坐标', async () => {
    const { wrapper, item, interactable } = await mountItem(
      { positionStrategy: scaledStrategy(0.5) },
      0.5,
    )
    const listener = interactable.listeners.get('dragstart')!

    listener(dragEvent('dragstart', item.element, 55, 105))
    await nextTick()
    expect(item.attributes('style')).toContain('translate3d(10px,10px, 0)')

    listener(dragEvent('dragmove', item.element, 65, 115))
    await vi.waitFor(() => {
      expect(item.attributes('style')).toContain('translate3d(30px,30px, 0)')
    })

    wrapper.unmount()
  })
})

/**
 * Issue #58: col-num 设置为 6 时，宽度要设置为特定值才是 6 列，否则会多出几列。
 * 根因：calcPosition 中对每个 item 独立做 Math.round，舍入误差累积导致
 * 相邻 item 的边界不对齐。
 */
describe('Column width rounding (Issue #58)', () => {
  const colNum = 6
  const marginX = 10
  const margin: [number, number] = [marginX, 10]
  const trickyWidths = [997, 999, 1000, 1001, 1003, 1007, 1024, 1280, 1366, 1440, 1920]

  function buildSingleRowLayout(cols: number): Layout {
    return Array.from({ length: cols }, (_, i) => ({
      x: i,
      y: 0,
      w: 1,
      h: 1,
      i: String(i),
    }))
  }

  /**
   * 从 GridItem style 属性中提取 left 和 width 像素值。
   * 支持 "left: 10px" 格式和 "translate3d(10px, ...)" 格式。
   */
  function parseItemStyle(styleStr: string) {
    const get = (key: string) => {
      const re = new RegExp(`${key}:\\s*(-?\\d+)px`)
      const m = styleStr.match(re)
      return m ? Number(m[1]) : NaN
    }

    let left = get('left')
    if (Number.isNaN(left)) {
      const m = styleStr.match(/translate3d\((-?\d+)px/)
      if (m) left = Number(m[1])
    }

    return { left, width: get('width') }
  }

  for (const containerWidth of trickyWidths) {
    it(`width=${containerWidth}: items tile exactly with no gaps or overlaps`, async () => {
      const layout = buildSingleRowLayout(colNum)

      const wrapper = mount(GridLayout, {
        props: {
          layout,
          colNum,
          rowHeight: 150,
          margin,
          isDraggable: false,
          isResizable: false,
        },
        attachTo: document.body,
      })

      // 直接设置 GridLayout 内部 state.width 来模拟容器宽度
      const vm = wrapper.vm as any
      vm.state.width = containerWidth

      // 等待 width watcher 和子组件更新
      await nextTick()
      await nextTick()
      await nextTick()

      const items = wrapper.findAll('.vgl-item')
      const visibleItems = items.filter(item => {
        const style = item.attributes('style') || ''
        return !style.includes('display: none') && !style.includes('display:none')
      })

      expect(visibleItems.length).toBeGreaterThanOrEqual(colNum)

      const parsed = visibleItems
        .slice(0, colNum)
        .map(item => parseItemStyle(item.attributes('style') || ''))

      // 所有 item 都应有有效的 left 和 width
      for (let i = 0; i < colNum; i++) {
        expect(parsed[i].left, `item ${i} left`).not.toBeNaN()
        expect(parsed[i].width, `item ${i} width`).not.toBeNaN()
        expect(parsed[i].width, `item ${i} width > 0`).toBeGreaterThan(0)
      }

      // 相邻 item 边界对齐：item[i].left + item[i].width + margin === item[i+1].left
      for (let i = 0; i < colNum - 1; i++) {
        const expectedNext = parsed[i].left + parsed[i].width + marginX
        expect(
          parsed[i + 1].left,
          `item ${i + 1}.left should == item ${i} right edge + margin (w=${containerWidth})`,
        ).toBe(expectedNext)
      }

      // 最后一个 item 的右边界 + margin === 容器宽度
      const last = parsed[colNum - 1]
      expect(
        last.left + last.width + marginX,
        `last item right edge + margin should == ${containerWidth}`,
      ).toBe(containerWidth)

      wrapper.unmount()
    })
  }
})
