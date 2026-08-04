/**
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest'

import { findReleaseTestMarkers } from '../scripts/check-release-tests'
import {
  InteractionTransactionBuffer,
  LatestInteractionProposal,
  MAX_SUPERSEDED_CODE_UNITS,
  SupersededLayoutCache,
  layoutGeometrySignature,
} from '../src/core/transaction-buffer'

import type { Layout } from '../src/helpers/types'

type MetadataLayout = Array<Layout[number] & { metadata?: unknown }>

function layout(x = 0): Layout {
  const result: MetadataLayout = [{ i: 1, x, y: 0, w: 1, h: 1, metadata: { ignored: x } }]
  return result
}

describe('Phase 5 事务性能边界', () => {
  it('geometry signature 保留类型和顺序并忽略 metadata 与 effective default 差异', () => {
    const explicit: MetadataLayout = [
      {
        i: 1,
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        minW: 1,
        minH: 1,
        maxW: Infinity,
        maxH: Infinity,
        static: false,
        zIndex: 0,
        metadata: 'first',
      },
      { i: '1', x: 1, y: 0, w: 1, h: 1 },
    ]
    const defaults: MetadataLayout = [
      { i: 1, x: 0, y: 0, w: 1, h: 1, metadata: 'second' },
      { i: '1', x: 1, y: 0, w: 1, h: 1 },
    ]

    expect(layoutGeometrySignature(explicit)).toBe(layoutGeometrySignature(defaults))
    expect(layoutGeometrySignature(defaults)).not.toBe(
      layoutGeometrySignature(defaults.toReversed()),
    )
    expect(layoutGeometrySignature([{ ...defaults[0], i: '1' }])).not.toBe(
      layoutGeometrySignature([{ ...defaults[0], i: 1 }]),
    )
  })

  it('geometry fingerprint 覆盖全部语义字段与 number 边界', () => {
    const base = { i: 1, x: 0, y: 0, w: 1, h: 1 }
    const variants: Layout = [
      { ...base, i: '1' },
      { ...base, x: 1 },
      { ...base, x: -0 },
      { ...base, y: 1 },
      { ...base, w: 2 },
      { ...base, h: 2 },
      { ...base, minW: 2 },
      { ...base, minH: 2 },
      { ...base, maxW: 2 },
      { ...base, maxH: 2 },
      { ...base, static: true },
      { ...base, isDraggable: false },
      { ...base, isResizable: false },
      { ...base, zIndex: 1 },
    ]
    const signature = layoutGeometrySignature([base])

    for (const variant of variants) {
      const variantSignature = layoutGeometrySignature([variant])
      expect(variantSignature).not.toBe(signature)
      expect(variantSignature).toMatch(/^[0-9a-f]{32}$/)
    }
  })

  it('superseded cache 固定容量、正确处理重复 signature 并可立即清空', () => {
    const cache = new SupersededLayoutCache(3)
    cache.remember(layout(0))
    cache.remember(layout(0))
    cache.remember(layout(1))
    cache.remember(layout(2))

    expect(cache.size).toBe(3)
    expect(cache.has(layout(0))).toBe(true)
    expect(cache.has(layout(1))).toBe(true)
    expect(cache.has(layout(2))).toBe(true)

    cache.remember(layout(3))
    expect(cache.size).toBe(3)
    expect(cache.has(layout(0))).toBe(false)
    expect(cache.has(layout(3))).toBe(true)

    cache.clear()
    expect(cache.size).toBe(0)
    expect(cache.retainedCodeUnits).toBe(0)
    expect(cache.has(layout(3))).toBe(false)
  })

  it('superseded cache 同时受 entry 和 code-unit 上限约束', () => {
    const cache = new SupersededLayoutCache(1024, 256)
    for (let index = 0; index < 100; index++) cache.remember(layout(index))

    expect(cache.size).toBeLessThan(100)
    expect(cache.retainedCodeUnits).toBeLessThanOrEqual(256)
  })

  it('超长 canonical 输入仍在预算内精确识别 superseded', () => {
    const oversized = new SupersededLayoutCache()
    const first: Layout = [{ ...layout()[0], i: 'x'.repeat(MAX_SUPERSEDED_CODE_UNITS + 1) }]
    const latest: Layout = [{ ...first[0], x: 1 }]

    oversized.remember(first)
    expect(oversized.size).toBe(1)
    expect(oversized.retainedCodeUnits).toBe(32)
    expect(oversized.has(first)).toBe(true)

    oversized.remember(latest)
    expect(oversized.size).toBe(2)
    expect(oversized.retainedCodeUnits).toBe(64)
    expect(oversized.has(first)).toBe(true)
    expect(oversized.has(latest)).toBe(true)
  })

  it('同一 frame 的高频 candidate 只消费最后一个', () => {
    const proposals = new LatestInteractionProposal()
    for (let index = 0; index < 3; index++) {
      proposals.replace({
        type: 'drag',
        id: 'active',
        value: { x: index, y: 0 },
        nativeEvent: null,
      })
    }

    expect(proposals.pending).toBe(true)
    expect(proposals.take()).toMatchObject({ value: { x: 2, y: 0 } })
    expect(proposals.take()).toBeNull()

    proposals.replace({
      type: 'resize',
      id: 'active',
      value: { w: 2, h: 2 },
      nativeEvent: null,
    })
    proposals.clear()
    expect(proposals.pending).toBe(false)
  })

  it('生产交互事务生命周期在 terminal 同步清空所有资源', () => {
    const buffers = new InteractionTransactionBuffer()
    buffers.replaceProposal({
      type: 'drag',
      id: 'active',
      value: { x: 1, y: 0 },
      nativeEvent: null,
    })
    for (let index = 0; index < 100; index++) buffers.rememberSuperseded(layout(index))

    expect(buffers.snapshot()).toMatchObject({
      pendingProposal: true,
      supersededCount: expect.any(Number),
    })
    expect(buffers.snapshot().retainedCodeUnits).toBeLessThanOrEqual(MAX_SUPERSEDED_CODE_UNITS)

    buffers.finishTerminal()
    expect(buffers.snapshot()).toEqual({
      pendingProposal: false,
      supersededCount: 0,
      retainedCodeUnits: 0,
    })
  })
})

describe('Phase 5 发布门禁', () => {
  it('AST marker 扫描识别跨行和计算属性，并忽略注释与字符串', () => {
    const markers = findReleaseTestMarkers(`
      import { test, test as scenario } from '@playwright/test'

      test
        .skip('cross-line', async () => {})
      test['describe']['only']('computed', () => {})
      scenario.fail('aliased', async () => {})
      test[('fixme')]('parenthesized', async () => {})
      const example = 'test.fixme("documentation only")'
      // describe.fail('comment only', () => {})
      test('allowed', async () => {})
    `)

    expect(markers.map(marker => marker.text)).toEqual([
      'test .skip',
      "test['describe']['only']",
      'scenario.fail',
      "test[('fixme')]",
    ])
  })
})
