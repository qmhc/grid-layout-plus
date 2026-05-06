import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import GridBackground from '../src/components/grid-background.vue'

describe('GridBackground 组件（需求 12.1-12.5）', () => {
  it('渲染 SVG 并包含 <pattern> 元素', () => {
    const wrapper = mount(GridBackground, {
      props: {
        cols: 12,
        rowHeight: 30,
        margin: [10, 10] as [number, number],
        width: 1200,
      },
    })

    const svg = wrapper.find('svg')
    expect(svg.exists()).toBe(true)
    expect(svg.classes()).toContain('vgl-background')

    const pattern = wrapper.find('pattern')
    expect(pattern.exists()).toBe(true)

    wrapper.unmount()
  })

  it('color 和 strokeWidth props 正确应用到 rect', () => {
    const wrapper = mount(GridBackground, {
      props: {
        cols: 4,
        rowHeight: 50,
        margin: [5, 5] as [number, number],
        width: 400,
        color: '#ff0000',
        strokeWidth: 2,
      },
    })

    const patternRect = wrapper.find('pattern rect')
    expect(patternRect.exists()).toBe(true)
    expect(patternRect.attributes('stroke')).toBe('#ff0000')
    expect(patternRect.attributes('stroke-width')).toBe('2')

    wrapper.unmount()
  })

  it('默认 color 和 strokeWidth', () => {
    const wrapper = mount(GridBackground, {
      props: {
        cols: 12,
        rowHeight: 30,
        margin: [10, 10] as [number, number],
        width: 1200,
      },
    })

    const patternRect = wrapper.find('pattern rect')
    expect(patternRect.attributes('stroke')).toBe('rgba(0,0,0,0.1)')
    expect(patternRect.attributes('stroke-width')).toBe('1')

    wrapper.unmount()
  })

  it('pattern 尺寸与 calcGridCellDimensions 一致', () => {
    // cols=4, margin=[10,10], width=400
    // cellWidth = (400 - 10 * 5) / 4 = 350 / 4 = 87.5
    // patternWidth = 87.5 + 10 = 97.5
    // patternHeight = 50 + 10 = 60
    const wrapper = mount(GridBackground, {
      props: {
        cols: 4,
        rowHeight: 50,
        margin: [10, 10] as [number, number],
        width: 400,
      },
    })

    const pattern = wrapper.find('pattern')
    expect(Number(pattern.attributes('width'))).toBeCloseTo(97.5)
    expect(Number(pattern.attributes('height'))).toBeCloseTo(60)

    wrapper.unmount()
  })

  it('不同 margin 配置下 pattern 尺寸正确', () => {
    // cols=6, margin=[20,15], width=800
    // cellWidth = (800 - 20 * 7) / 6 = (800 - 140) / 6 = 110
    // patternWidth = 110 + 20 = 130
    // patternHeight = 40 + 15 = 55
    const wrapper = mount(GridBackground, {
      props: {
        cols: 6,
        rowHeight: 40,
        margin: [20, 15] as [number, number],
        width: 800,
      },
    })

    const pattern = wrapper.find('pattern')
    expect(Number(pattern.attributes('width'))).toBeCloseTo(130)
    expect(Number(pattern.attributes('height'))).toBeCloseTo(55)

    wrapper.unmount()
  })

  it('rows prop 控制 SVG 高度', () => {
    // patternHeight = 50 + 10 = 60, rows=3 → height = 60 * 3 + 10 = 190
    const wrapper = mount(GridBackground, {
      props: {
        cols: 4,
        rowHeight: 50,
        margin: [10, 10] as [number, number],
        width: 400,
        rows: 3,
      },
    })

    const svg = wrapper.find('svg')
    expect(Number(svg.attributes('height'))).toBeCloseTo(190)

    wrapper.unmount()
  })

  it('未传 rows 时 SVG 高度为 100%', () => {
    const wrapper = mount(GridBackground, {
      props: {
        cols: 12,
        rowHeight: 30,
        margin: [10, 10] as [number, number],
        width: 1200,
      },
    })

    const svg = wrapper.find('svg')
    expect(svg.attributes('height')).toBe('100%')

    wrapper.unmount()
  })

  it('pattern 内 rect 的 fill 为 none', () => {
    const wrapper = mount(GridBackground, {
      props: {
        cols: 12,
        rowHeight: 30,
        margin: [10, 10] as [number, number],
        width: 1200,
      },
    })

    const patternRect = wrapper.find('pattern rect')
    expect(patternRect.attributes('fill')).toBe('none')

    wrapper.unmount()
  })
})
