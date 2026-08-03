import { expect, test } from '@playwright/test'

import type { Locator, Page } from '@playwright/test'

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

async function readLayoutHeight(locator: Locator): Promise<number> {
  const text = (await locator.textContent()) ?? ''
  const match = text.match(/h=(\d+)/)
  return match ? Number(match[1]) : Number.NaN
}

test('basic reset restores the first canonical layout after a committed drag', async ({ page }) => {
  const errors: string[] = []

  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', error => {
    errors.push(error.message)
  })

  const response = await page.goto('/#/basic')
  expect(response?.ok()).toBe(true)
  await expect(page.locator('.demo-root')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reset layout' })).toBeEnabled()

  const grid = page.locator('.demo-grid')
  const item = page
    .locator('.demo-grid > .vgl-item:not(.vgl-item--placeholder)')
    .filter({ hasText: /^0$/ })

  await expect
    .poll(async () => {
      const box = await grid.boundingBox()
      return box?.height ?? 0
    })
    .toBeGreaterThan(500)

  const before = await item.boundingBox()

  expect(before).not.toBeNull()
  if (!before) return

  const startX = before.x + before.width / 2
  const startY = before.y + before.height / 2
  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX + 8, startY + 8, { steps: 2 })
  await page.mouse.move(startX + 230, startY + 180, { steps: 12 })
  await page.mouse.up()

  await expect
    .poll(async () => {
      const current = await item.boundingBox()
      return current
        ? Math.abs(current.x - before.x) > 100 && Math.abs(current.y - before.y) > 100
        : false
    })
    .toBe(true)

  await page.getByRole('button', { name: 'Reset layout' }).click()

  await expect
    .poll(async () => {
      const current = await item.boundingBox()
      return current
        ? Math.abs(current.x - before.x) <= 2 && Math.abs(current.y - before.y) <= 2
        : false
    })
    .toBe(true)

  expect(errors).toEqual([])
})

test('custom external source completes the public native drop flow', async ({ page }) => {
  const errors: string[] = []

  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', error => {
    errors.push(error.message)
  })

  const response = await page.goto('/#/drag-from-outside')
  expect(response?.ok()).toBe(true)

  const grid = page.locator('.demo-grid')
  const items = grid.locator(':scope > .vgl-item:not(.vgl-item--placeholder)')
  await expect(items).toHaveCount(4)

  const gridBox = await grid.boundingBox()
  expect(gridBox).not.toBeNull()
  if (!gridBox) return
  const targetPosition = {
    x: gridBox.width / 2,
    y: Math.min(60, gridBox.height / 2),
  }

  await page.locator('[data-source="note"]').dragTo(grid, { targetPosition })

  await expect(items).toHaveCount(5)
  await expect(page.locator('.demo-state--success')).toContainText('Dropped Note · external-1')

  await page.locator('[data-source="blocked"]').dragTo(grid, { targetPosition })

  await expect(items).toHaveCount(5)
  await expect(page.locator('.demo-state--warning')).toContainText('Restricted by source policy')
  expect(errors).toEqual([])
})

test('auto-height demo grows, shrinks, and reflows the following item', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const errors = collectBrowserErrors(page)
  const response = await page.goto('/#/auto-height')
  expect(response?.ok()).toBe(true)

  const grid = page.locator('.auto-height-grid')
  const visibleItems = grid.locator(':scope > .vgl-item:not(.vgl-item--placeholder)')
  const autoItem = visibleItems.filter({
    has: page.locator('[data-auto-height-item="details"]'),
  })
  const followerItem = visibleItems.filter({
    has: page.locator('[data-auto-height-item="follower"]'),
  })
  const autoHeightState = page.locator('[data-layout-height="details"]')

  await expect(visibleItems).toHaveCount(2)

  const initialAutoRows = await readLayoutHeight(autoHeightState)
  const initialAutoBox = await autoItem.boundingBox()
  const initialFollowerBox = await followerItem.boundingBox()
  expect(initialAutoRows).toBeGreaterThan(0)
  expect(initialAutoBox).not.toBeNull()
  expect(initialFollowerBox).not.toBeNull()
  if (!initialAutoBox || !initialFollowerBox) return

  await page.getByRole('button', { name: 'Show details' }).click()
  await expect.poll(() => readLayoutHeight(autoHeightState)).toBeGreaterThan(initialAutoRows)
  await expect
    .poll(async () => (await autoItem.boundingBox())?.height ?? 0)
    .toBeGreaterThan(initialAutoBox.height + 20)
  await expect
    .poll(async () => (await followerItem.boundingBox())?.y ?? 0)
    .toBeGreaterThan(initialFollowerBox.y + 20)

  await page.getByRole('button', { name: 'Hide details' }).click()
  await expect.poll(() => readLayoutHeight(autoHeightState)).toBe(initialAutoRows)
  await expect
    .poll(async () =>
      Math.abs(((await autoItem.boundingBox())?.height ?? 0) - initialAutoBox.height),
    )
    .toBeLessThanOrEqual(2)
  await expect
    .poll(async () => Math.abs(((await followerItem.boundingBox())?.y ?? 0) - initialFollowerBox.y))
    .toBeLessThanOrEqual(2)

  expect(errors).toEqual([])
})

test('custom resize handles follow configured axes and complete pointer resize', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const errors = collectBrowserErrors(page)
  const response = await page.goto('/#/custom-resize-handles')
  expect(response?.ok()).toBe(true)

  await expect(
    page.locator('[data-testid="custom-resize-handle"][data-resize-item="0"]'),
  ).toHaveCount(8)
  await expect(
    page.locator('[data-testid="custom-resize-handle"][data-resize-item="1"]'),
  ).toHaveCount(3)
  await expect(
    page.locator('[data-testid="custom-resize-handle"][data-resize-item="2"]'),
  ).toHaveCount(3)

  const item = page
    .locator('.demo-grid > .vgl-item:not(.vgl-item--placeholder)')
    .filter({ has: page.locator('[data-custom-resize-item="1"]') })
  const southVisual = page.locator(
    '[data-testid="custom-resize-handle"][data-resize-item="1"][data-resize-axis="s"][data-resize-direction="s"]',
  )
  const southHandle = southVisual.locator('..')
  const before = await item.boundingBox()
  const handleBox = await southHandle.boundingBox()
  expect(before).not.toBeNull()
  expect(handleBox).not.toBeNull()
  if (!before || !handleBox) return

  const startX = handleBox.x + handleBox.width / 2
  const startY = handleBox.y + handleBox.height / 2
  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX, startY - 50, { steps: 8 })
  await expect(item).toHaveClass(/vgl-item--resizing/)
  await page.mouse.up()

  await expect
    .poll(async () => (await item.boundingBox())?.height ?? Number.POSITIVE_INFINITY)
    .toBeLessThan(before.height - 20)
  await expect(page.locator('.demo-state')).toContainText('Resized item 1')
  expect(errors).toEqual([])
})
