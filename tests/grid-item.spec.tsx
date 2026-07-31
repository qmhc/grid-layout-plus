import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, shallowMount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'

import { GridItem, GridLayout } from '../src'
import { scaledStrategy } from '../src/core/position-strategies'
import { GridLayoutValidationError } from '../src/core/errors'
import { snapshotInteractOption } from '../src/helpers/interact-options'

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
      slots: {
        item: ({ item }: { item: { i: string | number } }) => h('span', String(item.i)),
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

  async function mountManualHost(options: {
    layout: Layout
    id: string
    dragOption?: Readonly<Record<string, unknown>>
    duplicate?: boolean
    isBounded?: boolean
    onError?: () => void
    onMoved?: (...args: unknown[]) => void
  }) {
    const layout = ref(options.layout)
    const id = ref(options.id)
    const dragOption = ref<Readonly<Record<string, unknown>>>(options.dragOption ?? {})
    const isBounded = ref(options.isBounded)
    const showOwner = ref(true)
    const topologyVersion = ref(0)
    const Host = defineComponent(() => {
      return () =>
        h(
          GridLayout,
          {
            layout: layout.value,
            colNum: 4,
            width: 400,
            isResizable: false,
            onError: options.onError,
          },
          {
            default: () => [
              showOwner.value
                ? h(GridItem, {
                    'data-manual-owner': '',
                    key: 'owner',
                    i: id.value,
                    dragOption: dragOption.value,
                    isBounded: isBounded.value,
                    onMoved: options.onMoved,
                    'data-topology-version': topologyVersion.value,
                  })
                : null,
              options.duplicate
                ? h(GridItem, {
                    'data-manual-duplicate': '',
                    key: 'duplicate',
                    i: id.value,
                  })
                : null,
            ],
          },
        )
    })
    const host = mount(Host, { attachTo: document.body })
    const grid = host.findComponent(GridLayout)
    const root = grid.find<HTMLElement>('.vgl-layout')

    for (const item of grid.findAll<HTMLElement>('[data-manual-owner], [data-manual-duplicate]')) {
      Object.defineProperty(item.element, 'offsetParent', {
        configurable: true,
        value: root.element,
      })
      Object.defineProperty(item.element, 'getBoundingClientRect', {
        configurable: true,
        value: () => createRect(10, 10, 100, 50),
      })
    }
    Object.defineProperty(root.element, 'getBoundingClientRect', {
      configurable: true,
      value: () => createRect(0, 0, 400, 400),
    })
    await nextTick()
    await nextTick()
    await nextTick()

    return {
      dragOption,
      grid,
      host,
      id,
      isBounded,
      layout,
      root,
      showOwner,
      topologyVersion,
    }
  }

  it('decorative placeholder 不创建 interactable 或 resize handle', async () => {
    const { wrapper } = await mountItem({ isResizable: true })
    const placeholder = wrapper.find<HTMLElement>('.vgl-item--placeholder')

    expect(placeholder.exists()).toBe(true)
    expect(interactMock.interactables.has(placeholder.element)).toBe(false)
    expect(placeholder.find('.vgl-item__resizer').exists()).toBe(false)

    wrapper.unmount()
  })

  it('仅为可缩放项渲染一个 se 手柄', async () => {
    const { wrapper, item } = await mountItem({ isResizable: true })

    expect(item.findAll('.vgl-item__resizer')).toHaveLength(1)
    expect(item.find('.vgl-item__resizer--se').exists()).toBe(true)

    wrapper.unmount()

    const { wrapper: disabledWrapper, item: disabledItem } = await mountItem({
      isResizable: false,
    })
    expect(disabledItem.find('.vgl-item__resizer').exists()).toBe(false)
    disabledWrapper.unmount()
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

  it('isBounded 关闭时允许拖拽预览从四个方向越过根边界', async () => {
    const { wrapper, item, interactable } = await mountItem({ isBounded: false })
    const listener = interactable.listeners.get('dragstart')!

    listener(dragEvent('dragstart', item.element, 100, 100))
    listener(dragEvent('dragmove', item.element, 70, 70))
    await nextTick()
    expect(item.element.style.transform).toBe('translate3d(-20px, -20px, 0)')

    listener(dragEvent('dragmove', item.element, 1400, 800))
    await nextTick()
    expect(item.element.style.transform).toBe('translate3d(1310px, 710px, 0)')

    wrapper.unmount()
  })

  it('isBounded 开启时仍限制拖拽预览的上、左边界', async () => {
    const { wrapper, item, interactable } = await mountItem({ isBounded: true })
    const parent = wrapper.find<HTMLElement>('.vgl-layout')
    Object.defineProperty(parent.element, 'clientWidth', {
      configurable: true,
      value: 1200,
    })
    Object.defineProperty(parent.element, 'clientHeight', {
      configurable: true,
      value: 600,
    })
    const listener = interactable.listeners.get('dragstart')!

    listener(dragEvent('dragstart', item.element, 100, 100))
    listener(dragEvent('dragmove', item.element, 70, 70))
    await nextTick()

    expect(item.element.style.transform).toBe('translate3d(0px, 0px, 0)')
    wrapper.unmount()
  })

  it('达到 dragThreshold 的原始事件直接进入 interaction-start payload', async () => {
    const { wrapper, item, interactable } = await mountItem({ dragThreshold: 10 })
    const listener = interactable.listeners.get('dragstart')!
    const start = dragEvent('dragstart', item.element, 100, 100)
    const thresholdEvent = dragEvent('dragmove', item.element, 106, 108)

    listener(start)
    listener(thresholdEvent)
    await nextTick()

    const payload = wrapper.emitted('interaction-start')?.[0]?.[0] as
      | { nativeEvent: Event }
      | undefined
    expect(payload?.nativeEvent).toBe(thresholdEvent)
    expect(payload?.nativeEvent.type).toBe('dragmove')
    wrapper.unmount()
  })

  it('interact option 快照拒绝 accessor 与非法值', () => {
    const getter = vi.fn(() => 1)
    const withGetter = {}
    Object.defineProperty(withGetter, 'hold', { enumerable: true, get: getter })

    expect(() => snapshotInteractOption(withGetter, 'dragOption')).toThrowError(
      GridLayoutValidationError,
    )
    expect(getter).not.toHaveBeenCalled()
    expect(() => snapshotInteractOption({ mouseButtons: -1 }, 'resizeOption')).toThrowError(
      GridLayoutValidationError,
    )
    expect(snapshotInteractOption({ lockAxis: 'start', autoScroll: true }, 'dragOption')).toEqual({
      lockAxis: 'start',
      autoScroll: true,
    })
  })

  it('bounded begin 在 item 大于 root 时拒绝且不开始 interaction', async () => {
    const { wrapper, item, interactable } = await mountItem({ isBounded: true })
    const parent = wrapper.find<HTMLElement>('.vgl-layout')
    Object.defineProperty(parent.element, 'clientWidth', {
      configurable: true,
      value: 40,
    })
    Object.defineProperty(parent.element, 'clientHeight', {
      configurable: true,
      value: 40,
    })
    const listener = interactable.listeners.get('dragstart')!

    listener(dragEvent('dragstart', item.element, 100, 100))
    await nextTick()

    expect(wrapper.emitted('interaction-start')).toBeUndefined()
    expect(wrapper.emitted('operation-rejected')?.[0]?.[0]).toMatchObject({
      operation: 'move',
      reason: 'out-of-bounds',
      id: 'item',
    })
    expect(item.classes()).not.toContain('vgl-item--dragging')
    wrapper.unmount()
  })

  it('手动 GridItem 的 isBounded 变化取消 active drag', async () => {
    const fixture = await mountManualHost({
      layout: [{ i: 'manual', x: 0, y: 0, w: 1, h: 1 }],
      id: 'manual',
      isBounded: false,
    })
    const item = fixture.grid.find<HTMLElement>('[data-manual-owner]')
    const interactable = interactMock.interactables.get(item.element)
    const listener = interactable.listeners.get('dragstart')!

    listener(dragEvent('dragstart', item.element, 10, 10))
    await nextTick()
    expect(fixture.grid.emitted('interaction-start')).toHaveLength(1)
    expect(item.classes()).toContain('vgl-item--dragging')

    fixture.isBounded.value = true
    await nextTick()
    await nextTick()

    expect(fixture.grid.emitted('interaction-end')).toHaveLength(1)
    expect(fixture.grid.emitted('interaction-end')?.[0]?.[0]).toMatchObject({
      status: 'cancelled',
      reason: 'config-changed',
    })
    fixture.host.unmount()
  })

  it('手动 GridItem 在组件 update 后立即重验 DOM ownership', async () => {
    const fixture = await mountManualHost({
      layout: [{ i: 'manual', x: 0, y: 0, w: 1, h: 1 }],
      id: 'manual',
    })
    const item = fixture.grid.find<HTMLElement>('[data-manual-owner]')
    const interactable = interactMock.interactables.get(item.element)
    const listener = interactable.listeners.get('dragstart')!

    listener(dragEvent('dragstart', item.element, 10, 10))
    await nextTick()
    expect(fixture.grid.emitted('interaction-start')).toHaveLength(1)

    document.body.append(item.element)
    fixture.topologyVersion.value += 1
    await nextTick()
    await nextTick()

    const ordered = Object.entries(fixture.grid.emitted())
      .flatMap(([name, emissions]) => emissions.map(args => ({ name, args })))
      .filter(event => ['error', 'interaction-end'].includes(event.name))
      .slice(-2)
    expect(ordered.map(event => event.name)).toEqual(['error', 'interaction-end'])
    expect(ordered[0].args[0]).toMatchObject({
      code: 'invalid-registration',
      source: 'grid-item',
      cause: { reason: 'outside-root', id: 'manual' },
    })
    expect(ordered[1].args[0]).toMatchObject({
      status: 'cancelled',
      reason: 'external-update',
    })
    const itemComponent = fixture.grid
      .findAllComponents(GridItem)
      .find(component => component.attributes('data-manual-owner') !== undefined)!
    expect((itemComponent.vm as any).state).toMatchObject({
      isDragging: false,
      dragging: { top: -1, left: -1 },
    })
    expect(item.classes()).not.toContain('vgl-item--dragging')
    expect(interactable.draggable).toHaveBeenCalledWith({ enabled: false })

    fixture.root.element.append(item.element)
    fixture.topologyVersion.value += 1
    await nextTick()
    await nextTick()
    listener(dragEvent('dragstart', item.element, 10, 10))
    await nextTick()
    expect(fixture.grid.emitted('interaction-start')).toHaveLength(2)
    fixture.host.unmount()
  })

  it('idle 手动 GridItem ownership 失效时在 error 前同步清空 style', async () => {
    let itemState: { style: Record<string, string> } | null = null
    let styleAtError: Record<string, string> | null = null
    const fixture = await mountManualHost({
      layout: [{ i: 'manual', x: 0, y: 0, w: 1, h: 1 }],
      id: 'manual',
      onError: () => {
        styleAtError = { ...itemState!.style }
      },
    })
    const item = fixture.grid.find<HTMLElement>('[data-manual-owner]')
    const itemComponent = fixture.grid
      .findAllComponents(GridItem)
      .find(component => component.attributes('data-manual-owner') !== undefined)!
    itemState = (itemComponent.vm as any).state
    expect(itemState!.style).not.toEqual({})

    document.body.append(item.element)
    fixture.topologyVersion.value += 1
    await nextTick()
    await nextTick()

    expect(styleAtError).toEqual({})
    expect(itemState!.style).toEqual({})
    expect(item.attributes('style')).toBeUndefined()
    fixture.host.unmount()
  })

  it('scaledStrategy 将视觉指针位移还原到布局坐标', async () => {
    const { wrapper, item, interactable } = await mountItem(
      { positionStrategy: scaledStrategy(0.5) },
      0.5,
    )
    const listener = interactable.listeners.get('dragstart')!

    listener(dragEvent('dragstart', item.element, 55, 105))
    await nextTick()
    expect(item.attributes('style')).toContain('translate3d(10px, 10px, 0)')

    listener(dragEvent('dragmove', item.element, 65, 115))
    await vi.waitFor(() => {
      expect(item.attributes('style')).toContain('translate3d(30px, 30px, 0)')
    })

    wrapper.unmount()
  })

  it('手动 GridItem 随父 Layout 在 missing 与 valid 状态间重新注册', async () => {
    const fixture = await mountManualHost({
      layout: [{ i: 'other', x: 0, y: 0, w: 1, h: 1 }],
      id: 'manual',
    })
    const item = fixture.grid.find<HTMLElement>('[data-manual-owner]')

    expect(item.attributes('style')).toBeUndefined()
    expect(fixture.grid.emitted('error')?.at(-1)?.[0]).toMatchObject({
      code: 'invalid-registration',
      cause: { reason: 'missing-id', id: 'manual' },
    })

    fixture.layout.value = [
      { i: 'other', x: 0, y: 0, w: 1, h: 1 },
      { i: 'manual', x: 2, y: 1, w: 2, h: 1 },
    ]
    await nextTick()
    await nextTick()
    await nextTick()
    expect(item.attributes('style')).toContain('translate3d(205px, 170px, 0)')

    fixture.layout.value = [{ i: 'other', x: 0, y: 0, w: 1, h: 1 }]
    await nextTick()
    await nextTick()
    await nextTick()
    expect(item.attributes('style')).toBeUndefined()
    expect(
      (fixture.grid.emitted('error') ?? []).filter(
        args => (args[0] as any).cause?.reason === 'missing-id',
      ),
    ).toHaveLength(2)
    fixture.host.unmount()
  })

  it('手动 GridItem 的 i 变化会注销旧 id 并注册新 id', async () => {
    const fixture = await mountManualHost({
      layout: [
        { i: 'first', x: 0, y: 0, w: 1, h: 1 },
        { i: 'second', x: 2, y: 1, w: 2, h: 1 },
      ],
      id: 'first',
    })
    const item = fixture.grid.find<HTMLElement>('[data-manual-owner]')

    expect(item.attributes('style')).toContain('translate3d(10px, 10px, 0)')
    fixture.id.value = 'second'
    await nextTick()
    await nextTick()
    await nextTick()
    expect(item.attributes('style')).toContain('translate3d(205px, 10px, 0)')
    fixture.host.unmount()
  })

  it('最早 duplicate owner 卸载后自动晋升仍挂载项', async () => {
    const fixture = await mountManualHost({
      layout: [{ i: 'manual', x: 1, y: 0, w: 2, h: 1 }],
      id: 'manual',
      duplicate: true,
    })
    const duplicate = fixture.grid.find<HTMLElement>('[data-manual-duplicate]')

    expect(duplicate.attributes('style')).toBeUndefined()
    expect(fixture.grid.emitted('error')?.at(-1)?.[0]).toMatchObject({
      code: 'invalid-registration',
      cause: { reason: 'duplicate', id: 'manual' },
    })

    fixture.showOwner.value = false
    await nextTick()
    await vi.waitFor(() => {
      expect(duplicate.attributes('style')).toContain('translate3d(107.5px, 10px, 0)')
    })
    fixture.host.unmount()
  })

  it('动态 interact option 保留 last-valid binding 并在合法更新后重建', async () => {
    const fixture = await mountManualHost({
      layout: [{ i: 'manual', x: 0, y: 0, w: 1, h: 1 }],
      id: 'manual',
      dragOption: { lockAxis: 'x' },
    })
    const item = fixture.grid.find<HTMLElement>('[data-manual-owner]')
    const interactable = interactMock.interactables.get(item.element)
    expect(interactable.draggable).toHaveBeenLastCalledWith(
      expect.objectContaining({ lockAxis: 'x', ignoreFrom: 'a, button' }),
    )
    const callCount = interactable.draggable.mock.calls.length

    fixture.dragOption.value = { listeners: {} }
    await nextTick()
    await nextTick()
    expect(interactable.draggable).toHaveBeenCalledTimes(callCount)
    expect(fixture.grid.emitted('error')?.at(-1)?.[0]).toMatchObject({
      code: 'invalid-config',
      path: 'gridItem.dragOption["listeners"]',
    })

    fixture.dragOption.value = { lockAxis: 'y' }
    await nextTick()
    await nextTick()
    expect(interactable.draggable).toHaveBeenLastCalledWith(
      expect.objectContaining({ lockAxis: 'y', ignoreFrom: 'a, button' }),
    )
    fixture.host.unmount()
  })

  it('active 时非法 interact option 按统一 config 时序终止', async () => {
    const fixture = await mountManualHost({
      layout: [{ i: 'manual', x: 0, y: 0, w: 1, h: 1 }],
      id: 'manual',
      dragOption: { lockAxis: 'x' },
    })
    const item = fixture.grid.find<HTMLElement>('[data-manual-owner]')
    const interactable = interactMock.interactables.get(item.element)
    interactable.listeners.get('dragstart')!(dragEvent('dragstart', item.element, 10, 10))
    await nextTick()

    fixture.dragOption.value = { listeners: {} }
    await nextTick()
    await nextTick()

    const ordered = Object.entries(fixture.grid.emitted())
      .flatMap(([name, emissions]) => emissions.map(args => ({ name, args })))
      .filter(event => ['error', 'operation-rejected', 'interaction-end'].includes(event.name))
      .slice(-3)
    expect(ordered.map(event => event.name)).toEqual([
      'error',
      'operation-rejected',
      'interaction-end',
    ])
    expect(ordered[1].args[0]).toMatchObject({
      operation: 'config',
      id: 'manual',
      reason: 'invalid-input',
    })
    expect((ordered[1].args[0] as any).evaluationId).toBe((ordered[0].args[0] as any).evaluationId)
    expect(ordered[2].args[0]).toMatchObject({
      status: 'cancelled',
      reason: 'config-changed',
    })
    fixture.host.unmount()
  })

  it('legacy terminal listener 外抛后静默清理 interaction', async () => {
    const listenerError = new Error('legacy moved listener failure')
    const fixture = await mountManualHost({
      layout: [{ i: 'manual', x: 0, y: 0, w: 1, h: 1 }],
      id: 'manual',
      onMoved: () => {
        throw listenerError
      },
    })
    ;(fixture.host.vm.$.appContext.config as any).errorHandler = (error: unknown) => {
      throw error
    }
    const item = fixture.grid.find<HTMLElement>('[data-manual-owner]')
    const interactable = interactMock.interactables.get(item.element)
    const listener = interactable.listeners.get('dragstart')!

    listener(dragEvent('dragstart', item.element, 10, 10))
    Object.defineProperty(item.element, 'getBoundingClientRect', {
      configurable: true,
      value: () => createRect(110, 10, 200, 50),
    })

    expect(() => listener(dragEvent('dragend', item.element, 110, 10))).toThrowError(listenerError)
    expect((fixture.grid.vm as any).state).toMatchObject({
      isDragging: false,
      placeholder: { x: 0, y: 0, w: 0, h: 0, i: '' },
    })
    expect(fixture.grid.emitted('interaction-end')).toBeUndefined()

    listener(dragEvent('dragstart', item.element, 110, 10))
    expect(fixture.grid.emitted('interaction-start')).toHaveLength(2)
    fixture.host.unmount()
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
      const re = new RegExp(`${key}:\\s*(-?\\d+(?:\\.\\d+)?)px`)
      const m = styleStr.match(re)
      return m ? Number(m[1]) : NaN
    }

    let left = get('left')
    if (Number.isNaN(left)) {
      const m = styleStr.match(/translate3d\((-?\d+(?:\.\d+)?)px/)
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
          width: containerWidth,
          isDraggable: false,
          isResizable: false,
        },
        slots: {
          item: ({ item }: { item: { i: string | number } }) => h('span', String(item.i)),
        },
        attachTo: document.body,
      })

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
        ).toBeCloseTo(expectedNext, 5)
      }

      // 最后一个 item 的右边界 + margin === 容器宽度
      const last = parsed[colNum - 1]
      expect(
        last.left + last.width + marginX,
        `last item right edge + margin should == ${containerWidth}`,
      ).toBeCloseTo(containerWidth, 5)

      wrapper.unmount()
    })
  }
})
