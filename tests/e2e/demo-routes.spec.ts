import { readdirSync } from 'node:fs'
import { basename, resolve } from 'node:path'

import { expect, test } from '@playwright/test'

import type { Locator, Page } from '@playwright/test'

interface ScrollbarFixtureMetrics {
  clientWidth: number
  clientHeight: number
  scrollHeight: number
}

const demoRoutes = readdirSync(resolve(process.cwd(), 'docs/demos'))
  .filter(file => file.endsWith('.vue'))
  .map(file => basename(file, '.vue'))
  .sort()

function collectBrowserErrors(page: Page): string[] {
  const errors: string[] = []

  page.on('console', message => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`)
  })
  page.on('pageerror', error => {
    errors.push(`pageerror: ${error.message}`)
  })

  return errors
}

async function settleBrowser(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>(resolveFrame => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolveFrame()))
      }),
  )
}

async function prepareScrollbarFixture(page: Page, app: Locator): Promise<ScrollbarFixtureMetrics> {
  await page.setViewportSize({ width: 1280, height: 900 })
  await app.evaluate(element => {
    const target = element as HTMLElement
    target.style.height = '820px'
    target.style.overflowY = 'auto'
  })
  await settleBrowser(page)

  const metrics = await readScrollbarFixture(app)
  expect(metrics.scrollHeight).toBeLessThanOrEqual(metrics.clientHeight)

  return metrics
}

async function showScrollbarFixture(app: Locator, width: number): Promise<void> {
  await app.evaluate((element, nextWidth) => {
    const target = element as HTMLElement
    const spacer = document.createElement('div')
    spacer.dataset.scrollbarFixture = ''
    spacer.style.cssText = [
      'display:block',
      'flex:none',
      'height:400px',
      'min-height:400px',
      'width:1px',
    ].join(';')
    target.append(spacer)
    target.style.width = `${nextWidth}px`
  }, width)
}

async function hideScrollbarFixture(app: Locator): Promise<void> {
  await app.evaluate(element => {
    const target = element as HTMLElement
    target.querySelector('[data-scrollbar-fixture]')?.remove()
    target.style.removeProperty('width')
  })
}

async function readScrollbarFixture(app: Locator): Promise<ScrollbarFixtureMetrics> {
  return app.evaluate(element => ({
    clientWidth: element.clientWidth,
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }))
}

test('all public demo routes mount without browser errors', async ({ context }) => {
  test.setTimeout(120_000)
  const failures: string[] = []

  for (const route of demoRoutes) {
    const page = await context.newPage()
    const errors = collectBrowserErrors(page)

    try {
      const path = route === 'basic' ? '/' : `/#/${route}`
      const response = await page.goto(path)
      if (!response?.ok()) failures.push(`${route}: navigation returned ${response?.status()}`)

      await expect(page).toHaveTitle(`select - ${route} | Grid Layout Plus`)
      if (route === 'composable-api') {
        await expect(page.locator('.headless-item')).toHaveCount(4)
      } else {
        await expect(page.locator('.vgl-layout')).not.toHaveCount(0)
        await expect(
          page.locator('.vgl-layout > .vgl-item:not(.vgl-item--placeholder)'),
        ).not.toHaveCount(0)
      }
      await settleBrowser(page)
      if (errors.length) failures.push(`${route}: ${errors.join(' | ')}`)
    } catch (error) {
      failures.push(`${route}: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      await page.close()
    }
  }

  expect(failures, failures.join('\n')).toEqual([])
})

test('default demo can navigate after mounting', async ({ page }) => {
  const errors = collectBrowserErrors(page)

  await page.goto('/')
  await expect(page.locator('.vgl-layout')).toHaveCount(1)
  await page.locator('.dev-setting').click()
  await expect(page.locator('.dev-links')).toBeVisible()
  await expect(page.locator('.dev-links')).not.toContainText('contract-fixture')
  await page.goto('/#/composable-api')
  await expect(page).toHaveTitle('select - composable-api | Grid Layout Plus')
  await expect(page.locator('.headless-item')).toHaveCount(4)
  await settleBrowser(page)

  expect(errors).toEqual([])
})

test('allow-overlap drag raises the item without changing its grid position', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/#/allow-overlap')

  const items = page.locator('.vgl-layout > .vgl-item:not(.vgl-item--placeholder)')
  const itemZero = items.filter({ has: page.locator('[data-demo-item="0"]') })
  await expect(itemZero).toHaveCount(1)
  const initial = await itemZero.boundingBox()
  expect(initial).not.toBeNull()
  if (!initial) return

  const initialRanks = await items.evaluateAll(nodes =>
    nodes.map(node => Number.parseInt(getComputedStyle(node).zIndex, 10)),
  )
  expect(initialRanks[0]).toBeLessThan(Math.max(...initialRanks))

  const pointerX = initial.x + initial.width * 0.2
  const pointerY = initial.y + initial.height * 0.2
  await page.mouse.move(pointerX, pointerY)
  await page.mouse.down()
  await page.mouse.move(pointerX + 8, pointerY + 4, { steps: 4 })
  await expect(itemZero).toHaveClass(/vgl-item--dragging/)
  const placeholder = page.locator('.vgl-layout > .vgl-item--placeholder')
  await expect(placeholder).toBeVisible()
  const placeholderBox = await placeholder.boundingBox()
  expect(placeholderBox).not.toBeNull()
  expect(Math.abs(placeholderBox!.x - initial.x)).toBeLessThanOrEqual(2)
  expect(Math.abs(placeholderBox!.y - initial.y)).toBeLessThanOrEqual(2)

  const activeRanks = await items.evaluateAll(nodes =>
    nodes.map(node => Number.parseInt(getComputedStyle(node).zIndex, 10)),
  )
  const placeholderRank = await placeholder.evaluate(node =>
    Number.parseInt(getComputedStyle(node).zIndex, 10),
  )
  expect(activeRanks[0]).toBeGreaterThan(placeholderRank)
  expect(placeholderRank).toBeGreaterThan(Math.max(...activeRanks.slice(1)))

  await page.mouse.up()
  await settleBrowser(page)

  await expect
    .poll(async () => {
      const current = await itemZero.boundingBox()
      return current ? Math.abs(current.x - initial.x) : Number.POSITIVE_INFINITY
    })
    .toBeLessThanOrEqual(2)
  const released = await itemZero.boundingBox()
  expect(released).not.toBeNull()
  expect(Math.abs(released!.x - initial.x)).toBeLessThanOrEqual(2)
  expect(Math.abs(released!.y - initial.y)).toBeLessThanOrEqual(2)
  const releasedRanks = await items.evaluateAll(nodes =>
    nodes.map(node => Number.parseInt(getComputedStyle(node).zIndex, 10)),
  )
  expect(releasedRanks[0]).toBe(Math.max(...releasedRanks))
})

test('default drag commits the last previewed layout without release-only reflow', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')

  const items = page.locator('.vgl-layout > .vgl-item:not(.vgl-item--placeholder)')
  const item = page
    .locator('.vgl-layout > .vgl-item:not(.vgl-item--placeholder)')
    .filter({ hasText: /^16$/ })
  await expect(item).toHaveCount(1)
  const itemZero = items.filter({ hasText: /^0$/ })
  const itemSix = items.filter({ hasText: /^6$/ })
  const [itemZeroBox, itemSixBox] = await Promise.all([
    itemZero.boundingBox(),
    itemSix.boundingBox(),
  ])
  expect(itemZeroBox).not.toBeNull()
  expect(itemSixBox).not.toBeNull()
  expect(
    Math.abs(itemSixBox!.y - (itemZeroBox!.y + itemZeroBox!.height + 10)),
    'item 6 should be vertically compacted directly below item 0 before interaction',
  ).toBeLessThanOrEqual(1)
  const positionsBefore = await items.evaluateAll(nodes =>
    Object.fromEntries(
      nodes.map(node => {
        const box = node.getBoundingClientRect()
        return [node.textContent?.trim() ?? '', { x: box.x, y: box.y }]
      }),
    ),
  )
  const initial = await item.boundingBox()
  const itemFifteen = items.filter({ hasText: /^15$/ })
  const itemFifteenBox = await itemFifteen.boundingBox()
  expect(initial).not.toBeNull()
  expect(itemFifteenBox).not.toBeNull()
  if (!initial || !itemFifteenBox) return

  const centerX = initial.x + initial.width / 2
  const centerY = initial.y + initial.height / 2
  const columnPitch = (initial.x - itemFifteenBox.x) / 2
  await page.mouse.move(centerX, centerY)
  await page.mouse.down()
  await page.mouse.move(centerX + 8, centerY)

  const placeholder = page.locator('.vgl-layout > .vgl-item--placeholder')
  await expect(item).toHaveClass(/vgl-item--dragging/)
  await expect(placeholder).toBeVisible()
  const positionsAfterLift = await items.evaluateAll(nodes =>
    Object.fromEntries(
      nodes.map(node => {
        const box = node.getBoundingClientRect()
        return [node.textContent?.trim() ?? '', { x: box.x, y: box.y }]
      }),
    ),
  )
  for (const [id, before] of Object.entries(positionsBefore)) {
    if (id === '16') continue
    expect(Math.abs(positionsAfterLift[id].x - before.x), `${id} x after lift`).toBeLessThanOrEqual(
      0.5,
    )
    expect(Math.abs(positionsAfterLift[id].y - before.y), `${id} y after lift`).toBeLessThanOrEqual(
      0.5,
    )
  }

  await page.mouse.move(centerX - columnPitch * 3, centerY + 160, { steps: 8 })
  await settleBrowser(page)

  const preview = await page.locator('.vgl-layout').evaluate(layout => {
    const active = layout.querySelector<HTMLElement>(':scope > .vgl-item--dragging')
    const placeholder = layout.querySelector<HTMLElement>(':scope > .vgl-item--placeholder')
    if (!active || !placeholder) return null
    const placeholderBox = placeholder.getBoundingClientRect()
    if (!placeholderBox.width || !placeholderBox.height) return null
    const activeId = active.textContent?.trim()
    return Object.fromEntries(
      Array.from(
        layout.querySelectorAll<HTMLElement>(':scope > .vgl-item:not(.vgl-item--placeholder)'),
      ).map(node => {
        const id = node.textContent?.trim() ?? ''
        const box = id === activeId ? placeholderBox : node.getBoundingClientRect()
        return [id, { x: box.x, y: box.y }]
      }),
    )
  })

  expect(preview).not.toBeNull()
  expect(
    Math.max(Math.abs(preview!['16'].x - initial.x), Math.abs(preview!['16'].y - initial.y)),
    'the drag should preview a different accepted position',
  ).toBeGreaterThan(2)

  await page.mouse.up()
  await settleBrowser(page)

  const finalPositions = await items.evaluateAll(nodes =>
    Object.fromEntries(
      nodes.map(node => {
        const box = node.getBoundingClientRect()
        return [node.textContent?.trim() ?? '', { x: box.x, y: box.y }]
      }),
    ),
  )
  for (const [id, expected] of Object.entries(preview!)) {
    expect(Math.abs(finalPositions[id].x - expected.x), `${id} released x`).toBeLessThanOrEqual(2)
    expect(Math.abs(finalPositions[id].y - expected.y), `${id} released y`).toBeLessThanOrEqual(2)
  }
})

test('default drag animates passive items while the active item follows the pointer', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/')
  await page.waitForTimeout(250)

  const itemFifteen = page
    .locator('.vgl-layout > .vgl-item:not(.vgl-item--placeholder)')
    .filter({ hasText: /^15$/ })
  const itemSixteen = page
    .locator('.vgl-layout > .vgl-item:not(.vgl-item--placeholder)')
    .filter({ hasText: /^16$/ })
  const initialPassive = await itemFifteen.boundingBox()
  const initialActive = await itemSixteen.boundingBox()
  expect(initialPassive).not.toBeNull()
  expect(initialActive).not.toBeNull()
  if (!initialPassive || !initialActive) return

  await itemFifteen.evaluate(node => {
    const target = node as HTMLElement & {
      __vglMotionProbe?: { ended: boolean; samples: number[] }
    }
    const probe = { ended: false, samples: [] as number[] }
    target.__vglMotionProbe = probe
    const sample = () => {
      probe.samples.push(target.getBoundingClientRect().y)
      if (!probe.ended) requestAnimationFrame(sample)
    }
    target.addEventListener('transitionend', event => {
      if (event.target !== target || event.propertyName !== 'transform') return
      probe.samples.push(target.getBoundingClientRect().y)
      probe.ended = true
    })
    requestAnimationFrame(sample)
  })

  await page.mouse.move(
    initialActive.x + initialActive.width / 2,
    initialActive.y + initialActive.height / 2,
  )
  await page.mouse.down()
  await page.mouse.move(
    initialPassive.x + initialPassive.width / 2,
    initialPassive.y + initialPassive.height / 2,
  )

  const activeDuringDrag = await itemSixteen.boundingBox()
  expect(activeDuringDrag).not.toBeNull()
  expect(Math.abs(activeDuringDrag!.x - initialPassive.x)).toBeLessThanOrEqual(2)

  await expect
    .poll(() =>
      itemFifteen.evaluate(node => {
        const target = node as HTMLElement & {
          __vglMotionProbe?: { ended: boolean; samples: number[] }
        }
        return target.__vglMotionProbe?.ended ?? false
      }),
    )
    .toBe(true)
  const passiveSamples = await itemFifteen.evaluate(node => {
    const target = node as HTMLElement & {
      __vglMotionProbe?: { ended: boolean; samples: number[] }
    }
    return target.__vglMotionProbe?.samples ?? []
  })
  const passivePreviewY = passiveSamples.at(-1)
  expect(passivePreviewY).toBeDefined()
  expect(passivePreviewY! - initialPassive.y).toBeGreaterThan(100)
  expect(passiveSamples.some(y => y - initialPassive.y > 2 && passivePreviewY! - y > 2)).toBe(true)

  await page.mouse.up()
  await page.waitForTimeout(240)
  const releasedActive = await itemSixteen.boundingBox()
  expect(releasedActive).not.toBeNull()
  expect(Math.abs(releasedActive!.x - initialPassive.x)).toBeLessThanOrEqual(2)
})

test('default vertical compaction previews and commits the gap-free position', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')

  const item = page
    .locator('.vgl-layout > .vgl-item:not(.vgl-item--placeholder)')
    .filter({ hasText: /^15$/ })
  const blocker = page
    .locator('.vgl-layout > .vgl-item:not(.vgl-item--placeholder)')
    .filter({ hasText: /^9 · Static$/ })
  const [initial, blockerBox] = await Promise.all([item.boundingBox(), blocker.boundingBox()])
  expect(initial).not.toBeNull()
  expect(blockerBox).not.toBeNull()
  if (!initial || !blockerBox) return

  expect(
    Math.abs(initial.y - (blockerBox.y + blockerBox.height + 10)),
    'item 15 should start directly below static item 9',
  ).toBeLessThanOrEqual(1)

  const centerX = initial.x + initial.width / 2
  const centerY = initial.y + initial.height / 2
  await page.mouse.move(centerX, centerY)
  await page.mouse.down()
  await page.mouse.move(centerX, centerY + 100, { steps: 8 })
  await settleBrowser(page)

  const draggedPlaceholder = await page
    .locator('.vgl-layout > .vgl-item--placeholder')
    .boundingBox()
  const draggedItem = await item.boundingBox()
  expect(draggedPlaceholder).not.toBeNull()
  expect(draggedItem).not.toBeNull()
  expect(
    Math.abs(draggedPlaceholder!.y - initial.y),
    'the placeholder should already preview the gap-free position',
  ).toBeLessThanOrEqual(2)
  expect(
    draggedItem!.y - initial.y,
    'the native item should still follow the downward pointer',
  ).toBeGreaterThan(2)

  await page.mouse.up()
  await settleBrowser(page)

  const final = await item.boundingBox()
  expect(final).not.toBeNull()
  expect(Math.abs(final!.x - initial.x), 'released item x').toBeLessThanOrEqual(2)
  expect(Math.abs(final!.y - initial.y), 'released item y').toBeLessThanOrEqual(2)
})

test('default drag survives container scrollbar appearance and disappearance', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')

  const app = page.locator('#app')
  const itemZero = page
    .locator('.vgl-layout > .vgl-item:not(.vgl-item--placeholder)')
    .filter({ hasText: /^0$/ })
  const itemSixteen = page
    .locator('.vgl-layout > .vgl-item:not(.vgl-item--placeholder)')
    .filter({ hasText: /^16$/ })
  const initialApp = await prepareScrollbarFixture(page, app)
  const initialItem = await itemSixteen.boundingBox()
  const targetItem = await itemZero.boundingBox()
  expect(initialItem).not.toBeNull()
  expect(targetItem).not.toBeNull()
  if (!initialItem || !targetItem) return

  await page.mouse.move(
    initialItem.x + initialItem.width / 2,
    initialItem.y + initialItem.height / 2,
  )
  await page.mouse.down()
  await page.mouse.move(
    (initialItem.x + targetItem.x) / 2 + initialItem.width / 2,
    (initialItem.y + targetItem.y) / 2 + initialItem.height / 2,
    { steps: 20 },
  )
  await showScrollbarFixture(app, initialApp.clientWidth - 15)
  await settleBrowser(page)
  await page.mouse.move(targetItem.x + targetItem.width / 2, targetItem.y + targetItem.height / 2, {
    steps: 20,
  })
  await page.mouse.up()
  await settleBrowser(page)

  const movedItem = await itemSixteen.boundingBox()
  const expandedApp = await readScrollbarFixture(app)
  expect(movedItem).not.toBeNull()
  expect(
    Math.abs(movedItem!.x - targetItem.x),
    'drag should reach the first column',
  ).toBeLessThanOrEqual(2)
  expect(expandedApp.scrollHeight).toBeGreaterThan(expandedApp.clientHeight)
  expect(expandedApp.clientWidth).toBeLessThan(initialApp.clientWidth)

  await page.mouse.move(movedItem!.x + movedItem!.width / 2, movedItem!.y + movedItem!.height / 2)
  await page.mouse.down()
  await page.mouse.move(
    (movedItem!.x + initialItem.x) / 2 + movedItem!.width / 2,
    (movedItem!.y + initialItem.y) / 2 + movedItem!.height / 2,
    { steps: 20 },
  )
  await hideScrollbarFixture(app)
  await settleBrowser(page)
  await page.mouse.move(
    initialItem.x + initialItem.width / 2,
    initialItem.y + initialItem.height / 2,
    { steps: 20 },
  )
  await page.mouse.up()
  await settleBrowser(page)

  const restoredItem = await itemSixteen.boundingBox()
  const restoredApp = await readScrollbarFixture(app)
  expect(restoredItem).not.toBeNull()
  expect(
    Math.abs(restoredItem!.x - initialItem.x),
    'drag should reach the original column',
  ).toBeLessThanOrEqual(2)
  expect(
    Math.abs(restoredItem!.y - initialItem.y),
    'drag should restore the original row',
  ).toBeLessThanOrEqual(2)
  expect(restoredApp.scrollHeight).toBeLessThanOrEqual(restoredApp.clientHeight)
  expect(restoredApp.clientWidth).toBe(initialApp.clientWidth)
})

test('default resize survives container scrollbar appearance and disappearance', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')

  const app = page.locator('#app')
  const itemZero = page
    .locator('.vgl-layout > .vgl-item:not(.vgl-item--placeholder)')
    .filter({ hasText: /^0$/ })
  const handle = itemZero.locator('.vgl-item__resizer--se')
  const initialApp = await prepareScrollbarFixture(page, app)
  const initialItem = await itemZero.boundingBox()
  const initialHandle = await handle.boundingBox()
  expect(initialItem).not.toBeNull()
  expect(initialHandle).not.toBeNull()
  if (!initialItem || !initialHandle) return

  await page.mouse.move(
    initialHandle.x + initialHandle.width / 2,
    initialHandle.y + initialHandle.height / 2,
  )
  await page.mouse.down()
  await page.mouse.move(
    initialHandle.x + initialHandle.width / 2,
    initialHandle.y + initialHandle.height / 2 + 80,
    { steps: 20 },
  )
  await showScrollbarFixture(app, initialApp.clientWidth - 15)
  await settleBrowser(page)
  await page.mouse.move(
    initialHandle.x + initialHandle.width / 2,
    initialHandle.y + initialHandle.height / 2 + 160,
    { steps: 20 },
  )
  await page.mouse.up()
  await settleBrowser(page)

  const expandedItem = await itemZero.boundingBox()
  const expandedHandle = await handle.boundingBox()
  const expandedApp = await readScrollbarFixture(app)
  expect(expandedItem).not.toBeNull()
  expect(expandedHandle).not.toBeNull()
  expect(expandedItem!.height - initialItem.height).toBeGreaterThanOrEqual(158)
  expect(expandedApp.scrollHeight).toBeGreaterThan(expandedApp.clientHeight)
  expect(expandedApp.clientWidth).toBeLessThan(initialApp.clientWidth)

  await page.mouse.move(
    expandedHandle!.x + expandedHandle!.width / 2,
    expandedHandle!.y + expandedHandle!.height / 2,
  )
  await page.mouse.down()
  await page.mouse.move(
    expandedHandle!.x + expandedHandle!.width / 2,
    expandedHandle!.y + expandedHandle!.height / 2 - 80,
    { steps: 20 },
  )
  await hideScrollbarFixture(app)
  await settleBrowser(page)
  await page.mouse.move(
    expandedHandle!.x + expandedHandle!.width / 2,
    expandedHandle!.y + expandedHandle!.height / 2 - 160,
    { steps: 20 },
  )
  await page.mouse.up()
  await settleBrowser(page)

  const restoredItem = await itemZero.boundingBox()
  const restoredApp = await readScrollbarFixture(app)
  expect(restoredItem).not.toBeNull()
  expect(Math.abs(restoredItem!.height - initialItem.height)).toBeLessThanOrEqual(2)
  expect(restoredApp.scrollHeight).toBeLessThanOrEqual(restoredApp.clientHeight)
  expect(restoredApp.clientWidth).toBe(initialApp.clientWidth)
})
