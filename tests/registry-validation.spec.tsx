import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, onUpdated, ref, watch } from 'vue'

import { GridItem, GridLayout } from '../src'
import { createGridItemRegistry } from '../src/components/grid-layout/item-registry'

import type { PropType } from 'vue'
import type { GridLayoutRuntimeError } from '../src/composables/useGridLayout'
import type { GridItemRegistration } from '../src/helpers/internal-types'
import type { Layout, LayoutItem } from '../src/helpers/types'

/**
 * 从外部统计 GridLayout 元素注册表的工作量：一轮完整校验是 `getRoot` 的唯一调用方，
 * 并对每个已注册元素调用一次 `hasLayoutItem`。`getLayoutItem` 是布局的线性查找，
 * 注册表与注入的元素查找都不应依赖它。
 */
const counters = vi.hoisted(() => ({ passes: 0, membership: 0, linearSearches: 0 }))

vi.mock('../src/components/grid-layout/item-registry', async importOriginal => {
  const original =
    await importOriginal<typeof import('../src/components/grid-layout/item-registry')>()
  return {
    ...original,
    createGridItemRegistry: (options: Parameters<typeof original.createGridItemRegistry>[0]) =>
      original.createGridItemRegistry({
        ...options,
        getRoot: () => {
          counters.passes += 1
          return options.getRoot()
        },
        hasLayoutItem: id => {
          counters.membership += 1
          return options.hasLayoutItem(id)
        },
      }),
  }
})

vi.mock('../src/helpers/common', async importOriginal => {
  const original = await importOriginal<typeof import('../src/helpers/common')>()
  return {
    ...original,
    getLayoutItem: ((layout: Layout, id: LayoutItem['i']) => {
      counters.linearSearches += 1
      return original.getLayoutItem(layout, id)
    }) as typeof original.getLayoutItem,
  }
})

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

// 按元素覆盖：`detached` 表示没有包含块，`throws` 让读取抛错。
const offsetParentOverrides = new Map<Element, 'detached' | 'throws'>()

beforeEach(() => {
  offsetParentOverrides.clear()
  Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
    configurable: true,
    get(this: HTMLElement) {
      const override = offsetParentOverrides.get(this)
      if (override === 'throws') throw new Error('offsetParent read failed')
      if (override === 'detached') return null
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

function resetCounters() {
  counters.passes = 0
  counters.membership = 0
  counters.linearSearches = 0
}

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

const size = 300
// 桌面端：12 列，每行六个 2x2 单元格。
const desktop = (): Layout =>
  Array.from({ length: size }, (_, k) => ({
    i: `c${k}`,
    x: (k % 6) * 2,
    y: Math.floor(k / 6) * 2,
    w: 2,
    h: 2,
  }))
// 移动端：1 列，同样的单元格纵向堆叠。
const mobile = (): Layout =>
  Array.from({ length: size }, (_, k) => ({ i: `c${k}`, x: 0, y: k * 2, w: 1, h: 2 }))

async function mountGrid() {
  const view = ref({ layout: desktop(), colNum: 12, width: 1200 })
  const errors: GridLayoutRuntimeError[] = []

  const host = () =>
    h(
      GridLayout,
      {
        layout: view.value.layout,
        colNum: view.value.colNum,
        width: view.value.width,
        'onUpdate:layout': (next: Layout) => (view.value = { ...view.value, layout: next }),
        onError: (error: GridLayoutRuntimeError) => errors.push(error),
        rowHeight: 30,
        isDraggable: false,
        isResizable: false,
      },
      { default: () => view.value.layout.map(item => h(Cell, { key: item.i, id: item.i })) },
    )

  const wrapper = mount(host, { attachTo: document.body })
  return { wrapper, view, errors }
}

describe('300 个单元格时的注册表校验开销', () => {
  it('挂载时每个单元格的校验次数有上限，而不是每个单元格触发一轮', async () => {
    resetCounters()
    const { wrapper, errors } = await mountGrid()
    await flush()

    // 合并前：每次注册和每次重新渲染各一轮，300 个单元格共 601 轮。现在：所有注册共用的一轮、
    // GridLayout 自身挂载时的一轮，以及已注册状态触发的重新渲染共用的一轮。轮数不随单元格数增长。
    expect(counters.passes).toBeLessThanOrEqual(3)
    expect(counters.membership).toBeLessThanOrEqual(3 * size)
    expect(counters.linearSearches).toBeLessThan(size)
    expect(wrapper.findAll('.vgl-item:not(.vgl-item--placeholder)').length).toBe(size)
    expect(errors).toEqual([])
    wrapper.unmount()
  })

  it('宽度与 colNum 切换时，所有更新的单元格共用一轮延迟校验', async () => {
    const { wrapper, view, errors } = await mountGrid()
    await flush()

    for (const next of [
      { layout: mobile(), colNum: 1, width: 390 },
      { layout: desktop(), colNum: 12, width: 1200 },
    ]) {
      resetCounters()
      view.value = next
      await flush()

      // 只有外部布局提交后的同步一轮。单元格通过直接写入样式得到新盒子，不会重新渲染，
      // 也不请求延迟校验（此前：1 + 300，之后为 1 + 1 共用）。
      expect(counters.passes).toBe(1)
      expect(counters.membership).toBe(size)
      expect(counters.linearSearches).toBeLessThan(size)
    }
    expect(errors).toEqual([])
    wrapper.unmount()
  })
})

/**
 * 单元格按自己的列表渲染，因此布局可以移除某个 id 而其单元格仍保持挂载。
 * 应用的 `errorHandler` 收集 Vue 转交给它的错误。
 */
async function mountCells(ids: string[]) {
  const layout = ref<Layout>(ids.map((i, k) => ({ i, x: k * 2, y: 0, w: 2, h: 2 })))
  const cells = ref(ids)
  const errors: GridLayoutRuntimeError[] = []
  const appErrors: unknown[] = []

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
        isDraggable: false,
        isResizable: false,
      },
      { default: () => cells.value.map(id => h(Cell, { key: id, id })) },
    )

  const wrapper = mount(host, {
    attachTo: document.body,
    global: { config: { errorHandler: error => void appErrors.push(error) } },
  })
  await flush()
  const element = (id: string) =>
    wrapper.findAll<HTMLElement>('.vgl-item').find(item => item.text().trim() === id)!.element
  const move = (id: string, x: number) =>
    (layout.value = layout.value.map(item => (item.i === id ? { ...item, x } : item)))
  return { wrapper, layout, errors, appErrors, element, move }
}

describe('GridLayout 内的注册表校验', () => {
  it('无效注册在同一次 flush 内上报，早于之后的 nextTick', async () => {
    const { wrapper, errors, element, move } = await mountCells(['a', 'b'])
    offsetParentOverrides.set(element('a'), 'detached')

    move('a', 6)
    // 一次 nextTick 恰好等待重新渲染 `a` 的那次 flush。
    await nextTick()

    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatchObject({
      code: 'invalid-registration',
      cause: { reason: 'invalid-containing-block', id: 'a' },
    })
    wrapper.unmount()
  })

  it('一轮校验先读取所有包含块，再写入被拒绝的元素', async () => {
    const { wrapper, errors, element, move } = await mountCells(['a', 'b', 'c', 'd'])
    offsetParentOverrides.set(element('a'), 'detached')
    offsetParentOverrides.set(element('c'), 'detached')

    // 这里的读取只来自注册表校验（没有拖拽），写入是内联样式修改。
    const log: Array<'read' | 'write'> = []
    const style = CSSStyleDeclaration.prototype
    const setProperty = style.setProperty
    const removeProperty = style.removeProperty
    const readParent = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetParent')!
    Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
      configurable: true,
      get(this: HTMLElement) {
        log.push('read')
        return readParent.get!.call(this)
      },
    })
    style.setProperty = function (this: CSSStyleDeclaration, ...args) {
      log.push('write')
      return setProperty.apply(this, args)
    }
    style.removeProperty = function (this: CSSStyleDeclaration, ...args) {
      log.push('write')
      return removeProperty.apply(this, args)
    }
    try {
      move('a', 8)
      await nextTick()
    } finally {
      style.setProperty = setProperty
      style.removeProperty = removeProperty
    }

    // 被拒绝元素的样式重置若夹在下一个元素的 `offsetParent` 读取之间，每个被拒绝元素都会
    // 强制一次样式与布局计算；一轮中的所有读取必须排在前面。
    const firstRead = log.indexOf('read')
    const pass = log.slice(firstRead)
    expect(pass.filter(entry => entry === 'read')).toHaveLength(4)
    expect(pass.slice(0, 4)).toEqual(['read', 'read', 'read', 'read'])
    expect(pass.slice(4)).toContain('write')
    expect(errors.map(error => (error.cause as { id: string }).id)).toEqual(['a', 'c'])
    expect(errors.map(error => (error.cause as { reason: string }).reason)).toEqual([
      'invalid-containing-block',
      'invalid-containing-block',
    ])
    wrapper.unmount()
  })

  it('被外部布局更新移除的 id 通过索引判定为 missing-id', async () => {
    const { wrapper, layout, errors } = await mountCells(['a', 'b'])
    resetCounters()

    layout.value = layout.value.filter(item => item.i !== 'b')
    await flush()

    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatchObject({
      code: 'invalid-registration',
      cause: { reason: 'missing-id', id: 'b' },
    })
    expect(counters.passes).toBeGreaterThan(0)
    expect(counters.linearSearches).toBe(0)
    wrapper.unmount()
  })

  it('抛错的延迟校验交给应用 errorHandler，不阻断之后的钩子', async () => {
    const { wrapper, appErrors, element, move } = await mountCells(['a', 'b'])
    offsetParentOverrides.set(element('a'), 'throws')

    move('a', 6)
    await flush()
    offsetParentOverrides.clear()

    // 读取失败期间执行的每一轮都上报给应用，没有异常逃逸。
    expect(appErrors.length).toBeGreaterThan(0)
    for (const error of appErrors) {
      expect(error).toMatchObject({ message: 'offsetParent read failed' })
    }

    // Vue 执行 post 回调时没有 try/finally：其中一个抛错会让调度器停住，
    // 之后所有 `updated` 钩子和 `flush: 'post'` watcher 都不再执行。
    const probe = ref(0)
    const seen = { updated: 0, postWatcher: 0 }
    // 独立的应用：探针与网格只共享 Vue 的调度器。
    const other = mount(
      {
        setup() {
          onUpdated(() => (seen.updated += 1))
          return () => h('i', probe.value)
        },
      },
      { attachTo: document.body },
    )
    watch(probe, () => (seen.postWatcher += 1), { flush: 'post' })
    probe.value += 1
    await flush()

    expect(seen).toEqual({ updated: 1, postWatcher: 1 })
    other.unmount()
    wrapper.unmount()
  })
})

function fakeItem(i: LayoutItem['i'], wrapper: HTMLElement): GridItemRegistration {
  return {
    i,
    wrapper,
    state: { registered: false, style: {} },
    resetInteractionState: vi.fn(),
    finishDragInteraction: vi.fn(),
    finishResizeInteraction: vi.fn(),
    refreshPositionStyle: vi.fn(),
    disableInteractionBinding: vi.fn(),
  }
}

function createFixture(ids: LayoutItem['i'][]) {
  const root = document.createElement('div')
  root.className = 'vgl-layout'
  document.body.append(root)
  const scheduled: (() => void)[] = []
  const errors: GridLayoutRuntimeError[] = []
  const layoutIds = new Set(ids)
  let activeId: LayoutItem['i'] | null = null
  const calls: string[] = []
  const registry = createGridItemRegistry({
    itemInstances: new Map(),
    registeredItems: new Set(),
    registrationEpisodes: new WeakMap(),
    isUnavailable: () => false,
    getRoot: () => root,
    hasLayoutItem: id => layoutIds.has(id),
    getActiveInteractionId: () => activeId,
    prepareActiveForTerminal: () => calls.push('prepare'),
    finishActiveForExternalUpdate: () => calls.push('finish'),
    scheduleValidation: callback => scheduled.push(callback),
    nextEvaluationId: () => 0,
    emitError: error => {
      calls.push('error')
      errors.push(error)
    },
  })
  const item = (id: LayoutItem['i']) => {
    const node = document.createElement('div')
    root.append(node)
    return fakeItem(id, node)
  }
  const runScheduled = () => scheduled.splice(0).forEach(callback => callback())
  return {
    root,
    registry,
    scheduled,
    errors,
    calls,
    item,
    runScheduled,
    setActive: (id: LayoutItem['i'] | null) => (activeId = id),
  }
}

describe('元素注册表调度', () => {
  it('将注册与同一 id 的更新合并为一轮延迟校验', () => {
    const fixture = createFixture(['a', 'b'])
    const a = fixture.item('a')
    const b = fixture.item('b')

    fixture.registry.increase(a)
    fixture.registry.increase(b)
    expect(fixture.scheduled).toHaveLength(1)
    fixture.runScheduled()
    expect(a.state.registered).toBe(true)
    expect(b.state.registered).toBe(true)

    fixture.registry.update(a, 'a')
    fixture.registry.update(b, 'b')
    fixture.registry.update(a, 'a')
    expect(fixture.scheduled).toHaveLength(1)
  })

  it('无效注册由延迟校验上报，而不是在更新调用内上报', () => {
    const fixture = createFixture(['a'])
    const a = fixture.item('a')
    fixture.registry.increase(a)
    fixture.runScheduled()

    document.body.append(a.wrapper!)
    fixture.registry.update(a, 'a')
    // 更新本身（GridItem 的 onUpdated）不再同步校验。
    expect(fixture.errors).toEqual([])
    expect(a.state.registered).toBe(true)

    fixture.runScheduled()
    expect(a.state.registered).toBe(false)
    expect(fixture.errors).toHaveLength(1)
    expect(fixture.errors[0]).toMatchObject({
      code: 'invalid-registration',
      cause: { reason: 'outside-root', id: 'a' },
    })
  })

  it('同步校验会消费尚未执行的延迟校验', () => {
    const fixture = createFixture(['a'])
    const a = fixture.item('a')
    fixture.registry.increase(a)
    fixture.runScheduled()

    document.body.append(a.wrapper!)
    fixture.registry.update(a, 'a')
    fixture.registry.validate()
    expect(fixture.errors).toHaveLength(1)

    fixture.runScheduled()
    expect(fixture.errors).toHaveLength(1)

    // 之后的请求会排入新的一轮。
    fixture.registry.update(a, 'a')
    expect(fixture.scheduled).toHaveLength(1)
  })

  it('id 变化仍同步取消旧 id 的进行中交互', () => {
    const fixture = createFixture(['a', 'b'])
    const a = fixture.item('a')
    fixture.registry.increase(a)
    fixture.runScheduled()
    fixture.setActive('a')

    a.i = 'b'
    fixture.registry.update(a, 'a')
    expect(fixture.calls).toEqual(['prepare', 'finish'])
    expect(fixture.scheduled).toHaveLength(1)
  })

  it('被延迟校验判为无效的活动元素保持 prepare、error、finish 顺序', () => {
    const fixture = createFixture(['a'])
    const a = fixture.item('a')
    fixture.registry.increase(a)
    fixture.runScheduled()
    fixture.setActive('a')

    document.body.append(a.wrapper!)
    fixture.registry.update(a, 'a')
    expect(fixture.calls).toEqual([])
    fixture.runScheduled()
    expect(fixture.calls).toEqual(['prepare', 'error', 'finish'])
    expect(a.refreshPositionStyle).toHaveBeenCalledTimes(1)
  })

  it('持续存在的错误只上报一次，恢复后再出现才再次上报', () => {
    const fixture = createFixture(['a'])
    const a = fixture.item('a')
    fixture.registry.increase(a)
    fixture.runScheduled()
    const node = a.wrapper!

    document.body.append(node)
    for (let pass = 0; pass < 3; pass++) {
      fixture.registry.update(a, 'a')
      fixture.runScheduled()
    }
    expect(fixture.errors).toHaveLength(1)

    fixture.root.append(node)
    fixture.registry.update(a, 'a')
    fixture.runScheduled()
    expect(a.state.registered).toBe(true)

    document.body.append(node)
    fixture.registry.update(a, 'a')
    fixture.runScheduled()
    expect(fixture.errors).toHaveLength(2)
  })

  it('首个持有者移除后，另一个同 id 元素接管', () => {
    const fixture = createFixture(['a'])
    const first = fixture.item('a')
    const second = fixture.item('a')
    fixture.registry.increase(first)
    fixture.registry.increase(second)
    fixture.runScheduled()
    expect(first.state.registered).toBe(true)
    expect(second.state.registered).toBe(false)
    expect(fixture.errors[0]).toMatchObject({ cause: { reason: 'duplicate', id: 'a' } })

    fixture.registry.decrease(first)
    fixture.runScheduled()
    expect(second.state.registered).toBe(true)
    expect(fixture.registry.get('a')).toBe(second)
  })
})
