import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import GridBackground from '../src/components/grid-background.vue'

describe('GridBackground 组件（需求 12.1-12.5）', () => {
  it('渲染 div 并包含 vgl-background 类', () => {
    const wrapper = mount(GridBackground, {
      props: {
        cols: 12,
        rowHeight: 30,
        margin: [10, 10] as [number, number],
        width: 1200,
      },
    })

    const div = wrapper.find('div')
    expect(div.exists()).toBe(true)
    expect(div.classes()).toContain('vgl-background')

    wrapper.unmount()
  })

  it('color 和 strokeWidth props 正确应用到 backgroundImage', () => {
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

    const div = wrapper.find('div')
    const style = div.attributes('style') || ''
    expect(style).toContain('#ff0000')
    expect(style).toContain('2px')

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

    const div = wrapper.find('div')
    const style = div.attributes('style') || ''
    expect(style).toContain('rgba(0,0,0,0.1)')
    expect(style).toContain('1px')

    wrapper.unmount()
  })

  it('backgroundSize 与 calcGridCellDimensions 一致', () => {
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

    const div = wrapper.find('div')
    const style = div.attributes('style') || ''
    expect(style).toContain('background-size: 97.5px 60px')

    wrapper.unmount()
  })

  it('不同 margin 配置下 backgroundSize 正确', () => {
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

    const div = wrapper.find('div')
    const style = div.attributes('style') || ''
    expect(style).toContain('background-size: 130px 55px')

    wrapper.unmount()
  })

  it('rows prop 控制 div 高度', () => {
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

    const div = wrapper.find('div')
    const style = div.attributes('style') || ''
    expect(style).toContain('height: 190px')

    wrapper.unmount()
  })

  it('未传 rows 时 div 高度为 100%', () => {
    const wrapper = mount(GridBackground, {
      props: {
        cols: 12,
        rowHeight: 30,
        margin: [10, 10] as [number, number],
        width: 1200,
      },
    })

    const div = wrapper.find('div')
    const style = div.attributes('style') || ''
    expect(style).toContain('height: 100%')

    wrapper.unmount()
  })

  it('非正或非有限 rows 回退 100%，正有限小数按公式计算', async () => {
    const wrapper = mount(GridBackground, {
      props: {
        cols: 4,
        rowHeight: 50,
        margin: [10, 10] as const,
        width: 400,
        rows: 0,
      },
    })

    expect(wrapper.find('.vgl-background').attributes('style')).toContain('height: 100%')
    await wrapper.setProps({ rows: Number.POSITIVE_INFINITY })
    expect(wrapper.find('.vgl-background').attributes('style')).toContain('height: 100%')
    await wrapper.setProps({ rows: 2.5 })
    expect(wrapper.find('.vgl-background').attributes('style')).toContain('height: 160px')

    wrapper.unmount()
  })

  it('backgroundPosition 把网格线放在 margin 中间', () => {
    // cols=12, margin=[10,10], width=1200
    // cellWidth = (1200 - 10*13) / 12 = 89.166...
    // bgPosX = cellWidth + 1.5*marginX = 89.166... + 15 = 104.166...
    // bgPosY = cellHeight + 1.5*marginY = 30 + 15 = 45
    const wrapper = mount(GridBackground, {
      props: {
        cols: 12,
        rowHeight: 30,
        margin: [10, 10] as [number, number],
        width: 1200,
      },
    })

    const div = wrapper.find('div')
    const style = div.attributes('style') || ''
    expect(style).toContain('background-position: 104.166667px 45px')

    wrapper.unmount()
  })

  it('非法输入和派生 overflow 不渲染，恢复合法值后重新渲染', async () => {
    const wrapper = mount(GridBackground, {
      props: {
        cols: 4,
        rowHeight: 40,
        margin: [10, 10] as const,
        width: Number.POSITIVE_INFINITY,
        rows: 3,
      },
    })

    expect(wrapper.find('.vgl-background').exists()).toBe(false)
    await wrapper.setProps({ width: 400 })
    expect(wrapper.find('.vgl-background').exists()).toBe(true)

    for (const props of [
      { cols: 0 },
      { rowHeight: Number.NaN },
      { margin: [Number.POSITIVE_INFINITY, 10] as const },
      { strokeWidth: Number.POSITIVE_INFINITY },
      { color: 1 as unknown as string },
      {
        width: Number.MAX_VALUE,
        margin: [Number.MAX_VALUE, 10] as const,
      },
    ]) {
      await wrapper.setProps(props)
      expect(wrapper.find('.vgl-background').exists()).toBe(false)
      await wrapper.setProps({
        cols: 4,
        rowHeight: 40,
        margin: [10, 10],
        width: 400,
        rows: 3,
        strokeWidth: 1,
        color: 'rgba(0,0,0,0.1)',
      })
      expect(wrapper.find('.vgl-background').exists()).toBe(true)
    }

    wrapper.unmount()
  })
})
