import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'

import { GridItem, GridLayout } from '../src'
import { sameStyle } from '../src/helpers/style-equality'

import type { ComponentPublicInstance, PropType } from 'vue'
import type { Layout, LayoutItem } from '../src/helpers/types'

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

  Object.assign(interact, { modifiers: { aspectRatio: vi.fn(() => ({})) } })

  return { interact, interactables }
})

vi.mock('interactjs', () => ({ default: interactMock.interact }))

// happy-dom 没有布局计算，`offsetParent` 恒为 null；GridLayout 只在手动放置的 GridItem
// 的包含块为布局根节点时才注册它，浏览器中由 `.vgl-layout { position: relative }` 保证。
const offsetParentDescriptor = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  'offsetParent',
)

beforeEach(() => {
  interactMock.interact.mockClear()
  interactMock.interactables.clear()
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

describe('sameStyle', () => {
  it('比较键和值，而不是对象引用', () => {
    expect(sameStyle({ a: '1', b: '2' }, { b: '2', a: '1' })).toBe(true)
    expect(sameStyle({ a: '1' }, { a: '1', b: '2' })).toBe(false)
    expect(sameStyle({ a: '1' }, { a: '2' })).toBe(false)
    expect(sameStyle({}, {})).toBe(true)
    expect(sameStyle({ height: undefined }, { height: undefined })).toBe(true)
    expect(sameStyle({ height: undefined }, { width: undefined })).toBe(false)
  })
})

/**
 * 通过 `updated` 钩子按元素 id 记录 GridItem 的重新渲染。不使用插槽计数：要回答的是 GridItem
 * 本身是否重新渲染，只有它自己的生命周期钩子能回答。
 */
function createRenderProbe() {
  const updates: Record<string, number> = {}
  const mixin = {
    updated(this: ComponentPublicInstance) {
      if (this.$.type !== GridItem) return
      const id = String(this.$props.i)
      updates[id] = (updates[id] ?? 0) + 1
    },
  }
  return { updates, mixin }
}

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

function dragEvent(type: string, target: HTMLElement, clientX: number, clientY: number) {
  const event = new MouseEvent(type, { clientX, clientY })
  Object.defineProperty(event, 'target', { configurable: true, value: target })
  return event
}

/** 拖拽候选合并到下一动画帧处理；等待该帧与 Vue 队列。 */
async function flush() {
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
  for (let index = 0; index < 4; index++) await nextTick()
}

/** 像浏览器一样，让 `element` 的包围盒从 `originX` 起跟随指针。 */
function trackPointer(element: HTMLElement, left: number, originX: number) {
  let pointerX = originX
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () => createRect(left + pointerX - originX, 0, left + pointerX - originX + 200, 70),
  })
  return (x: number) => (pointerX = x)
}

function itemElement(wrapper: ReturnType<typeof mount>, id: string) {
  return wrapper
    .findAll<HTMLElement>('.vgl-item')
    .find(
      element =>
        !element.classes().includes('vgl-item--placeholder') && element.text().trim() === id,
    )!
}

/**
 * 每个单元格一个组件，由它放置自己的 GridItem（仪表盘中常见的写法）。`$stable` 按编译模板的方式
 * 标记插槽，因此 GridItem 只会因自身响应式状态重新渲染，不会因单元格或布局重新渲染而渲染。
 * 单元格只接收 id：提交后发出的布局携带新的元素对象，插槽若读取这类对象，
 * 就会因库外部的原因让 GridItem 重新渲染。
 */
const Cell = defineComponent({
  props: { id: { type: [String, Number] as PropType<LayoutItem['i']>, required: true } },
  setup: props => () =>
    h(GridItem, { i: props.id }, { default: () => h('span', String(props.id)), $stable: true }),
})

async function mountGrid(layout: Layout) {
  const probe = createRenderProbe()
  const model = ref<Layout>(layout)

  const host = () =>
    h(
      GridLayout,
      {
        layout: model.value,
        'onUpdate:layout': (next: Layout) => (model.value = next),
        width: 1200,
        colNum: 12,
        rowHeight: 30,
        isResizable: false,
      },
      { default: () => model.value.map(item => h(Cell, { key: item.i, id: item.i })) },
    )

  const wrapper = mount(host, { attachTo: document.body, global: { mixins: [probe.mixin] } })
  await flush()

  const root = wrapper.find<HTMLElement>('.vgl-layout').element
  Object.defineProperty(root, 'getBoundingClientRect', {
    configurable: true,
    value: () => createRect(0, 0, 1200, 600),
  })

  return { wrapper, model, ...probe }
}

function delta(after: Record<string, number>, before: Record<string, number>, id: string) {
  return (after[id] ?? 0) - (before[id] ?? 0)
}

const twoItems = (): Layout => [
  { i: 'a', x: 0, y: 0, w: 2, h: 2 },
  { i: 'b', x: 4, y: 0, w: 2, h: 2 },
]

describe('GridItem 样式写入', () => {
  it('相邻元素移动时，盒子未变的元素不重新渲染', async () => {
    const { wrapper, model, updates } = await mountGrid(twoItems())
    const before = { ...updates }

    model.value = [
      { i: 'a', x: 0, y: 0, w: 2, h: 2 },
      { i: 'b', x: 6, y: 0, w: 2, h: 2 },
    ]
    await flush()

    expect(itemElement(wrapper, 'b').attributes('style')).toContain('translate3d(605px')
    expect(delta(updates, before, 'a')).toBe(0)
    expect(delta(updates, before, 'b')).toBeGreaterThan(0)
    wrapper.unmount()
  })

  it('相邻元素拖拽步进期间，盒子未变的元素不重新渲染', async () => {
    const { wrapper, model, updates } = await mountGrid(twoItems())
    const b = itemElement(wrapper, 'b').element
    const moveTo = trackPointer(b, 403, 450)
    const listener = interactMock.interactables.get(b).listeners.get('dragstart')!

    listener(dragEvent('dragstart', b, 450, 20))
    moveTo(460)
    listener(dragEvent('dragmove', b, 460, 20))
    await flush()
    const before = { ...updates }

    // 同一列内的像素级步进，以及跨入后续列的步进。
    for (const x of [480, 500, 520, 560, 600, 700]) {
      moveTo(x)
      listener(dragEvent('dragmove', b, x, 20))
      await flush()
    }

    expect(itemElement(wrapper, 'b').classes()).toContain('vgl-item--dragging')
    expect(model.value.find(item => item.i === 'b')!.x).toBeGreaterThan(4)
    expect(delta(updates, before, 'a')).toBe(0)
    expect(delta(updates, before, 'b')).toBeGreaterThan(0)

    listener(dragEvent('dragend', b, 700, 20))
    await flush()
    wrapper.unmount()
  })

  it('放下及随后的压缩不会让盒子未变的元素重新渲染', async () => {
    // `c` 位于 `b` 下方；拖走 `b` 后纵向压缩器把 `c` 上提。`a` 的盒子不变。
    const { wrapper, model, updates } = await mountGrid([
      { i: 'a', x: 0, y: 0, w: 2, h: 2 },
      { i: 'b', x: 4, y: 0, w: 2, h: 2 },
      { i: 'c', x: 4, y: 2, w: 2, h: 2 },
    ])
    const b = itemElement(wrapper, 'b').element
    const moveTo = trackPointer(b, 403, 450)
    const listener = interactMock.interactables.get(b).listeners.get('dragstart')!
    const before = { ...updates }

    listener(dragEvent('dragstart', b, 450, 20))
    for (const x of [470, 600, 750, 850]) {
      moveTo(x)
      listener(dragEvent('dragmove', b, x, 20))
      await flush()
    }
    listener(dragEvent('dragend', b, 850, 20))
    await flush()

    const byId = Object.fromEntries(model.value.map(item => [item.i, [item.x, item.y]]))
    expect(byId.b![0]).toBeGreaterThan(5)
    expect(byId.c).toEqual([4, 0])
    expect(byId.a).toEqual([0, 0])
    expect(delta(updates, before, 'a')).toBe(0)
    expect(delta(updates, before, 'c')).toBeGreaterThan(0)
    wrapper.unmount()
  })

  it('容器高度不变时不重写布局根节点样式', async () => {
    const { wrapper, model } = await mountGrid(twoItems())
    const root = wrapper.find<HTMLElement>('.vgl-layout')
    // GridLayout 最近一次渲染中绑定到根元素的样式对象。
    const layoutInstance = wrapper.findComponent(GridLayout).vm.$
    const rootStyle = () => layoutInstance.subTree.props?.style
    const height = root.element.style.height
    const style = rootStyle()

    model.value = [
      { i: 'a', x: 0, y: 0, w: 2, h: 2 },
      { i: 'b', x: 6, y: 0, w: 2, h: 2 },
    ]
    await flush()

    expect(root.element.style.height).toBe(height)
    expect(rootStyle()).toBe(style)

    model.value = [
      { i: 'a', x: 0, y: 0, w: 2, h: 2 },
      { i: 'b', x: 6, y: 0, w: 2, h: 4 },
    ]
    await flush()

    expect(root.element.style.height).not.toBe(height)
    expect(rootStyle()).not.toBe(style)
    wrapper.unmount()
  })
})
