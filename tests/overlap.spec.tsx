import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'

import { GridLayout, collides, verticalCompactor, withOverlap } from '../src'

import type { ComponentPublicInstance } from 'vue'
import type { CollisionMode, Compactor, Layout } from '../src'

const componentStyles = readFileSync(resolve(process.cwd(), 'src/style.scss'), 'utf-8')

interface GridLayoutInstance extends ComponentPublicInstance {
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
  bringToFront: (id: number | string) => boolean
  sendToBack: (id: number | string) => boolean
}

async function mountGrid(layout: Layout, props: Record<string, unknown> = {}) {
  const wrapper = mount(GridLayout, {
    props: {
      layout,
      isDraggable: false,
      isResizable: false,
      ...props,
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

    expect(layout[0]).toEqual(expect.objectContaining({ x: 1, y: 0, moved: false }))
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

    expect(layout[0]).toEqual(expect.objectContaining({ w: 2, h: 1, moved: false }))
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

describe('overlap 层级', () => {
  it('交互开始时默认将元素置顶并归一化层级', async () => {
    const layout: Layout = [
      { i: '1', x: 0, y: 0, w: 2, h: 2 },
      { i: '2', x: 0, y: 0, w: 2, h: 2 },
    ]
    const { wrapper, vm } = await mountGrid(layout, { collisionMode: 'overlap' })

    vm.dragEvent('dragstart', '1', 0, 0, 2, 2)

    expect(layout[0].zIndex).toBeGreaterThan(layout[1].zIndex!)
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
    expect(componentStyles).toContain(
      `z-index: max(var(--vgl-item-z-index, 0), var(--vgl-item-${stateName}-z-index, 3));`,
    )
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

    expect(vm.bringToFront('2')).toBe(true)
    expect(layout.find(item => item.i === '2')!.zIndex).toBe(2)
    expect(vm.sendToBack('2')).toBe(true)
    expect(layout.find(item => item.i === '2')!.zIndex).toBe(0)
    expect(vm.bringToFront('missing')).toBe(false)
    wrapper.unmount()
  })

  it('GridItem 将布局层级渲染为 CSS 变量', async () => {
    const layout: Layout = [{ i: '1', x: 0, y: 0, w: 1, h: 1, zIndex: 7 }]
    const { wrapper } = await mountGrid(layout, { collisionMode: 'overlap' })
    const item = wrapper.find('.vgl-item:not(.vgl-item--placeholder)')

    expect(item.attributes('style')).toContain('--vgl-item-z-index: 7')
    wrapper.unmount()
  })
})
