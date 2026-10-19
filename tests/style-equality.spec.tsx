import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref, vShow, withDirectives } from 'vue'

import { GridItem, GridLayout } from '../src'
import { absoluteStrategy } from '../src/core/position-strategies'
import { sameStyle } from '../src/helpers/style-equality'

import type { ComponentPublicInstance, PropType, StyleValue } from 'vue'
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
      // 拖拽占位符是携带被拖元素 id 的装饰性 GridItem。
      if (this.$.type !== GridItem || this.$props.decorative) return
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
    // 被移动的元素通过直接写入样式得到新盒子，不经过 GridItem 渲染。
    expect(delta(updates, before, 'b')).toBe(0)
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
    // 拖拽步进只移动被拖元素的盒子：直接写入元素，没有 GridItem 渲染。
    expect(delta(updates, before, 'b')).toBe(0)
    expect(itemElement(wrapper, 'b').attributes('style')).toContain('translate3d(')

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
    // `c` 被压缩器上提：盒子改变，渲染输出不变。
    expect(delta(updates, before, 'c')).toBe(0)
    expect(itemElement(wrapper, 'c').attributes('style')).toMatch(/translate3d\(403(\.\d+)?px, 0px/)
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

describe('GridItem 定位样式直接写入元素', () => {
  it('布局更新与无关渲染保持透传定位样式的优先级', async () => {
    const flag = ref(false)
    const visible = ref(false)
    const custom = ref<StyleValue>({ width: '10px', left: '10px', display: 'block' })
    const Cell = defineComponent({
      setup: () => () =>
        withDirectives(
          h(
            GridItem,
            {
              i: 'b',
              class: flag.value ? 'marked' : 'plain',
              style: custom.value,
            },
            { default: () => 'b', $stable: true },
          ),
          [[vShow, visible.value]],
        ),
    })
    const model = ref<Layout>(twoItems())
    const wrapper = mount(
      () =>
        h(
          GridLayout,
          {
            layout: model.value,
            width: 1200,
            colNum: 12,
            rowHeight: 30,
            isResizable: false,
            positionStrategy: absoluteStrategy,
          },
          { default: () => h(Cell) },
        ),
      { attachTo: document.body },
    )
    await flush()
    const element = itemElement(wrapper, 'b').element

    for (const style of [
      { width: '10px', left: '10px', display: 'block' },
      ['width: 10px !important; left: 10px !important; display: block', { color: 'red' }],
    ]) {
      custom.value = style
      await flush()
      expect(element.style.width).toBe('10px')
      expect(element.style.left).toBe('10px')
      expect(element.style.display).toBe('none')
      model.value = model.value.map(item =>
        item.i === 'b' ? { ...item, w: item.w === 2 ? 3 : 2, x: item.x === 4 ? 6 : 4 } : item,
      )
      await flush()
      expect(element.style.width).toBe('10px')
      expect(element.style.left).toBe('10px')
      expect(element.style.display).toBe('none')
      flag.value = !flag.value
      await flush()
      expect(element.style.width).toBe('10px')
      expect(element.style.left).toBe('10px')
      expect(element.style.display).toBe('none')
    }
    custom.value = undefined
    await flush()
    expect(parseFloat(element.style.width)).toBeGreaterThan(10)
    const state = (
      wrapper.findComponent(GridItem).vm as unknown as {
        state: { style: Record<string, string> }
      }
    ).state
    state.style.display = 'inline-flex'
    await flush()
    expect(element.style.display).toBe('none')
    visible.value = true
    await flush()
    expect(element.style.display).toBe('inline-flex')
    delete state.style.display
    await flush()
    expect(element.style.display).toBe('')
    wrapper.unmount()
  })

  it('透传的 style 与 class 使元素重新渲染时保留当前盒子', async () => {
    const flag = ref(false)
    const model = ref<Layout>(twoItems())
    const wrapper = mount(
      () =>
        h(
          GridLayout,
          {
            layout: model.value,
            'onUpdate:layout': (next: Layout) => (model.value = next),
            width: 1200,
            colNum: 12,
            rowHeight: 30,
          },
          {
            default: () =>
              model.value.map(item =>
                h(
                  GridItem,
                  {
                    key: item.i,
                    i: item.i,
                    class: flag.value ? 'marked' : 'plain',
                    style: { outline: flag.value ? '2px solid red' : '1px solid red' },
                  },
                  () => h('span', String(item.i)),
                ),
              ),
          },
        ),
      { attachTo: document.body },
    )
    await flush()

    model.value = [
      { i: 'a', x: 0, y: 0, w: 2, h: 2 },
      { i: 'b', x: 6, y: 0, w: 2, h: 2 },
    ]
    await flush()
    flag.value = true
    await flush()

    const b = itemElement(wrapper, 'b')
    expect(b.classes()).toContain('marked')
    expect(b.element.style.outline).toContain('2px')
    expect(b.element.style.transform).toMatch(/^translate3d\(605px, 0px, 0(px)?\)$/)
    expect(b.element.style.width).not.toBe('')
    wrapper.unmount()
  })

  it('布局更新和原地修改后，暴露的样式状态与元素保持同步', async () => {
    const { wrapper, model } = await mountGrid(twoItems())
    const b = wrapper.findAllComponents(GridItem).find(item => item.props('i') === 'b')!
    const state = (b.vm as unknown as { state: { style: Record<string, string> } }).state

    model.value = [
      { i: 'a', x: 0, y: 0, w: 2, h: 2 },
      { i: 'b', x: 6, y: 2, w: 3, h: 2 },
    ]
    await flush()

    const element = b.element as HTMLElement
    for (const [key, value] of Object.entries(state.style)) {
      expect(element.style.getPropertyValue(key)).toBe(value)
    }

    // 保留已有 expose 的可写语义，不依赖 style 对象被整体替换。
    state.style.transform = 'translate3d(1px, 2px, 0)'
    state.style.width = '10px !important'
    await flush()
    expect(element.style.transform).toMatch(/^translate3d\(1px, 2px, 0(px)?\)$/)
    expect(element.style.width).toBe('10px')
    expect(element.style.getPropertyPriority('width')).toBe('important')
    state.style.display = 'inline-flex'
    await flush()
    expect(element.style.display).toBe('inline-flex')
    delete state.style.display
    await flush()
    expect(element.style.display).toBe('')
    wrapper.unmount()
  })

  it('占位符通过直接写入跟随拖拽', async () => {
    const { wrapper } = await mountGrid(twoItems())
    const b = itemElement(wrapper, 'b').element
    const moveTo = trackPointer(b, 403, 450)
    const listener = interactMock.interactables.get(b).listeners.get('dragstart')!

    listener(dragEvent('dragstart', b, 450, 20))
    for (const x of [600, 750]) {
      moveTo(x)
      listener(dragEvent('dragmove', b, x, 20))
      await flush()
    }
    const placeholder = wrapper.find<HTMLElement>('.vgl-item--placeholder').element
    expect(placeholder.style.transform).toMatch(/^translate3d\([\d.]+px, [\d.]+px, 0(px)?\)$/)
    expect(placeholder.style.transform).not.toMatch(/^translate3d\(403px, 0px/)

    listener(dragEvent('dragend', b, 750, 20))
    await flush()
    wrapper.unmount()
  })
})
