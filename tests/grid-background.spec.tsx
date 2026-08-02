import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import GridBackground from '../src/components/grid-background.vue'

describe('GridBackground 组件（需求 12.1-12.5）', () => {
  it('渲染 div 并包含 vgl-background 类', () => {
    const wrapper = mount(GridBackground, {
      props: {
        cols: 12,
        rowHeight: 30,
        gap: [10, 10] as [number, number],
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
        gap: [5, 5] as [number, number],
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
        gap: [10, 10] as [number, number],
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
    // cols=4, gap=[10,10], width=400
    // cellWidth = (400 - 10 * 3) / 4 = 370 / 4 = 92.5
    // patternWidth = 92.5 + 10 = 102.5
    // patternHeight = 50 + 10 = 60
    const wrapper = mount(GridBackground, {
      props: {
        cols: 4,
        rowHeight: 50,
        gap: [10, 10] as [number, number],
        width: 400,
      },
    })

    const div = wrapper.find('div')
    const style = div.attributes('style') || ''
    expect(style).toContain('background-size: 102.5px 60px')

    wrapper.unmount()
  })

  it('不同 gap 配置下 backgroundSize 正确', () => {
    // cols=6, gap=[20,15], width=800
    // cellWidth = (800 - 20 * 5) / 6 = 700 / 6
    // patternWidth = 700 / 6 + 20
    // patternHeight = 40 + 15 = 55
    const wrapper = mount(GridBackground, {
      props: {
        cols: 6,
        rowHeight: 40,
        gap: [20, 15] as [number, number],
        width: 800,
      },
    })

    const div = wrapper.find('div')
    const style = div.attributes('style') || ''
    expect(style).toContain('background-size: 136.66666666666669px 55px')

    wrapper.unmount()
  })

  it('rows prop 控制 div 高度', () => {
    // rows=3 → height = 50 * 3 + 10 * 2 = 170
    const wrapper = mount(GridBackground, {
      props: {
        cols: 4,
        rowHeight: 50,
        gap: [10, 10] as [number, number],
        width: 400,
        rows: 3,
      },
    })

    const div = wrapper.find('div')
    const style = div.attributes('style') || ''
    expect(style).toContain('height: 170px')

    wrapper.unmount()
  })

  it('未传 rows 时 div 高度为 100%', () => {
    const wrapper = mount(GridBackground, {
      props: {
        cols: 12,
        rowHeight: 30,
        gap: [10, 10] as [number, number],
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
        gap: [10, 10] as const,
        width: 400,
        rows: 0,
      },
    })

    expect(wrapper.find('.vgl-background').attributes('style')).toContain('height: 100%')
    await wrapper.setProps({ rows: Number.POSITIVE_INFINITY })
    expect(wrapper.find('.vgl-background').attributes('style')).toContain('height: 100%')
    await wrapper.setProps({ rows: 2.5 })
    expect(wrapper.find('.vgl-background').attributes('style')).toContain('height: 140px')

    wrapper.unmount()
  })

  it('backgroundPosition 把网格线放在 gap 中间', () => {
    // cols=12, gap=[10,10], width=1200
    // cellWidth = (1200 - 10*11) / 12 = 90.833...
    // bgPosX = cellWidth + gapX/2 = 95.833...
    // bgPosY = cellHeight + gapY/2 = 35
    const wrapper = mount(GridBackground, {
      props: {
        cols: 12,
        rowHeight: 30,
        gap: [10, 10] as [number, number],
        width: 1200,
      },
    })

    const div = wrapper.find('div')
    const style = div.attributes('style') || ''
    expect(style).toContain('background-position: 95.833333px 35px')

    wrapper.unmount()
  })

  it('非法输入和派生 overflow 不渲染，恢复合法值后重新渲染', async () => {
    const wrapper = mount(GridBackground, {
      props: {
        cols: 4,
        rowHeight: 40,
        gap: [10, 10] as const,
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
      { gap: [Number.POSITIVE_INFINITY, 10] as const },
      { strokeWidth: Number.POSITIVE_INFINITY },
      { color: 1 as unknown as string },
      {
        width: Number.MAX_VALUE,
        gap: [Number.MAX_VALUE, 10] as const,
      },
    ]) {
      await wrapper.setProps(props)
      expect(wrapper.find('.vgl-background').exists()).toBe(false)
      await wrapper.setProps({
        cols: 4,
        rowHeight: 40,
        gap: [10, 10],
        width: 400,
        rows: 3,
        strokeWidth: 1,
        color: 'rgba(0,0,0,0.1)',
      })
      expect(wrapper.find('.vgl-background').exists()).toBe(true)
    }

    wrapper.unmount()
  })

  it('containerPadding 独立控制网格线位置和指定行数高度', () => {
    const wrapper = mount(GridBackground, {
      props: {
        cols: 4,
        rowHeight: 50,
        gap: [10, 10] as const,
        containerPadding: [20, 30] as const,
        width: 400,
        rows: 3,
      },
    })

    const style = wrapper.find('.vgl-background').attributes('style')
    expect(style).toContain('height: 230px')
    expect(style).toContain('background-position: 107.5px 85px')

    wrapper.unmount()
  })
})
