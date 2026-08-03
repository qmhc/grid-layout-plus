/**
 * @vitest-environment node
 */

import { describe, expect, it, vi } from 'vitest'

import {
  createLayoutEngine,
  createNormalizedLayoutEngine,
  defaultInternalConfig,
  layoutsSemanticallyEqual,
} from '../src/core/layout-engine'
import { noCompactor, verticalCompactor } from '../src/core/compactors'

import type { InternalEffectiveConfig } from '../src/core/layout-engine'
import type { Compactor, Layout, ReadonlyLayout } from '../src/helpers/types'

function config(overrides: Partial<InternalEffectiveConfig> = {}): InternalEffectiveConfig {
  return {
    ...defaultInternalConfig,
    cols: 4,
    compactor: noCompactor,
    collisionMode: 'overlap',
    ...overrides,
  }
}

function layout(): Layout {
  return [
    { i: 'active', x: 0, y: 0, w: 1, h: 1 },
    { i: 'other', x: 2, y: 0, w: 1, h: 1 },
  ]
}

describe('internal layout engine port', () => {
  it('auto-resize 原子更新多个内容高度并服从尺寸约束', () => {
    const engine = createLayoutEngine(
      [
        { i: 'first', x: 0, y: 0, w: 1, h: 2, minH: 2 },
        { i: 'second', x: 2, y: 0, w: 1, h: 1, maxH: 3 },
      ],
      config(),
    )

    const result = engine.evaluate({
      type: 'auto-resize',
      changes: [
        { id: 'first', h: 1 },
        { id: 'second', h: 5 },
      ],
    }).result

    expect(result).toMatchObject({ status: 'accepted', operation: 'resize', id: null })
    expect(result.candidate).toBeNull()
    expect(result.layout).toEqual([
      { i: 'first', x: 0, y: 0, w: 1, h: 2, minH: 2 },
      { i: 'second', x: 2, y: 0, w: 1, h: 3, maxH: 3 },
    ])
  })

  it('auto-resize 允许静态项改变高度并推动相交的非静态项', () => {
    const engine = createLayoutEngine(
      [
        { i: 'static', x: 0, y: 0, w: 1, h: 1, static: true },
        { i: 'moving', x: 0, y: 1, w: 1, h: 1 },
      ],
      config({ collisionMode: 'push' }),
    )

    const result = engine.evaluate({
      type: 'auto-resize',
      changes: [{ id: 'static', h: 2 }],
    }).result

    expect(result.status).toBe('accepted')
    expect(result.layout).toEqual([
      { i: 'static', x: 0, y: 0, w: 1, h: 2, static: true },
      { i: 'moving', x: 0, y: 2, w: 1, h: 1 },
    ])
  })

  it('auto-resize 在 maxRows 底边裁剪高度但不移动静态项', () => {
    const engine = createLayoutEngine(
      [{ i: 'static', x: 0, y: 2, w: 1, h: 1, static: true }],
      config({ maxRows: 4 }),
    )

    const result = engine.evaluate({
      type: 'auto-resize',
      changes: [{ id: 'static', h: 5 }],
    }).result

    expect(result).toMatchObject({
      status: 'accepted',
      layout: [{ i: 'static', y: 2, h: 2, static: true }],
    })
  })

  it('auto-resize 在 prevent 碰撞和非法批次下整体拒绝', () => {
    const initial: Layout = [
      { i: 'first', x: 0, y: 0, w: 1, h: 1 },
      { i: 'second', x: 0, y: 1, w: 1, h: 1 },
    ]
    const engine = createLayoutEngine(initial, config({ collisionMode: 'prevent' }))

    expect(
      engine.evaluate({ type: 'auto-resize', changes: [{ id: 'first', h: 2 }] }).result,
    ).toMatchObject({ status: 'rejected', reason: 'collision', layout: initial })
    expect(
      engine.evaluate({
        type: 'auto-resize',
        changes: [
          { id: 'first', h: 2 },
          { id: 'missing', h: 2 },
        ],
      }).result,
    ).toMatchObject({ status: 'rejected', reason: 'item-not-found', layout: initial })
  })

  it('LayoutItem.autoHeight 只接受布尔值', () => {
    expect(() =>
      createLayoutEngine(
        [{ i: 'item', x: 0, y: 0, w: 1, h: 1, autoHeight: 'yes' } as never],
        config(),
      ),
    ).toThrow(/autoHeight/)
  })

  it('LayoutItem.resizeHandles 校验方向并对重复值去重', () => {
    expect(() =>
      createLayoutEngine(
        [
          {
            i: 'item',
            x: 0,
            y: 0,
            w: 1,
            h: 1,
            resizeHandles: ['center'] as never,
          },
        ],
        config(),
      ),
    ).toThrow(/resizeHandles\[0\]/)

    const engine = createLayoutEngine(
      [{ i: 'item', x: 0, y: 0, w: 1, h: 1, resizeHandles: ['n', 'n', 'se'] }],
      config(),
    )
    expect(
      engine.replaceExternal(
        [{ i: 'item', x: 0, y: 0, w: 1, h: 1, resizeHandles: ['n', 'se'] }],
        config(),
      ).layout[0].resizeHandles,
    ).toEqual(['n', 'se'])
  })

  it('初始 push Layout 允许先接收碰撞输入，再在首帧前完成归一化', () => {
    const initial: Layout = [
      { i: 'first', x: 0, y: 0, w: 1, h: 2 },
      { i: 'second', x: 0, y: 1, w: 1, h: 1 },
    ]

    const normalized = createNormalizedLayoutEngine(
      initial,
      config({
        collisionMode: 'push',
        compactor: verticalCompactor,
      }),
    )

    expect(normalized.changed).toBe(true)
    expect(normalized.layout).toEqual([
      { i: 'first', x: 0, y: 0, w: 1, h: 2 },
      { i: 'second', x: 0, y: 2, w: 1, h: 1 },
    ])
    expect(() => createLayoutEngine(initial, config({ collisionMode: 'push' }))).toThrow(
      /layout\[1\]/,
    )
    const bypass = { allowInitialCollisions: true } as unknown as Parameters<
      typeof createLayoutEngine
    >[2]
    expect(() => createLayoutEngine(initial, config({ collisionMode: 'push' }), bypass)).toThrow(
      /layout\[1\]/,
    )
  })

  it('evaluate 不提交，并以 baseVersion 阻止过期 confirm', () => {
    const engine = createLayoutEngine(layout(), config())
    const first = engine.evaluate({ type: 'move', id: 'active', x: 1, y: 0 })
    const second = engine.evaluate({ type: 'move', id: 'active', x: 2, y: 0 })

    expect(first.result.status).toBe('accepted')
    expect(second.result.previousLayout[0]).toMatchObject({ x: 0, y: 0 })

    const confirmed = engine.confirm(first)
    expect(confirmed.status).toBe('accepted')
    expect(confirmed.layout[0]).toMatchObject({ x: 1, y: 0 })

    const stale = engine.confirm(second)
    expect(stale).toMatchObject({ status: 'rejected', reason: 'superseded' })
    expect(stale.layout[0]).toMatchObject({ x: 1, y: 0 })
    expect(engine.confirm(second)).toBe(stale)
  })

  it('rollback 幂等且不会覆盖随后提交的状态', () => {
    const engine = createLayoutEngine(layout(), config())
    const rolled = engine.evaluate({ type: 'move', id: 'active', x: 1, y: 0 })
    expect(engine.rollback(rolled)).toEqual(layout())

    const committed = engine.evaluate({ type: 'move', id: 'active', x: 2, y: 0 })
    expect(engine.confirm(committed).layout[0]).toMatchObject({ x: 2 })
    expect(engine.rollback(rolled)[0]).toMatchObject({ x: 2 })
    expect(engine.confirm(rolled)).toMatchObject({ status: 'rejected', reason: 'cancelled' })
  })

  it('同位置 interaction 不调用 Compactor，移开后回原位直接恢复 begin base', () => {
    const initial: Layout = [
      { i: 'active', x: 0, y: 2, w: 1, h: 1 },
      { i: 'other', x: 2, y: 4, w: 1, h: 1 },
    ]
    const compact = vi.fn((input: ReadonlyLayout): Layout => input.map(item => ({ ...item })))
    const engine = createLayoutEngine(
      initial,
      config({
        collisionMode: 'push',
        compactor: { type: 'vertical', compact },
      }),
    )
    const started = engine.beginInteraction({ type: 'drag', id: 'active' })
    expect(started.status).toBe('accepted')
    if (started.status !== 'accepted') return

    const lifted = engine.evaluateInteraction(started.session, {
      type: 'drag',
      x: 0,
      y: 2,
    })
    expect(lifted.result).toMatchObject({ status: 'unchanged', reason: 'same-value' })
    expect(lifted.result.layout).toEqual(initial)
    expect(compact).not.toHaveBeenCalled()
    expect(engine.confirm(lifted)).toMatchObject({ status: 'unchanged' })

    const moved = engine.evaluateInteraction(started.session, {
      type: 'drag',
      x: 1,
      y: 2,
    })
    expect(moved.result.status).toBe('accepted')
    expect(engine.confirm(moved).status).toBe('accepted')
    expect(compact).toHaveBeenCalled()
    const callsAfterMove = compact.mock.calls.length

    const returned = engine.evaluateInteraction(started.session, {
      type: 'drag',
      x: 0,
      y: 2,
    })
    expect(returned.result).toMatchObject({ status: 'accepted', reason: 'applied' })
    expect(returned.result.layout).toEqual(initial)
    expect(compact).toHaveBeenCalledTimes(callsAfterMove)

    engine.closeInteraction(started.session)
    engine.closeInteraction(started.session)
    expect(
      engine.evaluateInteraction(started.session, { type: 'drag', x: 2, y: 2 }).result,
    ).toMatchObject({ status: 'rejected', reason: 'cancelled' })
  })

  it('interaction 乱序 rollback 不恢复已失效的 working 前驱', () => {
    const engine = createLayoutEngine(layout(), config())
    const started = engine.beginInteraction({ type: 'drag', id: 'active' })
    expect(started.status).toBe('accepted')
    if (started.status !== 'accepted') return

    const first = engine.evaluateInteraction(started.session, {
      type: 'drag',
      x: 1,
      y: 0,
    })
    const second = engine.evaluateInteraction(started.session, {
      type: 'drag',
      x: 2,
      y: 0,
    })
    engine.rollback(first)
    engine.rollback(second)

    const repeated = engine.evaluateInteraction(started.session, {
      type: 'drag',
      x: 1,
      y: 0,
    })
    expect(repeated.result).toMatchObject({ status: 'accepted', reason: 'applied' })
  })

  it('interaction 算法保留 begin config，但 confirm 不回滚当前配置', () => {
    const engine = createLayoutEngine(layout(), config({ isResizable: true }))
    const started = engine.beginInteraction({ type: 'drag', id: 'active' })
    expect(started.status).toBe('accepted')
    if (started.status !== 'accepted') return

    const configEvaluation = engine.evaluate({
      type: 'config',
      config: config({ isResizable: false }),
    })
    expect(engine.confirm(configEvaluation).status).not.toBe('rejected')

    const moved = engine.evaluateInteraction(started.session, {
      type: 'drag',
      x: 1,
      y: 0,
    })
    expect(engine.confirm(moved).status).toBe('accepted')
    engine.closeInteraction(started.session)

    expect(engine.beginInteraction({ type: 'resize', id: 'active' })).toMatchObject({
      status: 'rejected',
      result: { reason: 'disabled' },
    })
  })

  it('collisionMode 特殊转换与 cols 同事务变化时仍归一化 bounds', () => {
    const initial: Layout = [
      { i: 'active', x: 3, y: 0, w: 1, h: 1 },
      { i: 'other', x: 0, y: 0, w: 1, h: 1 },
    ]
    const toOverlap = createLayoutEngine(initial, config({ collisionMode: 'prevent', cols: 4 }))
    const overlapEvaluation = toOverlap.evaluate({
      type: 'config',
      config: config({ collisionMode: 'overlap', cols: 2 }),
    })
    const overlapResult = toOverlap.confirm(overlapEvaluation)
    expect(overlapResult.status).toBe('accepted')
    expect(overlapResult.layout[0]).toMatchObject({ i: 'active', x: 1 })

    const toPrevent = createLayoutEngine(initial, config({ collisionMode: 'overlap', cols: 4 }))
    const preventEvaluation = toPrevent.evaluate({
      type: 'config',
      config: config({ collisionMode: 'prevent', cols: 2 }),
    })
    const preventResult = toPrevent.confirm(preventEvaluation)
    expect(preventResult.status).toBe('accepted')
    expect(preventResult.layout[0]).toMatchObject({ i: 'active', x: 1 })
  })

  it('set 可以携带 config 并原子归一化 Layout', () => {
    const engine = createLayoutEngine(
      [{ i: 'active', x: 3, y: 0, w: 1, h: 1 }],
      config({ cols: 4 }),
    )
    const evaluation = engine.evaluate({
      type: 'set',
      layout: [{ i: 'active', x: 3, y: 0, w: 1, h: 1 }],
      config: config({ cols: 2 }),
    })

    expect(evaluation.result).toMatchObject({
      status: 'accepted',
      layout: [{ i: 'active', x: 1, y: 0, w: 1, h: 1 }],
    })
    expect(engine.confirm(evaluation)).toMatchObject({
      status: 'accepted',
      layout: [{ i: 'active', x: 1, y: 0, w: 1, h: 1 }],
    })

    const moved = engine.evaluate({ type: 'move', id: 'active', x: 2, y: 0 })
    expect(moved.result).toMatchObject({
      status: 'unchanged',
      layout: [{ i: 'active', x: 1, y: 0, w: 1, h: 1 }],
    })
  })

  it('push 传播 extent overflow 保留 geometry failure', () => {
    const engine = createLayoutEngine(
      [
        { i: 'active', x: 0, y: 0, w: 1, h: 1 },
        {
          i: 'blocker',
          x: 0,
          y: Number.MAX_SAFE_INTEGER - 1,
          w: 1,
          h: 1,
        },
      ],
      config({
        collisionMode: 'push',
        rowHeight: 0,
        gap: [0, 0],
        containerPadding: [0, 0],
      }),
    )

    const evaluation = engine.evaluate({
      type: 'move',
      id: 'active',
      x: 0,
      y: Number.MAX_SAFE_INTEGER - 1,
    })
    expect(evaluation.result).toMatchObject({
      status: 'rejected',
      reason: 'invalid-input',
      candidate: { i: 'active', y: Number.MAX_SAFE_INTEGER - 1 },
    })
    expect(evaluation.failure).toMatchObject({
      kind: 'geometry',
      error: { path: 'layoutItem.y' },
    })
  })

  it('普通非法 config 不误分类为 geometry failure', () => {
    const engine = createLayoutEngine(layout(), config())
    const evaluation = engine.evaluate({
      type: 'config',
      config: { ...config(), cols: 0 },
    })

    expect(evaluation.result).toMatchObject({
      status: 'rejected',
      reason: 'invalid-input',
    })
    expect(evaluation.failure).toBeNull()
  })

  it('replaceExternal 静默替换并关闭 active session', () => {
    const engine = createLayoutEngine(layout(), config())
    const started = engine.beginInteraction({ type: 'resize', id: 'active' })
    expect(started.status).toBe('accepted')
    if (started.status !== 'accepted') return

    const external: Layout = [
      { i: 'active', x: 1, y: 0, w: 1, h: 1 },
      { i: 'other', x: 2, y: 0, w: 1, h: 1 },
    ]
    expect(engine.replaceExternal(external, config())).toMatchObject({ status: 'accepted' })
    expect(
      engine.evaluateInteraction(started.session, { type: 'resize', w: 2, h: 1 }).result,
    ).toMatchObject({ status: 'rejected', reason: 'cancelled' })
  })

  it('resize interaction 原子更新位置与尺寸', () => {
    const engine = createLayoutEngine(
      [
        { i: 'active', x: 2, y: 2, w: 2, h: 2 },
        { i: 'other', x: 0, y: 5, w: 1, h: 1 },
      ],
      config(),
    )
    const started = engine.beginInteraction({ type: 'resize', id: 'active' })
    expect(started.status).toBe('accepted')
    if (started.status !== 'accepted') return

    const evaluation = engine.evaluateInteraction(started.session, {
      type: 'resize',
      x: 1,
      y: 1,
      w: 3,
      h: 3,
    })

    expect(evaluation.result).toMatchObject({
      status: 'accepted',
      operation: 'resize',
      candidate: { i: 'active', x: 1, y: 1, w: 3, h: 3 },
    })
  })

  it('push 模式在 resize update 预览终态压缩，terminal 复用相同布局', () => {
    const initial: Layout = [
      { i: 'active', x: 4, y: 4, w: 4, h: 3 },
      { i: 'blocker', x: 4, y: 0, w: 4, h: 4 },
    ]
    const effectiveConfig = config({
      cols: 12,
      collisionMode: 'push',
      compactor: verticalCompactor,
    })
    const engine = createLayoutEngine(initial, effectiveConfig)
    const started = engine.beginInteraction({ type: 'resize', id: 'active' })
    expect(started.status).toBe('accepted')
    if (started.status !== 'accepted') return

    const update = engine.evaluateInteraction(started.session, {
      type: 'resize',
      x: 3,
      y: 3,
      w: 5,
      h: 4,
    })
    expect(update.result).toMatchObject({
      status: 'accepted',
      candidate: { i: 'active', x: 3, y: 0, w: 5, h: 4 },
      layout: [
        { i: 'active', x: 3, y: 0, w: 5, h: 4 },
        { i: 'blocker', x: 4, y: 4, w: 4, h: 4 },
      ],
    })
    expect(update.result.layout[0]).not.toHaveProperty('static')
    expect(engine.confirm(update)).toMatchObject({ status: 'accepted' })

    const terminal = engine.evaluateInteraction(started.session, {
      type: 'resize',
      x: 3,
      y: 3,
      w: 5,
      h: 4,
      terminal: true,
    })
    expect(terminal.result).toMatchObject({
      status: 'unchanged',
      candidate: { i: 'active', x: 3, y: 0, w: 5, h: 4 },
      layout: [
        { i: 'active', x: 3, y: 0, w: 5, h: 4 },
        { i: 'blocker', x: 4, y: 4, w: 4, h: 4 },
      ],
    })
    expect(terminal.result.layout[0]).not.toHaveProperty('static')

    const programmatic = createLayoutEngine(
      [{ i: 'active', x: 0, y: 4, w: 1, h: 1 }],
      effectiveConfig,
    ).evaluate({ type: 'resize', id: 'active', w: 2, h: 2 }).result
    expect(programmatic).toMatchObject({
      status: 'accepted',
      candidate: { i: 'active', x: 0, y: 0, w: 2, h: 2 },
    })
  })

  it('metadata 合入保持几何、规范字段 presence 与递归隔离', () => {
    const engine = createLayoutEngine(layout(), config())
    const metadata = { owner: { name: 'external' } }
    const external = layout() as Array<
      Layout[number] & { static?: boolean; metadata?: typeof metadata }
    >
    external[0].static = false
    external[0].metadata = metadata

    const merged = engine.mergeExternalMetadata(external)
    expect(layoutsSemanticallyEqual(merged, external)).toBe(true)
    expect((merged[0] as Layout[number] & { metadata: typeof metadata }).metadata).not.toBe(
      metadata,
    )
    expect(merged[0]).not.toHaveProperty('static')
    expect(merged[0]).toHaveProperty('metadata', metadata)
  })

  it('restoreOnDrag 仅在 active update 固定 candidate，terminal 恢复正常压缩', () => {
    const compact = vi.fn<Compactor['compact']>(input =>
      input.map(item => ({
        ...item,
        y: item.static ? item.y : 0,
      })),
    )
    const initial: Layout = [{ i: 'active', x: 0, y: 2, w: 1, h: 1 }]

    const restored = createLayoutEngine(
      initial,
      config({
        collisionMode: 'push',
        restoreOnDrag: true,
        compactor: { type: 'vertical', compact },
      }),
    )
    const restoredStart = restored.beginInteraction({ type: 'drag', id: 'active' })
    expect(restoredStart.status).toBe('accepted')
    if (restoredStart.status !== 'accepted') return
    const restoredEvaluation = restored.evaluateInteraction(restoredStart.session, {
      type: 'drag',
      x: 0,
      y: 3,
    })
    const restoredItem = restored.confirm(restoredEvaluation).layout[0]
    expect(restoredItem).toMatchObject({ y: 3 })
    expect(restoredItem).not.toHaveProperty('static')
    const restoredTerminal = restored.evaluateInteraction(restoredStart.session, {
      type: 'drag',
      x: 0,
      y: 3,
      terminal: true,
    })
    expect(restored.confirm(restoredTerminal).layout[0]).toMatchObject({ y: 0 })

    const compacted = createLayoutEngine(
      initial,
      config({
        collisionMode: 'push',
        restoreOnDrag: false,
        compactor: { type: 'vertical', compact },
      }),
    )
    const compactedStart = compacted.beginInteraction({ type: 'drag', id: 'active' })
    expect(compactedStart.status).toBe('accepted')
    if (compactedStart.status !== 'accepted') return
    const compactedEvaluation = compacted.evaluateInteraction(compactedStart.session, {
      type: 'drag',
      x: 0,
      y: 3,
    })
    expect(compacted.confirm(compactedEvaluation).layout[0]).toMatchObject({ y: 0 })
    const compactedTerminal = compacted.evaluateInteraction(compactedStart.session, {
      type: 'drag',
      x: 0,
      y: 3,
      terminal: true,
    })
    expect(compacted.confirm(compactedTerminal)).toMatchObject({
      status: 'unchanged',
      layout: [{ y: 0 }],
    })
  })

  it('扩展点重入替换 committed 时，求值使用入口版本并拒绝 stale confirm', () => {
    const holder: { engine?: ReturnType<typeof createLayoutEngine> } = {}
    let replaced = false
    const reentrantCompactor: Compactor = {
      type: 'vertical',
      compact(input) {
        if (!replaced) {
          replaced = true
          holder.engine!.replaceExternal(
            [{ i: 'active', x: 0, y: 4, w: 1, h: 1 }],
            config({ collisionMode: 'push', compactor: reentrantCompactor }),
          )
        }
        return input.map(item => ({ ...item }))
      },
    }
    const engine = createLayoutEngine(
      [{ i: 'active', x: 0, y: 0, w: 1, h: 1 }],
      config({ collisionMode: 'push', compactor: reentrantCompactor }),
    )
    holder.engine = engine

    const evaluation = engine.evaluate({ type: 'move', id: 'active', x: 0, y: 2 })
    const confirmed = engine.confirm(evaluation)

    expect(confirmed).toMatchObject({ status: 'rejected', reason: 'superseded' })
    expect(confirmed.layout[0]).toMatchObject({ y: 4 })
  })

  it('extension rejection 保留传播后 target，非法 add 保留可解析 id', () => {
    const extensionFailure = createLayoutEngine(
      [
        { i: 'active', x: 0, y: 0, w: 1, h: 1 },
        { i: 'static', x: 0, y: 1, w: 1, h: 1, static: true },
      ],
      config({
        collisionMode: 'push',
        compactor: {
          type: 'vertical',
          compact() {
            throw new Error('failed')
          },
        },
      }),
    )
    const failed = extensionFailure.evaluate({
      type: 'move',
      id: 'active',
      x: 0,
      y: 1,
    }).result
    expect(failed).toMatchObject({
      status: 'rejected',
      reason: 'extension-error',
      id: 'active',
      candidate: { i: 'active', y: 2 },
    })

    const invalidAdd = createLayoutEngine(layout(), config()).evaluate({
      type: 'add',
      item: { i: 'invalid', x: 0, y: 0, w: 0, h: 1 },
    }).result
    expect(invalidAdd).toMatchObject({
      status: 'rejected',
      reason: 'invalid-input',
      id: 'invalid',
      candidate: null,
    })
  })
})
