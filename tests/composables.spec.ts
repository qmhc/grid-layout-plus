/**
 * @vitest-environment node
 */

import { describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref, shallowRef } from 'vue'

import { useGridLayout } from '../src/composables/useGridLayout'
import { useResponsiveLayout } from '../src/composables/useResponsiveLayout'
import { horizontalCompactor, noCompactor, verticalCompactor } from '../src/core/compactors'
import { getBreakpointFromWidth, getColsFromBreakpoint } from '../src/helpers/responsive'

import type { GridLayoutExtensionError } from '../src/core/errors'
import type { Breakpoints, Compactor, Layout } from '../src/helpers/types'

// ─── useGridLayout ──────────────────────────────────────────

describe('useGridLayout', () => {
  function withScope<T>(fn: () => T): T {
    let result!: T
    const scope = effectScope()
    scope.run(() => {
      result = fn()
    })
    return result
  }

  function createLayout(): Layout {
    return [
      { i: 'active', x: 0, y: 0, w: 1, h: 1 },
      { i: 'blocker', x: 1, y: 0, w: 1, h: 1 },
    ]
  }

  it('创建时严格校验后压缩，并计算压缩后的容器几何', () => {
    const compact = vi.fn((layout: Layout) => layout.map(item => ({ ...item, y: 0 })))
    const layout: Layout = [
      { i: '1', x: 0, y: 5, w: 1, h: 1 },
      { i: '2', x: 1, y: 3, w: 1, h: 1 },
    ]
    const api = withScope(() =>
      useGridLayout({
        layout,
        cols: 4,
        compactor: { type: 'vertical', compact },
      }),
    )

    expect(compact).toHaveBeenCalledOnce()
    expect(api.layout.value.map(item => item.y)).toEqual([0, 0])
    expect(api.containerRows.value).toBe(1)
    expect(api.containerHeight.value).toBe(170)
    expect(layout.map(item => item.y)).toEqual([5, 3])

    const source = ref<Layout>([{ i: 'ref', x: 0, y: 2, w: 1, h: 1 }])
    const sourceBefore = source.value
    const onLayoutChange = vi.fn()
    const refApi = withScope(() =>
      useGridLayout({
        layout: source,
        cols: 4,
        compactor: {
          type: 'vertical',
          compact: input => input.map(item => ({ ...item, y: 0 })),
        },
        onLayoutChange,
      }),
    )
    expect(source.value).not.toBe(sourceBefore)
    expect(source.value).toEqual(refApi.layout.value)
    expect(source.value[0].y).toBe(0)
    expect(onLayoutChange).not.toHaveBeenCalled()

    const overlapping = createLayout().map(item => ({ ...item, x: 0 }))
    const normalizedOverlap = withScope(() =>
      useGridLayout({
        layout: overlapping,
        cols: 4,
      }),
    )
    expect(normalizedOverlap.layout.value).toEqual([
      { i: 'active', x: 0, y: 0, w: 1, h: 1 },
      { i: 'blocker', x: 0, y: 1, w: 1, h: 1 },
    ])
    expect(overlapping.every(item => item.y === 0)).toBe(true)

    expect(() =>
      useGridLayout({
        layout: overlapping,
        cols: 4,
        collisionMode: 'prevent',
      }),
    ).toThrowError(expect.objectContaining({ code: 'invalid-layout', path: 'layout' }))
  })

  it.each([
    ['extension-error', () => new Error('failed')],
    ['extension-invalid-result', () => null],
  ] as const)('创建期 Compactor %s 同步抛扩展错误', (code, compactResult) => {
    expect(() =>
      useGridLayout({
        layout: [{ i: 'item', x: 0, y: 1, w: 1, h: 1 }],
        cols: 4,
        compactor: {
          type: 'vertical',
          compact(_layout) {
            const result = compactResult()
            if (result instanceof Error) throw result
            return result as unknown as Layout
          },
        },
      }),
    ).toThrowError(
      expect.objectContaining<GridLayoutExtensionError>({
        code,
        source: 'compactor',
      }),
    )
  })

  it('restoreOnDrag 默认预览 Compactor 结果，显式 true 仅在 active update 固定 active', () => {
    const cases = [
      { label: 'default', restoreOnDrag: undefined, expectedStatic: undefined, expectedY: 0 },
      { label: 'explicit true', restoreOnDrag: true, expectedStatic: true, expectedY: 3 },
    ] as const

    for (const testCase of cases) {
      let activeStatic: boolean | undefined
      let compactCalls = 0
      const compact = vi.fn<Compactor['compact']>(input => {
        compactCalls += 1
        return input.map(item => {
          if (compactCalls === 1) return { ...item }
          if (item.i === 'active') activeStatic = item.static
          return { ...item, y: item.static ? item.y : 0 }
        })
      })
      const api = withScope(() =>
        useGridLayout({
          layout: [{ i: 'active', x: 0, y: 2, w: 1, h: 1 }],
          cols: 4,
          compactor: { type: 'vertical', compact },
          ...(testCase.restoreOnDrag === undefined
            ? {}
            : { restoreOnDrag: testCase.restoreOnDrag }),
        }),
      )
      const started = api.beginInteraction({ type: 'drag', id: 'active', nativeEvent: null })
      expect(started.status, testCase.label).toBe('accepted')
      if (started.status !== 'accepted') continue

      const result = api.updateInteraction(started.token, {
        type: 'drag',
        x: 0,
        y: 3,
        nativeEvent: null,
      })

      expect(result.status, testCase.label).toBe('accepted')
      expect(result.layout[0].y, testCase.label).toBe(testCase.expectedY)
      expect(activeStatic, testCase.label).toBe(testCase.expectedStatic)
      expect(api.endInteraction(started.token), testCase.label).toMatchObject({
        status: 'terminal',
      })
      expect(api.layout.value[0].y, testCase.label).toBe(0)
    }
  })

  it('terminal Layout callback 抛错前已完成提交清理且仍发送唯一 terminal', () => {
    const source = ref<Layout>([{ i: 'active', x: 0, y: 2, w: 1, h: 1 }])
    const callbackError = new Error('terminal layout callback failed')
    const terminals = vi.fn()
    let compactCalls = 0
    const api = withScope(() =>
      useGridLayout({
        layout: source,
        cols: 4,
        compactor: {
          type: 'vertical',
          compact(input) {
            compactCalls += 1
            return input.map(item => ({
              ...item,
              y: compactCalls === 1 || item.static ? item.y : 0,
            }))
          },
        },
        restoreOnDrag: true,
        onLayoutChange(layout) {
          if (layout[0].y === 0) throw callbackError
        },
        onInteractionEnd: terminals,
      }),
    )
    const started = api.beginInteraction({ type: 'drag', id: 'active', nativeEvent: null })
    expect(started.status).toBe('accepted')
    if (started.status !== 'accepted') return

    expect(
      api.updateInteraction(started.token, {
        type: 'drag',
        x: 0,
        y: 3,
        nativeEvent: null,
      }),
    ).toMatchObject({ status: 'accepted' })

    expect(() => api.endInteraction(started.token)).toThrow(callbackError)
    expect(source.value[0].y).toBe(0)
    expect(api.layout.value[0].y).toBe(0)
    expect(api.isInteracting.value).toBe(false)
    expect(api.placeholder.value).toBeNull()
    expect(terminals).toHaveBeenCalledTimes(1)
    expect(terminals).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'committed', reason: 'applied', revision: 2 }),
    )
    expect(api.endInteraction(started.token)).toEqual({
      status: 'rejected',
      reason: 'no-active-interaction',
      token: started.token,
    })
  })

  it('普通 Layout 模式内部提交且不修改输入', () => {
    const input = createLayout()
    const api = withScope(() =>
      useGridLayout({
        layout: input,
        cols: 4,
        compactor: noCompactor,
      }),
    )

    const result = api.moveItem('active', 1, 0)
    expect(result).toMatchObject({ status: 'accepted', reason: 'applied' })
    expect(api.layout.value).toEqual([
      expect.objectContaining({ i: 'active', x: 1, y: 0 }),
      expect.objectContaining({ i: 'blocker', x: 1, y: 1 }),
    ])
    expect(input).toEqual(createLayout())
    expect(result.layout).not.toBe(api.layout.value)
    expect(result.previousLayout).not.toBe(input)
  })

  it('writable Ref 模式同步替换数组并隔离 callback/result', () => {
    const source = ref<Layout>(createLayout())
    const before = source.value
    const callbackLayouts: ReadonlyLayout[] = []
    const api = withScope(() =>
      useGridLayout({
        layout: source,
        cols: 4,
        compactor: noCompactor,
        onLayoutChange(layout) {
          callbackLayouts.push(layout)
        },
      }),
    )

    const result = api.moveItem('active', 1, 0)
    expect(source.value).not.toBe(before)
    expect(source.value).toEqual(api.layout.value)
    expect(callbackLayouts).toHaveLength(1)
    expect(callbackLayouts[0]).not.toBe(source.value)
    ;(callbackLayouts[0] as Layout)[0].x = 3
    expect(api.layout.value[0].x).toBe(1)
    expect(result.layout[0].x).toBe(1)
  })

  it('六类操作返回可判别结果并遵循碰撞模式', () => {
    const rejected = vi.fn()
    const prevent = withScope(() =>
      useGridLayout({
        layout: createLayout(),
        cols: 4,
        compactor: noCompactor,
        collisionMode: 'prevent',
        onOperationRejected: rejected,
      }),
    )

    expect(prevent.resizeItem('active', 2, 1)).toMatchObject({
      status: 'rejected',
      reason: 'collision',
    })
    expect(prevent.moveItem('missing', 1, 1)).toMatchObject({
      status: 'rejected',
      reason: 'item-not-found',
    })
    expect(rejected).toHaveBeenCalledTimes(2)

    const overlap = withScope(() =>
      useGridLayout({
        layout: createLayout(),
        cols: 4,
        collisionMode: 'overlap',
      }),
    )
    expect(overlap.moveItem('active', 1, 0)).toMatchObject({ status: 'accepted' })
    expect(overlap.bringToFront('active')).toMatchObject({ status: 'accepted' })
    expect(overlap.sendToBack('active')).toMatchObject({ status: 'accepted' })
    expect(overlap.addItem({ i: 'new', x: 3, y: 0, w: 1, h: 1 })).toMatchObject({
      status: 'accepted',
    })
    expect(overlap.removeItem('new')).toMatchObject({ status: 'accepted' })
    expect(overlap.setLayout(overlap.layout.value)).toMatchObject({
      status: 'unchanged',
      reason: 'same-value',
    })
    expect(prevent.bringToFront('active')).toMatchObject({
      status: 'rejected',
      reason: 'disabled',
    })
  })

  it('interaction 管理 token、placeholder、状态和 terminal', () => {
    const terminals = vi.fn()
    const api = withScope(() =>
      useGridLayout({
        layout: createLayout(),
        cols: 4,
        collisionMode: 'overlap',
        bringToFrontOnInteract: false,
        onInteractionEnd: terminals,
      }),
    )

    const started = api.beginInteraction({
      type: 'drag',
      id: 'active',
      nativeEvent: null,
    })
    expect(started.status).toBe('accepted')
    if (started.status !== 'accepted') return
    expect(api.isInteracting.value).toBe(true)
    expect(api.dragState.value).toMatchObject({ status: 'active', id: 'active' })
    expect(
      api.updateInteraction('invalid' as typeof started.token, {
        type: 'drag',
        x: 2,
        y: 0,
        nativeEvent: null,
      }),
    ).toMatchObject({ status: 'rejected', reason: 'cancelled' })

    expect(
      api.updateInteraction(started.token, {
        type: 'drag',
        x: 1,
        y: 0,
        nativeEvent: null,
      }),
    ).toMatchObject({ status: 'accepted' })
    expect(api.placeholder.value).toMatchObject({ i: 'active', x: 1, y: 0 })
    expect(api.isInteracting.value).toBe(true)

    const ended = api.endInteraction(started.token)
    expect(ended).toMatchObject({
      status: 'terminal',
      terminal: { status: 'committed', reason: 'applied', revision: 1 },
    })
    expect(api.isInteracting.value).toBe(false)
    expect(api.placeholder.value).toBeNull()
    expect(terminals).toHaveBeenCalledTimes(1)
    expect(api.endInteraction(started.token)).toMatchObject({
      status: 'rejected',
      reason: 'no-active-interaction',
    })
  })

  it('可恢复的 interaction rejection 保持 active，cancel 只产生一次 terminal', () => {
    const rejected = vi.fn()
    const terminals = vi.fn()
    const api = withScope(() =>
      useGridLayout({
        layout: createLayout(),
        cols: 4,
        collisionMode: 'prevent',
        onOperationRejected: rejected,
        onInteractionEnd: terminals,
      }),
    )
    const started = api.beginInteraction({ type: 'drag', id: 'active', nativeEvent: null })
    expect(started.status).toBe('accepted')
    if (started.status !== 'accepted') return

    expect(
      api.updateInteraction(started.token, {
        type: 'drag',
        x: 1,
        y: 0,
        nativeEvent: null,
      }),
    ).toMatchObject({ status: 'rejected', reason: 'collision' })
    expect(api.isInteracting.value).toBe(true)
    expect(rejected).toHaveBeenCalledTimes(1)
    expect(api.cancelInteraction(started.token)).toMatchObject({
      status: 'terminal',
      terminal: { status: 'cancelled', reason: 'cancelled', revision: null },
    })
    expect(terminals).toHaveBeenCalledTimes(1)
  })

  it('内部 Ref 写回不误判 external，合法外部替换会取消 active', () => {
    const source = ref<Layout>(createLayout())
    const terminals = vi.fn()
    const api = withScope(() =>
      useGridLayout({
        layout: source,
        cols: 4,
        collisionMode: 'overlap',
        bringToFrontOnInteract: false,
        onInteractionEnd: terminals,
      }),
    )
    const started = api.beginInteraction({ type: 'drag', id: 'active', nativeEvent: null })
    expect(started.status).toBe('accepted')
    if (started.status !== 'accepted') return

    api.updateInteraction(started.token, {
      type: 'drag',
      x: 2,
      y: 0,
      nativeEvent: null,
    })
    expect(api.isInteracting.value).toBe(true)
    expect(terminals).not.toHaveBeenCalled()

    source.value = [
      { i: 'active', x: 3, y: 0, w: 1, h: 1 },
      { i: 'blocker', x: 1, y: 0, w: 1, h: 1 },
    ]
    expect(api.isInteracting.value).toBe(false)
    expect(api.layout.value[0].x).toBe(3)
    expect(terminals).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'cancelled', reason: 'external-update' }),
    )
  })

  it('metadata-only 外部更新不取消 active，并规范化 moved', () => {
    const source = ref<Layout>(createLayout())
    const terminals = vi.fn()
    const api = withScope(() =>
      useGridLayout({
        layout: source,
        cols: 4,
        collisionMode: 'overlap',
        onInteractionEnd: terminals,
      }),
    )
    const started = api.beginInteraction({ type: 'drag', id: 'active', nativeEvent: null })
    expect(started.status).toBe('accepted')
    if (started.status !== 'accepted') return

    source.value = [
      { ...source.value[0], moved: true, metadata: { owner: 'external' } },
      { ...source.value[1] },
    ] as Layout

    expect(api.isInteracting.value).toBe(true)
    expect(source.value[0]).not.toHaveProperty('moved')
    expect(api.layout.value[0]).toHaveProperty('metadata', { owner: 'external' })
    expect(terminals).not.toHaveBeenCalled()
    api.cancelInteraction(started.token)
  })

  it('非法外部 Ref 恢复已提交布局，并按 error/rejected/terminal 排序', () => {
    const source = ref<Layout>(createLayout())
    const calls: string[] = []
    const api = withScope(() =>
      useGridLayout({
        layout: source,
        cols: 4,
        onError: () => calls.push('error'),
        onOperationRejected: () => calls.push('rejected'),
        onInteractionEnd: () => calls.push('terminal'),
      }),
    )
    const started = api.beginInteraction({ type: 'drag', id: 'active', nativeEvent: null })
    expect(started.status).toBe('accepted')

    source.value = [{ ...source.value[0], w: 0 }]
    expect(source.value).toEqual(createLayout())
    expect(api.layout.value).toEqual(createLayout())
    expect(api.isInteracting.value).toBe(false)
    expect(calls).toEqual(['error', 'rejected', 'terminal'])
  })

  it('reactive config 变化取消 active 并原子应用新模式', () => {
    const collisionMode = ref<'push' | 'overlap'>('push')
    const terminals = vi.fn()
    const api = withScope(() =>
      useGridLayout({
        layout: createLayout(),
        cols: 4,
        collisionMode,
        onInteractionEnd: terminals,
      }),
    )
    const started = api.beginInteraction({ type: 'drag', id: 'active', nativeEvent: null })
    expect(started.status).toBe('accepted')

    collisionMode.value = 'overlap'
    expect(api.isInteracting.value).toBe(false)
    expect(terminals).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'cancelled', reason: 'config-changed' }),
    )
    expect(api.bringToFront('active')).toMatchObject({ status: 'accepted' })
  })

  it('scope dispose 关闭 active，callback 抛错时状态已提交', () => {
    const scope = effectScope()
    const terminals = vi.fn()
    let throwFirst = true
    const api = scope.run(() =>
      useGridLayout({
        layout: createLayout(),
        cols: 4,
        collisionMode: 'overlap',
        onLayoutChange() {
          if (throwFirst) {
            throwFirst = false
            throw new Error('callback failed')
          }
        },
        onInteractionEnd: terminals,
      }),
    )!

    expect(() => api.moveItem('active', 2, 0)).toThrowError('callback failed')
    expect(api.layout.value[0].x).toBe(2)
    expect(api.moveItem('active', 3, 0)).toMatchObject({ status: 'accepted' })

    const started = api.beginInteraction({ type: 'resize', id: 'active', nativeEvent: null })
    expect(started.status).toBe('accepted')
    scope.stop()
    expect(api.isInteracting.value).toBe(false)
    expect(terminals).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'cancelled', reason: 'unmount' }),
    )
  })

  it('active guard 不读取操作参数，第二次 begin 保持静默', () => {
    const rejected = vi.fn()
    const api = withScope(() =>
      useGridLayout({
        layout: createLayout(),
        cols: 4,
        collisionMode: 'overlap',
        onOperationRejected: rejected,
      }),
    )
    const started = api.beginInteraction({ type: 'drag', id: 'active', nativeEvent: null })
    expect(started.status).toBe('accepted')
    if (started.status !== 'accepted') return

    const readX = vi.fn(() => 0)
    const unreadableItem = Object.defineProperty({ i: 'new', y: 0, w: 1, h: 1 }, 'x', {
      enumerable: true,
      get: readX,
    })
    expect(api.addItem(unreadableItem as Layout[number])).toMatchObject({
      status: 'rejected',
      reason: 'interaction-active',
      id: null,
      candidate: null,
    })
    expect(readX).not.toHaveBeenCalled()
    expect(rejected).toHaveBeenCalledTimes(1)

    expect(
      api.beginInteraction({ type: 'resize', id: 'blocker', nativeEvent: null }),
    ).toMatchObject({
      status: 'rejected',
      result: { reason: 'interaction-active', id: 'blocker', candidate: null },
    })
    expect(rejected).toHaveBeenCalledTimes(1)
    expect(api.isInteracting.value).toBe(true)
  })

  it('reactive option 按 active 矩阵区分 next-begin、无关权限与 disabled', () => {
    const restoreOnDrag = ref(false)
    const bringToFrontOnInteract = ref(true)
    const isDraggable = ref(true)
    const isResizable = ref(true)
    const terminals = vi.fn()
    const api = withScope(() =>
      useGridLayout({
        layout: createLayout(),
        cols: 4,
        collisionMode: 'overlap',
        restoreOnDrag,
        bringToFrontOnInteract,
        isDraggable,
        isResizable,
        onInteractionEnd: terminals,
      }),
    )
    const started = api.beginInteraction({ type: 'drag', id: 'active', nativeEvent: null })
    expect(started.status).toBe('accepted')

    restoreOnDrag.value = true
    bringToFrontOnInteract.value = false
    isResizable.value = false
    expect(api.isInteracting.value).toBe(true)
    expect(terminals).not.toHaveBeenCalled()

    if (started.status !== 'accepted') return
    expect(
      api.updateInteraction(started.token, {
        type: 'drag',
        x: 2,
        y: 0,
        nativeEvent: null,
      }),
    ).toMatchObject({ status: 'accepted' })

    isDraggable.value = false
    expect(api.isInteracting.value).toBe(false)
    expect(terminals).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'cancelled', reason: 'disabled' }),
    )

    isDraggable.value = true
    expect(api.beginInteraction({ type: 'resize', id: 'active', nativeEvent: null })).toMatchObject(
      {
        status: 'rejected',
        result: { reason: 'disabled' },
      },
    )
  })

  it('Compactor 只按新 identity 更新，原对象突变不追溯 active', () => {
    const compact = (layout: ReadonlyLayout) => layout.map(item => ({ ...item }))
    const compactor = shallowRef<Compactor>({ type: 'vertical', compact })
    const terminals = vi.fn()
    const api = withScope(() =>
      useGridLayout({
        layout: createLayout(),
        cols: 4,
        collisionMode: 'overlap',
        compactor,
        onInteractionEnd: terminals,
      }),
    )
    const started = api.beginInteraction({ type: 'drag', id: 'active', nativeEvent: null })
    expect(started.status).toBe('accepted')

    compactor.value.compact = input => input.map(item => ({ ...item }))
    expect(api.isInteracting.value).toBe(true)
    expect(terminals).not.toHaveBeenCalled()

    compactor.value = { type: 'vertical', compact: compactor.value.compact }
    expect(api.isInteracting.value).toBe(false)
    expect(terminals).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'cancelled', reason: 'config-changed' }),
    )
  })

  it('无关配置变化复用同 identity Compactor 的既有快照', () => {
    const cols = ref(4)
    const errors = vi.fn()
    const rejected = vi.fn()
    const originalCompact = vi.fn<Compactor['compact']>(input => input.map(item => ({ ...item })))
    const compactor = shallowRef<Compactor>({
      type: 'vertical',
      compact: originalCompact,
    })
    const api = withScope(() =>
      useGridLayout({
        layout: createLayout(),
        cols,
        compactor,
        onError: errors,
        onOperationRejected: rejected,
      }),
    )

    compactor.value.compact = () => {
      throw new Error('mutated method must stay invisible')
    }
    cols.value = 3

    expect(errors).not.toHaveBeenCalled()
    expect(rejected).not.toHaveBeenCalled()
    expect(originalCompact).toHaveBeenCalled()
    expect(api.moveItem('active', 2, 0)).toMatchObject({ status: 'accepted' })
  })

  it('idle 外部 Ref 合法替换静默应用，非法替换只 error 并恢复', () => {
    const source = ref<Layout>(createLayout())
    const changed = vi.fn()
    const rejected = vi.fn()
    const terminals = vi.fn()
    const errors = vi.fn()
    const api = withScope(() =>
      useGridLayout({
        layout: source,
        cols: 4,
        collisionMode: 'overlap',
        onLayoutChange: changed,
        onOperationRejected: rejected,
        onInteractionEnd: terminals,
        onError: errors,
      }),
    )

    source.value = [
      { i: 'active', x: 2, y: 0, w: 1, h: 1 },
      { i: 'blocker', x: 1, y: 0, w: 1, h: 1 },
    ]
    expect(api.layout.value[0]).toMatchObject({ x: 2 })
    expect(
      [changed, rejected, terminals, errors].map(callback => callback.mock.calls.length),
    ).toEqual([0, 0, 0, 0])

    source.value = [{ i: 'active', x: 0, y: 0, w: 0, h: 1 }]
    expect(source.value).toEqual(api.layout.value)
    expect(api.layout.value[0]).toMatchObject({ x: 2, w: 1 })
    expect(errors).toHaveBeenCalledTimes(1)
    expect(changed).not.toHaveBeenCalled()
    expect(rejected).not.toHaveBeenCalled()
    expect(terminals).not.toHaveBeenCalled()

    source.value = null as unknown as Layout
    expect(source.value).toEqual(api.layout.value)
    expect(errors).toHaveBeenCalledTimes(2)
  })

  it('overlap 动态转换失败保留旧模式，随后 push 原子归一化', () => {
    const collisionMode = ref<'overlap' | 'prevent' | 'push'>('overlap')
    const rejected = vi.fn()
    const changes = vi.fn()
    const api = withScope(() =>
      useGridLayout({
        layout: [
          { i: 'first', x: 0, y: 0, w: 1, h: 1 },
          { i: 'second', x: 0, y: 0, w: 1, h: 1 },
        ],
        cols: 4,
        collisionMode,
        compactor: noCompactor,
        onOperationRejected: rejected,
        onLayoutChange: changes,
      }),
    )

    collisionMode.value = 'prevent'
    expect(rejected).toHaveBeenCalledWith(
      expect.objectContaining({ operation: 'config', reason: 'collision' }),
    )
    expect(api.bringToFront('first')).toMatchObject({ status: 'accepted' })

    collisionMode.value = 'push'
    expect(api.layout.value).toEqual([
      expect.objectContaining({ i: 'first', y: 0 }),
      expect.objectContaining({ i: 'second', y: 1 }),
    ])
    expect(changes).toHaveBeenCalledWith(expect.any(Array), 'config')
    expect(api.bringToFront('first')).toMatchObject({
      status: 'rejected',
      reason: 'disabled',
    })
  })

  it('invalid reactive config 即使 callback 抛错也完成清理并调用后续 callback', () => {
    const maxRows = ref(4)
    const calls: string[] = []
    const api = withScope(() =>
      useGridLayout({
        layout: createLayout(),
        cols: 4,
        maxRows,
        onError() {
          calls.push('error')
          throw new Error('first callback')
        },
        onOperationRejected() {
          calls.push('rejected')
          throw new Error('second callback')
        },
        onInteractionEnd() {
          calls.push('terminal')
          throw new Error('third callback')
        },
      }),
    )
    const started = api.beginInteraction({ type: 'drag', id: 'active', nativeEvent: null })
    expect(started.status).toBe('accepted')

    expect(() => {
      maxRows.value = 0
    }).toThrowError('first callback')
    expect(calls).toEqual(['error', 'rejected', 'terminal'])
    expect(api.isInteracting.value).toBe(false)
    expect(api.placeholder.value).toBeNull()
    if (started.status === 'accepted') {
      expect(api.endInteraction(started.token)).toMatchObject({
        status: 'rejected',
        reason: 'no-active-interaction',
      })
    }
  })

  it('idle 内建非法配置只 error，扩展失败才追加 rejected', () => {
    const maxRows = ref(4)
    const validationErrors = vi.fn()
    const validationRejected = vi.fn()
    withScope(() =>
      useGridLayout({
        layout: createLayout(),
        cols: 4,
        maxRows,
        onError: validationErrors,
        onOperationRejected: validationRejected,
      }),
    )

    maxRows.value = 0
    expect(validationErrors).toHaveBeenCalledTimes(1)
    expect(validationRejected).not.toHaveBeenCalled()

    const collisionMode = ref<'overlap' | 'push'>('overlap')
    const extensionErrors = vi.fn()
    const extensionRejected = vi.fn()
    withScope(() =>
      useGridLayout({
        layout: [
          { i: 'first', x: 0, y: 0, w: 1, h: 1 },
          { i: 'second', x: 0, y: 0, w: 1, h: 1 },
        ],
        cols: 4,
        collisionMode,
        compactor: {
          type: 'vertical',
          compact() {
            throw new Error('extension failed')
          },
        },
        onError: extensionErrors,
        onOperationRejected: extensionRejected,
      }),
    )

    collisionMode.value = 'push'
    expect(extensionErrors).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'extension-error', source: 'compactor' }),
    )
    expect(extensionRejected).toHaveBeenCalledWith(
      expect.objectContaining({ operation: 'config', reason: 'extension-error' }),
    )
  })

  it('容器 extent overflow 使用 geometry error，并与 rejected 共享 evaluationId', () => {
    expect(() =>
      useGridLayout({
        layout: [{ i: 'active', x: 0, y: Number.MAX_SAFE_INTEGER, w: 1, h: 1 }],
        cols: 4,
      }),
    ).toThrowError(expect.objectContaining({ path: 'layout[0].y' }))

    const errors = vi.fn()
    const rejected = vi.fn()
    const api = withScope(() =>
      useGridLayout({
        layout: createLayout(),
        cols: 4,
        collisionMode: 'overlap',
        onError: errors,
        onOperationRejected: rejected,
      }),
    )
    expect(api.moveItem('active', 0, Number.MAX_SAFE_INTEGER)).toMatchObject({
      status: 'rejected',
      reason: 'invalid-input',
    })
    expect(errors).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'derived-geometry-overflow',
        source: 'geometry',
        path: 'layoutItem.y',
      }),
    )
    expect(rejected).toHaveBeenCalledWith(
      expect.objectContaining({
        evaluationId: errors.mock.calls[0][0].evaluationId,
        operation: 'move',
        reason: 'invalid-input',
      }),
    )
  })

  it('push 传播 extent overflow 对 programmatic/active 均 error→rejected', () => {
    const errors = vi.fn()
    const rejected = vi.fn()
    const terminals = vi.fn()
    const api = withScope(() =>
      useGridLayout({
        layout: [
          { i: 'active', x: 0, y: 0, w: 1, h: 1 },
          {
            i: 'blocker',
            x: 0,
            y: Number.MAX_SAFE_INTEGER - 1,
            w: 1,
            h: 1,
          },
        ],
        cols: 4,
        rowHeight: 0,
        margin: [0, 0],
        containerPadding: [0, 0],
        collisionMode: 'push',
        compactor: noCompactor,
        onError: errors,
        onOperationRejected: rejected,
        onInteractionEnd: terminals,
      }),
    )

    expect(api.moveItem('active', 0, Number.MAX_SAFE_INTEGER - 1)).toMatchObject({
      status: 'rejected',
      reason: 'invalid-input',
    })
    expect(errors).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        code: 'derived-geometry-overflow',
        source: 'geometry',
        path: 'layoutItem.y',
      }),
    )
    expect(rejected.mock.calls[0][0].evaluationId).toBe(errors.mock.calls[0][0].evaluationId)

    const started = api.beginInteraction({ type: 'drag', id: 'active', nativeEvent: null })
    expect(started.status).toBe('accepted')
    if (started.status !== 'accepted') return
    expect(
      api.updateInteraction(started.token, {
        type: 'drag',
        x: 0,
        y: Number.MAX_SAFE_INTEGER - 1,
        nativeEvent: null,
      }),
    ).toMatchObject({ status: 'rejected', reason: 'invalid-input' })
    expect(errors).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        code: 'derived-geometry-overflow',
        source: 'geometry',
        path: 'layoutItem.y',
      }),
    )
    expect(rejected.mock.calls[1][0].evaluationId).toBe(errors.mock.calls[1][0].evaluationId)
    expect(api.isInteracting.value).toBe(true)
    expect(terminals).not.toHaveBeenCalled()
    api.cancelInteraction(started.token)
  })

  it('非法 add metadata 只 rejected，不误报 geometry error', () => {
    const errors = vi.fn()
    const rejected = vi.fn()
    const api = withScope(() =>
      useGridLayout({
        layout: createLayout(),
        cols: 4,
        collisionMode: 'overlap',
        onError: errors,
        onOperationRejected: rejected,
      }),
    )

    expect(
      api.addItem({
        i: 'invalid-metadata',
        x: 2,
        y: 0,
        w: 1,
        h: 1,
        metadata: () => undefined,
      }),
    ).toMatchObject({ status: 'rejected', reason: 'invalid-input' })
    expect(errors).not.toHaveBeenCalled()
    expect(rejected).toHaveBeenCalledWith(
      expect.objectContaining({ operation: 'add', reason: 'invalid-input' }),
    )
  })

  it('stale confirm 不消耗 revision，下一次 accepted interaction 从 1 开始', () => {
    const source = ref<Layout>(createLayout())
    const rejected = vi.fn()
    const terminals = vi.fn()
    let replaceDuringCompact = true
    let compactCalls = 0
    const api = withScope(() =>
      useGridLayout({
        layout: source,
        cols: 4,
        collisionMode: 'push',
        compactor: {
          type: 'vertical',
          compact(input) {
            compactCalls += 1
            if (compactCalls > 1 && replaceDuringCompact) {
              replaceDuringCompact = false
              source.value = [
                { i: 'active', x: 0, y: 2, w: 1, h: 1 },
                { i: 'blocker', x: 1, y: 0, w: 1, h: 1 },
              ]
            }
            return input.map(item => ({ ...item }))
          },
        },
        onOperationRejected: rejected,
        onInteractionEnd: terminals,
      }),
    )

    expect(api.moveItem('active', 2, 0)).toMatchObject({
      status: 'rejected',
      reason: 'superseded',
    })
    expect(rejected).toHaveBeenCalledWith(
      expect.objectContaining({ operation: 'move', reason: 'superseded', revision: null }),
    )

    const started = api.beginInteraction({ type: 'drag', id: 'active', nativeEvent: null })
    expect(started.status).toBe('accepted')
    if (started.status !== 'accepted') return
    expect(
      api.updateInteraction(started.token, {
        type: 'drag',
        x: 3,
        y: 2,
        nativeEvent: null,
      }),
    ).toMatchObject({ status: 'accepted' })
    api.endInteraction(started.token)
    expect(terminals).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'committed', revision: 1 }),
    )
  })

  it('动态 spacing accessor 不执行 getter，并按 invalid-config 取消 active', () => {
    const margin = ref<readonly [number, number]>([10, 10])
    const getter = vi.fn(() => 10)
    const errors = vi.fn()
    const terminals = vi.fn()
    const api = withScope(() =>
      useGridLayout({
        layout: createLayout(),
        cols: 4,
        margin,
        onError: errors,
        onInteractionEnd: terminals,
      }),
    )
    const started = api.beginInteraction({ type: 'drag', id: 'active', nativeEvent: null })
    expect(started.status).toBe('accepted')

    const invalidMargin: unknown[] = []
    Object.defineProperty(invalidMargin, '0', {
      enumerable: true,
      get: getter,
    })
    Object.defineProperty(invalidMargin, '1', {
      enumerable: true,
      value: 10,
    })
    margin.value = invalidMargin as unknown as readonly [number, number]

    expect(getter).not.toHaveBeenCalled()
    expect(errors).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'invalid-config',
        source: 'config',
        path: 'config.margin',
      }),
    )
    expect(api.isInteracting.value).toBe(false)
    expect(terminals).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'cancelled', reason: 'config-changed' }),
    )
  })
})

// ─── useResponsiveLayout ────────────────────────────────────

describe('useResponsiveLayout', () => {
  const breakpoints: Breakpoints = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }
  const cols: Breakpoints = { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }
  const cloneForTest = <T>(value: T): T => JSON.parse(JSON.stringify(value))

  function withScope<T>(fn: () => T): T {
    let result!: T
    const scope = effectScope()
    scope.run(() => {
      result = fn()
    })
    return result
  }

  it('不同 width 值对应正确的断点和列数', () => {
    const width = ref(1400)
    const layouts = ref({})
    const layout = ref<Layout>([{ i: '1', x: 0, y: 0, w: 1, h: 1 }])

    const { currentBreakpoint, currentCols } = withScope(() =>
      useResponsiveLayout({
        breakpoints,
        cols,
        width,
        layout,
        layouts,
        initialFallback: layout.value,
      }),
    )

    expect(currentBreakpoint.value).toBe(getBreakpointFromWidth(breakpoints, 1400))
    expect(currentBreakpoint.value).toBe('lg')
    expect(currentCols.value).toBe(getColsFromBreakpoint('lg', cols))
    expect(currentCols.value).toBe(12)
  })

  it('初始化响应式布局时使用指定 compactor', () => {
    const width = ref(1400)
    const layouts = ref({})
    const layout = ref<Layout>([{ i: '1', x: 5, y: 5, w: 1, h: 1 }])

    const { currentLayout } = withScope(() =>
      useResponsiveLayout({
        breakpoints,
        cols,
        width,
        layout,
        layouts,
        initialFallback: layout.value,
        compactor: noCompactor,
      }),
    )

    expect(currentLayout.value[0]).toEqual(expect.objectContaining({ x: 5, y: 5 }))
  })

  it('断点切换时使用指定 compactor 生成布局', async () => {
    const width = ref(1400)
    const layouts = ref({})
    const layout = ref<Layout>([{ i: '1', x: 5, y: 5, w: 1, h: 1 }])

    const { currentLayout } = withScope(() =>
      useResponsiveLayout({
        breakpoints,
        cols,
        width,
        layout,
        layouts,
        initialFallback: layout.value,
        compactor: horizontalCompactor,
      }),
    )

    width.value = 800
    await nextTick()

    expect(currentLayout.value[0]).toEqual(expect.objectContaining({ x: 0, y: 5 }))
  })

  it('width 变化导致断点切换时布局自动生成', async () => {
    const width = ref(1400)
    const layouts = ref({})
    const layout = ref<Layout>([
      { i: '1', x: 0, y: 0, w: 2, h: 1 },
      { i: '2', x: 2, y: 0, w: 2, h: 1 },
    ])

    const { currentBreakpoint, currentCols, currentLayout } = withScope(() =>
      useResponsiveLayout({
        breakpoints,
        cols,
        width,
        layout,
        layouts,
        initialFallback: layout.value,
      }),
    )

    expect(currentBreakpoint.value).toBe('lg')

    // 切换到 sm 断点
    width.value = 800
    await nextTick()

    expect(currentBreakpoint.value).toBe('sm')
    expect(currentCols.value).toBe(6)
    // 布局应该被生成且包含所有元素
    expect(currentLayout.value.length).toBe(2)
  })

  it('切换回已缓存断点时恢复布局', async () => {
    const width = ref(1400)
    const layouts = ref({})
    const layout = ref<Layout>([
      { i: '1', x: 0, y: 0, w: 2, h: 1 },
      { i: '2', x: 2, y: 0, w: 2, h: 1 },
    ])

    const { currentBreakpoint, currentLayout } = withScope(() =>
      useResponsiveLayout({
        breakpoints,
        cols,
        width,
        layout,
        layouts,
        initialFallback: layout.value,
      }),
    )

    // 记录 lg 断点的布局
    const lgLayout = JSON.parse(JSON.stringify(currentLayout.value))

    // 切换到 sm
    width.value = 800
    await nextTick()
    expect(currentBreakpoint.value).toBe('sm')

    // lg 布局应被缓存
    expect(layouts.value).toHaveProperty('lg')

    // 切换回 lg
    width.value = 1400
    await nextTick()
    expect(currentBreakpoint.value).toBe('lg')

    // 恢复的布局应与之前的 lg 布局一致（元素 id 和位置）
    for (const item of lgLayout) {
      const restored = currentLayout.value.find((l: any) => l.i === item.i)
      expect(restored).toBeTruthy()
      expect(restored!.x).toBe(item.x)
      expect(restored!.y).toBe(item.y)
      expect(restored!.w).toBe(item.w)
      expect(restored!.h).toBe(item.h)
    }
  })

  it('width 变化但断点不变时不触发布局更新', async () => {
    const width = ref(1400)
    const layouts = ref({})
    const layout = ref<Layout>([{ i: '1', x: 0, y: 0, w: 1, h: 1 }])

    const { currentBreakpoint, currentLayout } = withScope(() =>
      useResponsiveLayout({
        breakpoints,
        cols,
        width,
        layout,
        layouts,
        initialFallback: layout.value,
      }),
    )

    const layoutBefore = currentLayout.value

    // 同一断点内的 width 变化
    width.value = 1300
    await nextTick()

    expect(currentBreakpoint.value).toBe('lg')
    // 布局引用应不变（未触发更新）
    expect(currentLayout.value).toBe(layoutBefore)
  })

  it('多次断点切换后缓存正确累积', async () => {
    const width = ref(1400)
    const layouts = ref({})
    const layout = ref<Layout>([{ i: '1', x: 0, y: 0, w: 1, h: 1 }])

    const { currentBreakpoint } = withScope(() =>
      useResponsiveLayout({
        breakpoints,
        cols,
        width,
        layout,
        layouts,
        initialFallback: layout.value,
      }),
    )

    // lg → sm
    width.value = 800
    await nextTick()
    expect(currentBreakpoint.value).toBe('sm')
    expect(layouts.value).toHaveProperty('lg')

    // sm → xs
    width.value = 500
    await nextTick()
    expect(currentBreakpoint.value).toBe('xs')
    expect(layouts.value).toHaveProperty('sm')

    // 应同时有 lg 和 sm 的缓存
    expect(layouts.value).toHaveProperty('lg')
    expect(layouts.value).toHaveProperty('sm')
  })

  it('overlap 模式切换断点时保留重叠位置', async () => {
    const width = ref(1400)
    const layouts = ref({})
    const layout = ref<Layout>([
      { i: '1', x: 0, y: 4, w: 1, h: 1 },
      { i: '2', x: 0, y: 4, w: 1, h: 1 },
    ])

    const { currentLayout } = withScope(() =>
      useResponsiveLayout({
        breakpoints,
        cols,
        width,
        layout,
        layouts,
        initialFallback: layout.value,
        compactor: verticalCompactor,
        collisionMode: 'overlap',
      }),
    )

    expect(currentLayout.value.map(item => item.y)).toEqual([4, 4])
    width.value = 800
    await nextTick()
    expect(currentLayout.value.map(item => item.y)).toEqual([4, 4])
  })

  it('支持自定义断点和 unresolved 两阶段水平校验', async () => {
    const customBreakpoints = { mobile: 0, desktop: 900 } as const
    const customCols = { mobile: 2, desktop: 12 } as const
    const width = ref<number | null>(null)
    const layout = ref<Layout>([{ i: 'item', x: 9, y: 0, w: 2, h: 1 }])
    const layouts = ref({})
    const errors = vi.fn()

    const api = withScope(() =>
      useResponsiveLayout({
        breakpoints: customBreakpoints,
        cols: customCols,
        width,
        layout,
        layouts,
        initialFallback: layout.value,
        onError: errors,
      }),
    )

    expect(api.state.value).toBe('unresolved')
    expect(api.currentBreakpoint.value).toBeNull()
    expect(api.currentCols.value).toBeNull()
    expect(api.completeLayouts.value).toBeNull()

    width.value = 0
    await nextTick()

    expect(errors).not.toHaveBeenCalled()
    expect(api.state.value).toBe('resolved-zero')
    expect(api.currentBreakpoint.value).toBe('mobile')
    expect(api.currentCols.value).toBe(2)
    expect(api.currentLayout.value).toEqual([expect.objectContaining({ i: 'item', x: 0, w: 2 })])
  })

  it('unresolved 创建时仍按每个 author 的 cols 严格校验', () => {
    const width = ref<number | null>(null)
    const layout = ref<Layout>([{ i: 'item', x: 0, y: 0, w: 1, h: 1 }])
    const layouts = ref({
      xxs: [{ i: 'item', x: 2, y: 0, w: 1, h: 1 }],
    })

    expect(() =>
      withScope(() =>
        useResponsiveLayout({
          breakpoints,
          cols,
          width,
          layout,
          layouts,
          initialFallback: layout.value,
        }),
      ),
    ).toThrowError(
      expect.objectContaining({
        code: 'invalid-layout',
        path: 'responsiveLayouts["xxs"][0].w',
      }),
    )
  })

  it('同一 flush 的双 Ref 完整 pair 原子提交并输出完整 layouts', async () => {
    const customBreakpoints = { mobile: 0, desktop: 900 } as const
    const customCols = { mobile: 2, desktop: 12 } as const
    const width = ref(1000)
    const layout = ref<Layout>([{ i: 'item', x: 0, y: 0, w: 1, h: 1 }])
    const layouts = ref({})
    const errors = vi.fn()
    const api = withScope(() =>
      useResponsiveLayout({
        breakpoints: customBreakpoints,
        cols: customCols,
        width,
        layout,
        layouts,
        initialFallback: layout.value,
        onError: errors,
      }),
    )
    const next = [{ i: 'item', x: 3, y: 0, w: 1, h: 1 }]

    layouts.value = {
      mobile: [{ i: 'item', x: 1, y: 0, w: 1, h: 1 }],
      desktop: next,
    }
    layout.value = next
    await nextTick()

    expect(errors).not.toHaveBeenCalled()
    expect(layout.value).toEqual(next)
    expect(Object.keys(layouts.value).sort()).toEqual(['desktop', 'mobile'])
    expect(api.currentLayout.value).toEqual(next)
    expect(api.completeLayouts.value?.desktop).toEqual(next)
  })

  it('最终 pair 不一致时先整体恢复两个 Ref 再报告 partial-responsive-update', async () => {
    const width = ref(1400)
    const layout = ref<Layout>([{ i: 'item', x: 0, y: 0, w: 1, h: 1 }])
    const layouts = ref({})
    const snapshots: unknown[] = []
    const api = withScope(() =>
      useResponsiveLayout({
        breakpoints,
        cols,
        width,
        layout,
        layouts,
        initialFallback: layout.value,
        onError: error => {
          snapshots.push({
            error,
            layout: cloneForTest(layout.value),
            layouts: cloneForTest(layouts.value),
          })
        },
      }),
    )
    const committedLayout = cloneForTest(layout.value)
    const committedLayouts = cloneForTest(layouts.value)

    layout.value = [{ i: 'item', x: 4, y: 0, w: 1, h: 1 }]
    await nextTick()

    expect(layout.value).toEqual(committedLayout)
    expect(layouts.value).toEqual(committedLayouts)
    expect(api.currentLayout.value).toEqual(committedLayout)
    expect(snapshots).toEqual([
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'partial-responsive-update',
          source: 'layout',
          path: 'layout',
          revision: null,
          evaluationId: 1,
        }),
        layout: committedLayout,
        layouts: committedLayouts,
      }),
    ])
  })

  it('后续非法 width 和 Compactor 失败均保留最后 committed 状态', async () => {
    const width = ref<number | null>(1400)
    const compactor = shallowRef<Compactor>(noCompactor)
    const layout = ref<Layout>([{ i: 'item', x: 0, y: 2, w: 1, h: 1 }])
    const layouts = ref({})
    const errors = vi.fn()
    const api = withScope(() =>
      useResponsiveLayout({
        breakpoints,
        cols,
        width,
        layout,
        layouts,
        initialFallback: layout.value,
        compactor,
        onError: errors,
      }),
    )
    const committedLayout = cloneForTest(layout.value)
    const committedLayouts = cloneForTest(layouts.value)

    width.value = Number.NaN
    await nextTick()
    expect(api.state.value).toBe('resolved')
    expect(layout.value).toEqual(committedLayout)
    expect(layouts.value).toEqual(committedLayouts)
    expect(errors).toHaveBeenLastCalledWith(
      expect.objectContaining({
        code: 'invalid-config',
        source: 'config',
        path: 'config.width',
        evaluationId: 1,
      }),
    )

    width.value = 800
    compactor.value = {
      compact() {
        throw new Error('compact failed')
      },
    }
    await nextTick()
    expect(api.currentBreakpoint.value).toBe('lg')
    expect(layout.value).toEqual(committedLayout)
    expect(layouts.value).toEqual(committedLayouts)
    expect(errors).toHaveBeenLastCalledWith(
      expect.objectContaining({
        code: 'extension-error',
        source: 'compactor',
        evaluationId: 2,
        cause: expect.objectContaining({ message: 'compact failed' }),
      }),
    )
  })

  it('onError 抛错时不递归包装，且公开对象 mutable-detached', async () => {
    const width = ref<number | null>(1400)
    const layout = ref<Layout>([{ i: 'item', x: 0, y: 0, w: 1, h: 1 }])
    const layouts = ref({})
    const callbackError = new Error('callback failed')
    const api = withScope(() =>
      useResponsiveLayout({
        breakpoints,
        cols,
        width,
        layout,
        layouts,
        initialFallback: layout.value,
        onError: () => {
          throw callbackError
        },
      }),
    )

    expect(Object.getPrototypeOf(api.completeLayouts.value)).toBeNull()
    expect(Object.isFrozen(api.completeLayouts.value)).toBe(false)
    ;(api.currentLayout.value as Layout)[0].x = 2
    ;(api.completeLayouts.value!.lg as Layout)[0].x = 3
    expect(layout.value[0].x).toBe(0)
    expect(layouts.value.lg?.[0].x).toBe(0)

    width.value = Number.POSITIVE_INFINITY
    await expect(nextTick()).rejects.toBe(callbackError)
    expect(layout.value[0].x).toBe(0)
  })
})
