import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { h, nextTick } from 'vue'

import {
  GridItem,
  GridLayout,
  collides,
  noCompactor,
  useGridLayout,
  verticalCompactor,
  withOverlap,
} from '../src'

import type { ComponentPublicInstance } from 'vue'
import type { CollisionMode, Compactor, Layout } from '../src'

const componentStyles = readFileSync(resolve(process.cwd(), 'src/style.scss'), 'utf-8')

interface GridLayoutInstance extends ComponentPublicInstance {
  state: {
    width: number
    isDragging: boolean
    lastBreakpoint: string | null
    layouts: Record<string, Layout>
  }
  effectiveConfig: {
    collisionMode: CollisionMode
  }
  dragEvent: (
    eventName: string,
    id: number | string,
    x: number,
    y: number,
    h: number,
    w: number,
  ) => void
  resizeEvent: (
    eventName: string,
    id: number | string,
    x: number,
    y: number,
    h: number,
    w: number,
  ) => void
  bringToFront: (id: number | string) => unknown
  sendToBack: (id: number | string) => unknown
}

async function mountGrid(layout: Layout, props: Record<string, unknown> = {}) {
  const wrapper = mount(GridLayout, {
    props: {
      layout,
      width: 1200,
      isDraggable: true,
      isResizable: true,
      'onUpdate:layout': (nextLayout: Layout) => {
        const current = wrapper.props('layout') as Layout
        for (const target of new Set([layout, current])) {
          target.splice(0, target.length, ...nextLayout.map(item => ({ ...item })))
        }
        void wrapper.setProps({
          layout: nextLayout.map(item => ({ ...item })),
        })
      },
      'onUpdate:responsiveLayouts': (nextLayouts: Record<string, Layout>) => {
        void wrapper.setProps({
          responsiveLayouts: Object.fromEntries(
            Object.entries(nextLayouts).map(([key, value]) => [
              key,
              value.map(item => ({ ...item })),
            ]),
          ),
        })
      },
      ...props,
    },
    slots: {
      item: ({ item }: { item: { i: string | number } }) => h('span', String(item.i)),
    },
  })

  await nextTick()
  await nextTick()
  await nextTick()

  return {
    wrapper,
    vm: wrapper.vm as unknown as GridLayoutInstance,
  }
}

describe('collisionMode', () => {
  it.each([
    ['push', 'drag'],
    ['prevent', 'drag'],
    ['overlap', 'drag'],
    ['push', 'resize'],
    ['prevent', 'resize'],
    ['overlap', 'resize'],
  ] as const)('组件与 headless 的 %s/%s 结果一致', async (collisionMode, type) => {
    const layout: Layout = [
      { i: 'active', x: 0, y: 0, w: 1, h: 1 },
      { i: 'blocker', x: 1, y: 0, w: 1, h: 1 },
    ]
    const headless = useGridLayout({
      layout: layout.map(item => ({ ...item })),
      cols: 4,
      collisionMode,
      compactor: noCompactor,
    })
    const started = headless.beginInteraction({
      type,
      id: 'active',
      nativeEvent: null,
    })
    expect(started.status).toBe('accepted')
    if (started.status !== 'accepted') return
    const first =
      type === 'drag'
        ? headless.updateInteraction(started.token, {
            type,
            x: 1,
            y: 0,
            nativeEvent: null,
          })
        : headless.updateInteraction(started.token, {
            type,
            w: 2,
            h: 1,
            nativeEvent: null,
          })
    expect(first.status).toBe(collisionMode === 'prevent' ? 'rejected' : 'accepted')
    const expected =
      type === 'drag'
        ? headless.updateInteraction(started.token, {
            type,
            x: 2,
            y: 0,
            nativeEvent: null,
          })
        : headless.updateInteraction(started.token, {
            type,
            w: 3,
            h: 1,
            nativeEvent: null,
          })
    headless.endInteraction(started.token)

    const { wrapper, vm } = await mountGrid(layout, {
      collisionMode,
      compactor: noCompactor,
    })
    if (type === 'drag') {
      vm.dragEvent('dragstart', 'active', 1, 0, 1, 1)
      vm.dragEvent('dragmove', 'active', 2, 0, 1, 1)
      vm.dragEvent('dragend', 'active', 2, 0, 1, 1)
    } else {
      vm.resizeEvent('resizestart', 'active', 0, 0, 1, 2)
      vm.resizeEvent('resizemove', 'active', 0, 0, 1, 3)
      vm.resizeEvent('resizeend', 'active', 0, 0, 1, 3)
    }

    expect(layout).toEqual(expected.layout)
    wrapper.unmount()
  })

  it('overlap 模式保留位置并跳过 compactor', async () => {
    const compact = vi.fn((layout: Layout) => layout.map(item => ({ ...item, y: 0 })))
    const compactor: Compactor = { compact }
    const layout: Layout = [
      { i: '1', x: 0, y: 3, w: 2, h: 2 },
      { i: '2', x: 0, y: 3, w: 2, h: 2 },
    ]
    const { wrapper } = await mountGrid(layout, {
      collisionMode: 'overlap',
      compactor,
    })

    expect(compact).not.toHaveBeenCalled()
    expect(layout.map(item => item.y)).toEqual([3, 3])
    wrapper.unmount()
  })

  it('拖动允许重叠且不会移动其他元素', async () => {
    const layout: Layout = [
      { i: '1', x: 0, y: 0, w: 1, h: 1 },
      { i: '2', x: 1, y: 0, w: 1, h: 1 },
    ]
    const { wrapper, vm } = await mountGrid(layout, { collisionMode: 'overlap' })

    vm.dragEvent('dragstart', '1', 1, 0, 1, 1)
    vm.dragEvent('dragend', '1', 1, 0, 1, 1)

    expect(layout[0]).toEqual(expect.objectContaining({ x: 1, y: 0 }))
    expect(layout[0]).not.toHaveProperty('moved')
    expect(layout[1]).toEqual(expect.objectContaining({ x: 1, y: 0 }))
    wrapper.unmount()
  })

  it('overlap 优先于旧 preventCollision，拖动和缩放语义一致', async () => {
    const layout: Layout = [
      { i: '1', x: 0, y: 0, w: 1, h: 1 },
      { i: '2', x: 1, y: 0, w: 1, h: 1 },
    ]
    const { wrapper, vm } = await mountGrid(layout, {
      collisionMode: 'overlap',
      preventCollision: true,
    })

    vm.resizeEvent('resizestart', '1', 0, 0, 1, 2)
    vm.resizeEvent('resizeend', '1', 0, 0, 1, 2)

    expect(layout[0]).toEqual(expect.objectContaining({ w: 2, h: 1 }))
    expect(layout[0]).not.toHaveProperty('moved')
    expect(layout[1]).toEqual(expect.objectContaining({ x: 1, y: 0, w: 1, h: 1 }))
    wrapper.unmount()
  })

  it('prevent 模式阻止拖动进入已占用位置', async () => {
    const layout: Layout = [
      { i: '1', x: 0, y: 0, w: 1, h: 1 },
      { i: '2', x: 1, y: 0, w: 1, h: 1 },
    ]
    const { wrapper, vm } = await mountGrid(layout, {
      collisionMode: 'prevent',
      compactor: withOverlap(verticalCompactor),
    })

    vm.dragEvent('dragstart', '1', 1, 0, 1, 1)

    expect(layout[0]).toEqual(expect.objectContaining({ x: 0, y: 0 }))
    expect(layout[1]).toEqual(expect.objectContaining({ x: 1, y: 0 }))
    wrapper.unmount()
  })

  it('连续 push 交互不会跳过上一轮被推动的元素', async () => {
    const layout: Layout = [
      { i: 'active', x: 0, y: 0, w: 1, h: 1 },
      { i: 'blocker', x: 1, y: 0, w: 1, h: 1 },
      { i: 'next', x: 2, y: 1, w: 1, h: 1 },
    ]
    const { wrapper, vm } = await mountGrid(layout, {
      collisionMode: 'push',
      compactor: noCompactor,
    })

    vm.dragEvent('dragstart', 'active', 1, 0, 1, 1)
    vm.dragEvent('dragend', 'active', 1, 0, 1, 1)
    await nextTick()
    await nextTick()

    expect(layout.find(item => item.i === 'blocker')).toMatchObject({ x: 1, y: 1 })
    expect(layout.every(item => !Object.hasOwn(item, 'moved'))).toBe(true)

    vm.dragEvent('dragstart', 'next', 1, 1, 1, 1)
    vm.dragEvent('dragend', 'next', 1, 1, 1, 1)

    expect(layout.find(item => item.i === 'blocker')).toMatchObject({ x: 1, y: 2 })
    expect(collides(layout[1], layout[2])).toBe(false)
    expect(layout.every(item => !Object.hasOwn(item, 'moved'))).toBe(true)
    wrapper.unmount()
  })

  it('从 overlap 切换到 push 时消除重叠', async () => {
    const layout: Layout = [
      { i: '1', x: 0, y: 2, w: 1, h: 1 },
      { i: '2', x: 0, y: 2, w: 1, h: 1 },
    ]
    const { wrapper } = await mountGrid(layout, { collisionMode: 'overlap' })

    await wrapper.setProps({ collisionMode: 'push' })
    await nextTick()

    expect(collides(layout[0], layout[1])).toBe(false)
    expect(layout.map(item => item.y).sort((a, b) => a - b)).toEqual([0, 1])
    wrapper.unmount()
  })

  it('旧 withOverlap API 自动映射为 overlap 模式', async () => {
    const layout: Layout = [
      { i: '1', x: 0, y: 1, w: 1, h: 1 },
      { i: '2', x: 0, y: 1, w: 1, h: 1 },
    ]
    const { wrapper, vm } = await mountGrid(layout, {
      compactor: withOverlap(verticalCompactor),
    })

    expect(vm.effectiveConfig.collisionMode).toBe('overlap')
    expect(layout.map(item => item.y)).toEqual([1, 1])
    wrapper.unmount()
  })
})

describe('GridLayout engine adapter', () => {
  it('配置归一化拒绝后 GridItem 与后续交互继续使用最后有效 cols', async () => {
    const compactor: Compactor = {
      type: 'vertical',
      compact(layout, cols) {
        return cols === 2
          ? layout.slice(0, 1).map(item => ({ ...item }))
          : layout.map(item => ({ ...item }))
      },
    }
    const layout: Layout = [
      { i: 'active', x: 3, y: 0, w: 1, h: 1 },
      { i: 'other', x: 0, y: 0, w: 1, h: 1 },
    ]
    const { wrapper, vm } = await mountGrid(layout, {
      colNum: 4,
      compactor,
    })
    const itemState = (wrapper.findComponent(GridItem).vm as any).state

    await wrapper.setProps({ colNum: 2 })
    await nextTick()

    expect(itemState.cols).toBe(4)
    expect(layout.find(item => item.i === 'active')).toMatchObject({ x: 3 })

    vm.dragEvent('dragstart', 'active', 2, 0, 1, 1)
    vm.dragEvent('dragend', 'active', 2, 0, 1, 1)
    await nextTick()
    await nextTick()

    expect(layout.find(item => item.i === 'active')).toMatchObject({ x: 2 })

    await wrapper.setProps({ compactor: noCompactor })
    await nextTick()

    expect(itemState.cols).toBe(2)
    expect(layout.find(item => item.i === 'active')).toMatchObject({ x: 1 })
    wrapper.unmount()
  })

  it.each(['extension-error', 'extension-invalid-result'] as const)(
    '%s 会终止组件/headless 会话，并允许后续重新开始',
    async reason => {
      let failureEnabled = false
      const failingCompactor: Compactor = {
        type: 'vertical',
        compact(layout) {
          if (!failureEnabled) return layout.map(item => ({ ...item }))
          if (reason === 'extension-error') throw new Error('compactor failed')
          return layout.slice(0, 1).map(item => ({ ...item }))
        },
      }
      const initial: Layout = [
        { i: 'active', x: 0, y: 0, w: 1, h: 1 },
        { i: 'other', x: 3, y: 0, w: 1, h: 1 },
      ]
      const headless = useGridLayout({
        layout: initial.map(item => ({ ...item })),
        cols: 4,
        compactor: failingCompactor,
      })
      failureEnabled = true
      const headlessStart = headless.beginInteraction({
        type: 'drag',
        id: 'active',
        nativeEvent: null,
      })
      expect(headlessStart.status).toBe('accepted')
      if (headlessStart.status !== 'accepted') return
      expect(
        headless.updateInteraction(headlessStart.token, {
          type: 'drag',
          x: 1,
          y: 0,
          nativeEvent: null,
        }),
      ).toMatchObject({ status: 'rejected', reason })
      expect(
        headless.beginInteraction({
          type: 'drag',
          id: 'active',
          nativeEvent: null,
        }).status,
      ).toBe('accepted')

      failureEnabled = false
      const layout = initial.map(item => ({ ...item }))
      const { wrapper, vm } = await mountGrid(layout, {
        colNum: 4,
        compactor: failingCompactor,
      })

      failureEnabled = true
      vm.dragEvent('dragstart', 'active', 1, 0, 1, 1)
      await nextTick()
      await nextTick()

      expect(vm.state.isDragging).toBe(false)
      expect(layout.find(item => item.i === 'active')).toMatchObject({ x: 0 })

      await wrapper.setProps({ compactor: noCompactor })
      await nextTick()
      vm.dragEvent('dragstart', 'active', 1, 0, 1, 1)
      vm.dragEvent('dragend', 'active', 1, 0, 1, 1)

      expect(layout.find(item => item.i === 'active')).toMatchObject({ x: 1 })
      wrapper.unmount()
    },
  )

  it.each([
    ['drag', false],
    ['drag', true],
    ['resize', false],
    ['resize', true],
  ] as const)('active %s 遇到外部 Layout %s 后清理视图并可重新交互', async (type, removeActive) => {
    const layout: Layout = [
      { i: 'active', x: 0, y: 0, w: 1, h: 1 },
      { i: 'other', x: 2, y: 0, w: 1, h: 1 },
    ]
    const { wrapper, vm } = await mountGrid(layout, {
      colNum: 4,
      compactor: noCompactor,
    })

    if (type === 'drag') vm.dragEvent('dragstart', 'active', 1, 0, 1, 1)
    else vm.resizeEvent('resizestart', 'active', 0, 0, 1, 2)
    await nextTick()
    await nextTick()
    expect(vm.state.isDragging).toBe(true)

    const replacement: Layout = removeActive
      ? [{ i: 'other', x: 2, y: 0, w: 1, h: 1 }]
      : [
          { i: 'active', x: 0, y: 1, w: 1, h: 1 },
          { i: 'other', x: 2, y: 0, w: 1, h: 1 },
        ]
    await wrapper.setProps({ layout: replacement })
    await nextTick()
    await nextTick()

    expect(vm.state.isDragging).toBe(false)
    expect((wrapper.find('.vgl-item--placeholder').element as HTMLElement).style.display).toBe(
      'none',
    )

    const nextId = removeActive ? 'other' : 'active'
    if (type === 'drag') {
      vm.dragEvent('dragstart', nextId, 1, 2, 1, 1)
      vm.dragEvent('dragend', nextId, 1, 2, 1, 1)
      expect(replacement.find(item => item.i === nextId)).toMatchObject({ x: 1, y: 2 })
    } else {
      vm.resizeEvent('resizestart', nextId, 0, 0, 2, 2)
      vm.resizeEvent('resizeend', nextId, 0, 0, 2, 2)
      expect(replacement.find(item => item.i === nextId)).toMatchObject({ w: 2, h: 2 })
    }

    wrapper.unmount()
  })

  it.each(['drag', 'resize'] as const)(
    '响应式 %s 结果在断点往返后从 engine cache 恢复',
    async type => {
      const wide: Layout = [
        { i: 'active', x: 0, y: 0, w: 1, h: 1 },
        { i: 'sentinel', x: 3, y: 0, w: 1, h: 1, static: true },
      ]
      const narrow: Layout = [
        { i: 'active', x: 0, y: 0, w: 1, h: 1 },
        { i: 'sentinel', x: 1, y: 0, w: 1, h: 1, static: true },
      ]
      const { wrapper, vm } = await mountGrid(
        wide.map(item => ({ ...item })),
        {
          responsive: true,
          breakpoints: { wide: 600, narrow: 0 },
          cols: { wide: 4, narrow: 2 },
          responsiveLayouts: {
            wide: wide.map(item => ({ ...item })),
            narrow: narrow.map(item => ({ ...item })),
          },
          compactor: noCompactor,
        },
      )

      vm.state.width = 800
      await nextTick()
      await nextTick()
      vm.dragEvent('dragstart', 'sentinel', 3, 0, 1, 1)
      if (type === 'drag') {
        vm.dragEvent('dragstart', 'active', 2, 0, 1, 1)
        vm.dragEvent('dragend', 'active', 2, 0, 1, 1)
      } else {
        vm.resizeEvent('resizestart', 'active', 0, 0, 1, 2)
        vm.resizeEvent('resizeend', 'active', 0, 0, 1, 2)
      }
      await nextTick()
      await nextTick()

      vm.state.width = 300
      await nextTick()
      await nextTick()
      vm.dragEvent('dragstart', 'sentinel', 1, 0, 1, 1)
      vm.state.width = 800
      await nextTick()
      await nextTick()
      vm.dragEvent('dragstart', 'sentinel', 3, 0, 1, 1)

      const restored = vm.state.layouts.wide.find(item => item.i === 'active')
      expect(restored).toMatchObject(type === 'drag' ? { x: 2, y: 0 } : { w: 2, h: 1 })
      wrapper.unmount()
    },
  )

  it('响应式缺失断点由 engine 与 headless 使用相同 custom Compactor 归一化', async () => {
    const compact = vi.fn((layout: Layout, cols: number) => verticalCompactor.compact(layout, cols))
    const compactor: Compactor = { type: 'vertical', compact }
    const wide: Layout = [
      { i: 'active', x: 3, y: 0, w: 1, h: 1 },
      { i: 'sentinel', x: 0, y: 0, w: 1, h: 1, static: true },
    ]
    const headless = useGridLayout({
      layout: [
        { i: 'active', x: 1, y: 0, w: 1, h: 1 },
        { i: 'sentinel', x: 0, y: 0, w: 1, h: 1, static: true },
      ],
      cols: 2,
      compactor,
    })
    const expected = headless.setLayout(wide)

    const { wrapper, vm } = await mountGrid(
      wide.map(item => ({ ...item })),
      {
        responsive: true,
        breakpoints: { wide: 600, narrow: 0 },
        cols: { wide: 4, narrow: 2 },
        responsiveLayouts: { wide: wide.map(item => ({ ...item })) },
        compactor,
      },
    )
    vm.state.width = 800
    await nextTick()
    await nextTick()
    vm.dragEvent('dragstart', 'sentinel', 0, 0, 1, 1)
    vm.state.width = 300
    await nextTick()
    await nextTick()
    vm.dragEvent('dragstart', 'sentinel', 0, 0, 1, 1)

    expect(expected.status).not.toBe('rejected')
    expect(vm.state.layouts.narrow).toEqual(expected.layout)
    expect(compact).toHaveBeenCalled()
    wrapper.unmount()
  })

  it.each(['extension-error', 'extension-invalid-result'] as const)(
    '响应式 custom Compactor %s 时保留最后有效断点与 cols',
    async reason => {
      const validCompactor: Compactor = {
        type: 'vertical',
        compact(layout) {
          return layout.map(item => ({ ...item }))
        },
      }
      const failingCompactor: Compactor = {
        type: 'vertical',
        compact(layout, cols) {
          if (cols !== 2) return layout.map(item => ({ ...item }))
          if (reason === 'extension-error') throw new Error('responsive compactor failed')
          return layout.slice(0, 1).map(item => ({ ...item }))
        },
      }
      const wide: Layout = [
        { i: 'active', x: 3, y: 0, w: 1, h: 1 },
        { i: 'sentinel', x: 0, y: 0, w: 1, h: 1, static: true },
      ]
      const { wrapper, vm } = await mountGrid(
        wide.map(item => ({ ...item })),
        {
          responsive: true,
          breakpoints: { wide: 600, narrow: 0 },
          cols: { wide: 4, narrow: 2 },
          responsiveLayouts: { wide: wide.map(item => ({ ...item })) },
          compactor: validCompactor,
        },
      )

      expect(vm.state.lastBreakpoint).toBe('wide')
      const committedNarrow = vm.state.layouts.narrow.map(item => ({ ...item }))
      await wrapper.setProps({ compactor: failingCompactor })
      await nextTick()
      await nextTick()

      const itemState = (wrapper.findComponent(GridItem).vm as any).state
      expect(vm.state.lastBreakpoint).toBe('wide')
      expect(vm.state.layouts.narrow).toEqual(committedNarrow)
      expect(itemState.cols).toBe(4)
      wrapper.unmount()
    },
  )

  it('Compactor 同 identity 原地变更对组件与 headless 都不可见', async () => {
    const compactor: Compactor = {
      type: 'vertical',
      allowOverlap: false,
      compact: verticalCompactor.compact,
    }
    const initial: Layout = [
      { i: 'active', x: 0, y: 0, w: 1, h: 1 },
      { i: 'blocker', x: 1, y: 0, w: 1, h: 1 },
    ]
    const headless = useGridLayout({
      layout: initial.map(item => ({ ...item })),
      cols: 4,
      compactor,
    })
    const { wrapper, vm } = await mountGrid(
      initial.map(item => ({ ...item })),
      {
        colNum: 4,
        compactor,
      },
    )

    compactor.allowOverlap = true
    compactor.compact = noCompactor.compact
    await nextTick()

    const started = headless.beginInteraction({
      type: 'drag',
      id: 'active',
      nativeEvent: null,
    })
    expect(started.status).toBe('accepted')
    if (started.status !== 'accepted') return
    const expected = headless.updateInteraction(started.token, {
      type: 'drag',
      x: 1,
      y: 0,
      nativeEvent: null,
    })
    vm.dragEvent('dragstart', 'active', 1, 0, 1, 1)

    expect(vm.effectiveConfig.collisionMode).toBe('push')
    expect(wrapper.props('layout')).toEqual(expected.layout)

    await wrapper.setProps({
      compactor: {
        type: 'vertical',
        allowOverlap: true,
        compact: noCompactor.compact,
      },
    })
    await nextTick()
    expect(vm.effectiveConfig.collisionMode).toBe('overlap')
    wrapper.unmount()
  })
})

describe('非 overlap 交互层级', () => {
  it.each([
    ['push', '拖拽', 'dragstart', 'dragend'],
    ['prevent', '拖拽', 'dragstart', 'dragend'],
    ['push', '缩放', 'resizestart', 'resizeend'],
    ['prevent', '缩放', 'resizestart', 'resizeend'],
  ] as const)('%s 模式%s期间临时置顶且不改写布局层级', async (mode, _, start, end) => {
    const layout: Layout = Array.from({ length: 5 }, (_, index) => ({
      i: String(index + 1),
      x: index,
      y: 0,
      w: 1,
      h: 1,
    }))
    const { wrapper, vm } = await mountGrid(layout, { collisionMode: mode })
    const item = wrapper.find('.vgl-item:not(.vgl-item--placeholder)')

    start === 'dragstart'
      ? vm.dragEvent(start, '1', 0, 0, 1, 1)
      : vm.resizeEvent(start, '1', 0, 0, 1, 1)
    await nextTick()
    await nextTick()

    expect(wrapper.find('.vgl-layout').attributes('style')).toContain(
      '--vgl-layout-interaction-z-index: 5',
    )
    expect(item.attributes('style')).toContain('--vgl-item-z-index: 0')
    expect(wrapper.find('.vgl-item--placeholder').attributes('style')).toContain(
      '--vgl-item-z-index: 0',
    )
    expect(componentStyles).toContain('var(--vgl-layout-interaction-z-index, 0)')
    expect(componentStyles).toContain('calc(var(--vgl-layout-interaction-z-index, 0) + 1)')
    expect(layout.every(layoutItem => layoutItem.zIndex === undefined)).toBe(true)

    end === 'dragend' ? vm.dragEvent(end, '1', 0, 0, 1, 1) : vm.resizeEvent(end, '1', 0, 0, 1, 1)
    await nextTick()
    await nextTick()

    expect(item.attributes('style')).toContain('--vgl-item-z-index: 0')
    expect(layout.every(layoutItem => layoutItem.zIndex === undefined)).toBe(true)
    wrapper.unmount()
  })
})

describe('overlap 层级', () => {
  it('进入交互即默认将元素置顶并在无几何变化的终态保留层级', async () => {
    const layout: Layout = [
      { i: '1', x: 0, y: 0, w: 2, h: 2 },
      { i: '2', x: 0, y: 0, w: 2, h: 2 },
    ]
    const { wrapper, vm } = await mountGrid(layout, { collisionMode: 'overlap' })

    vm.dragEvent('dragstart', '1', 0, 0, 2, 2)
    await nextTick()
    await nextTick()

    expect(layout[0]).toMatchObject({ x: 0, y: 0, w: 2, h: 2 })
    expect(layout[0].zIndex).toBe(1)
    expect(layout[1].zIndex).toBeUndefined()

    vm.dragEvent('dragend', '1', 0, 0, 2, 2)
    await nextTick()
    await nextTick()

    expect(layout[0]).toMatchObject({ x: 0, y: 0, w: 2, h: 2 })
    expect(layout[0].zIndex).toBe(1)
    expect(layout[1].zIndex).toBeUndefined()
    wrapper.unmount()
  })

  it.each([
    ['拖拽', 'dragstart', 'dragging'],
    ['缩放', 'resizestart', 'resizing'],
  ])('%s开始时立即使用最高层级', async (_, eventName, stateName) => {
    const layout: Layout = Array.from({ length: 5 }, (_, index) => ({
      i: String(index + 1),
      x: 0,
      y: 0,
      w: 2,
      h: 2,
    }))
    const { wrapper, vm } = await mountGrid(layout, { collisionMode: 'overlap' })
    const item = wrapper.find('.vgl-item:not(.vgl-item--placeholder)')

    eventName === 'dragstart'
      ? vm.dragEvent(eventName, '1', 0, 0, 2, 2)
      : vm.resizeEvent(eventName, '1', 0, 0, 2, 2)
    await nextTick()
    await nextTick()

    expect(item.attributes('style')).toContain('--vgl-item-z-index: 4')
    expect(wrapper.find('.vgl-item--placeholder').attributes('style')).toContain(
      '--vgl-item-z-index: 4',
    )
    expect(componentStyles).toContain('var(--vgl-placeholder-z-index, 2)')
    expect(componentStyles).toContain(`var(--vgl-item-${stateName}-z-index, 3)`)
    wrapper.unmount()
  })

  it('可以关闭交互自动置顶', async () => {
    const layout: Layout = [
      { i: '1', x: 0, y: 0, w: 2, h: 2 },
      { i: '2', x: 0, y: 0, w: 2, h: 2 },
    ]
    const { wrapper, vm } = await mountGrid(layout, {
      collisionMode: 'overlap',
      bringToFrontOnInteract: false,
    })

    vm.dragEvent('dragstart', '1', 0, 0, 2, 2)

    expect(layout.every(item => item.zIndex === undefined)).toBe(true)
    wrapper.unmount()
  })

  it('公开方法可以置顶和置底元素', async () => {
    const layout: Layout = [
      { i: '1', x: 0, y: 0, w: 2, h: 2, zIndex: 10 },
      { i: '2', x: 0, y: 0, w: 2, h: 2, zIndex: 0 },
      { i: '3', x: 0, y: 0, w: 2, h: 2, zIndex: 5 },
    ]
    const { wrapper, vm } = await mountGrid(layout, { collisionMode: 'overlap' })

    expect(vm.bringToFront('2')).toMatchObject({
      status: 'pending',
      proposal: { operation: 'layer', status: 'accepted' },
    })
    await nextTick()
    await nextTick()
    expect(layout.find(item => item.i === '2')!.zIndex).toBe(11)
    expect(vm.sendToBack('2')).toMatchObject({
      status: 'pending',
      proposal: { operation: 'layer', status: 'accepted' },
    })
    await nextTick()
    await nextTick()
    expect(layout.find(item => item.i === '2')!.zIndex).toBe(4)
    expect(vm.bringToFront('missing')).toMatchObject({
      status: 'rejected',
      operation: 'layer',
      reason: 'item-not-found',
    })
    wrapper.unmount()
  })

  it('GridItem 将布局层级渲染为 CSS 变量', async () => {
    const layout: Layout = [{ i: '1', x: 0, y: 0, w: 1, h: 1, zIndex: 7 }]
    const { wrapper } = await mountGrid(layout, { collisionMode: 'overlap' })
    const item = wrapper.find('.vgl-item:not(.vgl-item--placeholder)')

    expect(item.attributes('style')).toContain('--vgl-item-z-index: 0')
    wrapper.unmount()
  })
})
