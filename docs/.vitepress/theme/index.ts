import { h } from 'vue'
import Theme from 'vitepress/theme'
import { install } from 'vexip-ui'
import { GridLayout, GridItem } from 'grid-layout-plus'
import { toCapitalCase } from '@vexip-ui/utils'

import 'vexip-ui/css/index.css'
import 'vexip-ui/css/dark/index.css'
import './style.css'

import type { App } from 'vue'

const demos = import.meta.glob('../../demos/*.vue', { eager: true })

export default {
  ...Theme,
  Layout: () => {
    return h(Theme.Layout, null, {
      // https://vitepress.dev/guide/extending-default-theme#layout-slots
    })
  },
  enhanceApp({ app }: { app: App }) {
    app.use(install)
    app.component('GridLayout', GridLayout)
    app.component('GridItem', GridItem)

    Object.keys(demos).forEach(path => {
      const name = toCapitalCase(path.split('/').at(-1)!.replace(/.vue$/, ''))

      app.component(`Demo${name}`, (demos[path] as any).default)
    })
  }
}
