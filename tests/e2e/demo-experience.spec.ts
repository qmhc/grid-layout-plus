import { expect, test } from '@playwright/test'

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
