import { beforeAll, describe, expect, it } from 'vitest'
import { mount, shallowMount } from '@vue/test-utils'
import { nextTick } from 'vue'

import { GridLayout } from '../src'

import type { Layout } from '../src/helpers/types'

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
          useCssTransforms: false,
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

      const parsed = visibleItems.slice(0, colNum).map(item =>
        parseItemStyle(item.attributes('style') || ''),
      )

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
