import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'

import { GridItem, GridLayout } from '../src'

import type { PropType } from 'vue'
import type { GridLayoutRuntimeError } from '../src/composables/useGridLayout'
import type { Layout, LayoutItem } from '../src/helpers/types'

vi.mock('interactjs', () => {
  const interact = vi.fn(() => {
    const instance: Record<string, any> = {}
    for (const name of ['draggable', 'resizable', 'styleCursor', 'unset', 'on']) {
      instance[name] = vi.fn(() => instance)
    }
    return instance
  })
  Object.assign(interact, { modifiers: { aspectRatio: vi.fn(() => ({})) } })
  return { default: interact }
})

// happy-dom 没有布局计算，`offsetParent` 恒为 null；GridLayout 只在手动放置的 GridItem
// 的包含块为布局根节点时才注册它（见 tests/style-equality.spec.tsx）。
const offsetParentDescriptor = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  'offsetParent',
)

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
    configurable: true,
    get(this: HTMLElement) {
      return this.parentElement?.closest('.vgl-layout') ?? null
    },
  })
})

afterEach(() => {
  if (offsetParentDescriptor) {
    Object.defineProperty(HTMLElement.prototype, 'offsetParent', offsetParentDescriptor)
  }
  document.body.innerHTML = ''
})

async function flush() {
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
  for (let index = 0; index < 4; index++) await nextTick()
}

/** 每个单元格一个组件，由它放置自己的 GridItem（仪表盘中常见的写法）。 */
const Cell = defineComponent({
  props: { id: { type: [String, Number] as PropType<LayoutItem['i']>, required: true } },
  setup: props => () =>
    h(GridItem, { i: props.id }, { default: () => h('span', String(props.id)), $stable: true }),
})

/** 在一次赋值中同时切换 layout 与 colNum 的父组件，类似移动端/桌面端切换。 */
async function mountGrid(layout: Layout, colNum: number) {
  const view = ref({ layout, colNum })
  const errors: GridLayoutRuntimeError[] = []

  const host = () =>
    h(
      GridLayout,
      {
        layout: view.value.layout,
        colNum: view.value.colNum,
        'onUpdate:layout': (next: Layout) => (view.value = { ...view.value, layout: next }),
        onError: (error: GridLayoutRuntimeError) => errors.push(error),
        width: 1200,
        rowHeight: 30,
        isDraggable: false,
        isResizable: false,
      },
      { default: () => view.value.layout.map(item => h(Cell, { key: item.i, id: item.i })) },
    )

  const wrapper = mount(host, { attachTo: document.body })
  await flush()
  return { wrapper, view, errors }
}

function geometry(layout: Layout) {
  return layout.map(({ i, x, y, w, h }) => ({ i, x, y, w, h }))
}

function itemStyle(wrapper: ReturnType<typeof mount>, id: string) {
  return wrapper
    .findAll<HTMLElement>('.vgl-item')
    .find(element => element.text().trim() === id)!
    .attributes('style')
}

// 桌面端：12 列，两个半宽元素并排，另有仅桌面端存在的 `d`。
const desktop = (): Layout => [
  { i: 'a', x: 0, y: 0, w: 6, h: 2 },
  { i: 'b', x: 6, y: 0, w: 6, h: 2 },
  { i: 'd', x: 0, y: 2, w: 12, h: 2 },
]
// 移动端：1 列纵向堆叠，另有仅移动端存在的 `m`。
const mobile = (): Layout => [
  { i: 'a', x: 0, y: 0, w: 1, h: 2 },
  { i: 'b', x: 0, y: 2, w: 1, h: 2 },
  { i: 'm', x: 0, y: 4, w: 1, h: 2 },
]

describe('colNum 与 layout 在同一 tick 变化', () => {
  it('移动端到桌面端（1 -> 12）不报错并绘制新布局', async () => {
    const { wrapper, view, errors } = await mountGrid(mobile(), 1)
    expect(errors).toEqual([])

    view.value = { layout: desktop(), colNum: 12 }
    await flush()

    expect(errors).toEqual([])
    expect(geometry(view.value.layout)).toEqual(geometry(desktop()))
    // 1200px、12 列、间距 10px、无内边距：列步长 605/6px，6 列宽的元素跨 595px。
    expect(itemStyle(wrapper, 'b')).toContain('translate3d(605px, 0px')
    expect(itemStyle(wrapper, 'b')).toContain('width: 595px')
    expect(itemStyle(wrapper, 'd')).toContain('translate3d(0px, 80px')
    expect(itemStyle(wrapper, 'd')).toContain('width: 1200px')
    wrapper.unmount()
  })

  it('桌面端到移动端（12 -> 1）不报错并绘制新布局', async () => {
    const { wrapper, view, errors } = await mountGrid(desktop(), 12)
    expect(errors).toEqual([])

    view.value = { layout: mobile(), colNum: 1 }
    await flush()

    expect(errors).toEqual([])
    expect(geometry(view.value.layout)).toEqual(geometry(mobile()))
    // 单列占满 1200px；行步长为 30px 加 10px 间距。
    expect(itemStyle(wrapper, 'b')).toContain('translate3d(0px, 80px')
    expect(itemStyle(wrapper, 'm')).toContain('translate3d(0px, 160px')
    expect(itemStyle(wrapper, 'm')).toContain('width: 1200px')
    wrapper.unmount()
  })

  it('不符合新 colNum 的布局仍被拒绝', async () => {
    const { wrapper, view, errors } = await mountGrid(mobile(), 1)

    // `b` 结束于第 14 列，而总共只有 12 列。
    view.value = {
      layout: [
        { i: 'a', x: 0, y: 0, w: 6, h: 2 },
        { i: 'b', x: 8, y: 0, w: 6, h: 2 },
      ],
      colNum: 12,
    }
    await flush()

    expect(errors.some(error => error.code === 'invalid-layout')).toBe(true)
    wrapper.unmount()
  })

  it('不符合未变 colNum 的布局仍被拒绝', async () => {
    const { wrapper, view, errors } = await mountGrid(desktop(), 12)

    view.value = { ...view.value, layout: [{ i: 'a', x: 10, y: 0, w: 6, h: 2 }] }
    await flush()

    expect(errors.some(error => error.code === 'invalid-layout')).toBe(true)
    wrapper.unmount()
  })
})
