import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'

import { GridItem, GridLayout, noCompactor } from '../src'

import type { Layout } from '../src'

async function settle(): Promise<void> {
  await nextTick()
  await nextTick()
  await nextTick()
}

describe('Phase 2 review regressions', () => {
  it('初始非法 PositionStrategy shape 在 setup 同步抛出且不调用 callback', () => {
    const callback = vi.fn()
    expect(() =>
      mount(GridLayout, {
        props: {
          layout: [{ i: 'a', x: 0, y: 0, w: 1, h: 1 }],
          width: 400,
          positionStrategy: {
            usesCssTransforms: false,
            getStyle: callback,
          } as any,
        },
      }),
    ).toThrow(
      expect.objectContaining({
        name: 'GridLayoutValidationError',
        code: 'invalid-config',
        path: 'config.positionStrategy.getRtlStyle',
      }),
    )
    expect(callback).not.toHaveBeenCalled()
  })

  it('后续非法 PositionStrategy shape 保留旧 snapshot/style 并按 config 拒绝', async () => {
    const getStyle = vi.fn((top: number, left: number, width: number, height: number) => ({
      top: `${top}px`,
      left: `${left}px`,
      width: `${width}px`,
      height: `${height}px`,
    }))
    const getRtlStyle = vi.fn((top: number, right: number, width: number, height: number) => ({
      top: `${top}px`,
      right: `${right}px`,
      width: `${width}px`,
      height: `${height}px`,
    }))
    const invalidGetStyle = vi.fn()
    const wrapper = mount(GridLayout, {
      props: {
        layout: [{ i: 'a', x: 0, y: 0, w: 1, h: 1 }],
        width: 400,
        positionStrategy: {
          usesCssTransforms: false,
          getStyle,
          getRtlStyle,
        },
      },
      slots: {
        item: ({ item }: { item: { i: string | number } }) => h('span', String(item.i)),
      },
    })
    await settle()
    const item = wrapper.findComponent(GridItem)
    const previousStyle = { ...(item.vm as any).state.style }

    await wrapper.setProps({
      positionStrategy: {
        usesCssTransforms: false,
        getStyle: invalidGetStyle,
        getRtlStyle,
        extra: true,
      } as any,
    })
    await settle()

    expect(wrapper.emitted('error')?.at(-1)?.[0]).toMatchObject({
      code: 'invalid-config',
      source: 'config',
      path: 'config.positionStrategy.extra',
    })
    expect(wrapper.emitted('operation-rejected')?.at(-1)?.[0]).toMatchObject({
      operation: 'config',
      reason: 'invalid-input',
      id: null,
      candidate: null,
    })
    expect((item.vm as any).state.style).toEqual(previousStyle)
    expect(invalidGetStyle).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('父组件 ref 只暴露冻结的 GridLayout API', async () => {
    const grid = ref<Record<string, unknown> | null>(null)
    const Host = defineComponent(() => {
      return () =>
        h(GridLayout, {
          ref: grid,
          layout: [{ i: 'a', x: 0, y: 0, w: 1, h: 1 }],
        })
    })
    const host = mount(Host)
    await settle()

    expect(grid.value).not.toBeNull()
    expect(grid.value).toMatchObject({
      root: expect.anything(),
      setLayout: expect.any(Function),
      moveItem: expect.any(Function),
      resizeItem: expect.any(Function),
      addItem: expect.any(Function),
      removeItem: expect.any(Function),
      bringToFront: expect.any(Function),
      sendToBack: expect.any(Function),
    })
    for (const legacy of [
      'state',
      'getItem',
      'dragEvent',
      'resizeEvent',
      'layoutUpdate',
      'effectiveConfig',
      'cancelInteraction',
    ]) {
      expect(grid.value?.[legacy], legacy).toBeUndefined()
    }
    host.unmount()
  })

  it('最新 expected echo 优先于同值 superseded signature', async () => {
    const layout: Layout = [{ i: 'a', x: 0, y: 0, w: 1, h: 1 }]
    const wrapper = mount(GridLayout, {
      props: {
        layout,
        colNum: 4,
        compactor: noCompactor,
        'onUpdate:layout': vi.fn(),
      },
    })
    const vm = wrapper.vm as any

    const first = vm.moveItem('a', 1, 0)
    const second = vm.moveItem('a', 2, 0)
    const latest = vm.moveItem('a', 1, 0)
    expect([first.status, second.status, latest.status]).toEqual(['pending', 'pending', 'pending'])

    await wrapper.setProps({
      layout: [{ i: 'a', x: 1, y: 0, w: 1, h: 1 }],
    })
    await settle()

    const updated = wrapper.emitted('layout-updated') ?? []
    expect(updated.at(-1)?.[1]).toMatchObject({ revision: latest.revision })
    const rejected = (wrapper.emitted('operation-rejected') ?? []).map(args => args[0] as any)
    expect(rejected.filter(payload => payload.reason === 'superseded')).toHaveLength(2)
    expect(
      rejected.some(
        payload =>
          payload.revision === latest.revision && payload.reason === 'external-not-committed',
      ),
    ).toBe(false)
    wrapper.unmount()
  })

  it('active collision rejection 暴露被拒绝的 candidate', async () => {
    const layout: Layout = [
      { i: 'active', x: 0, y: 0, w: 1, h: 1 },
      { i: 'blocker', x: 1, y: 0, w: 1, h: 1 },
    ]
    const wrapper = mount(GridLayout, {
      props: {
        layout,
        colNum: 4,
        collisionMode: 'prevent',
        compactor: noCompactor,
      },
      slots: {
        item: ({ item }: { item: { i: string | number } }) => h('span', String(item.i)),
      },
    })
    await settle()

    const vm = wrapper.vm as any
    vm.dragEvent('dragstart', 'active', 1, 0, 1, 1)

    const payload = wrapper.emitted('operation-rejected')?.at(-1)?.[0] as any
    expect(payload).toMatchObject({
      operation: 'move',
      reason: 'collision',
      id: 'active',
      candidate: { i: 'active', x: 1, y: 0, w: 1, h: 1 },
    })
    wrapper.unmount()
  })

  it('idle PositionStrategy preflight 失败共享 evaluationId 并发送 config rejection', async () => {
    const wrapper = mount(GridLayout, {
      props: {
        layout: [{ i: 'a', x: 0, y: 0, w: 1, h: 1 }],
        width: 400,
      },
      slots: {
        item: ({ item }: { item: { i: string | number } }) => h('span', String(item.i)),
      },
    })
    await settle()

    await wrapper.setProps({
      positionStrategy: {
        usesCssTransforms: false,
        getStyle: (top: number, left: number, width: number, height: number) => ({
          top: `${top}px`,
          left: `${left}px`,
          width: `${width + 1}px`,
          height: `${height}px`,
        }),
        getRtlStyle: (top: number, right: number, width: number, height: number) => ({
          top: `${top}px`,
          right: `${right}px`,
          width: `${width}px`,
          height: `${height}px`,
        }),
      },
    })
    await settle()

    const error = wrapper.emitted('error')?.at(-1)?.[0] as any
    const rejected = wrapper.emitted('operation-rejected')?.at(-1)?.[0] as any
    expect(error).toMatchObject({
      code: 'extension-invalid-result',
      source: 'position-strategy',
      path: 'layout[0].style["width"]',
    })
    expect(rejected).toMatchObject({
      operation: 'config',
      reason: 'extension-invalid-result',
      id: null,
      candidate: null,
    })
    expect(rejected.evaluationId).toBe(error.evaluationId)
    expect(rejected.layout).toEqual(rejected.previousLayout)
    wrapper.unmount()
  })

  it('active PositionStrategy preflight 失败按 error/rejected/terminal 顺序结束', async () => {
    let terminalStyle: Record<string, string> | null = null
    const wrapper = mount(GridLayout, {
      props: {
        layout: [{ i: 'a', x: 0, y: 0, w: 1, h: 1 }],
        width: 400,
        onInteractionEnd: () => {
          terminalStyle = { ...(wrapper.findComponent(GridItem).vm as any).state.style }
        },
      },
      slots: {
        item: ({ item }: { item: { i: string | number } }) => h('span', String(item.i)),
      },
    })
    await settle()
    const vm = wrapper.vm as any
    const item = wrapper.findComponent(GridItem)
    const committedStyle = { ...(item.vm as any).state.style }
    vm.dragEvent('dragstart', 'a', 0, 0, 1, 1)
    ;(item.vm as any).state.isDragging = true
    ;(item.vm as any).state.dragging = { top: 123, left: 234 }
    ;(item.vm as any).state.style = { top: '123px', left: '234px' }

    await wrapper.setProps({
      positionStrategy: {
        usesCssTransforms: false,
        getStyle: () => {
          throw new Error('strategy failed')
        },
        getRtlStyle: () => ({ top: '0px', left: '0px', width: '100px', height: '100px' }),
      },
    })
    await settle()

    const ordered = Object.entries(wrapper.emitted())
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
      reason: 'extension-error',
      id: 'a',
      candidate: { i: 'a', x: 0, y: 0, w: 1, h: 1 },
    })
    expect((ordered[1].args[0] as any).evaluationId).toBe((ordered[0].args[0] as any).evaluationId)
    expect(ordered[2].args[0]).toMatchObject({
      status: 'cancelled',
      reason: 'extension-error',
    })
    expect(terminalStyle).toEqual(committedStyle)
    expect((item.vm as any).state.style).toEqual(committedStyle)
    expect((item.vm as any).state.isDragging).toBe(false)
    wrapper.unmount()
  })

  it('PositionStrategy 按真实 item 几何整批预检并保留旧样式', async () => {
    const failure = new Error('second item style failed')
    const wrapper = mount(GridLayout, {
      props: {
        layout: [
          { i: 'a', x: 0, y: 0, w: 1, h: 1 },
          { i: 'b', x: 1, y: 0, w: 2, h: 1 },
        ],
        colNum: 4,
        width: 400,
      },
      slots: {
        default: () => h(GridItem, { i: 'a' }),
      },
    })
    await settle()
    const items = wrapper.findAll('.vgl-item:not(.vgl-item--placeholder)')
    expect(items).toHaveLength(1)
    const previousStyles = items.map(item => item.attributes('style'))

    await wrapper.setProps({
      positionStrategy: {
        usesCssTransforms: false,
        getStyle: (top: number, left: number, width: number, height: number) => {
          if (width > 100) throw failure
          return {
            top: `${top}px`,
            left: `${left}px`,
            width: `${width}px`,
            height: `${height}px`,
          }
        },
        getRtlStyle: (top: number, right: number, width: number, height: number) => ({
          top: `${top}px`,
          right: `${right}px`,
          width: `${width}px`,
          height: `${height}px`,
        }),
      },
    })
    await settle()

    expect(wrapper.emitted('error')?.at(-1)?.[0]).toMatchObject({
      code: 'extension-error',
      source: 'position-strategy',
      path: 'layout[1].style',
      cause: failure,
    })
    expect(wrapper.emitted('operation-rejected')?.at(-1)?.[0]).toMatchObject({
      operation: 'config',
      reason: 'extension-error',
    })
    expect(items.map(item => item.attributes('style'))).toEqual(previousStyles)
    wrapper.unmount()
  })

  it('active 策略切换使用 committed Layout 几何预检', async () => {
    const getStyle = vi.fn((top: number, left: number, width: number, height: number) => {
      if (left !== 10) throw new Error(`unexpected working left ${left}`)
      return {
        top: `${top}px`,
        left: `${left}px`,
        width: `${width}px`,
        height: `${height}px`,
      }
    })
    const wrapper = mount(GridLayout, {
      props: {
        layout: [{ i: 'a', x: 0, y: 0, w: 1, h: 1 }],
        colNum: 4,
        width: 400,
      },
      slots: {
        item: ({ item }: { item: { i: string | number } }) => h('span', String(item.i)),
      },
    })
    await settle()
    const vm = wrapper.vm as any
    vm.dragEvent('dragstart', 'a', 2, 0, 1, 1)

    await wrapper.setProps({
      positionStrategy: {
        usesCssTransforms: false,
        getStyle,
        getRtlStyle: (top: number, right: number, width: number, height: number) => ({
          top: `${top}px`,
          right: `${right}px`,
          width: `${width}px`,
          height: `${height}px`,
        }),
      },
    })
    await settle()

    expect(getStyle).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('error')).toBeUndefined()
    expect(wrapper.emitted('interaction-end')?.at(-1)?.[0]).toMatchObject({
      status: 'cancelled',
      reason: 'config-changed',
    })
    wrapper.unmount()
  })

  it('第二次 begin 的 interaction-active 不发送 rejected 通知', async () => {
    const wrapper = mount(GridLayout, {
      props: {
        layout: [
          { i: 'a', x: 0, y: 0, w: 1, h: 1 },
          { i: 'b', x: 1, y: 0, w: 1, h: 1 },
        ],
      },
      slots: {
        item: ({ item }: { item: { i: string | number } }) => h('span', String(item.i)),
      },
    })
    await settle()
    const vm = wrapper.vm as any
    vm.dragEvent('dragstart', 'a', 0, 0, 1, 1)
    vm.dragEvent('dragstart', 'b', 1, 0, 1, 1)

    const reasons = (wrapper.emitted('operation-rejected') ?? []).map(
      args => (args[0] as any).reason,
    )
    expect(reasons).not.toContain('interaction-active')
    wrapper.unmount()
  })

  it('手动 GridItem 忽略 mirror 几何并读取父 Layout', async () => {
    const layout: Layout = [{ i: 'a', x: 0, y: 0, w: 1, h: 1 }]
    const wrapper = mount(GridLayout, {
      props: {
        layout,
        colNum: 4,
        width: 400,
      },
      slots: {
        default: () =>
          h(
            GridItem,
            { i: 'a', x: 3, y: 4, w: 4, h: 4, static: true, isDraggable: false },
            () => 'manual',
          ),
      },
      attachTo: document.body,
    })
    const root = wrapper.find<HTMLElement>('.vgl-layout')
    const item = wrapper.find<HTMLElement>('.vgl-item:not(.vgl-item--placeholder)')
    Object.defineProperty(item.element, 'offsetParent', {
      configurable: true,
      value: root.element,
    })
    await settle()

    expect(item.classes()).not.toContain('vgl-item--static')
    expect(item.attributes('style')).toContain('translate3d(10px, 10px, 0)')
    expect(item.attributes('style')).toContain('width: 87.5px')
    wrapper.unmount()
  })

  it('CSS zIndex 对极值和相同语义值生成稳定有限 rank', async () => {
    const wrapper = mount(GridLayout, {
      props: {
        layout: [
          { i: 'low', x: 0, y: 0, w: 1, h: 1, zIndex: Number.MIN_SAFE_INTEGER },
          { i: 'same-a', x: 1, y: 0, w: 1, h: 1, zIndex: 7 },
          { i: 'same-b', x: 2, y: 0, w: 1, h: 1, zIndex: 7 },
          { i: 'high', x: 3, y: 0, w: 1, h: 1, zIndex: Number.MAX_SAFE_INTEGER },
        ],
        width: 400,
        colNum: 4,
        collisionMode: 'overlap',
      },
      slots: {
        item: ({ item }: { item: { i: string | number } }) => h('span', String(item.i)),
      },
    })
    await settle()

    const ranks = wrapper
      .findAll('.vgl-item:not(.vgl-item--placeholder)')
      .map(item => item.attributes('style').match(/--vgl-item-z-index:\s*(\d+)/)?.[1])
    expect(ranks).toEqual(['0', '1', '2', '3'])
    wrapper.unmount()
  })
})
