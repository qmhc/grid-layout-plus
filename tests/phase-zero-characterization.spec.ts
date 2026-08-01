import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'

import { GridLayout } from '../src'

import type { ComponentPublicInstance } from 'vue'
import type { Layout } from '../src'

interface GridLayoutInstance extends ComponentPublicInstance {
  dragEvent(
    eventName: string,
    id: number | string,
    x: number,
    y: number,
    h: number,
    w: number,
  ): void
  resizeEvent(
    eventName: string,
    id: number | string,
    x: number,
    y: number,
    h: number,
    w: number,
  ): void
}

async function settleMount() {
  await nextTick()
  await nextTick()
  await nextTick()
  await nextTick()
}

describe('Phase 0 current behavior characterization', () => {
  it('strictly validates then compacts the initial Layout without mutating the input', async () => {
    const layout: Layout = [{ i: 'mutable', x: 0, y: 4, w: 1, h: 1 }]
    const originalItem = layout[0]
    const wrapper = mount(GridLayout, {
      props: {
        layout,
        isDraggable: false,
        isResizable: false,
      },
    })

    await settleMount()

    expect(layout[0]).toBe(originalItem)
    expect(layout[0].y).toBe(4)
    expect(wrapper.emitted('layout-before-mount')?.[0]?.[0]).toEqual([
      expect.objectContaining({ i: 'mutable', y: 0 }),
    ])
    expect(wrapper.emitted('update:layout')?.[0]).toEqual([
      [expect.objectContaining({ i: 'mutable', y: 0 })],
      { revision: expect.any(Number), source: 'config' },
    ])
    wrapper.unmount()
  })

  it.each([
    ['drag', ['dragstart', 'dragmove', 'dragend']],
    ['resize', ['resizestart', 'resizemove', 'resizeend']],
  ] as const)('records the current %s stage event sequence', async (kind, stages) => {
    const layout: Layout = [{ i: kind, x: 0, y: 0, w: 1, h: 1 }]
    const emitted: Array<{ name: string; payload: unknown[] }> = []
    const wrapper = mount(GridLayout, {
      props: {
        layout,
        collisionMode: 'overlap',
        isDraggable: true,
        isResizable: true,
        'onUpdate:layout': (nextLayout: Layout) => {
          void wrapper.setProps({
            layout: nextLayout.map(item => ({ ...item })),
          })
        },
      },
      attrs: {
        onLayoutUpdated: (...payload: unknown[]) => {
          emitted.push({ name: 'layout-updated', payload })
        },
      },
    })
    await settleMount()
    const vm = wrapper.vm as unknown as GridLayoutInstance
    emitted.length = 0

    for (const [index, stage] of stages.entries()) {
      kind === 'drag'
        ? vm.dragEvent(stage, kind, 1, 0, 1, 1)
        : vm.resizeEvent(stage, kind, 0, 0, 1, 2)
      await settleMount()
      expect(emitted, `${stage} emitted events`).toHaveLength(index === stages.length - 1 ? 1 : 0)
    }

    expect(emitted).toEqual([
      {
        name: 'layout-updated',
        payload: [
          [
            kind === 'drag'
              ? expect.objectContaining({ i: kind, x: 1, y: 0 })
              : expect.objectContaining({ i: kind, w: 2, h: 1 }),
          ],
          {
            revision: expect.any(Number),
            source: 'interaction',
          },
        ],
      },
    ])
    wrapper.unmount()
  })
})
