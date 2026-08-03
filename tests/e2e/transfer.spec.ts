import { expect, test } from '@playwright/test'

import type { Page } from '@playwright/test'

function gridItem(page: Page, grid: number, id: string) {
  return page
    .locator('.demo-panel')
    .nth(grid)
    .locator('.vgl-item:not(.vgl-item--placeholder)')
    .filter({ hasText: id })
}

test.describe('cross-grid transfer', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/cross-grid')
    await expect(page.locator('.demo-panel')).toHaveCount(2)
    await expect(gridItem(page, 0, 'sales')).toBeVisible()
    await page.waitForTimeout(150)
  })

  test('moves a complete item through the real pointer interaction', async ({ page }) => {
    const source = gridItem(page, 0, 'sales')
    const target = page.locator('.demo-panel').nth(1).locator('.vgl-layout')
    const sourceBox = await source.boundingBox()
    const targetBox = await target.boundingBox()
    if (!sourceBox || !targetBox) throw new Error('missing cross-grid geometry')

    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2)
    await page.mouse.down()
    await page.mouse.move(targetBox.x + targetBox.width * 0.7, targetBox.y + 60, { steps: 12 })
    await expect(target.locator('.vgl-item--placeholder:visible')).toHaveCount(1)
    await page.mouse.up()

    await expect(gridItem(page, 0, 'sales')).toHaveCount(0)
    await expect(gridItem(page, 1, 'sales')).toHaveCount(1)
    await expect(page.locator('.demo-toolbar')).toContainText('Moved sales')
  })

  test('Escape clears the target preview and preserves the source item', async ({ page }) => {
    const source = gridItem(page, 0, 'sales')
    const target = page.locator('.demo-panel').nth(1).locator('.vgl-layout')
    const sourceBox = await source.boundingBox()
    const targetBox = await target.boundingBox()
    if (!sourceBox || !targetBox) throw new Error('missing cross-grid geometry')

    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2)
    await page.mouse.down()
    await page.mouse.move(targetBox.x + targetBox.width * 0.7, targetBox.y + 60, { steps: 12 })
    await expect(target.locator('.vgl-item--placeholder:visible')).toHaveCount(1)
    await page.keyboard.press('Escape')
    await expect(target.locator('.vgl-item--placeholder:visible')).toHaveCount(0)
    await page.mouse.up()

    await expect(gridItem(page, 0, 'sales')).toHaveCount(1)
    await expect(gridItem(page, 1, 'sales')).toHaveCount(0)
  })

  test('window blur clears the target preview and preserves the source item', async ({ page }) => {
    const source = gridItem(page, 0, 'sales')
    const target = page.locator('.demo-panel').nth(1).locator('.vgl-layout')
    const sourceBox = await source.boundingBox()
    const targetBox = await target.boundingBox()
    if (!sourceBox || !targetBox) throw new Error('missing cross-grid geometry')

    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2)
    await page.mouse.down()
    await page.mouse.move(targetBox.x + targetBox.width * 0.7, targetBox.y + 60, { steps: 12 })
    await expect(target.locator('.vgl-item--placeholder:visible')).toHaveCount(1)
    await page.evaluate(() => window.dispatchEvent(new Event('blur')))
    await expect(target.locator('.vgl-item--placeholder:visible')).toHaveCount(0)
    await page.mouse.up()

    await expect(gridItem(page, 0, 'sales')).toHaveCount(1)
    await expect(gridItem(page, 1, 'sales')).toHaveCount(0)
  })
})
