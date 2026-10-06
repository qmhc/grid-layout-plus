import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, getCurrentInstance, h, nextTick, onMounted, ref } from 'vue'

import { GridItem, GridLayout } from '../src'

import type { PropType } from 'vue'
import type { GridLayoutRuntimeError } from '../src/composables/useGridLayout'
import type { Layout, LayoutItem } from '../src/helpers/types'

// 记录每个元素上的 interactjs 绑定，用于确认未确认的项不会获得可用的拖拽绑定。
// interacted：已为该元素创建 interactjs 实例；dragListeners：已注册 dragstart 监听器。
const bindings = vi.hoisted(() => ({
  enabledDrag: new Set<Element>(),
  interacted: new Set<Element>(),
  dragListeners: new Set<Element>(),
}))

vi.mock('interactjs', () => {
  const interact = vi.fn((element: Element) => {
    bindings.interacted.add(element)
    const instance: Record<string, any> = {}
    instance.draggable = vi.fn((options?: { enabled?: boolean }) => {
      if (options?.enabled === false) bindings.enabledDrag.delete(element)
      else bindings.enabledDrag.add(element)
      return instance
    })
    instance.on = vi.fn((types: string) => {
      if (types.split(' ').includes('dragstart')) bindings.dragListeners.add(element)
      return instance
    })
    for (const name of ['resizable', 'styleCursor']) {
      instance[name] = vi.fn(() => instance)
    }
    instance.unset = vi.fn(() => {
      bindings.enabledDrag.delete(element)
      return instance
    })
    return instance
  })
  Object.assign(interact, { modifiers: { aspectRatio: vi.fn(() => ({})) } })
  return { default: interact }
})

// happy-dom 没有布局：以 `.vgl-layout` 为 containing block，带 data-detached 的项视为不在其中。
const offsetParentDescriptor = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  'offsetParent',
)

beforeEach(() => {
  bindings.enabledDrag.clear()
  bindings.interacted.clear()
  bindings.dragListeners.clear()
  Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
    configurable: true,
    get(this: HTMLElement) {
      if (this.dataset.detached !== undefined) return null
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

interface FirstRender {
  id: LayoutItem['i']
  transform: string
  registered: boolean
  dragBound: boolean
  interacted: boolean
  dragListener: boolean
}

async function flush() {
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
  for (let index = 0; index < 4; index++) await nextTick()
}

/**
 * 子内容的 onMounted 早于 GridItem 自身的 onMounted 与延迟注册校验，
 * 因而记录的是元素第一次进入 DOM 时的状态。
 */
function createHarness() {
  const firstRenders: FirstRender[] = []
  const Probe = defineComponent({
    props: { id: { type: [String, Number] as PropType<LayoutItem['i']>, required: true } },
    setup(props) {
      const self = getCurrentInstance()!
      onMounted(() => {
        let owner = self.parent
        while (owner && owner.type !== GridItem) owner = owner.parent
        const exposed = owner!.exposed as { state: { registered: boolean }; wrapper: any }
        const element = exposed.wrapper.value as HTMLElement
        firstRenders.push({
          id: props.id,
          transform: element.style.transform,
          registered: exposed.state.registered,
          dragBound: bindings.enabledDrag.has(element),
          interacted: bindings.interacted.has(element),
          dragListener: bindings.dragListeners.has(element),
        })
      })
      return () => h('span', String(props.id))
    },
  })

  const layout = ref<Layout>([
    { i: 'a', x: 0, y: 0, w: 2, h: 2 },
    { i: 'b', x: 2, y: 0, w: 2, h: 2 },
  ])
  const cells = ref<Array<{ id: LayoutItem['i']; key: string; detached?: boolean }>>([
    { id: 'a', key: 'a' },
    { id: 'b', key: 'b' },
  ])
  const errors: GridLayoutRuntimeError[] = []

  const host = () =>
    h(
      GridLayout,
      {
        layout: layout.value,
        'onUpdate:layout': (next: Layout) => (layout.value = next),
        onError: (error: GridLayoutRuntimeError) => errors.push(error),
        colNum: 12,
        width: 1200,
        rowHeight: 30,
        isDraggable: true,
        isResizable: false,
      },
      {
        default: () =>
          cells.value.map(cell =>
            h(
              GridItem,
              { key: cell.key, i: cell.id, ...(cell.detached ? { 'data-detached': '' } : {}) },
              { default: () => h(Probe, { id: cell.id }) },
            ),
          ),
      },
    )

  const wrapper = mount(host, { attachTo: document.body })
  return { wrapper, layout, cells, errors, firstRenders }
}

function itemElement(wrapper: ReturnType<typeof mount>, text: string): HTMLElement {
  return wrapper.findAll<HTMLElement>('.vgl-item').filter(item => item.text().trim() === text)[0]
    .element
}

describe('新 GridItem 从首次渲染起即定位', () => {
  it('注册表确认前即渲染已提交的盒子', async () => {
    const { wrapper, layout, cells, firstRenders } = createHarness()
    await flush()
    firstRenders.length = 0

    // 布局先提交（与应用按已提交布局渲染单元格的顺序一致），单元格随后挂载。
    layout.value = [...layout.value, { i: 'c', x: 6, y: 0, w: 2, h: 2 }]
    await flush()
    cells.value = [...cells.value, { id: 'c', key: 'c' }]
    await flush()

    expect(firstRenders).toHaveLength(1)
    expect(firstRenders[0]).toMatchObject({ id: 'c', registered: false, dragBound: false })
    // 首帧即为最终位置，而不是先无样式、后续再写入 transform。
    expect(firstRenders[0].transform).toMatch(/^translate3d\(\d+(\.\d+)?px, 0(px)?, 0(px)?\)$/)
    expect(firstRenders[0].transform).not.toMatch(/^translate3d\(0px/)
    expect(itemElement(wrapper, 'c').style.transform).toBe(firstRenders[0].transform)
    expect(bindings.enabledDrag.has(itemElement(wrapper, 'c'))).toBe(true)
    wrapper.unmount()
  })

  it('包含块无效的新元素被清空盒子，错误按顺序上报', async () => {
    const { wrapper, layout, cells, errors, firstRenders } = createHarness()
    await flush()
    firstRenders.length = 0

    layout.value = [
      ...layout.value,
      { i: 'c', x: 6, y: 0, w: 2, h: 2 },
      { i: 'd', x: 8, y: 0, w: 2, h: 2 },
    ]
    cells.value = [
      ...cells.value,
      { id: 'c', key: 'c', detached: true },
      { id: 'd', key: 'd', detached: true },
    ]
    await flush()

    expect(firstRenders.map(render => render.registered)).toEqual([false, false])
    expect(
      errors.map(error => [error.code, (error.cause as any).reason, (error.cause as any).id]),
    ).toEqual([
      ['invalid-registration', 'invalid-containing-block', 'c'],
      ['invalid-registration', 'invalid-containing-block', 'd'],
    ])
    for (const id of ['c', 'd']) {
      const element = itemElement(wrapper, id)
      expect(element.style.transform).toBe('')
      expect(element.getAttribute('style') ?? '').not.toMatch(/transform|width|height/)
      expect(bindings.enabledDrag.has(element)).toBe(false)
    }
    wrapper.unmount()
  })

  it('missing-id 与重复 id 的处理路径保持不变', async () => {
    const { wrapper, cells, errors, firstRenders } = createHarness()
    await flush()
    firstRenders.length = 0

    cells.value = [...cells.value, { id: 'ghost', key: 'ghost' }, { id: 'a', key: 'a2' }]
    await flush()

    // 布局中没有的 id 没有已提交位置，首帧即无样式；重复 id 的第二个实例被拒绝后清空样式。
    const ghost = firstRenders.find(render => render.id === 'ghost')!
    expect(ghost).toMatchObject({ registered: false, transform: '', dragBound: false })
    expect(errors.map(error => [(error.cause as any).reason, (error.cause as any).id])).toEqual([
      ['missing-id', 'ghost'],
      ['duplicate', 'a'],
    ])
    const [first, second] = wrapper
      .findAll<HTMLElement>('.vgl-item')
      .filter(item => item.text().trim() === 'a')
      .map(item => item.element)
    expect(first.style.transform).toMatch(/^translate3d\(/)
    expect(second.style.transform).toBe('')
    expect(bindings.enabledDrag.has(first)).toBe(true)
    expect(bindings.enabledDrag.has(second)).toBe(false)
    expect(itemElement(wrapper, 'ghost').style.transform).toBe('')
    wrapper.unmount()
  })

  it('未确认的元素不能开始交互', async () => {
    const { wrapper, layout, cells, firstRenders } = createHarness()
    await flush()
    firstRenders.length = 0

    // c 随后被确认（对照组），d 的 containing block 无效、将被拒绝。
    layout.value = [
      ...layout.value,
      { i: 'c', x: 6, y: 0, w: 2, h: 2 },
      { i: 'd', x: 8, y: 0, w: 2, h: 2 },
    ]
    await flush()
    cells.value = [...cells.value, { id: 'c', key: 'c' }, { id: 'd', key: 'd', detached: true }]
    await flush()

    // 待定窗口（注册校验之前）：已带乐观位置，但没有 interactjs 实例，也没有 dragstart 监听器。
    expect(firstRenders).toHaveLength(2)
    for (const render of firstRenders) {
      expect(render).toMatchObject({ registered: false, interacted: false, dragListener: false })
      expect(render.transform).toMatch(/^translate3d\(/)
    }
    // 确认后 c 获得实例与监听器，说明上面的记录能观察到绑定；被拒绝的 d 始终没有。
    const confirmed = itemElement(wrapper, 'c')
    expect(bindings.interacted.has(confirmed)).toBe(true)
    expect(bindings.dragListeners.has(confirmed)).toBe(true)
    const rejected = itemElement(wrapper, 'd')
    expect(bindings.interacted.has(rejected)).toBe(false)
    expect(bindings.dragListeners.has(rejected)).toBe(false)
    expect(bindings.enabledDrag.has(rejected)).toBe(false)
    wrapper.unmount()
  })
})
