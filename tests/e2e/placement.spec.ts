import { expect, test } from '@playwright/test'

import type { Page } from '@playwright/test'

async function paint(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>(resolve => {
        requestAnimationFrame(() =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        )
      }),
  )
}

for (const preexisting of [false, true]) {
  test(`同 tick ${preexisting ? '挂载并移动预存项' : '新增元素'}不产生首次定位动画，后续移动保留动画`, async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(`/?preexisting=${preexisting}#/__e2e/placement`)
    await expect(page.locator('[data-placement-item="b"]')).toBeVisible()
    await paint(page)
    await page.locator('[data-placement-add]').click()
    const item = page.locator('[data-placement-item="c"]')
    await expect(item).toBeVisible()
    await paint(page)
    await expect(page.locator('[data-placement-transitions]')).toHaveText('0')
    // 检查已实际到达 inline 声明的位置，避免只验证动画事件遗漏。
    const placed = await item.evaluate(element => {
      const inline = new DOMMatrix((element as HTMLElement).style.transform)
      const computed = new DOMMatrix(getComputedStyle(element).transform)
      return inline.m41 > 0 && Math.abs(inline.m41 - computed.m41) < 1
    })
    expect(placed).toBe(true)

    await page.locator('[data-placement-move]').click()
    await expect
      .poll(async () => Number(await page.locator('[data-placement-transitions]').textContent()))
      .toBeGreaterThan(0)
    expect(errors).toEqual([])
  })
}
