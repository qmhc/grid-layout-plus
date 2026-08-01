import '../../src/style.scss'

import { createSSRApp } from 'vue'

import { SsrFixture } from './ssr-fixture'

import type { SsrFixtureInput } from './ssr-fixture'

const root = document.querySelector<HTMLElement>('#app')
const inputNode = document.querySelector<HTMLScriptElement>('#contract-ssr-input')

if (root && inputNode?.textContent) {
  const initialItem = root.querySelector<HTMLElement>('.vgl-item')
  const initialLayout = root.querySelector<HTMLElement>('.vgl-layout')
  ;(
    globalThis as typeof globalThis & {
      __GLP_SSR_INITIAL_STATE__?: {
        rootHeight: string
        itemGeometry: Record<string, string>
      }
    }
  ).__GLP_SSR_INITIAL_STATE__ = {
    rootHeight: initialLayout?.style.height ?? '',
    itemGeometry: {
      position: initialItem?.style.position ?? '',
      top: initialItem?.style.top ?? '',
      left: initialItem?.style.left ?? '',
      right: initialItem?.style.right ?? '',
      transform: initialItem?.style.transform ?? '',
      width: initialItem?.style.width ?? '',
      height: initialItem?.style.height ?? '',
    },
  }
  ;(
    globalThis as typeof globalThis & {
      __GLP_SSR_ITEM__?: Element | null
    }
  ).__GLP_SSR_ITEM__ = initialItem

  const hydrationErrors: string[] = []
  ;(
    globalThis as typeof globalThis & {
      __GLP_SSR_HYDRATION_ERRORS__?: string[]
    }
  ).__GLP_SSR_HYDRATION_ERRORS__ = hydrationErrors
  const input = JSON.parse(inputNode.textContent) as SsrFixtureInput
  const app = createSSRApp(SsrFixture, {
    input,
  })
  app.config.warnHandler = message => {
    hydrationErrors.push(message)
  }
  app.config.errorHandler = error => {
    hydrationErrors.push(error instanceof Error ? error.message : String(error))
  }
  app.mount(root)
}
