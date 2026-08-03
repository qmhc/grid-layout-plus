import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'

import { GridLayout } from '../src'

import type { Layout, ReadonlyLayout } from '../src/helpers/types'
import type { LayoutUpdateMeta } from '../src/components/types'

class MockResizeObserver {
  static instances: MockResizeObserver[] = []

  readonly targets = new Set<Element>()

  constructor(private readonly callback: ResizeObserverCallback) {
    MockResizeObserver.instances.push(this)
  }

  observe(target: Element): void {
    this.targets.add(target)
  }

  unobserve(target: Element): void {
    this.targets.delete(target)
  }

  disconnect(): void {
    this.targets.clear()
  }

  trigger(entries: readonly Readonly<{ target: Element; height: number }>[]): void {
    this.callback(
      entries.map(
        ({ target, height }) =>
          ({
            target,
            borderBoxSize: [{ blockSize: height, inlineSize: 100 }],
            contentBoxSize: [{ blockSize: height, inlineSize: 100 }],
            contentRect: { height },
            devicePixelContentBoxSize: [],
          }) as unknown as ResizeObserverEntry,
      ),
      this as unknown as ResizeObserver,
    )
  }
}

let animationFrames: FrameRequestCallback[]

async function flushAnimationFrames(): Promise<void> {
  while (animationFrames.length) {
    const callbacks = animationFrames.splice(0)
    callbacks.forEach(callback => callback(performance.now()))
    await nextTick()
  }
  await nextTick()
  await nextTick()
}

beforeEach(() => {
  MockResizeObserver.instances = []
  animationFrames = []
  vi.stubGlobal('ResizeObserver', MockResizeObserver)
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    animationFrames.push(callback)
    return animationFrames.length
  })
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

function autoHeightObserver(): MockResizeObserver {
  const observer = MockResizeObserver.instances.find(instance =>
    Array.from(instance.targets).some(target => (target as HTMLElement).dataset.autoContent),
  )
  expect(observer).toBeDefined()
  return observer!
}

describe('GridLayout auto height', () => {
  it('在一帧内批量提交内容高度并标记 auto-height 来源', async () => {
    const model = ref<Layout>([
      { i: 'first', x: 0, y: 0, w: 1, h: 1 },
      { i: 'second', x: 1, y: 0, w: 1, h: 1 },
    ])
    const proposals: Array<Readonly<{ layout: ReadonlyLayout; meta: LayoutUpdateMeta }>> = []
    const Host = defineComponent(() => () =>
      h(
        GridLayout,
        {
          layout: model.value,
          autoHeight: true,
          width: 400,
          colNum: 4,
          rowHeight: 30,
          gap: [10, 10],
          'onUpdate:layout': (layout: ReadonlyLayout, meta: LayoutUpdateMeta) => {
            proposals.push({ layout, meta })
            model.value = layout.map(item => ({ ...item }))
          },
        },
        {
          item: ({ item }: { item: { i: string | number } }) =>
            h('div', { 'data-auto-content': String(item.i) }),
        },
      ),
    )
    const wrapper = mount(Host, { attachTo: document.body })
    const grid = wrapper.findComponent(GridLayout)
    await nextTick()
    await nextTick()

    const contents = wrapper.findAll<HTMLElement>('[data-auto-content]')
    const observer = autoHeightObserver()
    observer.trigger([
      { target: contents[0].element, height: 75 },
      { target: contents[1].element, height: 35 },
    ])
    await flushAnimationFrames()

    expect(proposals).toHaveLength(1)
    expect(proposals[0].meta.source).toBe('auto-height')
    expect(proposals[0].layout.map(item => item.h)).toEqual([3, 2])
    expect(model.value.map(item => item.h)).toEqual([3, 2])
    expect(grid.emitted('layout-updated')?.at(-1)?.[1]).toMatchObject({
      source: 'auto-height',
    })
    wrapper.unmount()
  })

  it('responsive 模式同步提交当前布局和断点布局', async () => {
    const model = ref<Layout>([{ i: 'item', x: 0, y: 0, w: 1, h: 1 }])
    const responsiveLayouts = ref<Record<'only', Layout>>({
      only: model.value.map(item => ({ ...item })),
    })
    const Host = defineComponent(() => () =>
      h(
        GridLayout,
        {
          layout: model.value,
          responsiveLayouts: responsiveLayouts.value,
          responsive: true,
          autoHeight: true,
          width: 400,
          breakpoints: { only: 0 },
          cols: { only: 4 },
          rowHeight: 30,
          gap: [10, 10],
          'onUpdate:layout': (layout: ReadonlyLayout) => {
            model.value = layout.map(item => ({ ...item }))
          },
          'onUpdate:responsiveLayouts': (layouts: Readonly<Record<'only', ReadonlyLayout>>) => {
            responsiveLayouts.value = {
              only: layouts.only.map(item => ({ ...item })),
            }
          },
        },
        {
          item: () => h('div', { 'data-auto-content': 'item' }),
        },
      ),
    )
    const wrapper = mount(Host, { attachTo: document.body })
    const grid = wrapper.findComponent(GridLayout)
    await nextTick()
    await nextTick()
    await flushAnimationFrames()

    const content = wrapper.find<HTMLElement>('[data-auto-content]')
    autoHeightObserver().trigger([{ target: content.element, height: 75 }])
    await flushAnimationFrames()

    expect(model.value[0].h).toBe(3)
    expect(responsiveLayouts.value.only[0].h).toBe(3)
    expect(grid.emitted('update:layout')?.at(-1)?.[1]).toMatchObject({
      source: 'auto-height',
    })
    expect(grid.emitted('update:responsive-layouts')?.at(-1)?.[1]).toMatchObject({
      source: 'auto-height',
    })
    expect(grid.emitted('layout-updated')?.at(-1)?.[1]).toMatchObject({
      source: 'auto-height',
    })
    wrapper.unmount()
  })

  it('LayoutItem.autoHeight=false 覆盖全局默认值', async () => {
    const layout: Layout = [
      { i: 'fixed', x: 0, y: 0, w: 1, h: 1, autoHeight: false },
      { i: 'auto', x: 1, y: 0, w: 1, h: 1 },
    ]
    const wrapper = mount(GridLayout, {
      props: { layout, autoHeight: true, width: 400 },
      slots: {
        item: ({ item }: { item: { i: string | number } }) =>
          h('div', { 'data-auto-content': String(item.i) }),
      },
      attachTo: document.body,
    })
    await nextTick()
    await nextTick()

    const observedIds = Array.from(autoHeightObserver().targets).map(
      target => (target as HTMLElement).dataset.autoContent,
    )
    expect(observedIds).toEqual(['auto'])
    wrapper.unmount()
  })

  it('自动高度内容不是单一元素根时上报可恢复配置错误', async () => {
    const wrapper = mount(GridLayout, {
      props: {
        layout: [{ i: 'item', x: 0, y: 0, w: 1, h: 1 }],
        autoHeight: true,
        width: 400,
      },
      slots: {
        item: () => [h('div'), h('div')],
      },
      attachTo: document.body,
    })
    await nextTick()
    await nextTick()

    expect(wrapper.emitted('error')?.at(-1)?.[0]).toMatchObject({
      code: 'invalid-config',
      source: 'auto-height',
      path: 'gridItem["item"].autoHeight',
      cause: 'multiple-content-roots',
    })
    wrapper.unmount()
  })
})
