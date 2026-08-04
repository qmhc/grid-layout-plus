import { expect, test } from '@playwright/test'

import type { Locator, Page } from '@playwright/test'

type FixturePhase = 'phase-0' | 'phase-2' | 'phase-3' | 'phase-4'
type PhaseLabel = 'Phase 2' | 'Phase 3' | 'Phase 4'

interface EventRecord {
  name: string
  args: unknown[]
}

interface FutureContract<Actual> {
  id: string
  phase: Exclude<FixturePhase, 'phase-0'>
  phaseLabel: PhaseLabel
  controls: readonly string[]
  prepare?: (page: Page) => Promise<void>
  exercise: (page: Page) => Promise<Actual>
  expected: Actual
}

let fixtureReloadSerial = 0

function collectBrowserErrors(page: Page) {
  const errors: string[] = []

  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', error => {
    errors.push(error.message)
  })

  return errors
}

async function settleBrowser(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>(resolve => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      }),
  )
}

async function expectFixtureReady(
  page: Page,
  phase: FixturePhase,
  contractId: string,
  controls: readonly string[],
) {
  const errors = collectBrowserErrors(page)
  const response = await page.goto(`/#/__e2e/contracts/${phase}?scenario=${contractId}`)

  expect(response?.ok()).toBe(true)
  const fixture = page.locator('[data-contract-e2e-fixture="ready"]')
  await expect(fixture).toHaveAttribute('data-fixture-phase', phase)
  await expect(fixture).toHaveAttribute('data-fixture-scenario', contractId)
  await expect(page.locator('[data-fixture-sentinel="grid-layout-plus-contract"]')).toHaveCount(1)
  await expect(fixture).toHaveAttribute('data-grid-mounted', 'true')
  await expect(page.locator('.vgl-layout')).toHaveCount(1)

  for (const control of controls) {
    await expect(page.locator(`[data-e2e-control="${control}"]`)).toHaveCount(1)
  }

  await settleBrowser(page)
  expect(errors).toEqual([])
  return errors
}

async function clickControl(page: Page, control: string) {
  await page.locator(`[data-e2e-control="${control}"]`).click()
  await settleBrowser(page)
}

async function openVariant(
  page: Page,
  phase: Exclude<FixturePhase, 'phase-0'>,
  contractId: string,
  variant: string,
  controls: readonly string[],
) {
  fixtureReloadSerial += 1
  const response = await page.goto(
    `/?__contractFixtureReload=${fixtureReloadSerial}#/__e2e/contracts/${phase}?scenario=${contractId}&variant=${variant}`,
  )
  expect(response?.ok()).toBe(true)

  const fixture = page.locator('[data-contract-e2e-fixture="ready"]')
  await expect(fixture).toHaveAttribute('data-fixture-phase', phase)
  await expect(fixture).toHaveAttribute('data-fixture-scenario', contractId)
  await expect(fixture).toHaveAttribute('data-fixture-variant', variant)
  await expect(fixture).toHaveAttribute('data-grid-mounted', 'true')
  await expect(page.locator('.vgl-layout')).toHaveCount(1)
  for (const control of controls) {
    await expect(page.locator(`[data-e2e-control="${control}"]`)).toHaveCount(1)
  }
  await settleBrowser(page)
}

async function readJsonAttribute<T>(locator: Locator, attribute: string): Promise<T> {
  const value = await locator.getAttribute(attribute)
  if (value == null) throw new Error(`missing ${attribute}`)
  return JSON.parse(value) as T
}

async function readEvents(page: Page): Promise<EventRecord[]> {
  const raw = await readJsonAttribute<Array<{ name: string; args: string }>>(
    page.locator('[data-contract-e2e-fixture="ready"]'),
    'data-event-log',
  )

  return raw.map(event => ({
    name: event.name,
    args: JSON.parse(event.args) as unknown[],
  }))
}

function firstPayload(events: EventRecord[], name: string): Record<string, unknown> | null {
  const payload = events.find(event => event.name === name)?.args[0]
  return payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : null
}

function eventNames(events: EventRecord[]) {
  return events.map(event => event.name)
}

function hasOrderedEvents(events: EventRecord[], required: readonly string[]) {
  const names = eventNames(events)
  let cursor = -1
  return required.every(name => {
    cursor = names.indexOf(name, cursor + 1)
    return cursor >= 0
  })
}

function payloads(events: EventRecord[], name: string) {
  return events
    .filter(event => event.name === name)
    .map(event => event.args[0] as Record<string, unknown>)
}

function lastPayload(events: EventRecord[], name: string): Record<string, unknown> | null {
  const matches = payloads(events, name)
  return matches.at(-1) ?? null
}

function dropCandidate(payload: Record<string, unknown> | null) {
  if (!payload) return null
  const candidate = payload.candidate ?? payload.item
  if (!candidate || typeof candidate !== 'object') return payload
  if (payload.item === candidate) {
    return Object.fromEntries(
      Object.entries(candidate as Record<string, unknown>).filter(
        ([key]) => key !== 'i' && key !== 'moved',
      ),
    )
  }
  return candidate as Record<string, unknown>
}

function dropPreview(payload: Record<string, unknown> | null) {
  if (!payload) return null
  const preview = payload.previewLayout
  if (Array.isArray(preview)) return preview
  if (!Array.isArray(payload.layout) || !payload.item || typeof payload.item !== 'object')
    return null
  const id = (payload.item as { i?: unknown }).i
  return payload.layout.filter(entry => (entry as { i?: unknown }).i !== id)
}

function dropInsertionIndex(payload: Record<string, unknown> | null): number | null {
  if (!payload) return null
  if (typeof payload.insertionIndex === 'number') return payload.insertionIndex
  if (!Array.isArray(payload.layout) || !payload.item || typeof payload.item !== 'object')
    return null
  const id = (payload.item as { i?: unknown }).i
  const index = payload.layout.findIndex(entry => (entry as { i?: unknown }).i === id)
  return index >= 0 ? index : null
}

function itemA(page: Page) {
  return page.locator('.vgl-layout > .vgl-item').first()
}

async function readGeometryStyle(page: Page) {
  return itemA(page).evaluate(element => {
    const style = (element as HTMLElement).style
    const normalize = (value: string) =>
      value.replace(/-?\d+(?:\.\d+)?px/g, token => {
        const numeric = Number(token.slice(0, -2))

        return numeric === 0 ? '0' : `${Number(numeric.toFixed(3))}px`
      })

    return {
      position: style.position,
      top: normalize(style.top),
      left: normalize(style.left),
      right: normalize(style.right),
      transform: normalize(style.transform),
      width: normalize(style.width),
      height: normalize(style.height),
    }
  })
}

async function readItemBox(page: Page) {
  const root = await page.locator('.vgl-layout').boundingBox()
  const item = await itemA(page).boundingBox()
  if (!root || !item) return null
  return {
    inline: item.x - root.x,
    block: item.y - root.y,
    width: item.width,
    height: item.height,
  }
}

async function dragItemBy(page: Page, deltaX: number, deltaY: number, settleBeforeRelease = false) {
  const box = await itemA(page).boundingBox()
  if (!box) throw new Error('missing draggable item box')
  const startX = box.x + box.width / 2
  const startY = box.y + box.height / 2
  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX + deltaX, startY + deltaY, { steps: 4 })
  if (settleBeforeRelease) await settleBrowser(page)
  await page.mouse.up()
  await settleBrowser(page)
}

interface ResizePointerMove {
  deltaX: number
  deltaY: number
  settle?: boolean
}

async function fixtureItemSize(page: Page) {
  const layout = await readJsonAttribute<Array<{ i: string; w: number; h: number }>>(
    page.locator('[data-contract-e2e-fixture="ready"]'),
    'data-layout-state',
  )
  const item = layout.find(entry => entry.i === 'fixture-a')
  return item ? { w: item.w, h: item.h } : null
}

async function resizeItemThrough(
  page: Page,
  moves: readonly ResizePointerMove[],
  capturePreview = false,
) {
  const handle = page.locator('.vgl-item__resizer--se').first()
  const box = await handle.boundingBox()
  if (!box) throw new Error('missing resize handle box')
  const startX = box.x + box.width / 2
  const startY = box.y + box.height / 2
  await page.mouse.move(startX, startY)
  await page.mouse.down()
  for (const move of moves) {
    await page.mouse.move(startX + move.deltaX, startY + move.deltaY, { steps: 4 })
    if (move.settle) await settleBrowser(page)
  }
  const preview = capturePreview ? await fixtureItemSize(page) : null
  await page.mouse.up()
  await settleBrowser(page)
  return { preview, terminal: await fixtureItemSize(page) }
}

async function dispatchDragEvent(
  page: Page,
  type: 'dragenter' | 'dragover' | 'drop' | 'dragleave',
  horizontalFraction: number,
  clientX?: number,
  invalidClientX = false,
) {
  return page.locator('.vgl-layout').evaluate(
    (element, input) => {
      const rect = element.getBoundingClientRect()
      const dataTransfer = new DataTransfer()
      Object.defineProperty(dataTransfer, 'dropEffect', {
        configurable: true,
        value: 'none',
        writable: true,
      })
      const horizontalOffset = Number.isFinite(rect.width)
        ? rect.width * input.horizontalFraction
        : 10
      const verticalOffset = Number.isFinite(rect.height) ? Math.min(rect.height / 2, 30) : 10
      const event = new DragEvent(input.type, {
        bubbles: true,
        cancelable: true,
        clientX: input.clientX ?? (Number.isFinite(rect.left) ? rect.left : 0) + horizontalOffset,
        clientY: (Number.isFinite(rect.top) ? rect.top : 0) + verticalOffset,
        dataTransfer,
      })
      if (input.invalidClientX) {
        Object.defineProperty(event, 'clientX', {
          configurable: true,
          value: Number.NaN,
        })
      }
      element.dispatchEvent(event)
      return {
        defaultPrevented: event.defaultPrevented,
        dropEffect: dataTransfer.dropEffect,
        clientX: event.clientX,
        clientY: event.clientY,
      }
    },
    { type, horizontalFraction, clientX, invalidClientX },
  )
}

async function dispatchDndSequence(page: Page, horizontalFraction: number) {
  return page.locator('.vgl-layout').evaluate((element, fraction) => {
    const rect = element.getBoundingClientRect()
    const dataTransfer = new DataTransfer()
    Object.defineProperty(dataTransfer, 'dropEffect', {
      configurable: true,
      value: 'none',
      writable: true,
    })
    const clientX = rect.left + rect.width * fraction
    const clientY = rect.top + Math.min(rect.height / 2, 30)

    return (['dragenter', 'dragover', 'drop'] as const).map(type => {
      const event = new DragEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX,
        clientY,
        dataTransfer,
      })
      element.dispatchEvent(event)
      return {
        type,
        defaultPrevented: event.defaultPrevented,
        dropEffect: dataTransfer.dropEffect,
      }
    })
  }, horizontalFraction)
}

interface GridBox {
  x: number
  y: number
  width: number
  height: number
}

interface GridItemSnapshot {
  x: number
  y: number
  w: number
  h: number
}

async function expectedGridBox(
  page: Page,
  item: GridItemSnapshot,
  scale: number,
  rtl = false,
): Promise<GridBox | null> {
  const root = await page.locator('.vgl-layout').boundingBox()
  if (!root) return null

  const gap = 10 * scale
  const rowHeight = 40 * scale
  const cellWidth = (root.width - gap * 13) / 12
  const width = item.w * cellWidth + (item.w - 1) * gap
  const height = item.h * rowHeight + (item.h - 1) * gap
  const inlineOffset = gap + item.x * (cellWidth + gap)

  return {
    x: rtl ? root.x + root.width - inlineOffset - width : root.x + inlineOffset,
    y: root.y + gap + item.y * (rowHeight + gap),
    width,
    height,
  }
}

function maxBoxError(actual: GridBox | null, expected: GridBox | null) {
  if (!actual || !expected) return Number.POSITIVE_INFINITY
  return Math.max(
    Math.abs(actual.x - expected.x),
    Math.abs(actual.y - expected.y),
    Math.abs(actual.width - expected.width),
    Math.abs(actual.height - expected.height),
  )
}

async function itemBoxById(page: Page, id: string) {
  const item = page
    .locator('.vgl-item')
    .filter({ has: page.locator(`[data-grid-item="${id}"]`) })
    .first()
  return (await item.count()) ? item.boundingBox() : null
}

async function callbackInputs(page: Page) {
  const trace = await readJsonAttribute<Array<{ args: string }>>(
    page.locator('[data-contract-e2e-fixture="ready"]'),
    'data-drop-callback-trace',
  )
  return trace.map(entry => JSON.parse(entry.args) as unknown[])
}

async function prepareResourceInstrumentation(page: Page) {
  await page.addInitScript(() => {
    const NativeResizeObserver = globalThis.ResizeObserver
    const resources = {
      activeAnimationFrames: 0,
      activeObservers: 0,
      disconnectedObservers: 0,
    }
    Object.defineProperty(globalThis, '__GLP_E2E_RESOURCES__', {
      configurable: true,
      value: resources,
    })

    class TrackedResizeObserver {
      private readonly observer: ResizeObserver
      private active = false

      constructor(callback: ResizeObserverCallback) {
        this.observer = new NativeResizeObserver(callback)
      }

      observe(target: Element, options?: ResizeObserverOptions) {
        if (!this.active) {
          this.active = true
          resources.activeObservers += 1
        }
        this.observer.observe(target, options)
      }

      unobserve(target: Element) {
        this.observer.unobserve(target)
      }

      disconnect() {
        if (this.active) {
          this.active = false
          resources.activeObservers -= 1
          resources.disconnectedObservers += 1
        }
        this.observer.disconnect()
      }
    }

    const nativeRequestAnimationFrame = globalThis.requestAnimationFrame.bind(globalThis)
    const nativeCancelAnimationFrame = globalThis.cancelAnimationFrame.bind(globalThis)
    const pending = new Set<number>()
    globalThis.requestAnimationFrame = callback => {
      const id = nativeRequestAnimationFrame(time => {
        pending.delete(id)
        resources.activeAnimationFrames = pending.size
        callback(time)
      })
      pending.add(id)
      resources.activeAnimationFrames = pending.size
      return id
    }
    globalThis.cancelAnimationFrame = id => {
      pending.delete(id)
      resources.activeAnimationFrames = pending.size
      nativeCancelAnimationFrame(id)
    }
    Object.defineProperty(globalThis, 'ResizeObserver', {
      configurable: true,
      value: TrackedResizeObserver,
    })
  })
}

function defineFutureContract<Actual>(contract: FutureContract<Actual>) {
  test.describe.serial(`[${contract.phaseLabel}][${contract.id}]`, () => {
    test(`${contract.id} target contract`, async ({ page }) => {
      await contract.prepare?.(page)
      const errors = await expectFixtureReady(page, contract.phase, contract.id, contract.controls)
      const actual = await contract.exercise(page)

      expect(errors).toEqual([])
      expect(actual as unknown).toEqual(contract.expected)
    })
  })
}

test.describe('Phase 0 browser fixture', () => {
  test('E2E-00 readiness and GridLayout mount', async ({ page }) => {
    await expectFixtureReady(page, 'phase-0', 'E2E-00', ['fixture-ready'])
  })
})

defineFutureContract({
  id: 'E2E-20',
  phase: 'phase-2',
  phaseLabel: 'Phase 2',
  controls: ['programmatic-move', 'ack-mode'],
  exercise: async page => {
    const results: Record<string, unknown> = {}
    for (const mode of ['none', 'sync', 'next-tick', 'nested-next-tick', 'rewrite'] as const) {
      await openVariant(page, 'phase-2', 'E2E-20', mode, ['programmatic-move', 'ack-mode'])
      await clickControl(page, 'programmatic-move')
      const layout = await readJsonAttribute<Array<{ i: string; x: number }>>(
        page.locator('[data-contract-e2e-fixture="ready"]'),
        'data-layout-state',
      )
      const events = await readEvents(page)
      results[mode] = {
        x: layout.find(item => item.i === 'fixture-a')?.x,
        rejected: firstPayload(events, 'operation-rejected')?.reason ?? null,
        updatedSource:
          (
            events.find(event => event.name === 'layout-updated')?.args[1] as
              { source?: unknown } | undefined
          )?.source ?? null,
      }
    }
    return results
  },
  expected: {
    none: { x: 0, rejected: 'external-not-committed', updatedSource: null },
    sync: { x: 4, rejected: null, updatedSource: 'programmatic' },
    'next-tick': { x: 4, rejected: null, updatedSource: 'programmatic' },
    'nested-next-tick': {
      x: 4,
      rejected: 'external-not-committed',
      updatedSource: 'external',
    },
    rewrite: { x: 0, rejected: 'external-update', updatedSource: 'external' },
  },
})

defineFutureContract({
  id: 'E2E-21',
  phase: 'phase-2',
  phaseLabel: 'Phase 2',
  controls: ['high-frequency-drag', 'ack-mode'],
  exercise: async page => {
    const results: Record<string, unknown> = {}
    for (const mode of ['sync', 'out-of-order'] as const) {
      await openVariant(page, 'phase-2', 'E2E-21', mode, ['high-frequency-drag', 'ack-mode'])
      await clickControl(page, 'high-frequency-drag')
      const events = await readEvents(page)
      const layout = await readJsonAttribute<Array<{ i: string; x: number }>>(
        page.locator('[data-contract-e2e-fixture="ready"]'),
        'data-layout-state',
      )
      await expect
        .poll(async () => {
          const candidate = await readItemBox(page)
          return candidate ? Math.abs(candidate.inline - 142) : Number.POSITIVE_INFINITY
        })
        .toBeLessThanOrEqual(2)
      const box = await readItemBox(page)
      results[mode] = {
        ordered: hasOrderedEvents(events, [
          'update:layout',
          'interaction-change',
          'interaction-end',
          'layout-updated',
        ]),
        rejectedCount: payloads(events, 'operation-rejected').length,
        terminalCount: payloads(events, 'interaction-end').length,
        finalX: layout.find(item => item.i === 'fixture-a')?.x,
        finalBoxMatches: box ? Math.abs(box.inline - 142) <= 2 : false,
      }
    }
    return results
  },
  expected: {
    sync: {
      ordered: true,
      rejectedCount: 0,
      terminalCount: 1,
      finalX: 2,
      finalBoxMatches: true,
    },
    'out-of-order': {
      ordered: true,
      rejectedCount: 0,
      terminalCount: 1,
      finalX: 2,
      finalBoxMatches: true,
    },
  },
})

defineFutureContract({
  id: 'E2E-22',
  phase: 'phase-2',
  phaseLabel: 'Phase 2',
  controls: ['change-config-during-interaction'],
  exercise: async page => {
    const results: Record<string, unknown> = {}
    const variants = ['width', 'strategy', 'disabled'] as const
    for (const mode of variants) {
      await openVariant(page, 'phase-2', 'E2E-22', mode, ['change-config-during-interaction'])
      await clickControl(page, 'change-config-during-interaction')
      const events = await readEvents(page)
      const terminals = payloads(events, 'interaction-end')
      results[mode] = {
        placeholderCount: await page.locator('.vgl-item--placeholder:visible').count(),
        terminalCount: terminals.length,
        terminalReason: terminals[0]?.reason ?? null,
      }
    }
    return results
  },
  expected: {
    width: { placeholderCount: 0, terminalCount: 1, terminalReason: 'config-changed' },
    strategy: { placeholderCount: 0, terminalCount: 1, terminalReason: 'config-changed' },
    disabled: { placeholderCount: 0, terminalCount: 1, terminalReason: 'disabled' },
  },
})

defineFutureContract({
  id: 'E2E-23',
  phase: 'phase-2',
  phaseLabel: 'Phase 2',
  controls: ['item-slot', 'default-slot'],
  exercise: async page => {
    const results: Record<string, unknown> = {}

    await openVariant(page, 'phase-2', 'E2E-23', 'item-slot', ['item-slot', 'default-slot'])
    await clickControl(page, 'item-slot')
    results.itemSlot = {
      itemSlotCount: await page.locator('[data-item-slot]').count(),
      defaultSlotCount: await page.locator('[data-default-slot]').count(),
    }

    for (const mode of ['manual-missing', 'manual-duplicate', 'manual-promotion'] as const) {
      await openVariant(page, 'phase-2', 'E2E-23', mode, ['item-slot', 'default-slot'])
      if (mode === 'manual-promotion') {
        await clickControl(page, 'default-slot')
      }
      const events = await readEvents(page)
      const registrationErrors = payloads(events, 'error').filter(
        payload => payload.code === 'invalid-registration',
      )
      results[mode] = {
        errorReasons: registrationErrors.map(
          payload => (payload.cause as { reason?: unknown } | undefined)?.reason ?? null,
        ),
        missingCount: await page.locator('[data-manual-missing]').count(),
        duplicateCount: await page.locator('[data-manual-duplicate]').count(),
        promotedHasGeometry:
          mode === 'manual-promotion'
            ? Boolean(await page.locator('[data-manual-duplicate]').getAttribute('style'))
            : null,
      }
    }
    return results
  },
  expected: {
    itemSlot: { itemSlotCount: 2, defaultSlotCount: 0 },
    'manual-missing': {
      errorReasons: ['missing-id'],
      missingCount: 1,
      duplicateCount: 0,
      promotedHasGeometry: null,
    },
    'manual-duplicate': {
      errorReasons: ['duplicate'],
      missingCount: 0,
      duplicateCount: 1,
      promotedHasGeometry: null,
    },
    'manual-promotion': {
      errorReasons: ['duplicate'],
      missingCount: 0,
      duplicateCount: 1,
      promotedHasGeometry: true,
    },
  },
})

defineFutureContract({
  id: 'E2E-24',
  phase: 'phase-2',
  phaseLabel: 'Phase 2',
  controls: ['focus-target', 'motion-state'],
  exercise: async page => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openVariant(page, 'phase-2', 'E2E-24', 'reduced-placeholder', [
      'focus-target',
      'motion-state',
    ])
    await clickControl(page, 'motion-state')
    const reduced = await page.evaluate(() => {
      const root = document.querySelector('.vgl-layout')
      const item = document.querySelector('.vgl-layout > .vgl-item')
      const placeholder = document.querySelector('.vgl-item--placeholder')
      return {
        rootDuration: root ? getComputedStyle(root).transitionDuration : null,
        itemDuration: item ? getComputedStyle(item).transitionDuration : null,
        placeholderDuration: placeholder ? getComputedStyle(placeholder).transitionDuration : null,
        rootAnimation: root ? getComputedStyle(root).animationDuration : null,
        itemAnimation: item ? getComputedStyle(item).animationDuration : null,
      }
    })

    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await openVariant(page, 'phase-2', 'E2E-24', 'normal-motion', ['focus-target', 'motion-state'])
    await clickControl(page, 'motion-state')
    const normal = await page.evaluate(() => {
      const root = document.querySelector('.vgl-layout')!
      const item = document.querySelector('.vgl-layout > .vgl-item')!
      const placeholder = document.querySelector('.vgl-item--placeholder')!
      const rootStyle = getComputedStyle(root)
      const itemStyle = getComputedStyle(item)
      const placeholderStyle = getComputedStyle(placeholder)
      return {
        root: [
          rootStyle.transitionProperty,
          rootStyle.transitionDuration,
          rootStyle.transitionTimingFunction,
        ],
        item: [
          itemStyle.transitionProperty,
          itemStyle.transitionDuration,
          itemStyle.transitionTimingFunction,
        ],
        placeholder: [
          placeholderStyle.transitionProperty,
          placeholderStyle.transitionDuration,
          placeholderStyle.transitionTimingFunction,
        ],
      }
    })

    await openVariant(page, 'phase-2', 'E2E-24', 'focus', ['focus-target', 'motion-state'])
    const focus = page.locator('[data-focus-target]')
    await focus.focus()
    await page.evaluate(() => {
      ;(
        globalThis as unknown as {
          __GLP_FOCUSED_NODE__?: Element | null
        }
      ).__GLP_FOCUSED_NODE__ = document.activeElement
    })
    await dragItemBy(page, 80, 0)
    const focusAndTab = await page.evaluate(() => ({
      identityPreserved:
        document.activeElement ===
        (
          globalThis as unknown as {
            __GLP_FOCUSED_NODE__?: Element | null
          }
        ).__GLP_FOCUSED_NODE__,
      rootTabIndex: document.querySelector('.vgl-layout')?.getAttribute('tabindex') ?? null,
      itemTabIndex:
        document.querySelector('.vgl-layout > .vgl-item')?.getAttribute('tabindex') ?? null,
      handleAria:
        document.querySelector('.vgl-item__resizer--se')?.getAttribute('aria-hidden') ?? null,
      handleTabIndex:
        (document.querySelector('.vgl-item__resizer--se') as HTMLElement | null)?.tabIndex ?? null,
    }))
    return { reduced, normal, focusAndTab }
  },
  expected: {
    reduced: {
      rootDuration: '0s',
      itemDuration: '0s',
      placeholderDuration: '0s',
      rootAnimation: '0s',
      itemAnimation: '0s',
    },
    normal: {
      root: ['height', '0.2s', 'ease'],
      item: ['transform', '0.2s', 'ease'],
      placeholder: ['transform', '0.1s', 'ease'],
    },
    focusAndTab: {
      identityPreserved: true,
      rootTabIndex: null,
      itemTabIndex: null,
      handleAria: 'true',
      handleTabIndex: -1,
    },
  },
})

defineFutureContract({
  id: 'E2E-25',
  phase: 'phase-2',
  phaseLabel: 'Phase 2',
  controls: ['unmount-active-grid'],
  prepare: prepareResourceInstrumentation,
  exercise: async page => {
    await openVariant(page, 'phase-2', 'E2E-25', 'active-unmount', ['unmount-active-grid'])
    const resourcesBefore = await page.evaluate(
      () =>
        (
          globalThis as unknown as {
            __GLP_E2E_RESOURCES__: {
              activeAnimationFrames: number
              activeObservers: number
              disconnectedObservers: number
            }
          }
        ).__GLP_E2E_RESOURCES__,
    )
    await clickControl(page, 'unmount-active-grid')
    const terminals = (await readEvents(page)).filter(event => event.name === 'interaction-end')
    const resourcesAfter = await page.evaluate(
      () =>
        (
          globalThis as unknown as {
            __GLP_E2E_RESOURCES__: {
              activeAnimationFrames: number
              activeObservers: number
              disconnectedObservers: number
            }
          }
        ).__GLP_E2E_RESOURCES__,
    )
    const terminalSummary = terminals.map(event => {
      const payload = event.args[0] as { status?: unknown; reason?: unknown }
      return { status: payload.status, reason: payload.reason }
    })

    const eventCount = (await readEvents(page)).length
    await page.evaluate(() => {
      window.dispatchEvent(new Event('resize'))
      window.dispatchEvent(new Event('blur'))
    })
    await settleBrowser(page)
    const callbacksStopped = (await readEvents(page)).length === eventCount
    const gridRemoved = (await page.locator('.vgl-layout').count()) === 0

    await openVariant(page, 'phase-2', 'E2E-25', 'payload-mutation', ['unmount-active-grid'])
    await dragItemBy(page, 80, 0)
    const isolationLayout = await readJsonAttribute<Array<{ x: number }>>(
      page.locator('[data-contract-e2e-fixture="ready"]'),
      'data-layout-state',
    )
    return {
      terminalSummary,
      resourcesReleased:
        resourcesAfter.activeObservers < resourcesBefore.activeObservers &&
        resourcesAfter.disconnectedObservers > resourcesBefore.disconnectedObservers &&
        resourcesAfter.activeAnimationFrames === 0,
      callbacksStopped,
      payloadMutationIsolated: isolationLayout[0].x !== 99,
      gridRemoved,
    }
  },
  expected: {
    terminalSummary: [{ status: 'cancelled', reason: 'unmount' }],
    resourcesReleased: true,
    callbacksStopped: true,
    payloadMutationIsolated: true,
    gridRemoved: true,
  },
})

defineFutureContract({
  id: 'E2E-26',
  phase: 'phase-2',
  phaseLabel: 'Phase 2',
  controls: ['mount-standalone-item'],
  exercise: async page => {
    await openVariant(page, 'phase-2', 'E2E-26', 'standalone', ['mount-standalone-item'])
    await clickControl(page, 'mount-standalone-item')
    const error = await readJsonAttribute<Record<string, unknown>>(
      page.locator('[data-contract-e2e-fixture="ready"]'),
      'data-standalone-error',
    )
    const standalone = {
      name: error.name,
      code: error.code ?? null,
      path: error.path ?? null,
      domCount: await page.locator('[data-standalone-item]').count(),
    }

    return standalone
  },
  expected: {
    name: 'GridLayoutValidationError',
    code: 'invalid-config',
    path: 'gridItem.parent',
    domCount: 0,
  },
})

defineFutureContract({
  id: 'E2E-27',
  phase: 'phase-2',
  phaseLabel: 'Phase 2',
  controls: ['resize-handle'],
  exercise: async page => {
    const results: Record<string, unknown> = {}

    await openVariant(page, 'phase-2', 'E2E-27', 'normal', ['resize-handle'])
    await clickControl(page, 'resize-handle')
    results.normal = await page
      .locator('.vgl-item__resizer--se')
      .first()
      .evaluate(element => ({
        ariaHidden: element.getAttribute('aria-hidden'),
        tabIndex: (element as HTMLElement).tabIndex,
        rootContains: Boolean(element.closest('.vgl-layout')),
        validContainingBlock:
          (element.closest('.vgl-item') as HTMLElement | null)?.offsetParent ===
          element.closest('.vgl-layout'),
      }))

    for (const mode of ['teleport', 'containing-block'] as const) {
      await openVariant(page, 'phase-2', 'E2E-27', mode, ['resize-handle'])
      const error = firstPayload(await readEvents(page), 'error')
      results[mode] = {
        code: error?.code ?? null,
        reason: (error?.cause as { reason?: unknown } | undefined)?.reason ?? null,
        path: error?.path ?? null,
      }
    }

    const measureBottomOverflow = async (variant: 'bounded' | 'unbounded') => {
      await openVariant(page, 'phase-2', 'E2E-27', variant, ['resize-handle'])
      const item = itemA(page)
      const [initialItem, initialRoot] = await Promise.all([
        item.boundingBox(),
        page.locator('.vgl-layout').boundingBox(),
      ])
      if (!initialItem || !initialRoot) throw new Error(`missing ${variant} drag geometry`)

      const startX = initialItem.x + initialItem.width / 2
      const startY = initialItem.y + initialItem.height / 2
      await page.mouse.move(startX, startY)
      await page.mouse.down()
      await page.mouse.move(startX, startY + 1600, { steps: 4 })
      await settleBrowser(page)
      const heldItem = await item.boundingBox()
      await page.mouse.up()
      if (!heldItem) throw new Error(`missing held ${variant} item geometry`)

      return heldItem.y + heldItem.height - (initialRoot.y + initialRoot.height)
    }
    const boundedOverflow = await measureBottomOverflow('bounded')
    const unboundedOverflow = await measureBottomOverflow('unbounded')
    results.bounded = {
      enabledStopsAtBoundary: Math.abs(boundedOverflow) <= 2,
      disabledCanEscape: unboundedOverflow > 100,
    }

    await openVariant(page, 'phase-2', 'E2E-27', 'multi-direction', ['resize-handle'])
    const multiDirectionItem = page.locator('.vgl-layout > .vgl-item').first()
    const multiDirectionHandlePlacement = await multiDirectionItem.evaluate(element => {
      const item = element.getBoundingClientRect()
      const tolerance = 6
      return Array.from(element.querySelectorAll<HTMLElement>('.vgl-item__resizer')).every(
        handle => {
          const axis = Array.from(handle.classList)
            .find(className => className.startsWith('vgl-item__resizer--'))
            ?.replace('vgl-item__resizer--', '')
          if (!axis || axis === 'rtl') return false
          const rect = handle.getBoundingClientRect()
          const centerX = rect.left + rect.width / 2
          const centerY = rect.top + rect.height / 2
          const horizontal = axis.includes('e')
            ? Math.abs(centerX - item.right) <= tolerance
            : axis.includes('w')
              ? Math.abs(centerX - item.left) <= tolerance
              : Math.abs(centerX - (item.left + item.right) / 2) <= tolerance
          const vertical = axis.includes('n')
            ? Math.abs(centerY - item.top) <= tolerance
            : axis.includes('s')
              ? Math.abs(centerY - item.bottom) <= tolerance
              : Math.abs(centerY - (item.top + item.bottom) / 2) <= tolerance
          return horizontal && vertical
        },
      )
    })
    const renderedHandles = await multiDirectionItem
      .locator('.vgl-item__resizer')
      .evaluateAll(elements =>
        elements.map(element =>
          Array.from(element.classList)
            .find(className => className.startsWith('vgl-item__resizer--'))
            ?.replace('vgl-item__resizer--', ''),
        ),
      )

    const resizeTopCorner = async (axis: 'ne' | 'nw') => {
      await openVariant(page, 'phase-2', 'E2E-27', 'multi-direction', ['resize-handle'])
      const fixture = page.locator('[data-contract-e2e-fixture="ready"]')
      const active = itemA(page)
      const handle = active.locator(`.vgl-item__resizer--${axis}`)
      const [initialBox, handleBox] = await Promise.all([
        active.boundingBox(),
        handle.boundingBox(),
      ])
      if (!initialBox || !handleBox) throw new Error(`missing ${axis} resize geometry`)
      const startX = handleBox.x + handleBox.width / 2
      const startY = handleBox.y + handleBox.height / 2
      await page.mouse.move(startX, startY)
      await page.mouse.down()
      await page.mouse.move(startX + (axis === 'ne' ? 66 : -66), startY - 50, { steps: 4 })
      await settleBrowser(page)

      const placeholder = page.locator('.vgl-item--placeholder:visible')
      await placeholder.evaluate(element =>
        Promise.allSettled(element.getAnimations().map(animation => animation.finished)),
      )
      const [heldBox, placeholderBox, heldLayout] = await Promise.all([
        active.boundingBox(),
        placeholder.boundingBox(),
        readJsonAttribute<Array<{ i: string; x: number; y: number; w: number; h: number }>>(
          fixture,
          'data-layout-state',
        ),
      ])
      if (!heldBox || !placeholderBox) throw new Error(`missing held ${axis} resize geometry`)
      const preview = heldLayout.find(item => item.i === 'fixture-a')
      await page.mouse.up()
      await settleBrowser(page)
      await expect
        .poll(async () => maxBoxError(await active.boundingBox(), placeholderBox))
        .toBeLessThanOrEqual(2)
      const terminalBox = await active.boundingBox()
      const terminalLayout = await readJsonAttribute<
        Array<{ i: string; x: number; y: number; w: number; h: number }>
      >(fixture, 'data-layout-state')
      const terminal = terminalLayout.find(item => item.i === 'fixture-a')
      const blocker = terminalLayout.find(item => item.i === 'fixture-b')
      const boxesMatch = (
        first: Awaited<ReturnType<typeof active.boundingBox>>,
        second: Awaited<ReturnType<typeof active.boundingBox>>,
      ) =>
        first != null &&
        second != null &&
        Math.abs(first.x - second.x) <= 2 &&
        Math.abs(first.y - second.y) <= 2 &&
        Math.abs(first.width - second.width) <= 2 &&
        Math.abs(first.height - second.height) <= 2

      return {
        activeTracksResizeAnchor:
          Math.abs(initialBox.y + initialBox.height - (heldBox.y + heldBox.height)) <= 2 &&
          (axis === 'ne'
            ? Math.abs(initialBox.x - heldBox.x) <= 2
            : Math.abs(initialBox.x + initialBox.width - (heldBox.x + heldBox.width)) <= 2),
        placeholderPreviewsCompactedTarget:
          preview?.y === 0 && maxBoxError(heldBox, placeholderBox) > 2,
        terminalMatchesPlaceholder:
          boxesMatch(placeholderBox, terminalBox) &&
          preview != null &&
          terminal != null &&
          preview.x === terminal.x &&
          preview.y === terminal.y &&
          preview.w === terminal.w &&
          preview.h === terminal.h,
        layoutStableOnRelease: JSON.stringify(heldLayout) === JSON.stringify(terminalLayout),
        terminal: terminal ? { x: terminal.x, y: terminal.y, w: terminal.w, h: terminal.h } : null,
        blockerPushedBelow:
          terminal != null && blocker != null && blocker.y === terminal.y + terminal.h,
      }
    }

    results.multiDirection = {
      renderedHandles,
      handlesPlacedAtExpectedEdges: multiDirectionHandlePlacement,
      ne: await resizeTopCorner('ne'),
      nw: await resizeTopCorner('nw'),
    }

    await openVariant(page, 'phase-2', 'E2E-27', 'aspect', ['resize-handle'])
    const verticalMultiStep = await resizeItemThrough(page, [
      { deltaX: 5, deltaY: 5 },
      { deltaX: 10, deltaY: 80, settle: true },
      { deltaX: 20, deltaY: 100, settle: true },
    ])
    await openVariant(page, 'phase-2', 'E2E-27', 'aspect', ['resize-handle'])
    const verticalFastRelease = await resizeItemThrough(page, [
      { deltaX: 5, deltaY: 5 },
      { deltaX: 20, deltaY: 100 },
    ])
    const fastReleaseEvents = await readEvents(page)
    const fastReleaseNames = eventNames(fastReleaseEvents)
    const fastReleaseResized = fastReleaseEvents.filter(event => event.name === 'item-resized')
    const terminalResizeIndex = fastReleaseNames.lastIndexOf('item-resize')
    const terminalUpdateIndex = fastReleaseNames.lastIndexOf('update:layout')
    const terminalChangeIndex = fastReleaseNames.lastIndexOf('interaction-change')
    const terminalResizedIndex = fastReleaseNames.lastIndexOf('item-resized')
    const terminalEndIndex = fastReleaseNames.lastIndexOf('interaction-end')
    await openVariant(page, 'phase-2', 'E2E-27', 'aspect-no-ack', ['resize-handle'])
    await resizeItemThrough(page, [
      { deltaX: 5, deltaY: 5 },
      { deltaX: 20, deltaY: 100 },
    ])
    const noAckEvents = await readEvents(page)
    const noAckNames = eventNames(noAckEvents)
    const noAckResized = noAckEvents.filter(event => event.name === 'item-resized')
    const noAckWorkingItem = lastPayload(noAckEvents, 'interaction-change')?.item as
      { w?: unknown; h?: unknown } | undefined
    const noAckUpdateIndex = noAckNames.lastIndexOf('update:layout')
    const noAckChangeIndex = noAckNames.lastIndexOf('interaction-change')
    const noAckResizedIndex = noAckNames.lastIndexOf('item-resized')
    const noAckRejectedIndex = noAckEvents.findIndex(
      event =>
        event.name === 'operation-rejected' &&
        (event.args[0] as { reason?: unknown } | undefined)?.reason === 'external-not-committed',
    )
    const noAckEndIndex = noAckNames.lastIndexOf('interaction-end')
    await openVariant(page, 'phase-2', 'E2E-27', 'aspect-drag-no-ack', ['resize-handle'])
    await dragItemBy(page, 140, 0)
    const dragNoAckEvents = await readEvents(page)
    const dragNoAckNames = eventNames(dragNoAckEvents)
    const dragNoAckMoved = dragNoAckEvents.filter(event => event.name === 'item-moved')
    const dragNoAckWorkingItem = lastPayload(dragNoAckEvents, 'interaction-change')?.item as
      { x?: unknown; y?: unknown } | undefined
    const dragNoAckMoveIndex = dragNoAckNames.lastIndexOf('item-move')
    const dragNoAckUpdateIndex = dragNoAckNames.lastIndexOf('update:layout')
    const dragNoAckChangeIndex = dragNoAckNames.lastIndexOf('interaction-change')
    const dragNoAckMovedIndex = dragNoAckNames.lastIndexOf('item-moved')
    const dragNoAckRejectedIndex = dragNoAckEvents.findIndex(
      event =>
        event.name === 'operation-rejected' &&
        (event.args[0] as { reason?: unknown } | undefined)?.reason === 'external-not-committed',
    )
    const dragNoAckEndIndex = dragNoAckNames.lastIndexOf('interaction-end')
    await openVariant(page, 'phase-2', 'E2E-27', 'aspect-terminal-extension', ['resize-handle'])
    await dragItemBy(page, 140, 0, true)
    const terminalExtensionEvents = await readEvents(page)
    const terminalExtensionNames = eventNames(terminalExtensionEvents)
    const terminalExtensionMoved = terminalExtensionEvents.filter(
      event => event.name === 'item-moved',
    )
    const terminalExtensionWorkingItem = lastPayload(terminalExtensionEvents, 'interaction-change')
      ?.item as { x?: unknown; y?: unknown } | undefined
    const terminalExtensionErrorIndex = terminalExtensionNames.lastIndexOf('error')
    const terminalExtensionRejectedIndex = terminalExtensionNames.lastIndexOf('operation-rejected')
    const terminalExtensionMovedIndex = terminalExtensionNames.lastIndexOf('item-moved')
    const terminalExtensionEndIndex = terminalExtensionNames.lastIndexOf('interaction-end')
    const terminalExtensionEnd = lastPayload(terminalExtensionEvents, 'interaction-end')
    await openVariant(page, 'phase-2', 'E2E-27', 'aspect-rtl', ['resize-handle'])
    const rtlVertical = await resizeItemThrough(page, [
      { deltaX: -5, deltaY: 5 },
      { deltaX: -10, deltaY: 80, settle: true },
      { deltaX: -20, deltaY: 100, settle: true },
    ])
    await openVariant(page, 'phase-2', 'E2E-27', 'aspect-limit', ['resize-handle'])
    const limited = await resizeItemThrough(
      page,
      [
        { deltaX: 5, deltaY: 5 },
        { deltaX: 200, deltaY: 100, settle: true },
      ],
      true,
    )
    const limitedResized = (await readEvents(page))
      .filter(event => event.name === 'item-resized')
      .at(-1)
    await openVariant(page, 'phase-2', 'E2E-27', 'aspect-limit', ['resize-handle'])
    const minimum = await resizeItemThrough(page, [
      { deltaX: 5, deltaY: 5 },
      { deltaX: -100, deltaY: -100 },
    ])
    results.aspect = {
      verticalChanged:
        verticalMultiStep.terminal != null &&
        (verticalMultiStep.terminal.w !== 2 || verticalMultiStep.terminal.h !== 1),
      verticalTerminalStable:
        JSON.stringify(verticalMultiStep.terminal) === JSON.stringify(verticalFastRelease.terminal),
      fastReleaseLegacyTerminal:
        verticalFastRelease.terminal != null &&
        fastReleaseResized.length === 1 &&
        fastReleaseResized[0].args[1] === verticalFastRelease.terminal.h &&
        fastReleaseResized[0].args[2] === verticalFastRelease.terminal.w,
      fastReleaseEventOrder:
        terminalResizeIndex >= 0 &&
        terminalResizeIndex < terminalUpdateIndex &&
        terminalUpdateIndex < terminalChangeIndex &&
        terminalChangeIndex < terminalResizedIndex &&
        terminalResizedIndex < terminalEndIndex,
      noAckLegacyTerminal:
        noAckResized.length === 1 &&
        noAckResized[0].args[1] === noAckWorkingItem?.h &&
        noAckResized[0].args[2] === noAckWorkingItem?.w,
      noAckEventOrder:
        noAckUpdateIndex >= 0 &&
        noAckUpdateIndex < noAckChangeIndex &&
        noAckChangeIndex < noAckResizedIndex &&
        noAckResizedIndex < noAckRejectedIndex &&
        noAckRejectedIndex < noAckEndIndex,
      dragNoAckLegacyTerminal:
        dragNoAckMoved.length === 1 &&
        dragNoAckMoved[0].args[1] === dragNoAckWorkingItem?.x &&
        dragNoAckMoved[0].args[2] === dragNoAckWorkingItem?.y,
      dragNoAckEventOrder:
        dragNoAckMoveIndex >= 0 &&
        dragNoAckMoveIndex < dragNoAckUpdateIndex &&
        dragNoAckUpdateIndex < dragNoAckChangeIndex &&
        dragNoAckChangeIndex < dragNoAckMovedIndex &&
        dragNoAckMovedIndex < dragNoAckRejectedIndex &&
        dragNoAckRejectedIndex < dragNoAckEndIndex,
      terminalExtensionLegacyWorking:
        terminalExtensionMoved.length === 1 &&
        terminalExtensionMoved[0].args[1] === terminalExtensionWorkingItem?.x &&
        terminalExtensionMoved[0].args[2] === terminalExtensionWorkingItem?.y,
      terminalExtensionEventOrder:
        terminalExtensionErrorIndex >= 0 &&
        terminalExtensionErrorIndex < terminalExtensionRejectedIndex &&
        terminalExtensionRejectedIndex < terminalExtensionMovedIndex &&
        terminalExtensionMovedIndex < terminalExtensionEndIndex,
      terminalExtensionReason: terminalExtensionEnd?.reason ?? null,
      rtlEquivalent:
        JSON.stringify(rtlVertical.terminal) === JSON.stringify(verticalMultiStep.terminal),
      constrainedPreviewStable:
        JSON.stringify(limited.preview) === JSON.stringify(limited.terminal),
      constrainedLegacyTerminal:
        limited.terminal != null &&
        limitedResized?.args[1] === limited.terminal.h &&
        limitedResized.args[2] === limited.terminal.w,
      constrainedMaximum: limited.terminal,
      constrainedMinimum: minimum.terminal,
    }

    await openVariant(page, 'phase-2', 'E2E-27', 'selector', ['resize-handle'])
    const selectorBefore = await readItemBox(page)
    const selector = page.locator('[data-selector-ignore]')
    const selectorBox = await selector.boundingBox()
    if (selectorBox) {
      await page.mouse.move(selectorBox.x + 2, selectorBox.y + 2)
      await page.mouse.down()
      await page.mouse.move(selectorBox.x + 100, selectorBox.y + 2)
      await page.mouse.up()
      await settleBrowser(page)
    }
    results.selectorIgnored =
      JSON.stringify(await readItemBox(page)) === JSON.stringify(selectorBefore)

    await openVariant(page, 'phase-2', 'E2E-27', 'restore', ['resize-handle'])
    await dragItemBy(page, 140, 0)
    const restored = await readJsonAttribute<Array<{ i: string; y: number }>>(
      page.locator('[data-contract-e2e-fixture="ready"]'),
      'data-layout-state',
    )
    results.restore = restored.find(item => item.i === 'fixture-b')?.y === 0
    return results
  },
  expected: {
    normal: {
      ariaHidden: 'true',
      tabIndex: -1,
      rootContains: true,
      validContainingBlock: true,
    },
    teleport: {
      code: 'invalid-registration',
      reason: 'outside-root',
      path: 'gridItem["fixture-a"]',
    },
    'containing-block': {
      code: 'invalid-registration',
      reason: 'invalid-containing-block',
      path: 'gridItem["fixture-a"]',
    },
    bounded: {
      enabledStopsAtBoundary: true,
      disabledCanEscape: true,
    },
    multiDirection: {
      renderedHandles: ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'],
      handlesPlacedAtExpectedEdges: true,
      ne: {
        activeTracksResizeAnchor: true,
        placeholderPreviewsCompactedTarget: true,
        terminalMatchesPlaceholder: true,
        layoutStableOnRelease: true,
        terminal: { x: 4, y: 0, w: 5, h: 4 },
        blockerPushedBelow: true,
      },
      nw: {
        activeTracksResizeAnchor: true,
        placeholderPreviewsCompactedTarget: true,
        terminalMatchesPlaceholder: true,
        layoutStableOnRelease: true,
        terminal: { x: 3, y: 0, w: 5, h: 4 },
        blockerPushedBelow: true,
      },
    },
    aspect: {
      verticalChanged: true,
      verticalTerminalStable: true,
      fastReleaseLegacyTerminal: true,
      fastReleaseEventOrder: true,
      noAckLegacyTerminal: true,
      noAckEventOrder: true,
      dragNoAckLegacyTerminal: true,
      dragNoAckEventOrder: true,
      terminalExtensionLegacyWorking: true,
      terminalExtensionEventOrder: true,
      terminalExtensionReason: 'extension-error',
      rtlEquivalent: true,
      constrainedPreviewStable: true,
      constrainedLegacyTerminal: true,
      constrainedMaximum: { w: 4, h: 2 },
      constrainedMinimum: { w: 2, h: 1 },
    },
    selectorIgnored: true,
    restore: true,
  },
})

defineFutureContract({
  id: 'E2E-28',
  phase: 'phase-2',
  phaseLabel: 'Phase 2',
  controls: ['programmatic-move', 'metadata-log'],
  exercise: async page => {
    const results: Record<string, unknown> = {}
    for (const mode of [
      'metadata-echo',
      'independent-metadata',
      'committed-clone',
      'external',
      'invalid',
    ] as const) {
      await openVariant(page, 'phase-2', 'E2E-28', mode, ['programmatic-move', 'metadata-log'])
      await clickControl(page, 'programmatic-move')
      const events = await readEvents(page)
      results[mode] = {
        rejectedReasons: payloads(events, 'operation-rejected').map(payload => payload.reason),
        errorCodes: payloads(events, 'error').map(payload => payload.code),
        updatedSources: events
          .filter(event => event.name === 'layout-updated')
          .map(event => (event.args[1] as { source?: unknown } | undefined)?.source ?? null),
        metadataBearing: events
          .filter(event => ['update:layout', 'layout-updated'].includes(event.name))
          .every(event =>
            event.args.some(
              value =>
                value != null &&
                typeof value === 'object' &&
                typeof (value as { revision?: unknown }).revision === 'number' &&
                typeof (value as { source?: unknown }).source === 'string',
            ),
          ),
      }
    }
    return results
  },
  expected: {
    'metadata-echo': {
      rejectedReasons: [],
      errorCodes: [],
      updatedSources: ['programmatic'],
      metadataBearing: true,
    },
    'independent-metadata': {
      rejectedReasons: ['external-not-committed'],
      errorCodes: [],
      updatedSources: ['external'],
      metadataBearing: true,
    },
    'committed-clone': {
      rejectedReasons: ['external-update'],
      errorCodes: [],
      updatedSources: [],
      metadataBearing: true,
    },
    external: {
      rejectedReasons: ['external-update'],
      errorCodes: [],
      updatedSources: ['external'],
      metadataBearing: true,
    },
    invalid: {
      rejectedReasons: ['external-not-committed'],
      errorCodes: ['invalid-layout'],
      updatedSources: [],
      metadataBearing: true,
    },
  },
})

defineFutureContract({
  id: 'E2E-29',
  phase: 'phase-2',
  phaseLabel: 'Phase 2',
  controls: ['high-frequency-drag', 'terminal-log'],
  exercise: async page => {
    const results: Record<string, unknown> = {}
    for (const mode of ['committed', 'unchanged', 'cancelled', 'geometry', 'extension'] as const) {
      await openVariant(page, 'phase-2', 'E2E-29', mode, ['high-frequency-drag', 'terminal-log'])
      await clickControl(page, 'terminal-log')
      const events = await readEvents(page)
      const terminal = firstPayload(events, 'interaction-end')
      results[mode] = {
        terminalCount: payloads(events, 'interaction-end').length,
        status: terminal?.status ?? null,
        reason: terminal?.reason ?? null,
        hasRequiredFields:
          terminal != null &&
          [
            'type',
            'id',
            'revision',
            'previousLayout',
            'layout',
            'oldItem',
            'item',
            'nativeEvent',
          ].every(key => key in terminal),
      }
    }
    await openVariant(page, 'phase-2', 'E2E-29', 'legacy', ['high-frequency-drag', 'terminal-log'])
    await clickControl(page, 'high-frequency-drag')
    results.legacyOrder = hasOrderedEvents(await readEvents(page), [
      'update:layout',
      'interaction-change',
      'interaction-end',
      'layout-updated',
    ])
    return results
  },
  expected: {
    committed: {
      terminalCount: 1,
      status: 'committed',
      reason: 'applied',
      hasRequiredFields: true,
    },
    unchanged: {
      terminalCount: 1,
      status: 'unchanged',
      reason: 'same-value',
      hasRequiredFields: true,
    },
    cancelled: {
      terminalCount: 1,
      status: 'cancelled',
      reason: 'cancelled',
      hasRequiredFields: true,
    },
    geometry: {
      terminalCount: 1,
      status: 'cancelled',
      reason: 'geometry-error',
      hasRequiredFields: true,
    },
    extension: {
      terminalCount: 1,
      status: 'cancelled',
      reason: 'extension-invalid-result',
      hasRequiredFields: true,
    },
    legacyOrder: true,
  },
})

defineFutureContract({
  id: 'E2E-30',
  phase: 'phase-3',
  phaseLabel: 'Phase 3',
  controls: ['observer-gate'],
  exercise: async page => {
    const results: Record<string, unknown> = {}
    for (const mode of [
      'unresolved',
      'responsive-explicit',
      'hydration-match',
      'hydration-mismatch',
      'strategy-failure',
    ] as const) {
      const response = await page.request.get(`/__e2e/contracts/ssr?variant=${mode}`)
      expect(response.ok()).toBe(true)
      const html = await response.text()
      const rootTag = html.match(/<div[^>]*class="vgl-layout[^"]*"[^>]*>/)?.[0] ?? ''
      const itemTag = html.match(/<section[^>]*class="vgl-item[^"]*"[^>]*>/)?.[0] ?? ''
      const rootStyle = rootTag.match(/\sstyle="([^"]*)"/)?.[1] ?? ''
      const itemStyle = itemTag.match(/\sstyle="([^"]*)"/)?.[1] ?? ''
      const cssValue = (style: string, property: string) =>
        style.match(new RegExp(`(?:^|;)${property}:([^;]+)`))?.[1] ?? ''
      const result: Record<string, unknown> = {
        status: response.status(),
        serverRendered: response.ok(),
        finiteMarkup: !/NaNpx|Infinitypx/.test(html),
      }
      if (mode === 'unresolved') {
        result.rootHeight = cssValue(rootStyle, 'height')
        result.itemGeometry = {
          transform: cssValue(itemStyle, 'transform'),
          left: cssValue(itemStyle, 'left'),
          right: cssValue(itemStyle, 'right'),
          width: cssValue(itemStyle, 'width'),
          height: cssValue(itemStyle, 'height'),
        }
        const navigation = await page.goto(`/__e2e/contracts/ssr?variant=${mode}`)
        expect(navigation?.ok()).toBe(true)
        const fixture = page.locator('[data-contract-ssr-fixture]')
        await expect(fixture).toHaveAttribute('data-hydrated', 'true')
        await settleBrowser(page)
        result.hydrationInitialState = JSON.parse(
          (await fixture.getAttribute('data-hydration-initial-state')) ?? 'null',
        )
        result.eventOrder = JSON.parse((await fixture.getAttribute('data-event-order')) ?? '[]')
        result.finalLayout = JSON.parse((await fixture.getAttribute('data-layout-state')) ?? 'null')
        result.activeBreakpoint = await fixture.getAttribute('data-active-breakpoint')
        result.runtimeErrors = (
          JSON.parse((await fixture.getAttribute('data-runtime-errors')) ?? '[]') as Array<
            Record<string, unknown>
          >
        ).map(error => ({
          code: error.code,
          source: error.source,
          path: error.path,
        }))
        result.hydrationErrors = JSON.parse(
          (await fixture.getAttribute('data-hydration-errors')) ?? '[]',
        )
        result.itemIdentityPreserved =
          (await fixture.getAttribute('data-item-identity-preserved')) === 'true'
        result.hydratedItemGeometry = await readGeometryStyle(page)
        result.hydratedRootHeight = await page
          .locator('.vgl-layout')
          .evaluate(element => element.style.height)
      } else if (mode === 'responsive-explicit') {
        result.rootHeight = cssValue(rootStyle, 'height')
        result.itemGeometry = {
          transform: cssValue(itemStyle, 'transform'),
          width: cssValue(itemStyle, 'width'),
          height: cssValue(itemStyle, 'height'),
        }
        result.slotItem = html.includes('ssr-item:2') ? 'ssr-item:2' : null
      } else {
        const navigation = await page.goto(`/__e2e/contracts/ssr?variant=${mode}`)
        expect(navigation?.ok()).toBe(true)
        const fixture = page.locator('[data-contract-ssr-fixture]')
        await expect(fixture).toHaveAttribute('data-hydrated', 'true')
        await settleBrowser(page)
        result.eventOrder = JSON.parse((await fixture.getAttribute('data-event-order')) ?? '[]')
        result.finalLayout = JSON.parse((await fixture.getAttribute('data-layout-state')) ?? 'null')
        result.activeBreakpoint = await fixture.getAttribute('data-active-breakpoint')
        result.runtimeErrors = (
          JSON.parse((await fixture.getAttribute('data-runtime-errors')) ?? '[]') as Array<
            Record<string, unknown>
          >
        ).map(error => ({
          code: error.code,
          source: error.source,
          path: error.path,
        }))
        result.hydrationErrors = JSON.parse(
          (await fixture.getAttribute('data-hydration-errors')) ?? '[]',
        )
        result.itemIdentityPreserved =
          (await fixture.getAttribute('data-item-identity-preserved')) === 'true'
        result.itemGeometry = await readGeometryStyle(page)
        result.rootHeight = await page
          .locator('.vgl-layout')
          .evaluate(element => element.style.height)
      }
      results[mode] = result
    }
    return results
  },
  expected: {
    unresolved: {
      status: 200,
      serverRendered: true,
      finiteMarkup: true,
      rootHeight: '0px',
      itemGeometry: {
        transform: '',
        left: '',
        right: '',
        width: '',
        height: '',
      },
      hydrationInitialState: {
        rootHeight: '0px',
        itemGeometry: {
          position: '',
          top: '',
          left: '',
          right: '',
          transform: '',
          width: '',
          height: '',
        },
      },
      eventOrder: ['layout-mounted', 'width-changed', 'layout-ready'],
      finalLayout: [{ i: 'ssr-item', x: 0, y: 0, w: 2, h: 1 }],
      activeBreakpoint: null,
      runtimeErrors: [],
      hydrationErrors: [],
      itemIdentityPreserved: true,
      hydratedItemGeometry: {
        position: 'absolute',
        top: '',
        left: '',
        right: '',
        transform: 'translate3d(10px, 10px, 0)',
        width: '121.667px',
        height: '40px',
      },
      hydratedRootHeight: '60px',
    },
    'responsive-explicit': {
      status: 200,
      serverRendered: true,
      finiteMarkup: true,
      rootHeight: '60px',
      itemGeometry: {
        transform: 'translate3d(10px, 10px, 0)',
        width: '220px',
        height: '40px',
      },
      slotItem: 'ssr-item:2',
    },
    'hydration-match': {
      status: 200,
      serverRendered: true,
      finiteMarkup: true,
      eventOrder: [
        'layout-mounted',
        'width-changed',
        'breakpoint-changed',
        'layout-updated',
        'layout-ready',
      ],
      finalLayout: [{ i: 'ssr-item', x: 0, y: 0, w: 1, h: 1 }],
      activeBreakpoint: 'sm',
      runtimeErrors: [],
      hydrationErrors: [],
      itemIdentityPreserved: true,
      itemGeometry: {
        position: 'absolute',
        top: '',
        left: '',
        right: '',
        transform: 'translate3d(10px, 10px, 0)',
        width: '105px',
        height: '40px',
      },
      rootHeight: '60px',
    },
    'hydration-mismatch': {
      status: 200,
      serverRendered: true,
      finiteMarkup: true,
      eventOrder: [
        'layout-mounted',
        'width-changed',
        'update:responsive-layouts',
        'update:layout',
        'breakpoint-changed',
        'layout-updated',
        'layout-ready',
      ],
      finalLayout: [{ i: 'ssr-item', x: 0, y: 0, w: 1, h: 1 }],
      activeBreakpoint: 'sm',
      runtimeErrors: [],
      hydrationErrors: [],
      itemIdentityPreserved: true,
      itemGeometry: {
        position: 'absolute',
        top: '',
        left: '',
        right: '',
        transform: 'translate3d(10px, 10px, 0)',
        width: '105px',
        height: '40px',
      },
      rootHeight: '60px',
    },
    'strategy-failure': {
      status: 200,
      serverRendered: true,
      finiteMarkup: true,
      eventOrder: ['layout-mounted', 'width-changed', 'error', 'layout-ready'],
      finalLayout: [{ i: 'ssr-item', x: 0, y: 0, w: 2, h: 1 }],
      activeBreakpoint: null,
      runtimeErrors: [
        {
          code: 'extension-invalid-result',
          source: 'position-strategy',
          path: 'layout[0].style["width"]',
        },
      ],
      hydrationErrors: [],
      itemIdentityPreserved: true,
      itemGeometry: {
        position: '',
        top: '',
        left: '',
        right: '',
        transform: '',
        width: '',
        height: '',
      },
      rootHeight: '60px',
    },
  },
})

defineFutureContract({
  id: 'E2E-31',
  phase: 'phase-3',
  phaseLabel: 'Phase 3',
  controls: ['toggle-width-zero'],
  exercise: async page => {
    const results: Record<string, unknown> = {}
    for (const mode of ['prop-add', 'prop-remove', 'zero-positive', 'positive-zero'] as const) {
      await openVariant(page, 'phase-3', 'E2E-31', mode, ['toggle-width-zero'])
      const before = await readGeometryStyle(page)
      const rootHeightBefore = await page
        .locator('.vgl-layout')
        .evaluate(element => element.style.height)
      await clickControl(page, 'toggle-width-zero')
      const after = await readGeometryStyle(page)
      const widthEvents = payloads(await readEvents(page), 'width-changed')
      results[mode] = {
        before,
        after,
        rootHeightBefore,
        rootHeightAfter: await page
          .locator('.vgl-layout')
          .evaluate(element => element.style.height),
        widthEvents: widthEvents.map(payload => ({
          width: payload.width,
          state: payload.state,
          source: payload.source,
          responsive: payload.responsive,
          candidate: payload.candidate,
          committed: payload.committed,
        })),
      }
    }
    return results
  },
  expected: {
    'prop-add': {
      before: {
        position: 'absolute',
        top: '',
        left: '',
        right: '',
        transform: 'translate3d(10px, 10px, 0)',
        width: '121.667px',
        height: '40px',
      },
      after: {
        position: 'absolute',
        top: '',
        left: '',
        right: '',
        transform: 'translate3d(10px, 10px, 0)',
        width: '121.667px',
        height: '40px',
      },
      rootHeightBefore: '60px',
      rootHeightAfter: '60px',
      widthEvents: [
        {
          width: 800,
          state: 'resolved',
          source: 'explicit',
          responsive: false,
          candidate: {
            breakpoint: null,
            cols: 12,
            gap: [10, 10],
            containerPadding: [10, 10],
          },
          committed: {
            breakpoint: null,
            cols: 12,
            gap: [10, 10],
            containerPadding: [10, 10],
          },
        },
      ],
    },
    'prop-remove': {
      before: {
        position: 'absolute',
        top: '',
        left: '',
        right: '',
        transform: 'translate3d(10px, 10px, 0)',
        width: '121.667px',
        height: '40px',
      },
      after: {
        position: 'absolute',
        top: '',
        left: '',
        right: '',
        transform: 'translate3d(10px, 10px, 0)',
        width: '121.667px',
        height: '40px',
      },
      rootHeightBefore: '60px',
      rootHeightAfter: '60px',
      widthEvents: [
        {
          width: 800,
          state: 'resolved',
          source: 'observer',
          responsive: false,
          candidate: {
            breakpoint: null,
            cols: 12,
            gap: [10, 10],
            containerPadding: [10, 10],
          },
          committed: {
            breakpoint: null,
            cols: 12,
            gap: [10, 10],
            containerPadding: [10, 10],
          },
        },
      ],
    },
    'zero-positive': {
      before: {
        position: '',
        top: '',
        left: '',
        right: '',
        transform: '',
        width: '',
        height: '',
      },
      after: {
        position: 'absolute',
        top: '',
        left: '',
        right: '',
        transform: 'translate3d(10px, 10px, 0)',
        width: '121.667px',
        height: '40px',
      },
      rootHeightBefore: '60px',
      rootHeightAfter: '60px',
      widthEvents: [
        {
          width: 800,
          state: 'resolved',
          source: 'explicit',
          responsive: false,
          candidate: {
            breakpoint: null,
            cols: 12,
            gap: [10, 10],
            containerPadding: [10, 10],
          },
          committed: {
            breakpoint: null,
            cols: 12,
            gap: [10, 10],
            containerPadding: [10, 10],
          },
        },
      ],
    },
    'positive-zero': {
      before: {
        position: 'absolute',
        top: '',
        left: '',
        right: '',
        transform: 'translate3d(10px, 10px, 0)',
        width: '121.667px',
        height: '40px',
      },
      after: {
        position: '',
        top: '',
        left: '',
        right: '',
        transform: '',
        width: '',
        height: '',
      },
      rootHeightBefore: '60px',
      rootHeightAfter: '60px',
      widthEvents: [
        {
          width: 0,
          state: 'resolved-zero',
          source: 'explicit',
          responsive: false,
          candidate: {
            breakpoint: null,
            cols: 12,
            gap: [10, 10],
            containerPadding: [10, 10],
          },
          committed: {
            breakpoint: null,
            cols: 12,
            gap: [10, 10],
            containerPadding: [10, 10],
          },
        },
      ],
    },
  },
})

defineFutureContract({
  id: 'E2E-32',
  phase: 'phase-3',
  phaseLabel: 'Phase 3',
  controls: ['change-responsive-width'],
  exercise: async page => {
    const results: Record<string, unknown> = {}
    for (const mode of [
      'first-resolution',
      'drag',
      'programmatic',
      'breakpoint',
      'one-sided',
    ] as const) {
      await openVariant(page, 'phase-3', 'E2E-32', mode, ['change-responsive-width'])
      if (mode === 'drag') await dragItemBy(page, 80, 0)
      else await clickControl(page, 'change-responsive-width')
      const events = await readEvents(page)
      results[mode] = {
        dualUpdateOrder: hasOrderedEvents(events, ['update:responsive-layouts', 'update:layout']),
        breakpointAfterModels:
          !events.some(event => event.name === 'breakpoint-changed') ||
          hasOrderedEvents(events, [
            'update:responsive-layouts',
            'update:layout',
            'breakpoint-changed',
          ]),
        rejected: firstPayload(events, 'operation-rejected')?.reason ?? null,
      }
    }
    return results
  },
  expected: {
    'first-resolution': {
      dualUpdateOrder: true,
      breakpointAfterModels: true,
      rejected: null,
    },
    drag: { dualUpdateOrder: true, breakpointAfterModels: true, rejected: null },
    programmatic: { dualUpdateOrder: true, breakpointAfterModels: true, rejected: null },
    breakpoint: { dualUpdateOrder: true, breakpointAfterModels: true, rejected: null },
    'one-sided': {
      dualUpdateOrder: true,
      breakpointAfterModels: true,
      rejected: 'external-not-committed',
    },
  },
})

defineFutureContract({
  id: 'E2E-33',
  phase: 'phase-3',
  phaseLabel: 'Phase 3',
  controls: ['shrink-responsive-cols'],
  exercise: async page => {
    const results: Record<string, unknown> = {}
    for (const mode of [
      'author-generated',
      'delete-breakpoint',
      'cols-unack',
      'latest-wins',
    ] as const) {
      await openVariant(page, 'phase-3', 'E2E-33', mode, ['shrink-responsive-cols'])
      const before = await readGeometryStyle(page)
      await clickControl(page, 'shrink-responsive-cols')
      const events = await readEvents(page)
      const after = await readGeometryStyle(page)
      const fixture = page.locator('[data-contract-e2e-fixture="ready"]')
      const breakpointEvent = events.find(event => event.name === 'breakpoint-changed')
      results[mode] = {
        before,
        after,
        initialAuthorLayouts: await readJsonAttribute(fixture, 'data-initial-author-layouts'),
        finalResponsiveLayouts: await readJsonAttribute(fixture, 'data-responsive-layouts'),
        finalLayout: await readJsonAttribute(fixture, 'data-layout-state'),
        finalCols: await readJsonAttribute(fixture, 'data-cols'),
        proposedResponsiveLayouts:
          events.find(event => event.name === 'update:responsive-layouts')?.args[0] ?? null,
        proposedLayout: events.find(event => event.name === 'update:layout')?.args[0] ?? null,
        breakpoint:
          breakpointEvent == null
            ? null
            : {
                key: breakpointEvent.args[0],
                layout: breakpointEvent.args[1],
              },
        rejectionReasons: payloads(events, 'operation-rejected').map(payload => payload.reason),
      }
    }
    return results
  },
  expected: {
    'author-generated': {
      before: {
        position: 'absolute',
        top: '',
        left: '',
        right: '',
        transform: 'translate3d(10px, 10px, 0)',
        width: '185px',
        height: '40px',
      },
      after: {
        position: 'absolute',
        top: '',
        left: '',
        right: '',
        transform: 'translate3d(10px, 10px, 0)',
        width: '185px',
        height: '40px',
      },
      initialAuthorLayouts: {
        lg: [
          { i: 'fixture-a', x: 0, y: 0, w: 1, h: 1, static: false },
          { i: 'fixture-b', x: 1, y: 0, w: 1, h: 1, static: false },
        ],
      },
      finalResponsiveLayouts: {
        lg: [
          { i: 'fixture-a', x: 0, y: 0, w: 1, h: 1, static: false },
          { i: 'fixture-b', x: 1, y: 0, w: 1, h: 1, static: false },
        ],
      },
      finalLayout: [
        { i: 'fixture-a', x: 0, y: 0, w: 1, h: 1, static: false },
        { i: 'fixture-b', x: 1, y: 0, w: 1, h: 1, static: false },
      ],
      finalCols: { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 },
      proposedResponsiveLayouts: null,
      proposedLayout: null,
      breakpoint: null,
      rejectionReasons: [],
    },
    'delete-breakpoint': {
      before: {
        position: 'absolute',
        top: '',
        left: '',
        right: '',
        transform: 'translate3d(10px, 10px, 0)',
        width: '185px',
        height: '40px',
      },
      after: {
        position: 'absolute',
        top: '',
        left: '',
        right: '',
        transform: 'translate3d(10px, 10px, 0)',
        width: '185px',
        height: '40px',
      },
      initialAuthorLayouts: {
        lg: [
          { i: 'fixture-a', x: 0, y: 0, w: 2, h: 1, static: false },
          { i: 'fixture-b', x: 2, y: 0, w: 2, h: 1, static: false },
        ],
        xxs: [
          { i: 'fixture-a', x: 0, y: 0, w: 1, h: 1, static: false },
          { i: 'fixture-b', x: 1, y: 0, w: 1, h: 1, static: false },
        ],
      },
      finalResponsiveLayouts: {
        lg: [
          { i: 'fixture-a', x: 0, y: 0, w: 2, h: 1, static: false },
          { i: 'fixture-b', x: 2, y: 0, w: 2, h: 1, static: false },
        ],
        md: [
          { i: 'fixture-a', x: 0, y: 0, w: 2, h: 1, static: false },
          { i: 'fixture-b', x: 2, y: 0, w: 2, h: 1, static: false },
        ],
        sm: [
          { i: 'fixture-a', x: 0, y: 0, w: 2, h: 1, static: false },
          { i: 'fixture-b', x: 2, y: 0, w: 2, h: 1, static: false },
        ],
        xs: [
          { i: 'fixture-a', x: 0, y: 0, w: 2, h: 1, static: false },
          { i: 'fixture-b', x: 2, y: 0, w: 2, h: 1, static: false },
        ],
      },
      finalLayout: [
        { i: 'fixture-a', x: 0, y: 0, w: 2, h: 1, static: false },
        { i: 'fixture-b', x: 2, y: 0, w: 2, h: 1, static: false },
      ],
      finalCols: { lg: 12, md: 10, sm: 6, xs: 4 },
      proposedResponsiveLayouts: {
        lg: [
          { i: 'fixture-a', x: 0, y: 0, w: 2, h: 1, static: false },
          { i: 'fixture-b', x: 2, y: 0, w: 2, h: 1, static: false },
        ],
        md: [
          { i: 'fixture-a', x: 0, y: 0, w: 2, h: 1, static: false },
          { i: 'fixture-b', x: 2, y: 0, w: 2, h: 1, static: false },
        ],
        sm: [
          { i: 'fixture-a', x: 0, y: 0, w: 2, h: 1, static: false },
          { i: 'fixture-b', x: 2, y: 0, w: 2, h: 1, static: false },
        ],
        xs: [
          { i: 'fixture-a', x: 0, y: 0, w: 2, h: 1, static: false },
          { i: 'fixture-b', x: 2, y: 0, w: 2, h: 1, static: false },
        ],
      },
      proposedLayout: [
        { i: 'fixture-a', x: 0, y: 0, w: 2, h: 1, static: false },
        { i: 'fixture-b', x: 2, y: 0, w: 2, h: 1, static: false },
      ],
      breakpoint: {
        key: 'xs',
        layout: [
          { i: 'fixture-a', x: 0, y: 0, w: 2, h: 1, static: false },
          { i: 'fixture-b', x: 2, y: 0, w: 2, h: 1, static: false },
        ],
      },
      rejectionReasons: [],
    },
    'cols-unack': {
      before: {
        position: 'absolute',
        top: '',
        left: '',
        right: '',
        transform: 'translate3d(10px, 10px, 0)',
        width: '185px',
        height: '40px',
      },
      after: {
        position: 'absolute',
        top: '',
        left: '',
        right: '',
        transform: 'translate3d(10px, 10px, 0)',
        width: '185px',
        height: '40px',
      },
      initialAuthorLayouts: {
        lg: [
          { i: 'fixture-a', x: 0, y: 0, w: 2, h: 1, static: false },
          { i: 'fixture-b', x: 2, y: 0, w: 2, h: 1, static: false },
        ],
        xxs: [
          { i: 'fixture-a', x: 0, y: 0, w: 1, h: 1, static: false },
          { i: 'fixture-b', x: 1, y: 0, w: 1, h: 1, static: false },
        ],
      },
      finalResponsiveLayouts: {
        lg: [
          { i: 'fixture-a', x: 0, y: 0, w: 2, h: 1, static: false },
          { i: 'fixture-b', x: 2, y: 0, w: 2, h: 1, static: false },
        ],
        xxs: [
          { i: 'fixture-a', x: 0, y: 0, w: 1, h: 1, static: false },
          { i: 'fixture-b', x: 1, y: 0, w: 1, h: 1, static: false },
        ],
      },
      finalLayout: [
        { i: 'fixture-a', x: 0, y: 0, w: 1, h: 1, static: false },
        { i: 'fixture-b', x: 1, y: 0, w: 1, h: 1, static: false },
      ],
      finalCols: { lg: 12, md: 10, sm: 6, xs: 4, xxs: 1 },
      proposedResponsiveLayouts: {
        lg: [
          { i: 'fixture-a', x: 0, y: 0, w: 2, h: 1, static: false },
          { i: 'fixture-b', x: 2, y: 0, w: 2, h: 1, static: false },
        ],
        md: [
          { i: 'fixture-a', x: 0, y: 0, w: 2, h: 1, static: false },
          { i: 'fixture-b', x: 2, y: 0, w: 2, h: 1, static: false },
        ],
        sm: [
          { i: 'fixture-a', x: 0, y: 0, w: 2, h: 1, static: false },
          { i: 'fixture-b', x: 2, y: 0, w: 2, h: 1, static: false },
        ],
        xs: [
          { i: 'fixture-a', x: 0, y: 0, w: 2, h: 1, static: false },
          { i: 'fixture-b', x: 2, y: 0, w: 2, h: 1, static: false },
        ],
        xxs: [
          { i: 'fixture-a', x: 0, y: 0, w: 1, h: 1, static: false },
          { i: 'fixture-b', x: 0, y: 1, w: 1, h: 1, static: false },
        ],
      },
      proposedLayout: [
        { i: 'fixture-a', x: 0, y: 0, w: 1, h: 1, static: false },
        { i: 'fixture-b', x: 0, y: 1, w: 1, h: 1, static: false },
      ],
      breakpoint: null,
      rejectionReasons: ['external-not-committed'],
    },
    'latest-wins': {
      before: {
        position: 'absolute',
        top: '',
        left: '',
        right: '',
        transform: 'translate3d(10px, 10px, 0)',
        width: '185px',
        height: '40px',
      },
      after: {
        position: 'absolute',
        top: '',
        left: '',
        right: '',
        transform: 'translate3d(10px, 10px, 0)',
        width: '120px',
        height: '40px',
      },
      initialAuthorLayouts: {
        lg: [
          { i: 'fixture-a', x: 0, y: 0, w: 2, h: 1, static: false },
          { i: 'fixture-b', x: 2, y: 0, w: 2, h: 1, static: false },
        ],
        xxs: [
          { i: 'fixture-a', x: 0, y: 0, w: 1, h: 1, static: false },
          { i: 'fixture-b', x: 1, y: 0, w: 1, h: 1, static: false },
        ],
      },
      finalResponsiveLayouts: {
        lg: [
          { i: 'fixture-a', x: 0, y: 0, w: 2, h: 1, static: false },
          { i: 'fixture-b', x: 2, y: 0, w: 2, h: 1, static: false },
        ],
        xxs: [
          { i: 'fixture-a', x: 0, y: 0, w: 1, h: 1, static: false },
          { i: 'fixture-b', x: 1, y: 0, w: 1, h: 1, static: false },
        ],
      },
      finalLayout: [
        { i: 'fixture-a', x: 0, y: 0, w: 1, h: 1, static: false },
        { i: 'fixture-b', x: 1, y: 0, w: 1, h: 1, static: false },
      ],
      finalCols: { lg: 12, md: 10, sm: 6, xs: 4, xxs: 3 },
      proposedResponsiveLayouts: {
        lg: [
          { i: 'fixture-a', x: 0, y: 0, w: 2, h: 1, static: false },
          { i: 'fixture-b', x: 2, y: 0, w: 2, h: 1, static: false },
        ],
        md: [
          { i: 'fixture-a', x: 0, y: 0, w: 2, h: 1, static: false },
          { i: 'fixture-b', x: 2, y: 0, w: 2, h: 1, static: false },
        ],
        sm: [
          { i: 'fixture-a', x: 0, y: 0, w: 2, h: 1, static: false },
          { i: 'fixture-b', x: 2, y: 0, w: 2, h: 1, static: false },
        ],
        xs: [
          { i: 'fixture-a', x: 0, y: 0, w: 2, h: 1, static: false },
          { i: 'fixture-b', x: 2, y: 0, w: 2, h: 1, static: false },
        ],
        xxs: [
          { i: 'fixture-a', x: 0, y: 0, w: 1, h: 1, static: false },
          { i: 'fixture-b', x: 0, y: 1, w: 1, h: 1, static: false },
        ],
      },
      proposedLayout: [
        { i: 'fixture-a', x: 0, y: 0, w: 1, h: 1, static: false },
        { i: 'fixture-b', x: 0, y: 1, w: 1, h: 1, static: false },
      ],
      breakpoint: null,
      rejectionReasons: ['superseded'],
    },
  },
})

defineFutureContract({
  id: 'E2E-34',
  phase: 'phase-3',
  phaseLabel: 'Phase 3',
  controls: ['toggle-responsive-mode'],
  exercise: async page => {
    const results: Record<string, unknown> = {}
    for (const mode of [
      'unresolved',
      'resolved-ack',
      'resolved-no-ack',
      'active',
      'pending',
      'toggle-off',
    ] as const) {
      await openVariant(page, 'phase-3', 'E2E-34', mode, ['toggle-responsive-mode'])
      await clickControl(page, 'toggle-responsive-mode')
      const events = await readEvents(page)
      const breakpointEvent = events.find(event => event.name === 'breakpoint-changed')
      results[mode] = {
        terminalReason: firstPayload(events, 'interaction-end')?.reason ?? null,
        dualUpdate: hasOrderedEvents(events, ['update:responsive-layouts', 'update:layout']),
        rejected: firstPayload(events, 'operation-rejected')?.reason ?? null,
        breakpoint: breakpointEvent?.args[0] ?? null,
        readyRepeated: payloads(events, 'layout-ready').length,
      }
    }
    return results
  },
  expected: {
    unresolved: {
      terminalReason: null,
      dualUpdate: false,
      rejected: null,
      breakpoint: null,
      readyRepeated: 0,
    },
    'resolved-ack': {
      terminalReason: null,
      dualUpdate: true,
      rejected: null,
      breakpoint: 'sm',
      readyRepeated: 0,
    },
    'resolved-no-ack': {
      terminalReason: null,
      dualUpdate: true,
      rejected: 'external-not-committed',
      breakpoint: null,
      readyRepeated: 0,
    },
    active: {
      terminalReason: 'config-changed',
      dualUpdate: true,
      rejected: null,
      breakpoint: 'sm',
      readyRepeated: 0,
    },
    pending: {
      terminalReason: null,
      dualUpdate: true,
      rejected: 'superseded',
      breakpoint: 'sm',
      readyRepeated: 0,
    },
    'toggle-off': {
      terminalReason: null,
      dualUpdate: false,
      rejected: null,
      breakpoint: null,
      readyRepeated: 0,
    },
  },
})

defineFutureContract({
  id: 'E2E-36',
  phase: 'phase-3',
  phaseLabel: 'Phase 3',
  controls: ['invalidate-background-width'],
  exercise: async page => {
    const readBackground = async () => {
      const background = page.locator('.vgl-background')
      const count = await background.count()
      return {
        count,
        style:
          count === 0
            ? null
            : await background.evaluate(element => {
                const style = (element as HTMLElement).style
                return {
                  width: style.width,
                  height: style.height,
                  backgroundSize: style.backgroundSize,
                  backgroundPosition: style.backgroundPosition,
                }
              }),
      }
    }
    const results: Record<string, unknown> = {}
    for (const mode of [
      'dormant-responsive',
      'unresolved-explicit',
      'unresolved-observer',
      'background',
    ] as const) {
      await openVariant(page, 'phase-3', 'E2E-36', mode, ['invalidate-background-width'])
      const itemBefore = await readGeometryStyle(page)
      const backgroundBefore = await readBackground()
      await clickControl(page, 'invalidate-background-width')
      const itemAfterInvalid = await readGeometryStyle(page)
      const backgroundInvalid = await readBackground()
      await clickControl(page, 'invalidate-background-width')
      const itemAfterRecovery = await readGeometryStyle(page)
      const backgroundRecovered = await readBackground()
      const events = await readEvents(page)
      const responsiveLayouts = await readJsonAttribute<Record<string, unknown>>(
        page.locator('[data-contract-e2e-fixture="ready"]'),
        'data-responsive-layouts',
      )
      results[mode] = {
        itemBefore,
        itemAfterInvalid,
        itemAfterRecovery,
        backgroundBefore,
        backgroundInvalid,
        backgroundRecovered,
        interactionStartCount: payloads(events, 'interaction-start').length,
        interactionTerminalCount: payloads(events, 'interaction-end').length,
        errors: payloads(events, 'error').map(payload => payload.code),
        placeholderCount: await page.locator('.vgl-item--placeholder:visible').count(),
        dormantSmLayout: responsiveLayouts.sm ?? null,
      }
    }
    return results
  },
  expected: {
    'dormant-responsive': {
      itemBefore: {
        position: 'absolute',
        top: '',
        left: '',
        right: '',
        transform: 'translate3d(10px, 10px, 0)',
        width: '121.667px',
        height: '40px',
      },
      itemAfterInvalid: {
        position: 'absolute',
        top: '',
        left: '',
        right: '',
        transform: 'translate3d(75.833px, 60px, 0)',
        width: '121.667px',
        height: '40px',
      },
      itemAfterRecovery: {
        position: 'absolute',
        top: '',
        left: '',
        right: '',
        transform: 'translate3d(75.833px, 60px, 0)',
        width: '121.667px',
        height: '40px',
      },
      backgroundBefore: {
        count: 1,
        style: {
          width: '400px',
          height: '160px',
          backgroundSize: '32.5px 50px',
          backgroundPosition: '37.5px 55px',
        },
      },
      backgroundInvalid: { count: 0, style: null },
      backgroundRecovered: {
        count: 1,
        style: {
          width: '400px',
          height: '160px',
          backgroundSize: '32.5px 50px',
          backgroundPosition: '37.5px 55px',
        },
      },
      interactionStartCount: 1,
      interactionTerminalCount: 0,
      errors: [],
      placeholderCount: 1,
      dormantSmLayout: [
        { i: 'fixture-a', x: 0, y: 0, w: 2, h: 1, static: false },
        { i: 'fixture-b', x: 2, y: 0, w: 2, h: 1, static: false },
      ],
    },
    'unresolved-explicit': {
      itemBefore: {
        position: '',
        top: '',
        left: '',
        right: '',
        transform: '',
        width: '',
        height: '',
      },
      itemAfterInvalid: {
        position: '',
        top: '',
        left: '',
        right: '',
        transform: '',
        width: '',
        height: '',
      },
      itemAfterRecovery: {
        position: '',
        top: '',
        left: '',
        right: '',
        transform: '',
        width: '',
        height: '',
      },
      backgroundBefore: {
        count: 1,
        style: {
          width: '400px',
          height: '160px',
          backgroundSize: '32.5px 50px',
          backgroundPosition: '37.5px 55px',
        },
      },
      backgroundInvalid: { count: 0, style: null },
      backgroundRecovered: {
        count: 1,
        style: {
          width: '400px',
          height: '160px',
          backgroundSize: '32.5px 50px',
          backgroundPosition: '37.5px 55px',
        },
      },
      interactionStartCount: 0,
      interactionTerminalCount: 0,
      errors: [],
      placeholderCount: 0,
      dormantSmLayout: null,
    },
    'unresolved-observer': {
      itemBefore: {
        position: '',
        top: '',
        left: '',
        right: '',
        transform: '',
        width: '',
        height: '',
      },
      itemAfterInvalid: {
        position: '',
        top: '',
        left: '',
        right: '',
        transform: '',
        width: '',
        height: '',
      },
      itemAfterRecovery: {
        position: '',
        top: '',
        left: '',
        right: '',
        transform: '',
        width: '',
        height: '',
      },
      backgroundBefore: {
        count: 1,
        style: {
          width: '400px',
          height: '160px',
          backgroundSize: '32.5px 50px',
          backgroundPosition: '37.5px 55px',
        },
      },
      backgroundInvalid: { count: 0, style: null },
      backgroundRecovered: {
        count: 1,
        style: {
          width: '400px',
          height: '160px',
          backgroundSize: '32.5px 50px',
          backgroundPosition: '37.5px 55px',
        },
      },
      interactionStartCount: 0,
      interactionTerminalCount: 0,
      errors: [],
      placeholderCount: 0,
      dormantSmLayout: null,
    },
    background: {
      itemBefore: {
        position: 'absolute',
        top: '',
        left: '',
        right: '',
        transform: 'translate3d(10px, 10px, 0)',
        width: '121.667px',
        height: '40px',
      },
      itemAfterInvalid: {
        position: 'absolute',
        top: '',
        left: '',
        right: '',
        transform: 'translate3d(10px, 10px, 0)',
        width: '121.667px',
        height: '40px',
      },
      itemAfterRecovery: {
        position: 'absolute',
        top: '',
        left: '',
        right: '',
        transform: 'translate3d(10px, 10px, 0)',
        width: '121.667px',
        height: '40px',
      },
      backgroundBefore: {
        count: 1,
        style: {
          width: '400px',
          height: '160px',
          backgroundSize: '32.5px 50px',
          backgroundPosition: '37.5px 55px',
        },
      },
      backgroundInvalid: { count: 0, style: null },
      backgroundRecovered: {
        count: 1,
        style: {
          width: '400px',
          height: '160px',
          backgroundSize: '32.5px 50px',
          backgroundPosition: '37.5px 55px',
        },
      },
      interactionStartCount: 0,
      interactionTerminalCount: 0,
      errors: [],
      placeholderCount: 0,
      dormantSmLayout: null,
    },
  },
})

defineFutureContract({
  id: 'E2E-40',
  phase: 'phase-4',
  phaseLabel: 'Phase 4',
  controls: ['scaled-drop-target'],
  prepare: page => page.emulateMedia({ reducedMotion: 'reduce' }),
  exercise: async page => {
    const results: Record<string, unknown> = {}
    const logicalPitch = (800 - 10 * 13) / 12 + 10

    for (const scale of [0.5, 2] as const) {
      for (const operation of ['drag', 'resize', 'drop'] as const) {
        await openVariant(page, 'phase-4', 'E2E-40', `scale-${scale}-${operation}`, [
          'scaled-drop-target',
        ])

        if (operation === 'drop') {
          const dragEvent = await dispatchDragEvent(page, 'dragover', 0.65)
          await settleBrowser(page)
          const dragOver = lastPayload(await readEvents(page), 'drop-drag-over')
          const candidate = dropCandidate(dragOver) as GridItemSnapshot | null
          const expected = candidate ? await expectedGridBox(page, candidate, scale) : null
          const placeholder = await page
            .locator('.vgl-item--placeholder:visible')
            .first()
            .boundingBox()
          const pointer = dragOver?.pointer as { clientX?: number; clientY?: number } | undefined

          await dispatchDragEvent(page, 'drop', 0.65)
          await settleBrowser(page)
          const committed = (
            await readJsonAttribute<Array<GridItemSnapshot & { i: string }>>(
              page.locator('[data-contract-e2e-fixture="ready"]'),
              'data-layout-state',
            )
          ).find(item => item.i === 'drop-commit')
          const finalExpected = committed ? await expectedGridBox(page, committed, scale) : null
          results[`${scale}-${operation}`] = {
            pointerWithinTolerance:
              pointer != null &&
              Math.max(
                Math.abs(Number(pointer.clientX) - dragEvent.clientX),
                Math.abs(Number(pointer.clientY) - dragEvent.clientY),
              ) <= 2,
            placeholderWithinTolerance: maxBoxError(placeholder, expected) <= 2,
            finalWithinTolerance:
              maxBoxError(await itemBoxById(page, 'drop-commit'), finalExpected) <= 2,
          }
          continue
        }

        const before = await itemA(page).boundingBox()
        const handle =
          operation === 'resize' ? page.locator('.vgl-item__resizer--se').first() : itemA(page)
        const handleBox = await handle.boundingBox()
        if (!before || !handleBox) {
          results[`${scale}-${operation}`] = {
            pointerWithinTolerance: false,
            placeholderWithinTolerance: false,
            finalWithinTolerance: false,
          }
          continue
        }

        const startX = handleBox.x + handleBox.width / 2
        const startY = handleBox.y + handleBox.height / 2
        const physicalDelta = logicalPitch * scale
        await page.mouse.move(startX, startY)
        await page.mouse.down()
        await page.mouse.move(startX + physicalDelta, startY, { steps: 4 })
        const activeBox = await itemA(page).boundingBox()
        const interaction = lastPayload(await readEvents(page), 'interaction-change')
        const activeItem = (interaction?.item ?? interaction?.candidate) as
          GridItemSnapshot | undefined
        const expectedActive = activeItem ? await expectedGridBox(page, activeItem, scale) : null
        const placeholder = await page
          .locator('.vgl-item--placeholder:visible')
          .first()
          .boundingBox()
        const pointerError =
          activeBox == null
            ? Number.POSITIVE_INFINITY
            : operation === 'drag'
              ? Math.abs(activeBox.x - before.x - physicalDelta)
              : Math.abs(activeBox.width - before.width - physicalDelta)
        await page.mouse.up()
        await settleBrowser(page)

        const committed = (
          await readJsonAttribute<Array<GridItemSnapshot & { i: string }>>(
            page.locator('[data-contract-e2e-fixture="ready"]'),
            'data-layout-state',
          )
        ).find(item => item.i === 'fixture-a')
        const finalExpected = committed ? await expectedGridBox(page, committed, scale) : null
        results[`${scale}-${operation}`] = {
          pointerWithinTolerance: pointerError <= 2,
          placeholderWithinTolerance: maxBoxError(placeholder, expectedActive) <= 2,
          finalWithinTolerance: maxBoxError(await itemA(page).boundingBox(), finalExpected) <= 2,
        }
      }
    }
    return results
  },
  expected: Object.fromEntries(
    [0.5, 2].flatMap(scale =>
      ['drag', 'resize', 'drop'].map(operation => [
        `${scale}-${operation}`,
        {
          pointerWithinTolerance: true,
          placeholderWithinTolerance: true,
          finalWithinTolerance: true,
        },
      ]),
    ),
  ),
})

defineFutureContract({
  id: 'E2E-41',
  phase: 'phase-4',
  phaseLabel: 'Phase 4',
  controls: ['rtl-drop-target'],
  prepare: page => page.emulateMedia({ reducedMotion: 'reduce' }),
  exercise: async page => {
    const results: Record<string, unknown> = {}
    const columns: Record<string, number | null> = {}

    for (const mode of ['push', 'prevent', 'overlap'] as const) {
      const directions = mode === 'push' ? (['ltr', 'rtl'] as const) : (['ltr'] as const)
      for (const direction of directions) {
        await openVariant(page, 'phase-4', 'E2E-41', `mode-${mode}-${direction}`, [
          'rtl-drop-target',
        ])
        await dispatchDragEvent(page, 'dragover', 0.3)
        await settleBrowser(page)
        const beforeDropEvents = await readEvents(page)
        const dragOver = lastPayload(beforeDropEvents, 'drop-drag-over')
        const candidate = dropCandidate(dragOver) as GridItemSnapshot | null
        const preview = dropPreview(dragOver) as Array<GridItemSnapshot & { i: string }> | null
        const previewBlocker = preview?.find(item => item.i === 'fixture-b')
        const rejected = lastPayload(beforeDropEvents, 'operation-rejected')

        await dispatchDragEvent(page, 'drop', 0.3)
        await settleBrowser(page)
        const afterDropEvents = await readEvents(page)
        const drop = lastPayload(afterDropEvents, 'drop')
        const committedCandidate = dropCandidate(drop)
        const committedPreview = dropPreview(drop)
        const overlaps =
          candidate != null &&
          previewBlocker != null &&
          candidate.x < previewBlocker.x + previewBlocker.w &&
          candidate.x + candidate.w > previewBlocker.x &&
          candidate.y < previewBlocker.y + previewBlocker.h &&
          candidate.y + candidate.h > previewBlocker.y

        columns[`${mode}-${direction}`] =
          candidate && typeof candidate.x === 'number' ? candidate.x : null
        results[`${mode}-${direction}`] = {
          accepted: dragOver != null && drop != null,
          rejectedReason: rejected?.reason ?? null,
          previewCommitSame:
            JSON.stringify({
              candidate,
              preview,
              proposalId: dragOver?.proposalId,
              breakpoint: dragOver?.breakpoint,
              insertionIndex: dropInsertionIndex(dragOver),
            }) ===
            JSON.stringify({
              candidate: committedCandidate,
              preview: committedPreview,
              proposalId: drop?.proposalId,
              breakpoint: drop?.breakpoint,
              insertionIndex: dropInsertionIndex(drop),
            }),
          collisionResult:
            mode === 'prevent'
              ? dragOver == null && rejected?.reason === 'collision'
                ? 'rejected'
                : 'invalid'
              : mode === 'overlap'
                ? overlaps
                  ? 'overlap'
                  : 'invalid'
                : previewBlocker != null &&
                    (previewBlocker.x !== 2 || previewBlocker.y !== 0) &&
                    !overlaps
                  ? 'pushed'
                  : 'invalid',
        }
      }
    }

    results.mirrored =
      columns['push-ltr'] != null &&
      columns['push-rtl'] != null &&
      columns['push-ltr']! + columns['push-rtl']! + 1 === 12
    return results
  },
  expected: {
    'push-ltr': {
      accepted: true,
      rejectedReason: null,
      previewCommitSame: true,
      collisionResult: 'pushed',
    },
    'push-rtl': {
      accepted: true,
      rejectedReason: null,
      previewCommitSame: true,
      collisionResult: 'pushed',
    },
    'prevent-ltr': {
      accepted: false,
      rejectedReason: 'collision',
      previewCommitSame: true,
      collisionResult: 'rejected',
    },
    'overlap-ltr': {
      accepted: true,
      rejectedReason: null,
      previewCommitSame: true,
      collisionResult: 'overlap',
    },
    mirrored: true,
  },
})

defineFutureContract({
  id: 'E2E-42',
  phase: 'phase-4',
  phaseLabel: 'Phase 4',
  controls: ['reject-drop-callback'],
  exercise: async page => {
    const results: Record<string, unknown> = {}
    for (const reason of [
      'callback-rejected',
      'extension-error',
      'collision',
      'no-position',
    ] as const) {
      await openVariant(page, 'phase-4', 'E2E-42', reason, ['reject-drop-callback'])
      await dispatchDragEvent(page, 'dragover', 0.3, undefined, false)
      await settleBrowser(page)
      const events = await readEvents(page)
      results[reason] = {
        callbackCount: (await callbackInputs(page)).length,
        rejectedReasons: payloads(events, 'operation-rejected').map(payload => payload.reason),
        errorCodes: payloads(events, 'error').map(payload => payload.code),
        dragOverCount: payloads(events, 'drop-drag-over').length,
        dropCount: payloads(events, 'drop').length,
        placeholderCount: await page.locator('.vgl-item--placeholder:visible').count(),
      }
    }
    return results
  },
  expected: {
    'callback-rejected': {
      callbackCount: 1,
      rejectedReasons: [],
      errorCodes: [],
      dragOverCount: 0,
      dropCount: 0,
      placeholderCount: 0,
    },
    'extension-error': {
      callbackCount: 1,
      rejectedReasons: ['extension-error'],
      errorCodes: ['extension-error'],
      dragOverCount: 0,
      dropCount: 0,
      placeholderCount: 0,
    },
    collision: {
      callbackCount: 1,
      rejectedReasons: ['collision'],
      errorCodes: [],
      dragOverCount: 0,
      dropCount: 0,
      placeholderCount: 0,
    },
    'no-position': {
      callbackCount: 1,
      rejectedReasons: ['no-position'],
      errorCodes: [],
      dragOverCount: 0,
      dropCount: 0,
      placeholderCount: 0,
    },
  },
})

defineFutureContract({
  id: 'E2E-43',
  phase: 'phase-4',
  phaseLabel: 'Phase 4',
  controls: ['drop-proposal-log'],
  exercise: async page => {
    await openVariant(page, 'phase-4', 'E2E-43', 'stable-proposal', ['drop-proposal-log'])
    const fixture = page.locator('[data-contract-e2e-fixture="ready"]')
    const compactBefore = Number(await fixture.getAttribute('data-compactor-calls'))
    await dispatchDragEvent(page, 'dragover', 0.65)
    await dispatchDragEvent(page, 'dragover', 0.7)
    const overEvents = payloads(await readEvents(page), 'drop-drag-over')
    await dispatchDragEvent(page, 'drop', 0.7)
    await settleBrowser(page)
    const stableEvents = await readEvents(page)
    const latestOver = overEvents.at(-1) ?? null
    const drop = lastPayload(stableEvents, 'drop')
    const compactAfter = Number(await fixture.getAttribute('data-compactor-calls'))
    const layout = await readJsonAttribute<Array<{ i: string }>>(fixture, 'data-layout-state')
    const updatedSources = stableEvents
      .filter(event => event.name === 'layout-updated')
      .map(event => (event.args[1] as { source?: unknown } | undefined)?.source ?? null)

    await openVariant(page, 'phase-4', 'E2E-43', 'breakpoint-invalidation', ['drop-proposal-log'])
    await dispatchDragEvent(page, 'dragover', 0.65)
    const acceptedBeforeInvalidation = lastPayload(await readEvents(page), 'drop-drag-over')
    await clickControl(page, 'drop-proposal-log')
    await dispatchDragEvent(page, 'drop', 0.65)
    await settleBrowser(page)
    const invalidatedEvents = await readEvents(page)

    return {
      stable: {
        proposalIds: overEvents.map(payload => payload.proposalId),
        breakpoint: drop && 'breakpoint' in drop ? drop.breakpoint : 'missing',
        insertionIndex: dropInsertionIndex(drop),
        previewCommitSame:
          JSON.stringify({
            candidate: dropCandidate(latestOver),
            preview: dropPreview(latestOver),
            proposalId: latestOver?.proposalId,
            breakpoint: latestOver?.breakpoint,
            insertionIndex: dropInsertionIndex(latestOver),
          }) ===
          JSON.stringify({
            candidate: dropCandidate(drop),
            preview: dropPreview(drop),
            proposalId: drop?.proposalId,
            breakpoint: drop?.breakpoint,
            insertionIndex: dropInsertionIndex(drop),
          }),
        compactEvaluations: compactAfter - compactBefore,
        dropCount: payloads(stableEvents, 'drop').length,
        dropCommitUpdatedCount: updatedSources.filter(source => source === 'drop-commit').length,
        insertedCount: layout.filter(item => item.i === 'drop-commit').length,
      },
      invalidation: {
        proposalCreated: typeof acceptedBeforeInvalidation?.proposalId === 'number',
        breakpointChangedCount: payloads(invalidatedEvents, 'breakpoint-changed').length,
        placeholderCount: await page.locator('.vgl-item--placeholder:visible').count(),
        dropCount: payloads(invalidatedEvents, 'drop').length,
        terminalCount: payloads(invalidatedEvents, 'interaction-end').length,
      },
    }
  },
  expected: {
    stable: {
      proposalIds: [1, 2],
      breakpoint: null,
      insertionIndex: 2,
      previewCommitSame: true,
      compactEvaluations: 3,
      dropCount: 1,
      dropCommitUpdatedCount: 1,
      insertedCount: 1,
    },
    invalidation: {
      proposalCreated: true,
      breakpointChangedCount: 1,
      placeholderCount: 0,
      dropCount: 0,
      terminalCount: 0,
    },
  },
})

defineFutureContract({
  id: 'E2E-44',
  phase: 'phase-4',
  phaseLabel: 'Phase 4',
  controls: ['dynamic-drop-size'],
  exercise: async page => {
    const results: Record<string, unknown> = {}
    for (const mode of ['dynamic-ltr', 'dynamic-rtl', 'dynamic-scale-0.5'] as const) {
      await openVariant(page, 'phase-4', 'E2E-44', mode, ['dynamic-drop-size'])
      const scale = Number(mode.match(/scale-(0\.5|1|2)/)?.[1] ?? 1)
      const rtl = mode.endsWith('rtl')
      const horizontalFraction = rtl ? 0.55 : 0.6
      const pointer = await dispatchDragEvent(page, 'dragover', horizontalFraction)
      await settleBrowser(page)
      const dragOver = lastPayload(await readEvents(page), 'drop-drag-over')
      const candidate = dropCandidate(dragOver) as GridItemSnapshot | null
      const callback = (await callbackInputs(page)).at(-1)?.[0] as
        { candidate?: GridItemSnapshot } | undefined
      const provisional = callback?.candidate
      const root = await page.locator('.vgl-layout').boundingBox()
      let expectedCandidate: GridItemSnapshot | null = null
      if (root) {
        const logicalWidth = root.width / scale
        const cellWidth = (logicalWidth - 10 * 2 - 10 * 11) / 12
        const pitchX = cellWidth + 10
        const itemWidth = cellWidth * 2 + 10
        const localInline = rtl
          ? (root.x + root.width - pointer.clientX) / scale
          : (pointer.clientX - root.x) / scale
        const localBlock = (pointer.clientY - root.y) / scale
        expectedCandidate = {
          x: Math.max(0, Math.min(10, Math.round((localInline - itemWidth / 2 - 10) / pitchX))),
          y: Math.max(0, Math.round((localBlock - 45 - 10) / 50)),
          w: 2,
          h: 2,
        }
      }

      await dispatchDragEvent(page, 'drop', horizontalFraction)
      await settleBrowser(page)
      const committed = (
        await readJsonAttribute<Array<GridItemSnapshot & { i: string }>>(
          page.locator('[data-contract-e2e-fixture="ready"]'),
          'data-layout-state',
        )
      ).find(item => item.i === 'drop-commit')
      const expectedBox = expectedCandidate
        ? await expectedGridBox(page, expectedCandidate, scale, rtl)
        : null
      results[mode] = {
        callbackSizeChanged:
          provisional?.w === 1 && provisional.h === 1 && candidate?.w === 2 && candidate.h === 2,
        positionRecomputed:
          provisional != null &&
          candidate != null &&
          (provisional.x !== candidate.x || provisional.y !== candidate.y),
        expectedGridPosition:
          candidate != null &&
          expectedCandidate != null &&
          candidate.x === expectedCandidate.x &&
          candidate.y === expectedCandidate.y,
        finalCenterWithinTolerance:
          committed != null &&
          expectedCandidate != null &&
          committed.x === expectedCandidate.x &&
          committed.y === expectedCandidate.y &&
          maxBoxError(await itemBoxById(page, 'drop-commit'), expectedBox) <= 2,
      }
    }
    return results
  },
  expected: Object.fromEntries(
    ['dynamic-ltr', 'dynamic-rtl', 'dynamic-scale-0.5'].map(mode => [
      mode,
      {
        callbackSizeChanged: true,
        positionRecomputed: true,
        expectedGridPosition: true,
        finalCenterWithinTolerance: true,
      },
    ]),
  ),
})

defineFutureContract({
  id: 'E2E-45',
  phase: 'phase-4',
  phaseLabel: 'Phase 4',
  controls: ['geometry-error-log'],
  exercise: async page => {
    const commits: Record<string, unknown> = {}
    for (const mode of ['drop-sync', 'drop-timeout'] as const) {
      await openVariant(page, 'phase-4', 'E2E-45', mode, ['geometry-error-log'])
      await dispatchDragEvent(page, 'dragover', 0.65)
      await dispatchDragEvent(page, 'drop', 0.65)
      await settleBrowser(page)
      const events = await readEvents(page)
      const sources = events
        .filter(event => event.name === 'layout-updated')
        .map(event => (event.args[1] as { source?: unknown } | undefined)?.source ?? null)
      const current = await readJsonAttribute<Array<{ i: string }>>(
        page.locator('[data-contract-e2e-fixture="ready"]'),
        'data-layout-state',
      )
      commits[mode] = {
        dropCount: payloads(events, 'drop').length,
        insertedCount: current.filter(item => item.i === 'drop-commit').length,
        dropCommitUpdatedCount: sources.filter(source => source === 'drop-commit').length,
        externalUpdatedCount: sources.filter(source => source === 'external').length,
        terminalCount: payloads(events, 'interaction-end').length,
      }
    }

    const responsiveCommits: Record<string, unknown> = {}
    for (const mode of [
      'drop-responsive-sync',
      'drop-responsive-nested-next-tick',
      'drop-responsive-layout-only',
    ] as const) {
      await openVariant(page, 'phase-4', 'E2E-45', mode, ['geometry-error-log'])
      await dispatchDragEvent(page, 'dragover', 0.65)
      await dispatchDragEvent(page, 'drop', 0.65)
      await settleBrowser(page)
      const events = await readEvents(page)
      const sources = events
        .filter(event => event.name === 'layout-updated')
        .map(event => (event.args[1] as { source?: unknown } | undefined)?.source ?? null)
      const current = await readJsonAttribute<Array<{ i: string }>>(
        page.locator('[data-contract-e2e-fixture="ready"]'),
        'data-layout-state',
      )
      const currentResponsive = await readJsonAttribute<Record<string, Array<{ i: string }>>>(
        page.locator('[data-contract-e2e-fixture="ready"]'),
        'data-responsive-layouts',
      )
      const breakpoint = String(lastPayload(events, 'drop')?.breakpoint ?? '')
      responsiveCommits[mode] = {
        dropCount: payloads(events, 'drop').length,
        insertedCount: current.filter(item => item.i === 'drop-commit').length,
        responsiveInsertedCount: (currentResponsive[breakpoint] ?? []).filter(
          item => item.i === 'drop-commit',
        ).length,
        dropCommitUpdatedCount: sources.filter(source => source === 'drop-commit').length,
        externalUpdatedCount: sources.filter(source => source === 'external').length,
      }
    }

    const geometry: Record<string, unknown> = {}
    for (const mode of ['geometry-raw-rect', 'geometry-derived-pointer'] as const) {
      await openVariant(page, 'phase-4', 'E2E-45', mode, ['geometry-error-log'])
      await clickControl(page, 'geometry-error-log')
      await dispatchDragEvent(
        page,
        'dragover',
        0.5,
        mode === 'geometry-derived-pointer' ? Number.MAX_VALUE : undefined,
      )
      await settleBrowser(page)
      const geometryEvents = await readEvents(page)
      const error = lastPayload(geometryEvents, 'error')
      const rejected = lastPayload(geometryEvents, 'operation-rejected')
      geometry[mode] = {
        code: error?.code ?? null,
        source: error?.source ?? null,
        path: error?.path ?? null,
        revision: error?.revision ?? null,
        reason: rejected?.reason ?? null,
        evaluationIdsMatch: error?.evaluationId === rejected?.evaluationId,
        order: geometryEvents
          .filter(event => event.name === 'error' || event.name === 'operation-rejected')
          .map(event => event.name),
        dropCount: payloads(geometryEvents, 'drop').length,
        terminalCount: payloads(geometryEvents, 'interaction-end').length,
        placeholderCount: await page.locator('.vgl-item--placeholder:visible').count(),
      }
    }
    return {
      commits,
      responsiveCommits,
      geometry,
    }
  },
  expected: {
    commits: {
      'drop-sync': {
        dropCount: 1,
        insertedCount: 1,
        dropCommitUpdatedCount: 1,
        externalUpdatedCount: 0,
        terminalCount: 0,
      },
      'drop-timeout': {
        dropCount: 0,
        insertedCount: 0,
        dropCommitUpdatedCount: 0,
        externalUpdatedCount: 0,
        terminalCount: 0,
      },
    },
    responsiveCommits: {
      'drop-responsive-sync': {
        dropCount: 1,
        insertedCount: 1,
        responsiveInsertedCount: 1,
        dropCommitUpdatedCount: 1,
        externalUpdatedCount: 0,
      },
      'drop-responsive-nested-next-tick': {
        dropCount: 0,
        insertedCount: 1,
        responsiveInsertedCount: 0,
        dropCommitUpdatedCount: 0,
        externalUpdatedCount: 1,
      },
      'drop-responsive-layout-only': {
        dropCount: 0,
        insertedCount: 1,
        responsiveInsertedCount: 0,
        dropCommitUpdatedCount: 0,
        externalUpdatedCount: 0,
      },
    },
    geometry: {
      'geometry-raw-rect': {
        code: 'invalid-config',
        source: 'geometry',
        path: 'containerRect.right',
        revision: null,
        reason: 'invalid-input',
        evaluationIdsMatch: true,
        order: ['error', 'operation-rejected'],
        dropCount: 0,
        terminalCount: 0,
        placeholderCount: 0,
      },
      'geometry-derived-pointer': {
        code: 'derived-geometry-overflow',
        source: 'geometry',
        path: 'pointer.clientX',
        revision: null,
        reason: 'invalid-input',
        evaluationIdsMatch: true,
        order: ['error', 'operation-rejected'],
        dropCount: 0,
        terminalCount: 0,
        placeholderCount: 0,
      },
    },
  },
})

defineFutureContract({
  id: 'E2E-46',
  phase: 'phase-4',
  phaseLabel: 'Phase 4',
  controls: ['invalidate-position-strategy'],
  exercise: async page => {
    await openVariant(page, 'phase-4', 'E2E-46', 'owner-internal-wins', [
      'invalidate-position-strategy',
    ])
    await clickControl(page, 'invalidate-position-strategy')
    await dispatchDndSequence(page, 0.65)
    const internalEvents = await readEvents(page)
    const internalCallbacks = await callbackInputs(page)
    const internalPlaceholderCount = await page.locator('.vgl-item--placeholder:visible').count()

    await openVariant(page, 'phase-4', 'E2E-46', 'owner-drop-to-internal', [
      'invalidate-position-strategy',
    ])
    await dispatchDragEvent(page, 'dragover', 0.65)
    const dropPlaceholderBefore = await page.locator('.vgl-item--placeholder:visible').count()
    await clickControl(page, 'invalidate-position-strategy')
    const ownerEvents = await readEvents(page)
    const dropPlaceholderAfter = await page.locator('.vgl-item--placeholder:visible').count()

    const defaults: Record<string, unknown> = {}
    for (const mode of ['standard-listeners', 'listener-mutation'] as const) {
      await openVariant(page, 'phase-4', 'E2E-46', mode, ['invalidate-position-strategy'])
      const nativeResults = await dispatchDndSequence(page, 0.65)
      await settleBrowser(page)
      const events = await readEvents(page)
      defaults[mode] = {
        nativeResults,
        callbackBeforeDragOver: hasOrderedEvents(events, [
          'fixture-drop-callback',
          'drop-drag-over',
          'drop',
        ]),
        callbackCount: (await callbackInputs(page)).length,
        dropCount: payloads(events, 'drop').length,
      }
    }

    return {
      ownership: {
        internalWins: {
          placeholderCount: internalPlaceholderCount,
          callbackCount: internalCallbacks.length,
          dropDragOverCount: payloads(internalEvents, 'drop-drag-over').length,
          dropCount: payloads(internalEvents, 'drop').length,
          terminalCount: payloads(internalEvents, 'interaction-end').length,
        },
        dropToInternal: {
          placeholderBefore: dropPlaceholderBefore,
          placeholderAfter: dropPlaceholderAfter,
          dragLeaveCount: payloads(ownerEvents, 'drop-drag-leave').length,
          rejectedCount: payloads(ownerEvents, 'operation-rejected').length,
          interactionStartCount: payloads(ownerEvents, 'interaction-start').length,
        },
      },
      defaults,
    }
  },
  expected: {
    ownership: {
      internalWins: {
        placeholderCount: 1,
        callbackCount: 0,
        dropDragOverCount: 0,
        dropCount: 0,
        terminalCount: 0,
      },
      dropToInternal: {
        placeholderBefore: 1,
        placeholderAfter: 1,
        dragLeaveCount: 0,
        rejectedCount: 0,
        interactionStartCount: 1,
      },
    },
    defaults: {
      'standard-listeners': {
        nativeResults: [
          { type: 'dragenter', defaultPrevented: false, dropEffect: 'none' },
          { type: 'dragover', defaultPrevented: true, dropEffect: 'copy' },
          { type: 'drop', defaultPrevented: true, dropEffect: 'copy' },
        ],
        callbackBeforeDragOver: true,
        callbackCount: 1,
        dropCount: 1,
      },
      'listener-mutation': {
        nativeResults: [
          { type: 'dragenter', defaultPrevented: false, dropEffect: 'none' },
          { type: 'dragover', defaultPrevented: true, dropEffect: 'move' },
          { type: 'drop', defaultPrevented: true, dropEffect: 'move' },
        ],
        callbackBeforeDragOver: true,
        callbackCount: 1,
        dropCount: 1,
      },
    },
  },
})
